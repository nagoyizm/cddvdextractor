# Arquitectura — DVD & CD Audio Extractor

Referencia técnica de cómo está construida la aplicación. Para contexto de negocio/factibilidad ver [FACTIBILIDAD.md](FACTIBILIDAD.md); para el estado actual del trabajo ver [CURRENT_WORK.md](CURRENT_WORK.md).

## 1. Stack y topología de procesos

Aplicación de escritorio **Electron** (Windows x64 únicamente) con tres procesos clásicos:

```
┌─────────────────────────┐      IPC (ipcMain.handle / webContents.send)      ┌──────────────────────────┐
│   Main process (Node)   │ ◄───────────────────────────────────────────────► │  Preload (contextBridge)  │
│   src/main/*.ts          │                                                   │  src/preload/preload.ts   │
└──────────────┬───────────┘                                                   └─────────────┬────────────┘
               │ spawn()                                                                      │ window.electronAPI
      ┌────────┴────────┐                                                          ┌──────────▼───────────┐
      │ ffmpeg.exe       │                                                          │ Renderer (React 18)   │
      │ powershell.exe   │                                                          │ src/renderer/*.tsx     │
      │ (SPTI nativo C#) │                                                          └────────────────────────┘
      └──────────────────┘
```

- **Main** (`src/main/main.ts`): dueño del ciclo de vida de la app, la `BrowserWindow`, los diálogos nativos (`dialog`, `shell`) y el registro de todos los canales IPC. `nodeIntegration: false` / `contextIsolation: true`; el renderer nunca toca Node directamente.
- **Preload** (`src/preload/preload.ts`): única puerta de entrada expuesta al renderer vía `contextBridge.exposeInMainWorld('electronAPI', api)`. Tipado compartido en `src/shared/types.ts`.
- **Renderer** (`src/renderer/`): React 18 + Vite, sin router ni librería de estado — todo el estado vive en `App.tsx` con `useState`/`useEffect` y baja por props a los componentes de `src/renderer/components/`.

Build: Vite compila el renderer a `dist/renderer/`, `tsc -p tsconfig.main.json` compila main+preload a `dist/main/` y `dist/preload/`. `electron-builder.yml` empaqueta `dist/**` + `package.json` y copia `resources/bin/**` como `extraResources` → `resources/bin` en el paquete final.

## 2. Módulos del proceso Main

| Módulo | Responsabilidad |
|---|---|
| `driveDetector.ts` | Enumera unidades ópticas y determina si hay medio cargado y de qué tipo. |
| `discScanner.ts` | Dado un `OpticalDrive`, construye la lista de `AudioTrack[]` y busca metadatos iniciales. |
| `transcoder.ts` | Orquesta la extracción física (CD) o el corte (DVD) y la transcodificación vía FFmpeg, reportando progreso. |
| `metadataService.ts` | Cliente HTTP hacia Discogs y MusicBrainz/Cover Art Archive. |

### 2.1 DriveDetector (`src/main/driveDetector.ts`)

1. Ejecuta `Get-CimInstance Win32_CDROMDrive` vía `powershell -Command ... | ConvertTo-Json` para listar unidades físicas (letra, caption, `MediaLoaded`, `VolumeName`, `Size`).
2. Por cada unidad, decide `mediaType` con `detectMediaType()`: busca `VIDEO_TS/` (con `.VOB`/`.IFO`) → `DVD-Video`; `AUDIO_TS/` (con `.AOB`) → `DVD-Audio`; archivos `.cda` → `CD-DA`; carpeta vacía con medio cargado → se asume `CD-DA`; cualquier otra cosa → `Data-Disc`/`Unknown`.
3. **Fallback de respaldo**: además escanea manualmente las letras `D:`–`H:` buscando `VIDEO_TS`/`AUDIO_TS`, por si la consulta WMI falla o no reporta la unidad (frecuente en VMs/drives virtuales).
4. `ejectDrive()` usa el COM object `WMPlayer.OCX` vía PowerShell para abrir la bandeja.

No hay acceso SPTI en este módulo — solo heurísticas de sistema de archivos y WMI.

### 2.2 DiscScanner (`src/main/discScanner.ts`)

Construye `AudioTrack[]` según el tipo de medio:

- **CD-DA**: lee los archivos `.cda` del volumen (son punteros virtuales de Windows, no audio). De cada uno extrae con lectura binaria directa: número de pista (offset 22, `UInt16LE`), sector de inicio y cantidad de frames (offsets 28/32), de donde derivan `startSector`/`endSector` (en frames CDDA, 75/seg) y la duración. Si no hay `.cda` visibles, genera 12 pistas de muestra (`generateSampleTracks`).
- **DVD-Video**: lee `VIDEO_TS/`, agrupa los `.VOB` por prefijo de Title Set (`VTS_01`, `VTS_02`, ...) y elige el set de mayor tamaño total (se asume el contenido principal, ej. un concierto). Si existe el `.IFO` del set, lo **parsea en binario** a mano (sin `libdvdread`) para leer:
  - Atributos de audio en offset `0x0140` (códec: AC-3/LPCM/DTS, canales).
  - La tabla PGC (Program Chain) para la duración total.
  - **Capítulos reales vía Program Map** (no vía conteo de celdas): lee `nr_of_programs` (`pgc1+0x02`) y el *Program Map* (`pgc1+0xE6`, 1 byte por programa = celda inicial 1-based de ese capítulo/canción), agrupando y sumando las duraciones de celda (`pgc1+0xE8`, entradas de `0x18` bytes) que caen dentro de cada programa. Esto es necesario porque en el estándar DVD-Video un capítulo (programa) puede abarcar varias celdas, o el disco entero puede tener una sola celda de video con los cortes de canción definidos solo en el Program Map — tratar "número de celdas" como "número de canciones" (como se hacía antes) rompe exactamente en ese caso, muy común en DVDs de concierto/en vivo.
  - Si el disco no define `nr_of_programs > 1`, usa las celdas individuales como respaldo (mejor que nada, aunque no garantiza alinear con canciones).
  - Solo si ninguna de las dos fuentes anteriores da resultado, **divide la duración total en 12 partes iguales** como pistas sintéticas (último recurso; no son cortes reales de contenido, solo una partición temporal — ver también `CURRENT_WORK.md`).
- **DVD-Audio**: no hay parser real de `.AOB`/MLP; genera un número de pistas sintéticas proporcional a la cantidad de archivos `.AOB` con metadatos de ejemplo (`MLP Lossless 24-bit 192kHz`).
- Tras escanear, intenta enriquecer con metadatos:
  - Para CD-DA con sectores válidos: calcula el TOC (offsets + leadout, convención MusicBrainz DiscID) y llama `metadataService.searchByToc()`.
  - Si el nombre de volumen no es genérico (`isGenericTitle()`), llama `metadataService.searchAlbum()` como fallback/complemento y remapea títulos de pista por índice.

### 2.3 TranscoderService (`src/main/transcoder.ts`)

Pieza central del pipeline de extracción. Mantiene estado de instancia (`isBusy`, `isCancelled`, proceso activo, archivo temporal) — **solo soporta una extracción concurrente**.

**Resolución de binarios** (`getFfmpegPath`, `getRipScriptPath`): prioridad `resourcesPath/bin/ffmpeg.exe` (app empaquetada) → `./resources/bin/ffmpeg.exe` (dev) → carpeta de winget Gyan.FFmpeg en `%LOCALAPPDATA%` → `ffmpeg` del `PATH` del sistema.

**`extractTracks(config, sourceDrive, onProgress)`**: itera las pistas seleccionadas, construye el nombre de archivo desde `fileNamePattern` (placeholders `{track} {title} {artist} {album}`, saneando caracteres inválidos de Windows), y delega cada pista a `transcodeSingleTrack`. Reporta `ExtractionProgress` granular (pista actual, % de pista, % global, velocidad, ETA, fase, log) vía el callback, que en `main.ts` se reenvía al renderer por `webContents.send('extraction:progress', ...)`.

**`transcodeSingleTrack` — dos caminos de entrada según el tipo de pista:**

1. **DVD** (`track.startTimecode` presente): reconstruye la ruta del Title Set principal en `VIDEO_TS/`, concatena sus `.VOB` con la sintaxis `concat:a|b|c` de FFmpeg si hay más de uno, y llama a FFmpeg directo con `-ss <timecode> -i concat:... -t <duracion> -map 0:a:<streamIndex>`. La decodificación CSS corre dentro de FFmpeg vía `libdvdcss-2.dll` (ver §3).
2. **CD-DA** (`track.startSector`/`endSector` presentes): primero extrae los sectores crudos a un WAV temporal invocando `ripCdTrack()` (ver §4), y solo entonces lanza FFmpeg tomando ese WAV como entrada (`-i tempWavPath`). El progreso de esta fase se mapea a 0–70% de la pista; la codificación FFmpeg ocupa 70–99%.

**Postprocesado FFmpeg común a ambos caminos:**
- Downmix a estéreo (`-ac 2`) si `qualitySettings.downmixToStereo`.
- Resample (`-ar <rate>`) si se especifica un sample rate distinto de "mantener original".
- Selección de códec/calidad por `outputFormat`: `flac` (`-sample_fmt s16/s32`, `-compression_level`), `wav` (`pcm_s16le`/`pcm_s24le`), `mp3` (`libmp3lame`, CBR o VBR V0), `aac` (`-b:a`), `opus` (`libopus` 128k fijo), `ogg` (`libvorbis -q:a 6`).
- Inyección de metadatos vía `-metadata title=/artist=/album=/track=/date=/genre=`.
- `PATH` del proceso hijo se prepende con la carpeta de `ffmpeg.exe` para que resuelva `libdvdcss-2.dll`; se setean `DVDCSS_METHOD=key` y `DVDCSS_VERBOSE=0`.
- El progreso se parsea de `stderr` de FFmpeg con regex sobre `time=HH:MM:SS.ms` y `speed=Nx`.

**Cancelación** (`cancelExtraction`): en Windows usa `taskkill /pid <pid> /T /F` para matar el árbol de procesos (FFmpeg y/o PowerShell hijos), limpia el WAV temporal y el archivo de salida parcial.

### 2.4 MetadataService (`src/main/metadataService.ts`)

Cliente HTTP (`https` nativo de Node, sin librerías externas) con dos proveedores:

- **Discogs** (`api.discogs.com`): búsqueda inteligente que detecta automáticamente si el input es una URL/ID de release de Discogs, un código de barras (8–14 dígitos), un número de catálogo, o texto libre — y prueba cada heurística en orden hasta obtener resultado (`searchByCodeOrQuery`). Es la fuente primaria.
- **MusicBrainz** (`musicbrainz.org/ws/2`) + **Cover Art Archive**: fallback. Incluye búsqueda por **TOC físico del CD** (`searchByToc`, protocolo estándar de MusicBrainz DiscID: `firstTrack+lastTrack+leadout+offsets`) además de búsqueda por texto.
- Carátulas se descargan y convierten a `data:` URL base64 (`fetchImageAsBase64`) para mostrarse inline sin CORS ni servidor intermedio.
- `isGenericTitle()` filtra nombres de volumen inútiles ("Audio CD", "DVD_VIDEO", etc.) para no gastar llamadas de red en búsquedas sin sentido.
- Todas las peticiones llevan un `User-Agent` identificable (requisito de la API de MusicBrainz) y timeout de ~6–7s; cualquier error de red resuelve a `null` en vez de lanzar, para no romper el escaneo de disco.

## 3. Extracción de DVD y CSS

No hay demuxer propio de IFO/VOB más allá del parseo binario puntual descrito en §2.2 (duración/capítulos/formato de audio). El **corte y demux real de audio** se delega enteramente a FFmpeg, que:
- Lee los `.VOB` concatenados como *Program Stream* MPEG-2.
- Desencripta CSS en caliente a través de `libdvdcss-2.dll`, que se distribuye junto al binario en `resources/bin/` y se resuelve vía `PATH` inyectado (no hay licencia de CSS verificada; ver §6 de `FACTIBILIDAD.md` sobre aspectos legales).
- Selecciona el stream de audio por índice (`-map 0:a:N`), donde N proviene de `track.streamIndex` (actualmente casi siempre `0`, no hay UI para elegir pista de audio alternativa en discos multi-idioma).

## 4. Extracción de CD-DA (SPTI nativo)

`resources/bin/rip_cd_track.ps1` contiene C# embebido (compilado en caliente con `Add-Type` en cada invocación de PowerShell) que:
1. Abre un handle crudo a la unidad con `CreateFile` sobre `\\.\<letra>`.
2. Lee sectores en lotes (`-Batch`, por defecto 25) con `DeviceIoControl` + `IOCTL_CDROM_RAW_READ` (modo `TrackMode = 2`, CDDA).
3. Escribe un header WAV RIFF PCM 16-bit/44.1kHz/estéreo seguido de los sectores crudos (2352 bytes/sector) directamente al archivo temporal.
4. Imprime `CD_PROGRESS:<leidos>:<total>:<pct>` a stdout cada ~1 segundo (cada 75 sectores) para que `transcoder.ts` lo parsee en tiempo real.

Este script se invoca con `spawn('powershell', [...])` desde `transcoder.ts::ripCdTrack()`. **No hay corrección de errores tipo cdparanoia/AccurateRip** pese a estar mencionado como objetivo en `FACTIBILIDAD.md` — es una lectura raw de un solo paso, sin sobrelectura ni verificación de CRC contra discos de referencia.

## 5. UI (Renderer)

`App.tsx` es el único contenedor de estado (drives, pistas, metadata, formato/calidad de salida, carpeta destino, progreso). Componentes de presentación en `src/renderer/components/`:

- `Header.tsx` — barra superior, tipo de medio detectado, atajo de DevTools.
- `DriveSelector.tsx` — lista de unidades, selección, refresco, eject.
- `MetadataPanel.tsx` — álbum/artista/año/género/carátula + buscador manual (Discogs/MusicBrainz).
- `TrackList.tsx` — checkboxes de selección, edición inline de títulos, división manual de un DVD continuo en N pistas (`onSplitDvdTracks`).
- `OutputSettings.tsx` — formato de salida, bit depth/sample rate/bitrate/compresión, downmix, carpeta destino, patrón de nombre de archivo, botón de inicio.
- `ExtractionProgressModal.tsx` — modal de progreso con barra por pista/global, velocidad, ETA, log, cancelar/cerrar/abrir carpeta.

No hay gestor de estado global (Redux/Zustand) ni pruebas de componentes — todo el flujo es prop-drilling directo desde `App.tsx`.

## 6. Empaquetado y distribución

- `electron-builder.yml`: `appId com.audioextractor.app`, salida a `release/`, targets Windows `portable` y `nsis` (x64), publicación a GitHub Releases (`owner: nagoyizm`, `repo: cddvdextractor`).
- `extraResources` copia `resources/bin/**` (ffmpeg.exe, libdvdcss-2.dll, rip_cd_track.ps1) al paquete final — por eso `transcoder.ts` resuelve rutas vía `process.resourcesPath` en producción.
- `scripts/ensure-ffmpeg.js` (hook `postinstall`): si no existe un `ffmpeg.exe` válido en `resources/bin/`, intenta copiarlo desde WinGet (`Gyan.FFmpeg`) local, luego desde el `PATH`, y como último recurso **descarga el build `ffmpeg-release-essentials.zip` de gyan.dev**.
- `scripts/updateUnpacked.js`: sincroniza `release/win-unpacked/` tras un build incremental (usado por `npm run update:unpacked`).
- Auto-actualización: `electron-updater` (`autoUpdater`) configurado en `main.ts`, solo activo fuera de modo desarrollo (`isDev`), chequea 3s después del arranque y al completar la descarga ofrece reiniciar o instalar al salir.
- CI/CD: `.github/workflows/build-and-release.yml` — en cada tag `v*` o manualmente, corre en `windows-latest`, instala dependencias, asegura FFmpeg, build, y publica el instalador NSIS a GitHub Releases con `electron-builder --publish always`.

## 7. Limitaciones conocidas de la arquitectura actual

- **Solo Windows x64**: todo el acceso a hardware (WMI, SPTI, eject) y los binarios empaquetados son específicos de Win32. Portar a macOS/Linux requeriría reemplazar `driveDetector`/`rip_cd_track.ps1` por completo.
- **Capítulos de DVD sintéticos como último recurso**: si el disco no define Programas (`nr_of_programs <= 1`) ni celdas múltiples utilizables en el `.IFO`, la app divide la duración total en 12 partes iguales — no son cortes reales de pistas musicales. El caso común de discos de concierto (capítulos vía Program Map) está cubierto desde el fix de 2026-10-25 (ver `CURRENT_WORK.md`), pero discos sin Program Map en absoluto siguen cayendo en este reparto artificial.
- **Sin AccurateRip ni corrección de jitter** en la ruta de CD-DA, pese a estar documentado como objetivo de calidad audiófila en `FACTIBILIDAD.md`.
- **Una sola extracción concurrente** (estado de instancia en `TranscoderService`); no hay cola de trabajos.
- **Sin tests automatizados** (unitarios, de integración o e2e) en el repositorio.

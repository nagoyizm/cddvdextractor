# CLAUDE.md

Guía para trabajar en este repositorio con Claude Code. Para el detalle técnico de cómo funciona la app ver [ARCHITECTURE.md](ARCHITECTURE.md); para qué está en curso ver [CURRENT_WORK.md](CURRENT_WORK.md).

## Qué es este proyecto

Aplicación de escritorio Electron + React + TypeScript que extrae audio de **CD de Audio (CD-DA)**, **DVD-Video** y **DVD-Audio** y lo transcodifica a FLAC/WAV/MP3/AAC/OPUS/OGG usando un FFmpeg embebido, con enriquecimiento automático de metadatos (Discogs/MusicBrainz) y empaquetado como `.exe` portable o instalador NSIS. **Windows x64 únicamente.**

## Comandos

```bash
npm install              # también corre postinstall -> scripts/ensure-ffmpeg.js
npm run dev               # Vite (renderer) + tsc --watch (main) + electron, con hot-reload
npm run build              # build:renderer (vite) + build:main (tsc -p tsconfig.main.json)
npm run package:portable   # build + electron-builder --win portable
npm run package:installer  # build + electron-builder --win nsis
npm run release            # build + electron-builder --win nsis --publish always (requiere GH_TOKEN)
npm run update:unpacked    # build + sincroniza release/win-unpacked/ sin regenerar el instalador
```

No hay script de `test` ni `lint` configurado — no existen pruebas automatizadas en el repo.

## Reglas de este repositorio

- **Idioma**: todo el código (comentarios, strings de UI, mensajes de log, nombres en `FACTIBILIDAD.md`/`README.md`) está en **español**. Mantener ese idioma al tocar código existente o escribir mensajes de usuario/log nuevos; el código (identificadores, tipos) puede seguir en inglés como ya está.
- **Nunca commitear binarios de `release/`** ni artefactos de build (`dist/`, `release/`) — están en `.gitignore`; si algo de ahí aparece en `git status`, es generado, no fuente.
- `resources/bin/ffmpeg.exe` y `resources/bin/libdvdcss-2.dll` sí son binarios versionados intencionalmente (dependencias de runtime empaquetadas) — no confundirlos con los de `release/`.
- Antes de tocar `transcoder.ts`, `driveDetector.ts` o `discScanner.ts`, leer `ARCHITECTURE.md` §2-4: hay parseo binario manual de `.cda`/`.IFO` y llamadas a PowerShell/WMI/SPTI con offsets exactos — un cambio superficial puede romper silenciosamente la detección o el corte de pistas.
- `TranscoderService` mantiene estado de instancia (una sola extracción concurrente). Si se agrega una cola o paralelismo, hay que revisar `isBusy`/`isCancelled`/`activeProcess`/rutas temporales, que hoy asumen un solo trabajo a la vez.
- Los tres procesos (main/preload/renderer) están separados por `contextBridge`; nunca exponer APIs de Node nuevas al renderer sin pasar por `src/preload/preload.ts`, y mantener `nodeIntegration: false` / `contextIsolation: true`.
- Cualquier canal IPC nuevo debe registrarse en `main.ts::setupIpcHandlers()`, expuesto en `preload.ts::api`, y tipado en `src/shared/types.ts` (consumido por `App.tsx` vía `window.electronAPI`).

## Verificación de cambios

No hay hardware óptico garantizado en el entorno de desarrollo, así que:
- `npm run dev` permite verificar que la UI carga y que `getDrives()`/`scanDisc()` no crashean (puede devolver listas vacías o pistas de muestra — ver `generateSampleTracks` en `discScanner.ts`).
- Cambios en `transcoder.ts` (construcción de args de FFmpeg) se pueden revisar leyendo los argumentos armados sin ejecutar extracción real, o probando con un DVD/CD físico si está disponible.
- `npm run build` debe pasar sin errores de TypeScript antes de dar por terminado cualquier cambio en `src/main` o `src/renderer`.
- Si se toca `electron-builder.yml`, `ensure-ffmpeg.js` o el workflow de CI, confirmar explícitamente con el usuario antes de correr un build/paquete real (puede tardar minutos y descargar FFmpeg desde internet).

## Qué NO hacer sin confirmar con el usuario

- No publicar releases (`npm run release`, `electron-builder --publish`) ni hacer push de tags `v*` — dispara el workflow de GitHub Actions y crea un release público.
- No modificar `electron-builder.yml` (appId, owner/repo de publish) sin confirmar — afecta dónde se publican los releases firmados.
- No bajar/reemplazar `resources/bin/libdvdcss-2.dll` por otra fuente sin que el usuario lo sepa (ver aspectos legales de CSS en `FACTIBILIDAD.md` §6).

# Estado Actual del Proyecto

Snapshot al **2026-10-25**. Para arquitectura técnica ver [ARCHITECTURE.md](ARCHITECTURE.md); para reglas de trabajo ver [CLAUDE.md](CLAUDE.md).

## Dónde está el código

- Rama: `main` (único branch local).
- Último commit: `227eac7` — *"feat: complete DVD & CD audio extractor with auto-updater, Discogs integration and CI/CD workflow"* (2026-10-06). Este commit introdujo prácticamente todo el proyecto de una sola vez (31 archivos, ~12.5k líneas): toda la app Electron/React, el motor de transcodificación, la integración con Discogs/MusicBrainz, el workflow de CI/CD y `FACTIBILIDAD.md`.
- Commit anterior: `6fe64ae` — *"Initial commit"* (repo vacío/boilerplate inicial).
- **Cambio sin commitear**: `FACTIBILIDAD.md` tiene una modificación de una sola línea — se insertaron varios espacios extra en medio de la palabra "decodificadores" (línea ~17: `decodificadores        desde cero`). Parece un error de edición/typo accidental, no un cambio de contenido intencional. Pendiente de decidir si se revierte o se corrige.

## Qué está implementado (según el código, no solo el mensaje del commit)

- Detección de unidades ópticas en Windows vía WMI + fallback de escaneo de letras D:–H:.
- Escaneo de CD-DA leyendo punteros `.cda` reales (número de pista, sectores) con fallback a 12 pistas de muestra.
- Escaneo de DVD-Video con parseo binario manual de `.IFO` (duración, capítulos si existen múltiples celdas, códec de audio detectado) y fallback a 12 pistas sintéticas por división de tiempo.
- Escaneo de DVD-Audio con generación de pistas sintéticas basada en cantidad de `.AOB` (no hay demux real de MLP).
- Extracción física de sectores CD-DA vía SPTI nativo (C# embebido compilado en caliente desde PowerShell, `IOCTL_CDROM_RAW_READ`) con progreso en tiempo real.
- Corte de audio de DVD vía FFmpeg + `libdvdcss-2.dll` (timecodes por capítulo, concatenación de VOBs del Title Set principal).
- Transcodificación a FLAC (16/24-bit, compresión configurable), WAV, MP3 (CBR 320k o VBR V0), AAC, Opus, OGG Vorbis; downmix 5.1→2.0 opcional; inyección de metadatos ID3/Vorbis vía FFmpeg.
- Metadatos automáticos: búsqueda inteligente Discogs (URL/ID, barcode, catálogo, texto libre) con fallback a MusicBrainz (incluye lookup por TOC físico del CD) y Cover Art Archive; descarga de carátula como base64 inline.
- UI completa en React: selector de unidad, panel de metadata editable con buscador manual, lista de pistas con selección/edición de título/split manual de DVD continuo, panel de configuración de salida, modal de progreso con cancelación.
- Auto-actualización vía `electron-updater` apuntando a GitHub Releases de `nagoyizm/cddvdextractor`.
- Empaquetado dual (portable .exe / instalador NSIS) y pipeline de CI/CD en GitHub Actions que publica a un tag `v*`.
- Ya existen builds generados en `release/` (instalador, portable, zip, `win-unpacked/`) — es decir, al menos una build v1.0.0 fue producida y probablemente distribuida.

## Huecos y simplificaciones conocidas (ver ARCHITECTURE.md §7 para detalle)

- Sin AccurateRip ni corrección de jitter en la ruta de CD-DA, pese a estar en el objetivo original de `FACTIBILIDAD.md`.
- Los "capítulos" de un DVD sin celdas múltiples en el IFO son una partición sintética en 12 tiempos iguales, no cortes reales de canciones — el split manual en la UI (`onSplitDvdTracks`) existe precisamente para compensar esto a mano.
- DVD-Audio (MLP) no tiene demuxer real, solo pistas de ejemplo.
- Sin selector de stream de audio alternativo en discos DVD multi-pista/multi-idioma (`streamIndex` casi siempre 0).
- Una sola extracción concurrente (sin cola de trabajos).
- Sin pruebas automatizadas de ningún tipo.
- Solo Windows x64 (dependencia dura de WMI/SPTI/binarios nativos).

## Posibles próximos pasos (no iniciados, a confirmar con el usuario antes de empezar)

- Decidir qué hacer con el cambio sin commitear en `FACTIBILIDAD.md` (¿revertir el typo o es intencional?).
- Si se quiere mejorar fidelidad de CD-DA: evaluar integrar lógica tipo AccurateRip (verificación de checksums contra base de datos pública) o al menos sobrelectura/reintento de sectores con error.
- Si se quiere soporte real de DVD-Audio: investigar un demuxer de MLP/AOB (no hay librería evaluada aún en el código).
- Agregar algún nivel de test (al menos unitario para el parseo de `.cda`/`.IFO` y la construcción de argumentos de FFmpeg en `transcoder.ts`), ya que hoy la única verificación es manual con disco físico.

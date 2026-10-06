# Estudio de Factibilidad Técnica: Extractor Local de Audio CD y DVD

**Proyecto:** Extractor Local Multi-Formato de CD-DA, DVD-Video y DVD-Audio  
**Autor:** Senior Software Architect  
**Entorno de Operación:** Local (Windows 10/11 x64, extensible a macOS/Linux)  
**Fecha:** Octubre 2026  

---

## 1. Resumen Ejecutivo y Diagnóstico Inicial

El desarrollo de una aplicación local para extracción de audio de discos ópticos (CD y DVD) es un proyecto **completamente viable**, pero presenta un nivel de complejidad técnica asimétrico entre ambos medios:

*   **CD de Audio (CD-DA / Red Book):** No posee un sistema de archivos tradicional accesible por el sistema operativo. Windows muestra archivos virtuales `.cda` (que solo son punteros de 44 bytes a sectores LBA). La extracción exige comunicación directa a bajo nivel mediante **SCSI Pass-Through Interface (SPTI)** y rutinas de corrección de jitter (estilo `cdparanoia`).
*   **DVD-Video:** Utiliza sistema de archivos **UDF/ISO 9660**. El audio reside multiplexado en contenedores MPEG-2 Program Stream (`.VOB`) junto con video y subtítulos, organizado jerárquicamente en Títulos, Cadenas de Celdas (PGC) y Capítulos dentro de archivos descriptores `.IFO`. En el 95% de los discos comerciales se encuentra protegido por **CSS (Content Scramble System)**, lo que requiere rutinas de desencriptado (`libdvdcss`).
*   **DVD-Audio (DVD-A):** Mucho más infrecuente. Utiliza directorio `AUDIO_TS/` con archivos `.AOB` y codificación MLP (Meridian Lossless Packing) o LPCM de alta resolución (hasta 24-bit/192kHz). Requiere un demultiplexor especializado.

La solución óptima no es reinventar los decodificadores desde cero en C puro, sino diseñar una **arquitectura híbrida por capas**: un motor de orquestación de alto rendimiento que controle bibliotecas probadas en la industria (`libcdio`, `libdvdread`, `libdvdcss`, `ffmpeg` / `libavcodec`) acoplado a una interfaz gráfica de usuario reactiva, moderna y con soporte de metadatos automáticos (MusicBrainz).

---

## 2. Desglose del Problema por Medio Físico

### 2.1. Compact Disc Digital Audio (CD-DA)
```
[ Unidad Óptica ]
       │
       ▼  (SPTI / IOCTL_CDROM_RAW_READ / SCSI READ CD 0xBE)
[ Lectura de Sectores Raw (2352 bytes/sector) ]
       │
       ▼  (Detección de Jitter / Punteros C2 / Cache defeat)
[ Motor de Extracción Precisa (Accurate Rip Engine) ]
       │
       ▼  (PCM 16-bit / 44.1 kHz Stereo)
[ Buffer de Audio Crudo (WAV In-Memory) ]
```

*   **Estructura de Datos:** Sectores de 2352 bytes (sin cabecera de datos de usuario ni sincronismo ISO), a 44,100 Hz, 16-bit estéreo interleaved.
*   **Desafíos:**
    1.  *Acceso en Windows:* Requiere permisos adecuados para abrir handles con `CreateFile` sobre `\\.\D:` y comandos IOCTL (`IOCTL_CDROM_READ_TOC_EX`, `IOCTL_CDROM_RAW_READ`).
    2.  *Jitter y Corrección de Errores:* Las unidades ópticas domésticas interpolan errores silenciosamente. Para calidad audiófila se necesita algoritmos de sobrelectura (over-reading) y verificación de CRC contra bases como **AccurateRip**.
*   **Herramienta/Librería recomendada:** `libcdio` (con `cdparanoia`) o motor C# wrapper de SPTI directo.

### 2.2. DVD-Video & DVD-Audio
```
[ Estructura de Directorios DVD: VIDEO_TS / AUDIO_TS ]
       │
       ▼
[ Desencriptado CSS / Autenticación de Unidad (libdvdcss) ]
       │
       ▼
[ Parseo de Archivos IFO (Title Sets, PGC, VTS, Audio Streams) ]
       │
       ▼
[ Demuxing de VOB / AOB (Extracción de stream ID: 0x80..0x87 AC3, 0x88..0x8F DTS, 0xA0..0xA7 LPCM) ]
       │
       ▼
[ Stream de Audio Extraído (LPCM 16/24-bit 48/96kHz, Dolby AC-3, DTS) ]
```

*   **Identificación de Pistas:** Las pistas musicales en un DVD-Video de conciertos o videoclips suelen coincidir con **Capítulos (Chapters)** o **Celdas (Cells)** dentro de un Título específico. Es indispensable parsear los archivos `.IFO` para obtener la tabla de tiempos precisa (Timecodes) de cada capítulo para cortar el audio sin desincronización ni ruidos parásitos.
*   **Streams Soportados en DVD:**
    *   **LPCM:** 48 kHz o 96 kHz, 16 o 24 bits, estéreo o multicanal (puro sin compresión).
    *   **Dolby Digital (AC-3):** Compresión con pérdida (hasta 640 kbps, 5.1 canales).
    *   **DTS:** Compresión perceptual de mayor tasa (768 kbps o 1536 kbps).
    *   **MLP (en DVD-Audio):** Audio comprimido sin pérdidas (Lossless) de ultra alta definición.

---

## 3. Matriz de Variables y Opciones de Implementación

| Variable / Dimensión | Opción A: Scripting Rápido (Python) | Opción B: Aplicación Desktop Moderna (Tauri + Rust) | Opción C: Nativa Windows (.NET 8 / C#) | Opción D: C++ Puro / Qt6 |
| :--- | :--- | :--- | :--- | :--- |
| **Tiempo de Desarrollo** | Muy bajo (1 - 2 semanas MVP) | Medio (3 - 4 semanas) | Medio-Bajo (2 - 3 semanas) | Alto (6 - 8 semanas) |
| **Consumo de Memoria** | Moderado (~120-180 MB) | Muy bajo (~40-70 MB) | Bajo-Medio (~80-120 MB) | Mínimo (~30-50 MB) |
| **Rendimiento de E/S** | Bueno (vía subprocess/FFmpeg) | Excelente (Rust async I/O) | Excelente (P/Invoke nativo) | Máximo absoluto |
| **Acceso a Hardware Óptico** | Requiere wrappers C/CLI binarios | FFI a C (`libcdio`, `libdvdread`) | APIs directas de Windows (Win32 SPTI) | API directa Win32 / POSIX |
| **Diseño y UX** | PySide6 / CustomTkinter (limitado) | HTML5/CSS/React/Vue (Moderno, WOW effect) | WPF / Avalonia (Fluido y nativo) | QML / Qt Widgets (Clásico) |
| **Distribución** | PyInstaller (pesado, falsos positivos) | Binario standalone ligero (~15MB) | Single-file publish .NET (~60MB) | Instalador C++ nativo |

---

## 4. Pipeline de Procesamiento de Audio y Transcodificación

El pipeline de salida debe garantizar fidelidad y soporte para dos perfiles de usuario:

### 4.1. Perfil Alta Definición (Lossless / Audiophile)
*   **WAV (PCM Crudo):** Sin compresión, 16-bit/44.1kHz (CD) o 24-bit/96kHz (DVD LPCM).
*   **FLAC (Free Lossless Audio Codec):** Compresión sin pérdida, soporta metadatos completos y carátula integrada. Nivel de compresión 5 a 8.
*   **Manejo de Multicanal (5.1 a Estéreo):** Cuando la pista de DVD viene en AC3 5.1 o DTS 5.1, la app debe ofrecer:
    1.  *Pass-through:* Guardar el FLAC multicanal 5.1 original.
    2.  *Downmixing inteligente:* Mezcla a 2.0 estéreo usando matriz normalizada ITU-R BS.775-1 para evitar saturación de picos.

### 4.2. Perfil Ligero (Lossy / Portabilidad)
*   **MP3:** Codificador LAME (`libmp3lame`). Modos VBR (V0 ~245 kbps) o CBR (320 kbps) con filtro paso-bajo ajustado.
*   **AAC (M4A):** Formato preferido para dispositivos modernos, superior a MP3 a iguales bitrates (192 - 256 kbps).
*   **Opus:** El codificador de audio con pérdida más avanzado y eficiente del mercado (128 kbps supera a MP3 a 192 kbps).

---

## 5. Metadatos y Enriquecimiento Automático

Extraer pistas numéricas (`Track01.wav`, `Track02.wav`) degrada la experiencia de usuario. La aplicación debe implementar un módulo de reconocimiento:

1.  **Detección Local:** Lectura de **CD-Text** (si está grabado en el subcanal del disco) y nombres de volumen en DVD (`DVD_VOLUME_NAME`).
2.  **Cálculo de DiscID:** Generar el hash de offsets de pistas del CD (compatible con `MusicBrainz DiscID`).
3.  **Consulta REST:** Consumir la API abierta de **MusicBrainz** y **Cover Art Archive** para descargar automáticamente:
    *   Artista, Álbum, Año, Género.
    *   Títulos de cada canción según su posición.
    *   Carátula en alta resolución (`front.jpg`).
4.  **Inyección de Tags:** Utilizar `taglib` o metadatos nativos en FFmpeg para incrustar ID3v2.4 en MP3 y Vorbis Comments en FLAC.

---

## 6. Aspectos Legales y de Seguridad (DRM)

*   **Copia Privada vs. Evasión de DRM:** En la mayoría de legislaciones occidentales (incluyendo leyes de propiedad intelectual en Latinoamérica y Europa), realizar una copia privada o respaldo de un medio físico adquirido legítimamente está amparado. No obstante, leyes como la DMCA (EE. UU.) prohíben la distribución de herramientas diseñadas principalmente para eludir medidas de protección tecnológica (TPM) como CSS.
*   **Estrategia Arquitectónica de Desacoplamiento:**
    *   La aplicación base se enfoca en lectura de medios sin protección o con APIs estándar.
    *   Soporte dinámico para `libdvdcss-2.dll`: La aplicación puede cargar la biblioteca dinámicamente si está presente en la carpeta del sistema o permitir al usuario descargarla/enlazarla como plugin (similar a como lo gestionan reproductores como VLC o HandBrake).

---

## 7. Dictamen de Factibilidad y Recomendación de Arquitectura

### Nivel de Factibilidad: **ALTO (95%)**

### Arquitectura Recomendada: **Enfoque Híbrido C# (.NET 8 + WPF / Avalonia) o Tauri (Rust + React)**

Recomendamos **.NET 8 (C#) con WPF/Avalonia** o **Tauri v2 (Rust + Vite/React)** por las siguientes razones de ingeniería:
1.  **Windows Native Access:** En Windows, C# y Rust interactúan de manera transparente con las APIs del kernel de Windows (`kernel32.dll`, `DeviceIoControl`, `CreateFileW`) para detectar unidades lectoras `CD-ROM/DVD-ROM` y manejar la bandeja (eject/load).
2.  **Motor FFmpeg Embebido:** Ambos ecosistemas permiten ejecutar subprocesos de `ffmpeg` o enlazar `libav*` directamente para procesar el audio en streaming continuo (pipe stdin/stdout) sin necesidad de escribir gigabytes de archivos temporales en disco.
3.  **UI Premium y Acelerada por Hardware:** Permite construir un diseño moderno con dark-mode, medidores de nivel de audio en tiempo real, barras de progreso por pista y previsualización de carátulas.

---

## 8. Estimación de Esfuerzo y Roadmap de Entrega

*   **Fase 1: Motor Core de Extracción CD (Días 1-4):** Detección de unidad, lectura de TOC, extracción de PCM crudo a WAV/FLAC.
*   **Fase 2: Motor DVD IFO/VOB & Demux (Días 5-9):** Detección de títulos/capítulos de DVD, integración de `libdvdcss` y demuxing selectivo a pistas individuales.
*   **Fase 3: Pipeline de Transcodificación & Tags (Días 10-13):** Conversores a MP3/AAC/FLAC/WAV, normalización y conexión a MusicBrainz.
*   **Fase 4: Interfaz de Usuario y Experiencia (Días 14-18):** UI moderna, selector de discos, visualizador de pistas, configuración de perfiles y exportación por lotes.
*   **Fase 5: Empaquetado y Pruebas con Discos Reales (Días 19-21):** Instalador autónomo, validación con discos rayados/errores de lectura y control de memoria.

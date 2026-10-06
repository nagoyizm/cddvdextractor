# 💿 DVD & CD Audio Extractor - Pro Edition

Extractor local de alta definición y fidelidad audiófila para pistas de **CD de Audio (CD-DA)**, **DVD-Video** y **DVD-Audio**, desarrollado en **Electron + React + TypeScript + FFmpeg**.

Diseñado para funcionar de manera **100% autónoma, portátil (Portable .exe)** o como **Instalador de Windows (.exe Setup)** sin necesidad de configuraciones previas ni dependencias externas en la PC destino.

---

## ✨ Características Principales

*   **Soporte Multiformato de Entrada:**
    *   **CD de Audio (CD-DA / Red Book):** Detección de sectores PCM crudos (16-bit / 44.1 kHz).
    *   **DVD-Video:** Demuxing de contenedores VOB, parseo de títulos y extracción por capítulos individuales.
    *   **DVD-Audio:** Soporte para pistas LPCM de alta definición y MLP.
*   **Formatos de Salida Soportados:**
    *   **FLAC (Lossless):** Profundidad seleccionable de **16-bit** o **24-bit**, frecuencias de hasta **192 kHz** con nivel de compresión ajustable.
    *   **WAV (PCM Crudo):** Audio puro sin pérdida ni compresión.
    *   **MP3 (LAME):** Calidad máxima 320 kbps CBR o VBR V0 (~245 kbps).
    *   **AAC / M4A:** Códec moderno optimizado para dispositivos móviles y Apple.
    *   **OPUS:** La compresión perceptual más eficiente del mercado.
    *   **OGG Vorbis:** Formato abierto de alta fidelidad.
*   **Gestión Multicanal Inteligente:**
    *   *Downmixing Estéreo (2.0):* Convierte fuentes 5.1 (Dolby AC-3 / DTS) a estéreo usando matriz normalizada ITU-R BS.775-1 para evitar saturación de graves o distorsión.
    *   *Preservación de Canales:* Opción para conservar los 6 canales (5.1 surround) intactos en FLAC/WAV.
*   **Metadatos Automáticos y Carátulas:**
    *   Conexión con la API de **MusicBrainz** y **Cover Art Archive** para descargar nombres de canciones, artista, álbum, año y carátula en alta definición.
    *   Inyección automática de tags ID3v2 y comentarios Vorbis en los archivos exportados.
*   **Motor FFmpeg Embebido (`resources/bin`):**
    *   La aplicación empaqueta su propio motor de transcodificación dentro de la carpeta `resources/bin/ffmpeg.exe`, garantizando portabilidad absoluta en cualquier equipo.

---

## 🚀 Modos de Ejecución y Compilación

### 1. Ejecutar en Modo Desarrollo
```powershell
npm run dev
```
Inicia el servidor local de Vite con hot-reload y la ventana de Electron en modo de depuración.

### 2. Generar el Ejecutable Portable (`.exe` Único)
```powershell
npm run package:portable
```
Genera un único archivo autónomo en la carpeta `release/`:
* `release/DVD & CD Audio Extractor-Portable-1.0.0.exe`
* *Ideal para llevar en una memoria USB y ejecutar en cualquier PC con Windows sin instalar nada.*

### 3. Generar el Instalador de Windows (`Setup.exe`)
```powershell
npm run package:installer
```
Genera el asistente de instalación clásico (NSIS) con accesos directos al escritorio, menú de inicio y desinstalador limpio:
* `release/DVD & CD Audio Extractor-Setup-1.0.0.exe`

---

## 📁 Estructura del Código Fuente

```
DVD audio extractor/
├── resources/
│   └── bin/
│       ├── ffmpeg.exe       # Binario local optimizado de transcodificación
│       ├── ffprobe.exe      # Inspector de streams y metadatos de medios
│       └── ffplay.exe
├── src/
│   ├── main/                # Proceso Principal (Node.js nativo)
│   │   ├── main.ts          # Ciclo de vida y registro de canales IPC
│   │   ├── driveDetector.ts # Detección de hardware óptico en Windows vía CIM/WMI
│   │   ├── discScanner.ts   # Mapeo de pistas de CD y capítulos de DVD
│   │   ├── transcoder.ts    # Orquestación de pipes FFmpeg y cálculo de progreso
│   │   └── metadataService.ts # Integración REST con MusicBrainz
│   ├── preload/             # Puente seguro ContextBridge
│   │   └── preload.ts
│   ├── renderer/            # Interfaz Gráfica de Usuario (React + Vite)
│   │   ├── components/      # Componentes modulares (DriveSelector, TrackList, etc.)
│   │   ├── App.tsx          # Estado reactivo y control principal
│   │   └── index.css        # Diseño audiófilo oscuro con Glassmorphism
│   └── shared/              # Tipos TypeScript comunes
├── electron-builder.yml     # Configuración de compilación NSIS y Portable
├── FACTIBILIDAD.md          # Estudio de ingeniería y factibilidad técnica
└── package.json
```

---

## 🛡️ Licencia
Distribuido bajo la Licencia MIT.

param (
    [Parameter(Mandatory=$true)]
    [string]$DriveLetter,

    [Parameter(Mandatory=$true)]
    [long]$StartSector,

    [Parameter(Mandatory=$true)]
    [long]$SectorCount,

    [Parameter(Mandatory=$true)]
    [string]$OutputPath,

    [int]$Batch = 25
)

$src = @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public class NativeCdRipper {
    private const uint GENERIC_READ = 0x80000000;
    private const uint FILE_SHARE_READ = 1;
    private const uint OPEN_EXISTING = 3;
    private const uint IOCTL_CDROM_RAW_READ = 0x0002403E;

    [StructLayout(LayoutKind.Sequential)]
    public struct RAW_READ_INFO {
        public long DiskOffset;
        public uint SectorCount;
        public int TrackMode;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern SafeFileHandle CreateFile(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool DeviceIoControl(SafeFileHandle hDevice, uint dwIoControlCode, ref RAW_READ_INFO lpInBuffer, uint nInBufferSize, [Out] byte[] lpOutBuffer, uint nOutBufferSize, out uint lpBytesReturned, IntPtr lpOverlapped);

    public static void RipSectorsToWav(string driveLetter, long startSector, uint sectorCount, string outputPath, int batchSize) {
        string path = driveLetter.TrimEnd('\\');
        if (!path.StartsWith(@"\\.\")) {
            path = @"\\.\" + path;
        }

        using (var handle = CreateFile(path, GENERIC_READ, FILE_SHARE_READ, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero)) {
            if (handle.IsInvalid) {
                throw new Exception("No se puede abrir la unidad " + driveLetter + ": Error Win32 " + Marshal.GetLastWin32Error());
            }

            string outDir = Path.GetDirectoryName(outputPath);
            if (!string.IsNullOrEmpty(outDir) && !Directory.Exists(outDir)) {
                Directory.CreateDirectory(outDir);
            }

            using (var fs = new FileStream(outputPath, FileMode.Create, FileAccess.Write, FileShare.None, 65536))
            using (var bw = new BinaryWriter(fs)) {
                uint dataLength = sectorCount * 2352;
                
                // Cabecera WAV RIFF PCM 16-bit 44.1kHz Stereo
                bw.Write(new char[] { 'R', 'I', 'F', 'F' });
                bw.Write(dataLength + 36);
                bw.Write(new char[] { 'W', 'A', 'V', 'E' });
                bw.Write(new char[] { 'f', 'm', 't', ' ' });
                bw.Write((uint)16);
                bw.Write((ushort)1);
                bw.Write((ushort)2);
                bw.Write((uint)44100);
                bw.Write((uint)(44100 * 2 * 2));
                bw.Write((ushort)4);
                bw.Write((ushort)16);
                bw.Write(new char[] { 'd', 'a', 't', 'a' });
                bw.Write(dataLength);

                uint bSize = (uint)Math.Max(1, Math.Min(25, batchSize));
                byte[] buffer = new byte[bSize * 2352];

                for (uint i = 0; i < sectorCount; i += bSize) {
                    uint toRead = Math.Min(bSize, sectorCount - i);
                    RAW_READ_INFO rri = new RAW_READ_INFO();
                    rri.DiskOffset = (startSector + i) * 2048L;
                    rri.SectorCount = toRead;
                    rri.TrackMode = 2; // CDDA

                    uint returned;
                    bool ok = DeviceIoControl(handle, IOCTL_CDROM_RAW_READ, ref rri, (uint)Marshal.SizeOf(rri), buffer, toRead * 2352, out returned, IntPtr.Zero);
                    if (!ok) {
                        throw new Exception("Error al leer sector " + (startSector + i) + ": Win32 error " + Marshal.GetLastWin32Error());
                    }
                    bw.Write(buffer, 0, (int)returned);

                    uint current = i + toRead;
                    if (current % 75 == 0 || current >= sectorCount) {
                        int pct = (int)((current * 100) / sectorCount);
                        Console.WriteLine("CD_PROGRESS:" + current + ":" + sectorCount + ":" + pct);
                    }
                }
            }
        }
    }
}
'@

if (-not ([System.Management.Automation.PSTypeName]'NativeCdRipper').Type) {
    Add-Type -TypeDefinition $src
}

[NativeCdRipper]::RipSectorsToWav($DriveLetter, $StartSector, [uint32]$SectorCount, $OutputPath, $Batch)
Write-Output "OK"

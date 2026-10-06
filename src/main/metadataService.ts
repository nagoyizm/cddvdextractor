import { DiscMetadata } from '../shared/types';
import https from 'https';

export class MetadataService {
  private userAgent = 'DVDAndCDAudioExtractor/1.0.0 ( contact@audioextractor.local )';

  private static readonly GENERIC_NAMES = new Set([
    'audio cd',
    'cd audio',
    'cd de audio',
    'disco de audio',
    'compact disc',
    'disco sin título',
    'disco sin titulo',
    'audio_cd',
    'audiocd',
    'cdda',
    'new',
    'blank',
    'dvd',
    'dvd_video',
    'dvd-video',
    'dvd_rom',
    'dvd-rom',
    'bandeja vacía',
    'bandeja vacia',
    'unidad óptica',
    'unidad optica',
    'unknown',
    'desconocido'
  ]);

  /**
   * Verifica si un nombre de volumen es genérico
   */
  public isGenericTitle(title?: string): boolean {
    if (!title) return true;
    const clean = title.trim().toLowerCase();
    if (clean.length < 3) return true;
    return MetadataService.GENERIC_NAMES.has(clean);
  }

  /**
   * Búsqueda unificada inteligente por código (Barcode, Cat. No, Discogs ID/URL) o texto libre en Discogs y MusicBrainz
   */
  public async searchByCodeOrQuery(rawInput: string): Promise<{ metadata: DiscMetadata; trackTitles: string[] } | null> {
    if (!rawInput || this.isGenericTitle(rawInput)) {
      return null;
    }

    const input = rawInput.trim();

    // 1. Detección de URL o ID directo de Discogs (ej: https://www.discogs.com/release/21600157 o r21600157 o 21600157)
    const discogsUrlMatch = input.match(/discogs\.com\/(?:[a-z]{2}\/)?(?:[^\/]+\/)?release\/(\d+)/i);
    const discogsIdMatch = input.match(/^r?(\d{5,10})$/i);
    if (discogsUrlMatch || discogsIdMatch) {
      const releaseId = discogsUrlMatch ? discogsUrlMatch[1] : discogsIdMatch![1];
      const result = await this.fetchDiscogsReleaseDetails(releaseId);
      if (result) return result;
    }

    // 2. Detección de Código de Barras (UPC / EAN / Barcode: 8 a 14 dígitos numéricos)
    const isBarcode = /^\d{8,14}$/.test(input.replace(/[\s\-]/g, ''));
    if (isBarcode) {
      const cleanBarcode = input.replace(/[\s\-]/g, '');

      // Probar en Discogs por código de barras
      const discogsRes = await this.searchDiscogsByParam(`barcode=${encodeURIComponent(cleanBarcode)}`);
      if (discogsRes) return discogsRes;

      // Probar en MusicBrainz por código de barras
      const mbRes = await this.searchMusicBrainzByQuery(`barcode:${encodeURIComponent(cleanBarcode)}`);
      if (mbRes) return mbRes;
    }

    // 3. Detección de Número de Catálogo o Matriz (ej: "WPCR-13420", "TDV 1081", "COL 489035 2", "n° 10")
    const looksLikeCatNo = /^[A-Za-z0-9\.\-\s\/°º]{3,24}$/.test(input) && !input.includes(' - ');
    if (looksLikeCatNo) {
      // Probar en Discogs por catno
      const discogsCatRes = await this.searchDiscogsByParam(`catno=${encodeURIComponent(input)}`);
      if (discogsCatRes) return discogsCatRes;

      // Probar en MusicBrainz por catno
      const mbCatRes = await this.searchMusicBrainzByQuery(`catno:${encodeURIComponent(input)}`);
      if (mbCatRes) return mbCatRes;
    }

    // 4. Búsqueda por texto general (Artista, Álbum, o palabras clave)
    // Primero en Discogs
    const discogsGeneral = await this.searchDiscogsByParam(`q=${encodeURIComponent(input)}&type=release`);
    if (discogsGeneral) return discogsGeneral;

    // Segundo en MusicBrainz
    const mbGeneral = await this.searchMusicBrainzByQuery(input);
    if (mbGeneral) return mbGeneral;

    return null;
  }

  /**
   * Búsqueda por parámetro en la API de Discogs
   */
  private async searchDiscogsByParam(paramString: string): Promise<{ metadata: DiscMetadata; trackTitles: string[] } | null> {
    try {
      const url = `https://api.discogs.com/database/search?${paramString}`;
      const data = await this.httpGetJson(url);

      if (!data || !data.results || data.results.length === 0) {
        return null;
      }

      // Filtrar el primer resultado que sea un lanzamiento ("release") o el primero disponible
      const target = data.results.find((r: any) => r.type === 'release') || data.results[0];
      if (!target || !target.id) return null;

      return await this.fetchDiscogsReleaseDetails(String(target.id));
    } catch (e) {
      console.warn('Discogs search failed:', e);
      return null;
    }
  }

  /**
   * Obtiene la información completa de un lanzamiento desde la API de Discogs
   */
  public async fetchDiscogsReleaseDetails(releaseId: string): Promise<{ metadata: DiscMetadata; trackTitles: string[] } | null> {
    try {
      const url = `https://api.discogs.com/releases/${releaseId}`;
      const data = await this.httpGetJson(url);
      if (!data) return null;

      const album = data.title || 'Álbum Desconocido';
      // Limpiar sufijos numéricos de Discogs como "(2)", "(3)" de los nombres de artistas
      const artist = data.artists
        ? data.artists.map((a: any) => a.name.replace(/\s*\(\d+\)$/, '').trim()).join(', ')
        : 'Artista Desconocido';

      const year = data.year
        ? String(data.year)
        : data.released
        ? data.released.substring(0, 4)
        : '';

      const genre = data.genres && data.genres.length > 0
        ? data.genres.join(', ')
        : data.styles && data.styles.length > 0
        ? data.styles.join(', ')
        : 'Música';

      const barcode = Array.isArray(data.identifiers)
        ? data.identifiers.find((i: any) => i.type && i.type.toLowerCase().includes('barcode'))?.value || ''
        : Array.isArray(data.barcode) && data.barcode.length > 0
        ? data.barcode[0]
        : '';

      const catalogNumber = data.labels && data.labels.length > 0 && data.labels[0].catno
        ? data.labels[0].catno
        : data.catno || '';

      // Extraer carátula de Discogs
      let coverUrl: string | undefined = undefined;
      let coverBase64: string | undefined = undefined;

      if (data.images && data.images.length > 0) {
        coverUrl = data.images[0].uri || data.images[0].resource_url;
      } else if (data.thumb) {
        coverUrl = data.thumb;
      }

      if (coverUrl) {
        try {
          coverBase64 = await this.fetchImageAsBase64(coverUrl);
        } catch {}
      }

      // Extraer títulos de pistas limpias (descartando encabezados)
      const trackTitles: string[] = [];
      if (Array.isArray(data.tracklist)) {
        for (const tr of data.tracklist) {
          if (tr.title && tr.type_ !== 'heading') {
            trackTitles.push(tr.title.trim());
          }
        }
      }

      return {
        metadata: {
          album,
          artist,
          year,
          genre,
          coverUrl,
          coverBase64,
          barcode,
          catalogNumber,
          discId: String(data.id),
          source: 'Discogs',
        },
        trackTitles,
      };
    } catch (e) {
      console.warn('Error fetching Discogs release details:', e);
      return null;
    }
  }

  /**
   * Búsqueda en MusicBrainz por query personalizada
   */
  private async searchMusicBrainzByQuery(query: string): Promise<{ metadata: DiscMetadata; trackTitles: string[] } | null> {
    try {
      const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=1`;
      const data = await this.httpGetJson(url);

      if (!data || !data.releases || data.releases.length === 0) {
        return null;
      }

      const release = data.releases[0];
      return await this.fetchReleaseDetails(release.id);
    } catch (error) {
      console.warn('MusicBrainz lookup failed:', error);
      return null;
    }
  }

  /**
   * Consulta MusicBrainz usando la tabla de contenidos (TOC) física del CD
   */
  public async searchByToc(
    firstTrack: number,
    lastTrack: number,
    leadoutSector: number,
    offsets: number[]
  ): Promise<{ metadata: DiscMetadata; trackTitles: string[] } | null> {
    try {
      const tocParam = `${firstTrack}+${lastTrack}+${leadoutSector}+${offsets.join('+')}`;
      const url = `https://musicbrainz.org/ws/2/discid/-?toc=${tocParam}&fmt=json`;
      const data = await this.httpGetJson(url);

      if (!data || !data.releases || data.releases.length === 0) {
        return null;
      }

      const release = data.releases[0];
      return await this.fetchReleaseDetails(release.id);
    } catch (error) {
      console.warn('MusicBrainz TOC lookup failed:', error);
      return null;
    }
  }

  /**
   * Método compatible hacia atrás para búsqueda de álbum
   */
  public async searchAlbum(query: string): Promise<{ metadata: DiscMetadata; trackTitles: string[] } | null> {
    return await this.searchByCodeOrQuery(query);
  }

  /**
   * Obtiene la información completa de pistas, artistas y carátula dado un ID de lanzamiento de MusicBrainz
   */
  public async fetchReleaseDetails(mbid: string): Promise<{ metadata: DiscMetadata; trackTitles: string[] } | null> {
    try {
      const detailUrl = `https://musicbrainz.org/ws/2/release/${mbid}?inc=artist-credits+recordings+labels&fmt=json`;
      const detailData = await this.httpGetJson(detailUrl);
      if (!detailData) return null;

      const album = detailData.title || 'Álbum Desconocido';
      const artist = detailData['artist-credit']?.[0]?.name || 'Artista Desconocido';
      const year = detailData.date ? detailData.date.substring(0, 4) : '';
      const genre = detailData.tags?.[0]?.name || 'Música';
      const barcode = detailData.barcode || '';
      const catalogNumber = detailData['label-info']?.[0]?.['catalog-number'] || '';

      // Obtener carátula si está disponible
      let coverUrl: string | undefined = undefined;
      let coverBase64: string | undefined = undefined;

      try {
        coverUrl = `https://coverartarchive.org/release/${mbid}/front-500`;
        coverBase64 = await this.fetchImageAsBase64(coverUrl);
      } catch {
        // Carátula no disponible
      }

      const trackTitles: string[] = [];
      if (detailData.media && detailData.media.length > 0) {
        const medium = detailData.media[0];
        if (medium.tracks) {
          for (const track of medium.tracks) {
            trackTitles.push(track.title);
          }
        }
      }

      return {
        metadata: {
          album,
          artist,
          year,
          genre,
          coverUrl,
          coverBase64,
          barcode,
          catalogNumber,
          discId: mbid,
          source: 'MusicBrainz',
        },
        trackTitles,
      };
    } catch (error) {
      console.warn('Error fetching release details:', error);
      return null;
    }
  }

  /**
   * Helper para peticiones HTTP GET JSON seguras con User-Agent
   */
  private httpGetJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
        timeout: 6500,
      };

      const req = https.get(parsedUrl, options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.httpGetJson(res.headers.location).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return resolve(null);
        }

        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  /**
   * Descarga la carátula y la convierte a Data URL Base64 para visualización directa
   */
  private fetchImageAsBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 7000,
      };

      const req = https.get(parsedUrl, options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.fetchImageAsBase64(res.headers.location).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP Status ${res.statusCode}`));
        }

        const contentType = res.headers['content-type'] || 'image/jpeg';
        const chunks: Buffer[] = [];

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          resolve(`data:${contentType};base64,${base64}`);
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout al descargar carátula'));
      });
    });
  }
}

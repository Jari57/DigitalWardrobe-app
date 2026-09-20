import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { request } from 'node:https';
import { safeShoppingUrl } from '@/lib/discovery';
import { publicAddress } from './product-evidence';
import { MAX_UPLOAD_BYTES, normalizeImage } from '@/server/images';

export async function fetchProductPhoto(value: string) {
  const signal = AbortSignal.timeout(8000);
  let current = value;
  for (let hop = 0; hop <= 2; hop++) {
    const safe = safeShoppingUrl(current);
    if (!safe) throw new Error('Unsupported retailer image');
    const url = new URL(safe);
    signal.throwIfAborted();
    const addresses = await new Promise<LookupAddress[]>((resolve, reject) => {
      const abort = () => reject(new Error('Image lookup timed out'));
      signal.addEventListener('abort', abort, { once: true });
      lookup(url.hostname, { family: 4, all: true })
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', abort));
    });
    signal.throwIfAborted();
    if (!addresses.length || addresses.some((entry) => !publicAddress(entry.address)))
      throw new Error('Blocked image address');
    const result = await new Promise<{ redirect?: string; bytes?: Buffer }>((resolve, reject) => {
      const req = request(
        url,
        {
          signal,
          agent: false,
          family: 4,
          headers: {
            Accept: 'image/jpeg,image/png,image/webp',
            'Accept-Encoding': 'identity',
            'User-Agent': 'FitStalker/1.0 (user-requested look preview)',
          },
          lookup: (_host, _options, callback) => callback(null, addresses[0].address, 4),
        },
        (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
            res.destroy();
            try {
              resolve({ redirect: new URL(res.headers.location, url).href });
            } catch (error) {
              reject(error);
            }
            return;
          }
          if (
            res.statusCode !== 200 ||
            !/^image\/(jpeg|png|webp)(?:;|$)/i.test(res.headers['content-type'] ?? '') ||
            (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') ||
            Number(res.headers['content-length']) > MAX_UPLOAD_BYTES
          ) {
            res.destroy();
            reject(new Error('Retailer image unavailable'));
            return;
          }
          const chunks: Buffer[] = [];
          let total = 0;
          res.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_UPLOAD_BYTES) {
              res.destroy();
              reject(new Error('Image too large'));
            } else chunks.push(chunk);
          });
          res.on('error', reject);
          res.on('end', () => resolve({ bytes: Buffer.concat(chunks) }));
        },
      );
      req.on('error', reject);
      req.end();
    });
    if (result.redirect) {
      current = result.redirect;
      continue;
    }
    return normalizeImage(result.bytes!);
  }
  throw new Error('Too many image redirects');
}

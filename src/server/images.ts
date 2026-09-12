import sharp from 'sharp';
import { ApiError } from './http';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export async function normalizeImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES)
    throw new ApiError(413, 'Choose an image smaller than 4 MB.');
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: false, failOn: 'error' });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp', 'heif'].includes(metadata.format || ''))
      throw new ApiError(415, 'Choose a JPEG, PNG, WebP, or supported HEIC photo.');
    if ((metadata.pages || 1) > 1)
      throw new ApiError(415, 'Choose a still photo. Animated images are not supported.');
    // Decode/re-encode rather than trusting extension/MIME. Default output strips EXIF/GPS.
    const { data, info } = await image
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > 3 * 1024 * 1024)
      throw new ApiError(413, 'This image is too complex. Choose a smaller photo.');
    return { data, width: info.width, height: info.height, mimeType: 'image/webp' };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(415, 'This photo could not be read. Try a JPEG, PNG, or WebP image.');
  }
}
export async function uploadFile(request: Request) {
  const contentType = request.headers.get('content-type');
  if (!contentType?.startsWith('multipart/form-data;'))
    throw new ApiError(415, 'Upload a photo using the file picker.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Choose a photo.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_UPLOAD_BYTES + 16384) {
      await reader.cancel();
      throw new ApiError(413, 'Choose an image smaller than 4 MB.');
    }
    chunks.push(value);
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { 'Content-Type': contentType },
    }).formData();
  } catch {
    throw new ApiError(400, 'This upload could not be read.');
  }
  const file = form.get('file');
  if (!(file instanceof File) || form.getAll('file').length !== 1)
    throw new ApiError(400, 'Choose one photo.');
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'Choose an image smaller than 4 MB.');
  return new Uint8Array(await file.arrayBuffer());
}

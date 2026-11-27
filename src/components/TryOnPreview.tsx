'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, Download, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react';
import type { Garment } from '@/lib/types';
import { api, Modal, upload } from './ui';

async function preparePhoto(file: File) {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 4 * 1024 * 1024)
    return file;
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Choose a JPG, PNG or WebP photo.');
  });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This photo could not be read. Choose another photo.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) throw new Error('This photo could not be read. Choose another photo.');
    return new File([blob], 'try-on.jpg', { type: blob.type });
  } finally {
    bitmap.close();
  }
}

export default function TryOnPreview({ garments }: { garments: Garment[] }) {
  const [open, setOpen] = useState(false);
  const unavailable = garments.length === 0 || garments.length > 4;
  return (
    <section className="try-on-entry" aria-label="Virtual try-on">
      <div className="try-on-entry-copy">
        <span className="try-on-icon">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div>
          <h3>Try it on me</h3>
          <p>
            {unavailable ? 'Add one to four closet pieces.' : 'See this outfit on your own photo.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="try-on-action"
        disabled={unavailable}
        onClick={() => setOpen(true)}
      >
        Open try-on
      </button>
      <PreviewDialog
        key={JSON.stringify(garments.map(({ id, imageUrl }) => [id, imageUrl]))}
        garments={garments}
        open={open && !unavailable}
        close={() => setOpen(false)}
      />
    </section>
  );
}

function PreviewDialog({
  garments,
  open,
  close,
}: {
  garments: Garment[];
  open: boolean;
  close: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const previewChoice = useRef<HTMLButtonElement>(null);
  const [file, setFile] = useState<File>();
  const [photo, setPhoto] = useState('');
  const [uploaded, setUploaded] = useState('');
  const [preview, setPreview] = useState('');
  const [compare, setCompare] = useState(false);
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<'photo' | 'upload' | 'render'>();
  const [error, setError] = useState('');
  const busy = !!stage;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhoto(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (open && preview) previewChoice.current?.focus();
  }, [open, preview]);

  async function choosePhoto(next: File) {
    setStage('photo');
    setError('');
    try {
      setFile(await preparePhoto(next));
      setUploaded('');
      setPreview('');
      setCompare(false);
      setConsent(false);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setStage(undefined);
    }
  }

  async function generate() {
    if (!file || !consent || busy || preview) return;
    setStage(uploaded ? 'render' : 'upload');
    setError('');
    try {
      const photoUrl = uploaded || (await upload(file));
      setUploaded(photoUrl);
      setStage('render');
      const result = await api<{ imageUrl: string }>('/api/try-on', 'POST', {
        agent: 'try-on',
        photoUrl,
        garmentIds: garments.map(({ id }) => id),
        consent,
      });
      setPreview(result.imageUrl);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setStage(undefined);
    }
  }

  if (!open) return null;
  return (
    <Modal title="Try it on me" onClose={close}>
      <div className="try-on-studio" aria-busy={busy}>
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (selected) void choosePhoto(selected);
          }}
        />
        {photo ? (
          <div className="try-on-stage">
            <div className={compare ? 'try-on-comparison' : 'try-on-comparison is-single'}>
              {(!preview || compare) && (
                <figure>
                  <img src={photo} alt="Your original photo" />
                  {compare && <figcaption>Original</figcaption>}
                </figure>
              )}
              {preview && (
                <figure className="try-on-result">
                  <img src={preview} alt="AI preview of you wearing the selected outfit" />
                  <figcaption>Try-on preview</figcaption>
                </figure>
              )}
            </div>
            {preview && (
              <div className="try-on-view-switch" role="group" aria-label="Try-on view">
                <button
                  ref={previewChoice}
                  type="button"
                  aria-pressed={!compare}
                  onClick={() => setCompare(false)}
                >
                  Preview
                </button>
                <button type="button" aria-pressed={compare} onClick={() => setCompare(true)}>
                  Compare original
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="try-on-upload"
            type="button"
            onClick={() => picker.current?.click()}
            disabled={busy}
          >
            <span className="try-on-camera">
              <Camera size={24} aria-hidden="true" />
            </span>
            <strong>Choose a photo</strong>
            <span>Use a clear, well-lit full-body photo.</span>
          </button>
        )}
        <details className="try-on-closet">
          <summary>
            <span className="try-on-thumbnails" aria-hidden="true">
              {garments.map(({ id, imageUrl }) => (
                <img key={id} src={imageUrl} alt="" />
              ))}
            </span>
            {garments.length} closet {garments.length === 1 ? 'piece' : 'pieces'}
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <ul className="try-on-items" aria-label="Pieces in this preview">
            {garments.map(({ id, name }) => (
              <li key={id}>{name}</li>
            ))}
          </ul>
        </details>
        {file && !preview && (
          <label className="try-on-consent">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(event) => setConsent(event.target.checked)}
            />
            I have permission to send this photo and these pieces to FitStalker’s AI image provider.
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {photo && (
          <div className="try-on-actions">
            {preview ? (
              <a className="try-on-action" href={preview} download="fitstalker-try-on.webp">
                <Download size={16} aria-hidden="true" />
                Download preview
              </a>
            ) : (
              <button
                type="button"
                className="try-on-action"
                disabled={!consent || busy}
                onClick={() => void generate()}
              >
                {busy ? (
                  <LoaderCircle className="try-on-spin" size={16} aria-hidden="true" />
                ) : (
                  <Sparkles size={16} aria-hidden="true" />
                )}
                {stage === 'upload'
                  ? 'Uploading photo…'
                  : stage === 'render'
                    ? 'Creating preview…'
                    : uploaded && error
                      ? 'Check preview again'
                      : 'Create preview'}
              </button>
            )}
            <button
              className="try-on-change"
              type="button"
              onClick={() => picker.current?.click()}
              disabled={busy}
            >
              Change photo
            </button>
          </div>
        )}
        {preview && (
          <p className="try-on-note" role="status">
            AI preview. Garment details and fit may vary.
          </p>
        )}
        <p className="try-on-note">
          <LockKeyhole size={15} aria-hidden="true" />
          Private to your account
        </p>
      </div>
      {stage && (
        <span className="try-on-status" role="status">
          {stage === 'photo'
            ? 'Preparing photo…'
            : stage === 'upload'
              ? 'Uploading your photo…'
              : 'Creating your try-on preview…'}
        </span>
      )}
    </Modal>
  );
}

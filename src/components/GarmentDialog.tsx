'use client';
import { useState } from 'react';
import type { Garment } from '@/lib/types';
import { api, categories, Modal, upload } from './ui';
export default function GarmentDialog({
  garment,
  onClose,
  onSaved,
}: {
  garment?: Garment;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title={garment ? 'Edit piece' : 'Add to your closet'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const f = new FormData(e.currentTarget);
          try {
            const file = f.get('photo') as File;
            const imageUrl = file?.size ? await upload(file) : garment?.imageUrl;
            if (!imageUrl) throw new Error('Add a photo of your piece.');
            await api(
              garment ? `/api/garments/${garment.id}` : '/api/garments',
              garment ? 'PATCH' : 'POST',
              {
                name: f.get('name'),
                brand: f.get('brand'),
                category: f.get('category'),
                color: f.get('color'),
                price: f.get('price') === '' ? null : Number(f.get('price')),
                imageUrl,
              },
            );
            await onSaved();
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {garment && <img className="edit-photo" src={garment.imageUrl} alt={garment.name} />}
        <label>
          {garment ? 'Replace photo (optional)' : 'Photo'}
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required={!garment}
          />
        </label>
        <small>
          JPG, PNG or WebP · up to 4 MB. A clean background makes your outfit boards shine.
        </small>
        <label>
          Piece name
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={garment?.name}
            placeholder="Everyday oversized tee"
          />
        </label>
        <label>
          Brand (optional)
          <input name="brand" maxLength={80} defaultValue={garment?.brand} />
        </label>
        <div className="form-grid">
          <label>
            Category
            <select name="category" defaultValue={garment?.category || 'tops'}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Color
            <input name="color" type="color" required defaultValue={garment?.color || '#232220'} />
          </label>
        </div>
        <label>
          Price paid, USD (optional)
          <input
            name="price"
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            defaultValue={garment?.price ?? ''}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} className="primary">
          {busy ? 'Saving…' : 'Save piece'}
        </button>
        {garment && (
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  'Delete this piece? It will also be removed from saved looks and references.',
                )
              )
                return;
              setBusy(true);
              try {
                await api(`/api/garments/${garment.id}`, 'DELETE');
                await onSaved();
                onClose();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete piece
          </button>
        )}
      </form>
    </Modal>
  );
}

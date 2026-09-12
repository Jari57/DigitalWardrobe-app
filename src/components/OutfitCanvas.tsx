'use client';
import { useRef, useState } from 'react';
import { Layers, Plus, Save, Trash2 } from 'lucide-react';
import type { Garment, Piece } from '@/lib/types';
import { api } from './ui';
import ExportActions from './ExportActions';
export const arrange = (garments: Garment[]): Piece[] =>
  garments.slice(0, 12).map((g, i) =>
    garments.length > 6
      ? {
          garmentId: g.id,
          x: 4 + (i % 3) * 32,
          y: 6 + Math.floor(i / 3) * 23,
          scale: 0.85,
          zIndex: i,
        }
      : {
          garmentId: g.id,
          x: 15 + (i % 2) * 42,
          y: 15 + Math.floor(i / 2) * 26,
          scale: 1,
          zIndex: i,
        },
  );
export function Board({
  garments,
  pieces,
  onChange,
  selected,
  onSelect,
}: {
  garments: Garment[];
  pieces: Piece[];
  onChange?: (pieces: Piece[]) => void;
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    drag = useRef<{ id: string; x: number; y: number; px: number; py: number } | null>(null);
  function move(id: string, x: number, y: number) {
    onChange?.(
      pieces.map((p) =>
        p.garmentId === id
          ? {
              ...p,
              x: Math.max(0, Math.min(100 - 34 * p.scale, x)),
              y: Math.max(0, Math.min(100 - 25 * p.scale, y)),
            }
          : p,
      ),
    );
  }
  return (
    <div ref={ref} className="outfit-board" aria-label="Outfit composition">
      {pieces.map((p) => {
        const g = garments.find((g) => g.id === p.garmentId);
        return g ? (
          <button
            type="button"
            key={p.garmentId}
            className={`canvas-piece ${selected === p.garmentId ? 'selected' : ''}`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${34 * p.scale}%`,
              height: `${25 * p.scale}%`,
              zIndex: p.zIndex,
            }}
            aria-label={`${g.name}${onChange ? ', use arrow keys to move' : ''}`}
            tabIndex={onChange ? 0 : -1}
            onClick={() => onSelect?.(g.id)}
            onPointerDown={(e) => {
              if (!onChange) return;
              onSelect?.(g.id);
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { id: g.id, x: p.x, y: p.y, px: e.clientX, py: e.clientY };
            }}
            onPointerMove={(e) => {
              const d = drag.current,
                r = ref.current?.getBoundingClientRect();
              if (d && r)
                move(
                  d.id,
                  d.x + ((e.clientX - d.px) / r.width) * 100,
                  d.y + ((e.clientY - d.py) / r.height) * 100,
                );
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onKeyDown={(e) => {
              if (!onChange || !e.key.startsWith('Arrow')) return;
              e.preventDefault();
              move(
                g.id,
                p.x + (e.key === 'ArrowRight' ? 2 : e.key === 'ArrowLeft' ? -2 : 0),
                p.y + (e.key === 'ArrowDown' ? 2 : e.key === 'ArrowUp' ? -2 : 0),
              );
            }}
          >
            <img src={g.imageUrl} alt={g.name} draggable={false} />
          </button>
        ) : null;
      })}
      {!pieces.length && (
        <div className="board-placeholder">
          <Layers size={30} />
          <strong>Your next fit starts here</strong>
          <span>Add a piece below. Make it yours.</span>
        </div>
      )}
    </div>
  );
}
export default function OutfitCanvas({
  garments,
  pieces,
  setPieces,
  onSaved,
}: {
  garments: Garment[];
  pieces: Piece[];
  setPieces: (p: Piece[]) => void;
  onSaved: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string>(),
    [name, setName] = useState(''),
    [caption, setCaption] = useState(
      "Today's fit, straight from my closet. #GRWM #DigitalWardrobe",
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const piece = pieces.find((p) => p.garmentId === selected);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <h2>Style your next moment</h2>
          <p>Move. Layer. Make it yours.</p>
        </div>
        <span className="eyebrow">9:16</span>
      </div>
      <Board
        garments={garments}
        pieces={pieces}
        onChange={busy ? undefined : setPieces}
        selected={selected}
        onSelect={setSelected}
      />
      {piece && (
        <div className="toolbar">
          <label>
            Size
            <input
              aria-label="Selected piece size"
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              disabled={busy}
              value={piece.scale}
              onChange={(e) => {
                const scale = Number(e.target.value);
                setPieces(
                  pieces.map((p) =>
                    p.garmentId === selected
                      ? {
                          ...p,
                          scale,
                          x: Math.min(p.x, 100 - 34 * scale),
                          y: Math.min(p.y, 100 - 25 * scale),
                        }
                      : p,
                  ),
                );
              }}
            />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              setPieces(
                pieces.map((p) =>
                  p.garmentId === selected
                    ? { ...p, zIndex: Math.max(...pieces.map((p) => p.zIndex)) + 1 }
                    : p,
                ),
              )
            }
          >
            <Layers size={16} />
            Front
          </button>
          <button
            disabled={busy}
            aria-label="Remove selected piece"
            onClick={() => setPieces(pieces.filter((p) => p.garmentId !== selected))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
      <div className="piece-tray" aria-label="Add pieces to canvas">
        {garments.map((g) => (
          <button
            key={g.id}
            disabled={busy || pieces.some((p) => p.garmentId === g.id) || pieces.length >= 12}
            onClick={() =>
              setPieces([
                ...pieces,
                { garmentId: g.id, x: 33, y: 25, scale: 1, zIndex: pieces.length },
              ])
            }
          >
            <img src={g.imageUrl} alt="" />
            <span>{g.name}</span>
            <Plus size={14} />
          </button>
        ))}
      </div>
      <small>Drag pieces or select one and use arrow keys. Up to 12 pieces per look.</small>
      <label>
        Look name
        <input
          maxLength={100}
          placeholder="Coffee run, main character energy"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="primary"
        disabled={busy || !pieces.length || !name.trim()}
        onClick={() =>
          run(async () => {
            await api('/api/outfits', 'POST', { name: name.trim(), pieces });
            await onSaved();
            setMessage('Look saved to your collection.');
          })
        }
      >
        <Save size={17} />
        Save look
      </button>
      <label>
        Post caption
        <textarea value={caption} maxLength={160} onChange={(e) => setCaption(e.target.value)} />
      </label>
      <ExportActions
        garments={garments}
        pieces={pieces}
        caption={caption}
        disabled={busy || !pieces.length}
      />
      {busy && <p role="status">Working…</p>}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

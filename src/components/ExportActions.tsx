"use client";

import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import type { Garment, Piece } from "@/lib/types";
import { download, Modal } from "./ui";

async function renderExport(garments: Garment[], pieces: Piece[], caption: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser does not support image export.");
  ctx.fillStyle = "#FAF9F6";
  ctx.fillRect(0, 0, 1080, 1920);
  for (const piece of [...pieces].sort((a, b) => a.zIndex - b.zIndex)) {
    const garment = garments.find(g => g.id === piece.garmentId);
    if (!garment) throw new Error("A piece was removed. Reload your look and try again.");
    const image = new Image();
    image.src = garment.imageUrl;
    await image.decode();
    const width = 1080 * .34 * piece.scale;
    const height = 1600 * .25 * piece.scale;
    const ratio = Math.min(width / image.width, height / image.height);
    ctx.drawImage(image, piece.x / 100 * 1080 + (width - image.width * ratio) / 2,
      piece.y / 100 * 1600 + (height - image.height * ratio) / 2,
      image.width * ratio, image.height * ratio);
  }
  await document.fonts.ready;
  ctx.fillStyle = "#232220";
  ctx.font = 'bold 42px "Plus Jakarta Sans Variable", sans-serif';
  const lines: string[] = [];
  let line = "";
  // Character wrapping also bounds long handles/hashtags without spaces.
  for (const character of caption) {
    if (character === "\n" || ctx.measureText(line + character).width > 940) {
      lines.push(line); line = character === "\n" ? "" : character;
    } else line += character;
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((text, i) => ctx.fillText(text, 70, 1710 + i * 54));
  ctx.font = '22px "Plus Jakarta Sans Variable", sans-serif';
  ctx.fillText("DIGITAL WARDROBE · YOUR CLOSET, YOUR RULES", 70, 1870);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image export failed.")), "image/png"));
}

function ReadyExport({ file, caption, onClose }: { file: File; caption: string; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    const value = URL.createObjectURL(file); setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  const canShare = typeof navigator.share === "function" && navigator.canShare?.({ files: [file] });
  return <Modal title="Your look is ready" onClose={() => { if (!sharing) onClose(); }}>
    <div className="stack">
      {url && <img src={url} alt="Your outfit export preview" style={{ maxHeight: "45dvh", margin: "auto", objectFit: "contain" }} />}
      <p>1080 × 1920 PNG. Save it or send it to your favorite app.</p>
      <button className="primary" disabled={sharing} onClick={() => download(file, file.name)}><Download size={16} />Download PNG</button>
      {canShare ? <button disabled={sharing} onClick={() => {
        // Invoke synchronously from the click: async image rendering loses mobile user activation.
        setError(""); setSharing(true);
        navigator.share({ files: [file], text: caption }).catch(error => {
          if (error.name !== "AbortError") setError("Sharing could not open. Download the PNG instead.");
        }).finally(() => setSharing(false));
      }}><Share2 size={16} />Share to an app</button> : <p>Direct sharing isn’t supported here. Download the image, then attach it to your post.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  </Modal>;
}

export default function ExportActions({ garments, pieces, caption, disabled }: { garments: Garment[]; pieces: Piece[]; caption: string; disabled: boolean }) {
  const [ready, setReady] = useState<{ file: File; caption: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function prepare() {
    setBusy(true); setError("");
    try {
      const blob = await renderExport(garments, pieces, caption);
      setReady({ file: new File([blob], "my-wardrobe-look.png", { type: "image/png" }), caption });
    } catch { setError("We couldn’t prepare this look. Check that its photos load and try again."); }
    finally { setBusy(false); }
  }
  return <><div className="row">
    <button disabled={disabled || busy} onClick={prepare}><Download size={16} />Export PNG</button>
    <button disabled={disabled || busy} onClick={prepare}><Share2 size={16} />Share</button>
  </div>{busy && <p role="status">Preparing your image…</p>}{error && <p className="error" role="alert">{error}</p>}
  {ready && <ReadyExport file={ready.file} caption={ready.caption} onClose={() => setReady(undefined)} />}</>;
}

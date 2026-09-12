"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Shirt } from "lucide-react";
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  if(typeof navigator!=='undefined'&&!navigator.onLine)throw new Error('You’re offline. Reconnect before saving or using AI. Your current edits are still on this page.');
  const response = await fetch(path, { method, credentials: "same-origin", headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if(method==='POST'&&['/api/creator','/api/stylist','/api/spotter','/api/discovery'].includes(path))window.dispatchEvent(new Event('wardrobe-ai-used'));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}). Please try again.`);
  return data as T;
}
export function Modal({ title, children, onClose, dark = false }: { title: string; children: ReactNode; onClose: () => void; dark?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; d?.showModal(); const old = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { d?.close(); document.body.style.overflow = old; }; }, []);
  return <dialog ref={ref} aria-label={title} className={`modal ${dark ? "dark-modal" : ""}`} onCancel={e => { e.preventDefault(); onClose(); }}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <div className="empty"><div className="empty-icon"><Shirt size={32} strokeWidth={1.4}/></div><h2>{title}</h2><p>{children}</p>{action}</div>; }
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the URL alive while mobile browsers hand the file to their download manager.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export const categories = ["tops", "bottoms", "outerwear", "shoes", "accessories", "dresses"] as const;
export async function upload(file: File) { if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP image under 4 MB."); const body = new FormData(); body.append("file", file); return (await api<{ imageUrl: string }>("/api/uploads", "POST", body)).imageUrl; }

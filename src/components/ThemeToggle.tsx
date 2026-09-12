"use client";
import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
type Theme = 'system' | 'light' | 'dark';
const key = 'wardrobe-theme';
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    function sync() {
      let preference: Theme = 'system';
      try { const saved = localStorage.getItem(key); if (saved === 'light' || saved === 'dark') preference = saved; } catch {}
      setTheme(preference);
      document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    }
    sync(); media.addEventListener('change', sync); window.addEventListener('storage', sync);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', sync); };
  }, []);
  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  const Icon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;
  return <button className="icon-button" aria-label={`Theme: ${theme}. Switch to ${next}`} title={`Theme: ${theme}. Switch to ${next}`} onClick={() => {
    setTheme(next);
    try { localStorage.setItem(key, next); } catch {}
    document.documentElement.dataset.theme = next === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : next;
  }}><Icon size={18}/></button>;
}

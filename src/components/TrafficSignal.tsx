'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { referralChannel, trafficSchema } from '@/lib/traffic';

export default function TrafficSignal() {
  const pathname = usePathname();
  const last = useRef('');
  useEffect(() => {
    if (
      navigator.doNotTrack === '1' ||
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
    )
      return;
    if (last.current === pathname) return;
    last.current = pathname;
    const input = trafficSchema.safeParse({
      page: pathname,
      channel: referralChannel(document.referrer),
      device: /iPad|Tablet/i.test(navigator.userAgent)
        ? 'tablet'
        : /Mobi|Android/i.test(navigator.userAgent)
          ? 'mobile'
          : 'desktop',
    });
    if (!input.success) return;
    void fetch('/api/traffic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.data),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}

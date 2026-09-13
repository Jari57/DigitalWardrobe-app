import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'FitStalker',
    short_name: 'FitStalker',
    description: 'See the fit. Find the pieces.',
    start_url: '/',
    scope: '/',
    share_target: {
      action: '/share-target',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        files: [{ name: 'screenshot', accept: ['image/jpeg', 'image/png', 'image/webp'] }],
      },
    },
    display: 'standalone',
    background_color: '#faf7f2',
    theme_color: '#151218',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

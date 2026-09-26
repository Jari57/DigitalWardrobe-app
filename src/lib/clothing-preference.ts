import type { StyleAudience } from './for-you';

export function clothingPreferenceContext(audience: StyleAudience = 'all-styles') {
  return {
    department: audience === 'all-styles' ? 'Any clothing department, including unisex' : audience,
    priority:
      'This is an explicitly chosen clothing preference, not gender identity. The current request, described garment and locked closet pieces take precedence. Never infer gender from a name, photo, body or color. Do not exclude owned pieces or an exact pictured item because of its department. For otherwise comparable shopping alternatives, prefer the chosen department and unisex options. Never claim sizing or fit is verified from a department label.',
  };
}

import { createHash } from 'node:crypto';
import type { StyleAudience } from '@/lib/for-you';

/** Call with validated input; edits and regions have separate daily reservations. */
export function discoveryRequestKey(
  input: { agent: string },
  day = new Date().toISOString().slice(0, 10),
  memoryVersion = 'none',
  clothingPreference: StyleAudience = 'all-styles',
) {
  return createHash('sha256')
    .update(
      (input.agent === 'shop' ? 'shopping-recall-v8:' : 'capture-evidence-v4:') +
        JSON.stringify(input) +
        ':' +
        day +
        (memoryVersion === 'none' ? '' : ':' + memoryVersion) +
        (input.agent === 'shop' ? ':clothing-preference-v1:' + clothingPreference : ''),
    )
    .digest('hex');
}

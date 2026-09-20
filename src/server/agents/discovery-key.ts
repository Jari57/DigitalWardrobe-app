import { createHash } from 'node:crypto';

/** Call with validated input; edits and regions have separate daily reservations. */
export function discoveryRequestKey(
  input: { agent: string },
  day = new Date().toISOString().slice(0, 10),
  memoryVersion = 'none',
) {
  return createHash('sha256')
    .update(
      (input.agent === 'shop' ? 'shopping-visual-v4:' : 'capture-evidence-v3:') +
        JSON.stringify(input) +
        ':' +
        day +
        (memoryVersion === 'none' ? '' : ':' + memoryVersion),
    )
    .digest('hex');
}

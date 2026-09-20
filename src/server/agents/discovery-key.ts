import { createHash } from 'node:crypto';

/** Call with validated input; edits and regions have separate daily reservations. */
export function discoveryRequestKey(
  input: { agent: string },
  day = new Date().toISOString().slice(0, 10),
) {
  return createHash('sha256')
    .update(
      (input.agent === 'shop' ? 'shopping-quality-v3:' : 'capture-v2:') +
        JSON.stringify(input) +
        ':' +
        day,
    )
    .digest('hex');
}

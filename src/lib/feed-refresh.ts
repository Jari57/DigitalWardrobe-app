/** New stories lead. Otherwise refresh offers another mix, without claiming novelty. */
export function refreshedSelection<T extends { id: string }>(
  previous: T[],
  incoming: T[],
  mode: string,
) {
  const previousIds = new Set(previous.map((item) => item.id));
  const added = incoming.filter((item) => !previousIds.has(item.id));
  if (mode !== 'for-you') return { items: incoming, added: added.length, mixed: false };
  if (added.length)
    return {
      items: [...added, ...incoming.filter((item) => previousIds.has(item.id))],
      added: added.length,
      mixed: false,
    };
  const byId = new Map(incoming.map((item) => [item.id, item]));
  const ordered = previous.flatMap((item) => {
    const current = byId.get(item.id);
    return current ? [current] : [];
  });
  const offset = Math.min(6, Math.max(0, ordered.length - 1));
  return {
    items: [...ordered.slice(offset), ...ordered.slice(0, offset)],
    added: 0,
    mixed: offset > 0,
  };
}

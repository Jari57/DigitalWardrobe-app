type Piece = { id: string; name: string; category: string };
export function outfitGaps(selected: Piece[], closet: Piece[]) {
  if (!selected.length) return [];
  const categories = new Set(selected.map((piece) => piece.category));
  const needed = [...(!categories.has('dresses') ? ['tops', 'bottoms'] : []), 'shoes'];
  return needed
    .filter((category) => !categories.has(category))
    .map((category) => ({
      category,
      owned: closet.filter((piece) => piece.category === category).slice(0, 3),
      pairsWith: selected
        .filter((piece) => ['tops', 'bottoms', 'dresses'].includes(piece.category))
        .slice(0, 2)
        .map((piece) => piece.name),
    }));
}
export function outfitSwaps(piece: Piece, closet: Piece[], selected: Piece[], locks: string[]) {
  if (locks.includes(piece.id)) return [];
  return closet
    .filter(
      (candidate) =>
        candidate.category === piece.category && !selected.some((item) => item.id === candidate.id),
    )
    .slice(0, 5);
}

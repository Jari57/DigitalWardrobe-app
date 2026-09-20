import {
  spotterResultSchema,
  stylistResultSchema,
  validateSpotterResult,
  validateStylistResult,
} from './contracts';
import { productCategory } from '@/lib/shopping-quality';
type Candidate = { id: string; category: string };

export function qualitySpotter(value: unknown, candidates: Candidate[]) {
  const result = spotterResultSchema.parse(value);
  const owned = new Map(candidates.map((item) => [item.id, item]));
  const used = new Set<string>();
  const elements = result.elements.map((element) => {
    if (!element.garmentId) return element;
    const candidate = owned.get(element.garmentId);
    const category = productCategory(element.description);
    if (!candidate || used.has(element.garmentId) || (category && category !== candidate.category))
      return {
        ...element,
        garmentId: null,
        explanation:
          'No supported owned match was retained for this piece. Choose a substitute manually or leave it unmatched.',
      };
    used.add(element.garmentId);
    return element;
  });
  return validateSpotterResult(
    { ...result, elements },
    candidates.map((item) => item.id),
  );
}

export function qualityStylist(value: unknown, candidates: Candidate[], lockedIds: string[]) {
  const result = stylistResultSchema.parse(value);
  const owned = new Map(candidates.map((item) => [item.id, item]));
  if (lockedIds.some((id) => !owned.has(id))) throw new Error('A locked piece is unavailable.');
  const garmentIds = [...new Set(lockedIds)];
  const categories = () => garmentIds.map((id) => owned.get(id)!.category);
  for (const id of result.garmentIds) {
    const item = owned.get(id);
    if (!item || garmentIds.includes(id) || garmentIds.length === 12) continue;
    const selected = categories();
    if (item.category !== 'accessories' && selected.includes(item.category)) continue;
    if (item.category === 'dresses' && selected.some((c) => ['tops', 'bottoms'].includes(c)))
      continue;
    if (['tops', 'bottoms'].includes(item.category) && selected.includes('dresses')) continue;
    garmentIds.push(id);
  }
  const changed =
    garmentIds.length !== result.garmentIds.length ||
    garmentIds.some((id) => !result.garmentIds.includes(id));
  const selected = categories();
  const limitations = [
    ...(changed
      ? [
          'The proposal was adjusted to preserve your locks and remove unsupported or conflicting selections.',
        ]
      : []),
    ...(!selected.includes('dresses') &&
    (!selected.includes('tops') || !selected.includes('bottoms'))
      ? ['This is a partial outfit: add a top and bottom, or a dress.']
      : []),
    ...(!selected.includes('shoes') ? ['Footwear is not included.'] : []),
    ...result.limitations,
  ].slice(0, 4);
  return validateStylistResult(
    {
      ...result,
      garmentIds,
      limitations,
      explanation: changed
        ? 'An editable combination of your saved pieces, with your locked items preserved. Review the fit and occasion before wearing.'
        : result.explanation,
    },
    candidates.map((item) => item.id),
    lockedIds,
  );
}

import {
  creatorResultSchema,
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

export function qualityStylist(
  value: unknown,
  candidates: Candidate[],
  lockedIds: string[],
  avoidCombinations: string[][] = [],
) {
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
  for (const rejected of avoidCombinations) {
    if (rejected.length < 2 || !rejected.every((id) => garmentIds.includes(id))) continue;
    const removable = [...garmentIds]
      .reverse()
      .find((id) => rejected.includes(id) && !lockedIds.includes(id));
    if (removable) garmentIds.splice(garmentIds.indexOf(removable), 1);
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

export function qualityCreator(
  value: unknown,
  garments: { name: string; category: string; color: string; brand?: string }[],
) {
  const result = creatorResultSchema.parse(value);
  const text = [result.caption, ...result.filmingSteps].join(' ').toLowerCase();
  const source = garments
    .map((item) => [item.name, item.brand ?? ''].join(' ').toLowerCase())
    .join(' ');
  const materials = [
    'cashmere',
    'silk',
    'wool',
    'leather',
    'linen',
    'cotton',
    'polyester',
    'suede',
    'velvet',
  ];
  const unsupportedMaterial = materials.some(
    (word) =>
      new RegExp('\\b' + word + '\\b').test(text) && !new RegExp('\\b' + word + '\\b').test(source),
  );
  const brands = [
    'adidas',
    'nike',
    'gucci',
    'prada',
    'zara',
    'chanel',
    'louis vuitton',
    'uniqlo',
    'miu miu',
    'saint laurent',
    'balenciaga',
    'dior',
    'birkenstock',
    'versace',
    'hermes',
  ];
  const unsupportedBrand = brands.some((brand) => text.includes(brand) && !source.includes(brand));
  const claims =
    /https?:|www\.|\$\s*\d|\b(sponsored|paid partnership|guaranteed viral|best.selling|trending worldwide)\b/i.test(
      text,
    );
  if (!unsupportedMaterial && !unsupportedBrand && !claims)
    return {
      ...result,
      groundingNote: 'Drafted from saved garment descriptions; review before sharing.',
    };
  return {
    caption: 'A fresh look from pieces I already own.',
    filmingSteps: [
      'Set your phone on a stable surface in good light.',
      'Record a short full-outfit shot.',
      'Add a close-up of a detail you like.',
    ],
    groundingNote:
      'An unsupported brand, material or promotional claim was removed. This simpler draft uses no unverified product details.',
  };
}

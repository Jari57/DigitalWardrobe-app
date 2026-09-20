import { z } from 'zod';
export const learningAgents = ['detect', 'shop', 'spotter', 'stylist', 'creator'] as const;
export type LearningAgent = (typeof learningAgents)[number];
export const feedbackReasons = {
  detect: {
    'wrong-type': 'Wrong garment type',
    'invented-detail': 'Guessed a detail',
    'missed-piece': 'Missed a visible piece',
  },
  shop: {
    'wrong-color': 'Wrong color',
    'wrong-shape': 'Wrong shape',
    'wrong-product': 'Different product',
    'poor-retailer': 'Unhelpful retailer',
  },
  spotter: { 'wrong-pairing': 'Pieces do not match', 'forced-match': 'Should be unmatched' },
  stylist: {
    'too-formal': 'Too formal',
    'too-casual': 'Too casual',
    'wrong-weather': 'Wrong for the weather',
    'bad-pairing': 'Do not repeat this combination',
  },
  creator: {
    'too-wordy': 'Too wordy',
    'too-salesy': 'Too promotional',
    'invented-detail': 'Includes an unsupported detail',
  },
} as const;
export const feedbackDetailsSchema = z
  .object({ reason: z.string().max(40).nullable(), remember: z.boolean() })
  .strict();
export const learningRules: Record<string, string> = {
  'wrong-type':
    'Take extra care distinguishing garment categories; leave ambiguous types uncertain.',
  'invented-detail':
    'Avoid inferred branding, materials or model details; use only explicitly supported information.',
  'missed-piece': 'Check all clearly visible pieces within the scan limit and state omissions.',
  'wrong-color': 'Prioritize the observed garment color and explain any color difference.',
  'wrong-shape':
    'Prioritize matching cut and silhouette; do not substitute a materially different shape.',
  'wrong-product':
    'Check the product model and variant carefully and keep uncertain identities unverified.',
  'poor-retailer':
    'Prefer the brand store and established retailers; never imply a seller is endorsed.',
  'wrong-pairing': 'Compare garment details carefully instead of matching solely by color.',
  'forced-match': 'Prefer no owned match over an unrelated substitute.',
  'too-formal':
    'The user has asked for more relaxed combinations. Follow the current occasion if it differs.',
  'too-casual':
    'The user has asked for more polished combinations. Follow the current occasion if it differs.',
  'wrong-weather':
    'Do not assume local weather. Explain layering tradeoffs when temperature is unknown.',
  'bad-pairing': 'Avoid the explicitly rejected combinations unless the user locks them together.',
  'too-wordy': 'Prefer very short captions and concise filming steps.',
  'too-salesy': 'Use a natural personal tone and avoid promotional language.',
};
export type AgentMemory = {
  version: string;
  feedbackCount: number;
  rules: string[];
  avoidCombinations: string[][];
  preferredCombinations: string[][];
};
export const emptyAgentMemory: AgentMemory = {
  version: 'none',
  feedbackCount: 0,
  rules: [],
  avoidCombinations: [],
  preferredCombinations: [],
};

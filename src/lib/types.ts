export const categories = [
  'tops',
  'bottoms',
  'outerwear',
  'shoes',
  'accessories',
  'dresses',
] as const;
export type Category = (typeof categories)[number];
export interface User {
  id: string;
  username: string;
}
export interface Garment {
  id: string;
  name: string;
  brand: string;
  category: Category;
  color: string;
  price: number | null;
  imageUrl: string;
  wearCount: number;
  createdAt: string;
}
export interface Piece {
  garmentId: string;
  x: number;
  y: number;
  scale: number;
  zIndex: number;
}
export interface Outfit {
  id: string;
  name: string;
  pieces: Piece[];
  createdAt: string;
}
export interface Reference {
  id: string;
  name: string;
  imageUrl: string;
  garmentIds: string[];
  createdAt: string;
}
export interface Wardrobe {
  garments: Garment[];
  outfits: Outfit[];
  references: Reference[];
}

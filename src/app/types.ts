export const IMAGE_TYPES = [
  'action',
  'weekly',
  'permanent1',
  'permanent2',
  'permanent3',
  'permanent4',
] as const;

export type ImageType = (typeof IMAGE_TYPES)[number];

export interface ImageOcrData {
  fullText: string;
  altText: string;
}

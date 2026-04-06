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

export interface Reservation {
  id: string;
  name: string;
  email: string;
  seats: number;
  date: string;
  timeFrom: string;
  timeTo: string;
  note?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  token: string;
  createdAt: string;
}

export interface MenuItem {
  name: string;
  price: number;
}

export interface MenuDay {
  day: string;
  date: string;
  meals: MenuItem[];
}

export interface WeeklyMenu {
  days: MenuDay[];
}

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  name: string;
  phone: string;
  address: string;
  village: string;
  note?: string;
  day: string;
  date: string;
  items: OrderItem[];
  createdAt: string;
}

export interface GalleryItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  createdAt: string;
}

export type SceneType =
  | 'ai-lifestyle'
  | 'ai-experience'
  | 'real-product-closeup'
  | 'offer-cta'
  | 'real-footage';

export type QcStatus = 'pending' | 'approved' | 'rejected';

export interface WordTiming {
  display: string;
  start: number;
  end: number;
}

export interface SceneItem {
  id: string;
  type: SceneType;
  durationSec: number;
  subtitle: string;
  visualAction: string;
  setting: string;
  keyframeSrc?: string;
  audioSrc?: string;
  trimStartSec?: number;
  trimEndSec?: number;
  qcStatus?: QcStatus;
  videoSrc?: string;
  words?: WordTiming[];
}

export type ProductAdProps = {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  productName: string;
  sku: string;
  price: string;
  salePrice: string;
  discountBadge: string;
  highlights: string[];
  hookText: string;
  ctaText: string;
  productImageSrc?: string;
  subtitleStyle?: 'box' | 'word-highlight';
  scenes: SceneItem[];
};

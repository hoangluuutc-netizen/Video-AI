export type SceneType =
  | 'ai-lifestyle'
  | 'ai-experience'
  | 'real-product-closeup'
  | 'offer-cta'
  | 'real-footage';

export type QcStatus = 'pending' | 'approved' | 'rejected';

export interface SceneItem {
  id: string;
  type: SceneType;
  durationSec: number;
  subtitle: string;
  visualAction: string;
  setting: string;
  keyframeSrc?: string;
  trimStartSec?: number;
  trimEndSec?: number;
  qcStatus?: QcStatus;
  videoSrc?: string;
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
  scenes: SceneItem[];
};

import React from 'react';
import { CalculateMetadataFunction, Composition } from 'remotion';
import activeCampaign from './activeCampaign.json';
import { DEFAULT_PRODUCT_AD_PROPS } from './defaultProps';
import { ProductAdVideo } from './ProductAdVideo';
import type { ProductAdProps } from './types';

const FPS = 30;
const INITIAL_PROPS: ProductAdProps =
  (activeCampaign as ProductAdProps) || DEFAULT_PRODUCT_AD_PROPS;

const calculateAdMetadata: CalculateMetadataFunction<ProductAdProps> = ({ props }) => {
  const totalFrames = props.scenes.reduce(
    (sum, s) => sum + Math.max(1, Math.round(s.durationSec * FPS)),
    0
  );
  return {
    durationInFrames: Math.max(1, totalFrames),
    fps: FPS,
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TikTok-9x16"
        component={ProductAdVideo}
        calculateMetadata={calculateAdMetadata}
        width={1080}
        height={1920}
        defaultProps={INITIAL_PROPS}
      />
      <Composition
        id="Facebook-1x1"
        component={ProductAdVideo}
        calculateMetadata={calculateAdMetadata}
        width={1080}
        height={1080}
        defaultProps={INITIAL_PROPS}
      />
      <Composition
        id="Web-16x9"
        component={ProductAdVideo}
        calculateMetadata={calculateAdMetadata}
        width={1920}
        height={1080}
        defaultProps={INITIAL_PROPS}
      />
    </>
  );
};

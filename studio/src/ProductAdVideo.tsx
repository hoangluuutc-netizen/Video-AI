import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { ProductAdProps, SceneItem } from './types';

const FPS = 30;

function resolveMediaSrc(src?: string): string | undefined {
  if (!src) return undefined;
  if (/^(https?:|data:|blob:|\/)/.test(src)) return src;
  return staticFile(src);
}

const SceneView: React.FC<{
  scene: SceneItem;
  props: ProductAdProps;
  isFirst: boolean;
}> = ({ scene, props, isFirst }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isVertical = height > width;

  const enter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  const isRealFootage = scene.type === 'real-footage';
  // Cảnh quay thật: không phóng to tự động để giữ nguyên điểm ảnh gốc.
  const zoom = isRealFootage
    ? 1
    : interpolate(frame, [0, scene.durationSec * fps], [1, 1.05], {
        extrapolateRight: 'clamp',
      });

  const isOffer = scene.type === 'offer-cta';
  const isProductTruth = scene.type === 'real-product-closeup';

  const resolvedVideoSrc = resolveMediaSrc(scene.videoSrc);
  const resolvedKeyframeSrc = resolveMediaSrc(scene.keyframeSrc);
  const resolvedAudioSrc = resolveMediaSrc(scene.audioSrc);
  const resolvedProductImgSrc = resolveMediaSrc(props.productImageSrc);
  const trimStartFrame = Math.max(0, Math.round((scene.trimStartSec ?? 0) * fps));
  const trimEndFrame =
    scene.trimEndSec !== undefined ? Math.round(scene.trimEndSec * fps) : undefined;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: isOffer ? props.secondaryColor : '#0F172A',
        color: '#FFFFFF',
        fontFamily: 'Inter, system-ui, sans-serif',
        justifyContent: 'space-between',
        padding: isVertical ? '72px 48px' : '48px 72px',
      }}
    >
      {/* Lồng tiếng / Giọng đọc thuyết minh cảnh */}
      {resolvedAudioSrc ? <Audio src={resolvedAudioSrc} /> : null}

      {/* Background Video (AI Clip) hoặc Keyframe Preview */}
      {resolvedVideoSrc ? (
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
          <OffthreadVideo
            src={resolvedVideoSrc}
            startFrom={trimStartFrame}
            endAt={trimEndFrame}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <AbsoluteFill
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 45%, rgba(0,0,0,0.75) 100%)',
            }}
          />
        </AbsoluteFill>
      ) : resolvedKeyframeSrc ? (
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
          <Img
            src={resolvedKeyframeSrc}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <AbsoluteFill
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 45%, rgba(0,0,0,0.75) 100%)',
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* Top Bar: Brand + Discount Badge */}
      <div
        style={{
          zIndex: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.85)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '10px 20px',
            borderRadius: 999,
            fontSize: isVertical ? 26 : 22,
            fontWeight: 700,
          }}
        >
          {props.brandName}
        </div>
        <div
          style={{
            backgroundColor: props.primaryColor,
            padding: '10px 22px',
            borderRadius: 999,
            fontSize: isVertical ? 26 : 22,
            fontWeight: 800,
          }}
        >
          {props.discountBadge}
        </div>
      </div>

      {/* Center Content */}
      <div
        style={{
          zIndex: 2,
          flex: 1,
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          transform: `translateY(${(1 - enter) * 24}px)`,
          opacity: enter,
        }}
      >
        {isFirst && (
          <div
            style={{
              backgroundColor: props.accentColor,
              color: '#111827',
              padding: '18px 28px',
              borderRadius: 20,
              fontSize: isVertical ? 40 : 34,
              fontWeight: 900,
              textAlign: 'center',
              maxWidth: isVertical ? '95%' : '70%',
              boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
            }}
          >
            {props.hookText}
          </div>
        )}

        {(isProductTruth || isOffer || !scene.videoSrc) && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 28,
              padding: 32,
              maxWidth: isVertical ? '92%' : '65%',
              textAlign: 'center',
            }}
          >
            {resolvedProductImgSrc ? (
              <Img
                src={resolvedProductImgSrc}
                style={{
                  width: isVertical ? 420 : 320,
                  height: isVertical ? 420 : 320,
                  objectFit: 'contain',
                  transform: `scale(${zoom})`,
                }}
              />
            ) : (
              <div
                style={{
                  width: isVertical ? 380 : 280,
                  height: isVertical ? 260 : 200,
                  borderRadius: 20,
                  border: '2px dashed rgba(255,255,255,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 20,
                  fontSize: 22,
                  color: '#CBD5E1',
                }}
              >
                {isProductTruth
                  ? 'Ảnh sản phẩm gốc độ phân giải cao (100% nguyên bản)'
                  : scene.visualAction}
              </div>
            )}

            <div style={{ fontSize: isVertical ? 34 : 28, fontWeight: 800 }}>
              {props.productName}
            </div>

            {isProductTruth && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {props.highlights.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: isVertical ? 26 : 22,
                      color: '#E2E8F0',
                    }}
                  >
                    ✓ {item}
                  </div>
                ))}
              </div>
            )}

            {isOffer && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
                  <span
                    style={{
                      fontSize: 30,
                      textDecoration: 'line-through',
                      color: '#94A3B8',
                    }}
                  >
                    {props.price}
                  </span>
                  <span
                    style={{
                      fontSize: 54,
                      fontWeight: 900,
                      color: props.accentColor,
                    }}
                  >
                    {props.salePrice}
                  </span>
                </div>
                <div
                  style={{
                    backgroundColor: props.primaryColor,
                    padding: '16px 32px',
                    borderRadius: 16,
                    fontSize: 28,
                    fontWeight: 800,
                  }}
                >
                  {props.ctaText}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Subtitle */}
      <div
        style={{
          zIndex: 2,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {props.subtitleStyle === 'word-highlight' && scene.words && scene.words.length > 0 ? (() => {
          const currentSec = frame / fps;
          const activeIdx = Math.max(
            0,
            scene.words.findIndex((w, i) => currentSec >= w.start && (currentSec < w.end || i === scene.words!.length - 1))
          );
          const chunkIdx = Math.floor(activeIdx / 3);
          const chunk = scene.words.slice(chunkIdx * 3, chunkIdx * 3 + 3);
          return (
            <div
              style={{
                padding: '12px 24px',
                fontSize: isVertical ? 40 : 32,
                fontWeight: 900,
                textAlign: 'center',
                lineHeight: 1.3,
                maxWidth: '92%',
                textShadow: '0 3px 8px rgba(0,0,0,0.95), 0 0 2px #000',
              }}
            >
              {chunk.map((w, idx) => {
                const globalIdx = chunkIdx * 3 + idx;
                const isActive = globalIdx === activeIdx && currentSec >= w.start;
                return (
                  <span
                    key={`${globalIdx}-${w.display}`}
                    style={{
                      display: 'inline-block',
                      margin: '0 6px',
                      color: isActive ? '#FACC15' : '#FFFFFF',
                      transform: isActive ? 'scale(1.12)' : 'scale(1)',
                    }}
                  >
                    {w.display}
                  </span>
                );
              })}
            </div>
          );
        })() : (
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.78)',
              padding: '16px 28px',
              borderRadius: 16,
              fontSize: isVertical ? 32 : 26,
              fontWeight: 700,
              textAlign: 'center',
              lineHeight: 1.35,
              maxWidth: '92%',
            }}
          >
            {scene.subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const ProductAdVideo: React.FC<ProductAdProps> = (props) => {
  let offsetFrames = 0;

  return (
    <AbsoluteFill>
      {props.scenes.map((scene, index) => {
        const durationInFrames = Math.max(1, Math.round(scene.durationSec * FPS));
        const from = offsetFrames;
        offsetFrames += durationInFrames;

        return (
          <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
            <SceneView scene={scene} props={props} isFirst={index === 0} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

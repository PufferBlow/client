import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';

interface CroppableImageProps {
  imageSrc: string;
  aspect?: number; // width/height ratio, e.g., 1 for square, 16/9 for banner
  shape?: 'rect' | 'round'; // for avatar use 'round', for banner use 'rect'
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
  className?: string;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function CroppableImage({
  imageSrc,
  aspect = 1,
  shape = 'rect',
  onCropComplete,
  onCancel,
  className = ''
}: CroppableImageProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const zoomPercentage = ((zoom - 0.1) / 2.9) * 100;

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onCropAreaChange = useCallback((croppedArea: any, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
      image.crossOrigin = 'anonymous';
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: CropArea): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    const maxSize = Math.max(image.naturalWidth, image.naturalHeight);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.naturalWidth / 2,
      safeArea / 2 - image.naturalHeight / 2
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(
      data,
      Math.round(0 - safeArea / 2 + image.naturalWidth / 2 - pixelCrop.x),
      Math.round(0 - safeArea / 2 + image.naturalHeight / 2 - pixelCrop.y)
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob!);
        },
        'image/jpeg',
        0.95
      );
    });
  };

  const handleCropConfirm = async () => {
    if (!croppedAreaPixels || isProcessing) return;

    setIsProcessing(true);
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImageBlob);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 animate-fade-in ${className}`}>
      <div
        className="absolute inset-0 backdrop-blur-xl"
        style={{
          background:
            "radial-gradient(circle at top, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 40%), color-mix(in srgb, var(--color-shadow-lg) 55%, transparent)",
        }}
      ></div>

      <div
        className="relative animate-scale-in max-w-md w-full mx-4 transform rounded-3xl border bg-[var(--color-surface)] opacity-100 shadow-2xl transition-all duration-300 scale-100"
        style={{
          borderColor: "color-mix(in srgb, var(--color-border) 85%, var(--color-accent) 15%)",
          boxShadow:
            "0 25px 50px -12px color-mix(in srgb, var(--color-shadow-lg) 65%, transparent), 0 0 0 1px color-mix(in srgb, var(--color-border) 65%, transparent)",
        }}
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] p-6">
          <h3 className="flex items-center space-x-3 text-lg font-semibold text-[var(--color-text)]">
            <svg className="w-6 h-6 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011-1V6.414a1 1 0 00-.293-.707l-2-2A1 1 0 0012.414 4H11z" />
            </svg>
            <span>Crop Image</span>
          </h3>
        </div>

        {/* Crop Area */}
        <div className="relative mx-6 mb-2 mt-4 h-64 overflow-hidden rounded-2xl bg-[var(--color-background)]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={shape}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropAreaChange={onCropAreaChange}
            style={{
              containerStyle: {
                width: '100%',
                height: '100%',
                backgroundColor: 'var(--color-background)'
              },
              cropAreaStyle: {
                border: '3px solid var(--color-accent)',
                borderRadius: shape === 'round' ? '50%' : '8px',
                boxShadow: '0 0 20px color-mix(in srgb, var(--color-accent) 30%, transparent)',
                background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
              },
              mediaStyle: {
                objectFit: 'contain'
              }
            }}
          />

          {/* Overlay instructions */}
          <div className="absolute left-2 top-2 rounded-full border border-[var(--color-border-secondary)] bg-[color:color-mix(in_srgb,var(--color-surface)_82%,transparent)] px-3 py-1 text-xs text-[var(--color-text)] backdrop-blur-sm">
            {shape === 'round' ? 'Avatar - Round' : 'Banner - Rectangle'}
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 space-y-6">
          {/* Zoom Slider */}
          <div>
            <label className="mb-3 flex items-center space-x-2 text-sm font-medium text-[var(--color-text)]">
              <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Zoom Level</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="slider h-3 w-full cursor-pointer appearance-none rounded-lg align-middle"
              style={{
                background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${zoomPercentage}%, color-mix(in srgb, var(--color-border-secondary) 70%, transparent) ${zoomPercentage}%, color-mix(in srgb, var(--color-border-secondary) 70%, transparent) 100%)`
              }}
            />
            <div className="mt-2 flex justify-between text-xs font-medium text-[var(--color-text-muted)]">
              <span>0.1x</span>
              <span className="text-sm font-semibold text-[var(--color-text)]">{zoom.toFixed(1)}x</span>
              <span>3x</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-4 text-center text-sm text-[var(--color-text-secondary)]">
            <svg className="mx-auto mb-2 w-5 h-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {shape === 'round'
              ? <span>Drag to reposition the image. Use zoom to fit your face perfectly within the circular area.</span>
              : <span>Drag to reposition the image. Use zoom to adjust the banner framing.</span>
            }
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-5 py-2.5 font-medium text-[var(--color-text-secondary)] transition-all duration-300 hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Cancel</span>
              </div>
            </button>
            <button
              onClick={handleCropConfirm}
              disabled={isProcessing}
              className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-5 py-2.5 font-medium text-[var(--color-on-primary)] transition-all duration-300 hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex items-center space-x-2">
                {isProcessing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Apply Crop</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

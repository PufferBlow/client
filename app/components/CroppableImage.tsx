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
      {/* Enhanced backdrop with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60 backdrop-blur-xl"></div>

      <div className="relative glassmorphism animate-scale-in rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] border border-white/20 max-w-md w-full mx-4 transition-all duration-300 transform scale-100 opacity-100">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="text-white font-semibold text-lg flex items-center space-x-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011-1V6.414a1 1 0 00-.293-.707l-2-2A1 1 0 0012.414 4H11z" />
            </svg>
            <span>Crop Image</span>
          </h3>
        </div>

        {/* Crop Area */}
        <div className="relative h-64 bg-black mx-6 mt-4 mb-2 overflow-hidden rounded-2xl">
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
                backgroundColor: '#000'
              },
              cropAreaStyle: {
                border: '3px solid #60A5FA',
                borderRadius: shape === 'round' ? '50%' : '8px',
                boxShadow: '0 0 20px rgba(96, 165, 250, 0.3)',
                background: 'rgba(96, 165, 250, 0.1)'
              },
              mediaStyle: {
                objectFit: 'contain'
              }
            }}
          />

          {/* Overlay instructions */}
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
            {shape === 'round' ? 'Avatar - Round' : 'Banner - Rectangle'}
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 space-y-6">
          {/* Zoom Slider */}
          <div>
            <label className="block text-sm font-medium text-white mb-3 flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer slider align-middle"
              style={{
                background: `linear-gradient(to right, #60A5FA 0%, #60A5FA ${((zoom - 0.1) / 2.9) * 100}%, rgba(255,255,255,0.1) ${((zoom - 0.1) / 2.9) * 100}%, rgba(255,255,255,0.1) 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-white/60 mt-2 font-medium">
              <span>0.1x</span>
              <span className="text-white font-semibold text-sm">{zoom.toFixed(1)}x</span>
              <span>3x</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-white/70 text-center bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
            <svg className="w-5 h-5 mx-auto mb-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="glassmorphism-light px-5 py-2.5 text-white/80 hover:text-white border border-white/20 hover:border-white/30 rounded-xl transition-all duration-300 font-medium hover-lift hover:shadow-lg hover:shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="glassmorphism px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white border border-blue-400/30 hover:border-blue-400/50 rounded-xl transition-all duration-300 font-medium hover-lift hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
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

import React, { useState, useEffect } from 'react';
import { Check, X, Mic, Volume2, Loader2, Circle, Music } from 'lucide-react';

// Custom Volume Slider Component
interface ModernSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  showValue?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ModernSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  size = 'medium',
  color = '[var(--color-primary)]',
  showValue = true,
  disabled = false,
  className = ''
}: ModernSliderProps) {
  const sizeClasses = {
    small: 'h-1',
    medium: 'h-2',
    large: 'h-3'
  };

  const thumbClasses = {
    small: 'w-3 h-3',
    medium: 'w-5 h-5',
    large: 'w-6 h-6'
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className={`w-full rounded-full bg-[var(--color-surface-secondary)] ${sizeClasses[size]}`} />

        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-200 ${color.includes("bg-") ? color : "bg-[var(--color-primary)]"}`}
          style={{ width: `${percentage}%` }}
        />

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          disabled={disabled}
          className={`
            absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
            [&::-webkit-slider-thumb]:bg-[var(--color-background)]
            [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[var(--color-border)]
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:duration-150
            [&::-webkit-slider-thumb]:hover:border-[var(--color-primary)]
            [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6
            [&::-moz-range-thumb]:bg-[var(--color-background)]
            [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-[var(--color-border)]
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:cursor-pointer
            disabled:cursor-not-allowed
          `}
        />
      </div>

      {showValue && (
        <div className="flex justify-end mt-1">
          <span className={`rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1 text-sm font-medium ${color.includes('text') ? color : 'text-[var(--color-text)]'}`}>
            {value}{max === 100 ? '%' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

// Modern Toggle Switch Component
interface ModernToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  disabled?: boolean;
  className?: string;
  icons?: {
    on?: React.ReactNode;
    off?: React.ReactNode;
  };
  labels?: {
    on?: string;
    off?: string;
  };
}

export function ModernToggle({
  checked,
  onChange,
  size = 'medium',
  color = '[var(--color-primary)]',
  disabled = false,
  className = '',
  icons,
  labels
}: ModernToggleProps) {
  const sizeClasses = {
    small: { container: 'w-12 h-6', thumb: 'w-4 h-4', translate: 'translate-x-6' },
    medium: { container: 'w-16 h-8', thumb: 'w-6 h-6', translate: 'translate-x-8' },
    large: { container: 'w-20 h-10', thumb: 'w-8 h-8', translate: 'translate-x-10' }
  };

  const currentSize = sizeClasses[size];

  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`
        relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out
        ${currentSize.container} ${color} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${checked ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border border-[var(--color-primary)]' : 'bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)]'}
        ${className}
      `}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[10px] font-medium transition-all duration-150 ${
          checked
            ? 'text-[var(--color-on-primary)] scale-100'
            : 'text-[var(--color-text-secondary)] scale-75'
        }`}>
          {checked ? (labels?.on || 'ON') : (labels?.off || 'OFF')}
        </span>
      </div>

      <div
        className={`
          relative inline-block rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background)] transition-all duration-200 ease-in-out
          ${currentSize.thumb} flex items-center justify-center
          ${checked ? currentSize.translate : 'translate-x-0'}
        `}
      >
        <div className={`transition-all duration-200 ${checked ? 'scale-100' : 'scale-75'}`}>
          {checked ? (
            icons?.on || <Check className="w-3 h-3 text-current" />
          ) : (
            icons?.off || <X className="w-3 h-3 text-current" />
          )}
        </div>
      </div>
    </button>
  );
}

// Modern Audio Test Button Component
interface AudioTestButtonProps {
  onClick: () => void;
  isActive: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function AudioTestButton({
  onClick,
  isActive,
  isLoading = false,
  children,
  variant = 'primary',
  size = 'medium',
  className = ''
}: AudioTestButtonProps) {
  const variantClasses = {
    primary: isActive
      ? 'bg-[var(--color-active)] text-[var(--color-text)] border-[var(--color-border)]'
      : 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]',
    secondary: isActive
      ? 'bg-[var(--color-active)] text-[var(--color-text)] border-[var(--color-border)]'
      : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]',
    success: isActive
      ? 'bg-[var(--color-active)] text-[var(--color-text)] border-[var(--color-border)]'
      : 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-hover)]',
    error: isActive
      ? 'bg-[var(--color-active)] text-[var(--color-text)] border-[var(--color-border)]'
      : 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-hover)]',
    warning: isActive
      ? 'bg-[var(--color-active)] text-[var(--color-text)] border-[var(--color-border)]'
      : 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-hover)]'
  };

  const sizeClasses = {
    small: 'px-4 py-2 text-sm',
    medium: 'px-6 py-3 text-base',
    large: 'px-8 py-4 text-lg'
  };

  const variantClass = variantClasses[variant];
  const sizeClass = sizeClasses[size];

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        relative overflow-hidden rounded-xl border font-semibold transition-colors duration-150
        ${variantClass} ${sizeClass}
        ${isActive ? 'ring-2 ring-[var(--color-focus)] ring-offset-2 ring-offset-[var(--color-background)]' : ''}
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[color:color-mix(in_srgb,var(--color-background)_72%,transparent)]">
          <Loader2 className="animate-spin w-5 h-5 text-current" />
        </div>
      )}

      <div className="flex items-center justify-center space-x-2">
        {isActive && <Circle className="w-4 h-4" />}
        <span>{children}</span>
      </div>
    </button>
  );
}

// Modern Audio Level Meter Component
interface AudioLevelMeterProps {
  level: number;
  min?: number;
  max?: number;
  showValue?: boolean;
  color?: string;
  segments?: number;
  className?: string;
}

export function AudioLevelMeter({
  level,
  min = 0,
  max = 100,
  showValue = true,
  color = 'green',
  segments = 10,
  className = ''
}: AudioLevelMeterProps) {
  const percentage = Math.min(100, Math.max(0, ((level - min) / (max - min)) * 100));

  // Determine color based on level
  const getColor = (level: number) => {
    if (level < 30) return 'bg-[var(--color-success)]';
    if (level < 70) return 'bg-[var(--color-warning)]';
    return 'bg-[var(--color-error)]';
  };

  const meterColor = color.startsWith('bg-') ? color : getColor(percentage);
  const meterValueColor =
    meterColor === 'bg-[var(--color-success)]'
      ? 'text-[var(--color-on-success)]'
      : meterColor === 'bg-[var(--color-warning)]'
        ? 'text-[var(--color-on-warning)]'
        : 'text-[var(--color-on-error)]';

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {/* Meter Container */}
      <div className="flex-1">
        <div className="flex items-center space-x-1">
          {/* Meter Segments */}
          {Array.from({ length: segments }).map((_, index) => {
            const segmentThreshold = ((index + 1) / segments) * 100;
            const isActive = percentage >= segmentThreshold;

            return (
              <div
                key={index}
                className={`h-6 w-2 rounded-full transition-all duration-200 ${
                  isActive ? meterColor : 'bg-[var(--color-surface-secondary)]'
                }`}
                style={{
                  height: isActive ? `${(index + 1) * 2 + 6}px` : '6px'
                }}
              />
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="mt-2 bg-[var(--color-surface-secondary)] rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${meterColor} transition-all duration-300 rounded-full shadow-sm`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Value Display */}
      {showValue && (
        <div className="flex items-center space-x-2">
          <div className={`px-3 py-1 rounded-lg border border-transparent text-sm font-bold shadow-sm ${meterColor} ${meterValueColor}`}>
            {Math.round(percentage)}%
          </div>
        </div>
      )}
    </div>
  );
}

// Modern Spectrum Analyzer Component
interface SpectrumAnalyzerProps {
  data: Uint8Array | number[];
  isActive: boolean;
  width?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  smoothBars?: boolean;
  color?: string;
  className?: string;
}

export function SpectrumAnalyzer({
  data,
  isActive,
  width = 200,
  height = 100,
  barWidth = 3,
  gap = 1,
  smoothBars = true,
  color = '[var(--color-primary)]',
  className = ''
}: SpectrumAnalyzerProps) {
  if (!isActive) {
    return (
      <div
        className={`bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg ${className}`}
        style={{ width, height }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <Music className="w-8 h-8 text-[var(--color-text-muted)]" />
        </div>
      </div>
    );
  }

  const numBars = Math.floor(width / (barWidth + gap));
  const dataLength = data.length;

  return (
    <div className={`bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg overflow-hidden ${className}`}>
      <svg width={width} height={height} className="block">
        {Array.from({ length: numBars }).map((_, index) => {
          const dataIndex = Math.floor((index / numBars) * dataLength);
          const value = data[dataIndex] || 0;
          const barHeight = smoothBars
            ? (value / 255) * height
            : Math.min(height, Math.max(4, (value / 255) * height));

          const x = index * (barWidth + gap);

          return (
            <rect
              key={index}
              x={x}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              fill="var(--color-primary)"
              rx={2}
              className="transition-all duration-75"
            />
          );
        })}
      </svg>
    </div>
  );
}

// Modern Device Card Component
interface DeviceCardProps {
  device: MediaDeviceInfo & { selected?: boolean };
  onSelect: () => void;
  type: 'input' | 'output';
  className?: string;
}

export function DeviceCard({
  device,
  onSelect,
  type,
  className = ''
}: DeviceCardProps) {
  const icon = type === 'input' ? (
    <Mic className="w-6 h-6 text-[var(--color-primary)]" />
  ) : (
    <Volume2 className="w-6 h-6 text-[var(--color-accent)]" />
  );

  return (
    <div
      onClick={onSelect}
      className={`
        relative rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-4 cursor-pointer
        transition-colors duration-150
        ${device.selected
          ? 'ring-2 ring-[var(--color-focus)] ring-offset-2 ring-offset-[var(--color-background)] border-[var(--color-border)] bg-[var(--color-surface-secondary)]'
          : 'hover:border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]'
        }
        ${className}
      `}
    >
      {device.selected && (
        <div className="absolute top-2 right-2">
          <Check className="w-5 h-5 text-[var(--color-text)]" />
        </div>
      )}

      <div className="flex items-center space-x-3">
        <div className={`rounded-lg border border-[var(--color-border-secondary)] p-2 ${device.selected ? 'bg-[var(--color-background)]' : 'bg-[var(--color-surface-secondary)]'}`}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold truncate ${device.selected ? 'text-[var(--color-text)]' : 'text-[var(--color-text)]'}`}>
            {device.label || `Device ${device.deviceId.slice(-4)}`}
          </h4>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">
            {type === 'input' ? 'Input Device' : 'Output Device'}
          </p>
        </div>
      </div>
    </div>
  );
}

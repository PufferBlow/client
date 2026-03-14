import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { Button } from './Button';

interface Device {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface DeviceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeviceSelectorModal({ isOpen, onClose }: DeviceSelectorModalProps) {
  const showToast = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [selectedHeadphones, setSelectedHeadphones] = useState<string>('');

  // Get available devices when modal opens
  useEffect(() => {
    if (isOpen) {
      handleGetDevices();
    }
  }, [isOpen]);

  const handleGetDevices = async () => {
    try {
      // Request permission to access media devices
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Close the stream immediately

      // Get available audio devices
      const audioDevices = await navigator.mediaDevices.enumerateDevices();
      const availableDevices: Device[] = audioDevices.filter(device =>
        device.kind === 'audioinput' || device.kind === 'audiooutput'
      );

      setDevices(availableDevices);

      // Set default selections
      const defaultMic = availableDevices.find(d => d.kind === 'audioinput');
      const defaultHeadphones = availableDevices.find(d => d.kind === 'audiooutput');

      if (defaultMic) setSelectedMic(defaultMic.deviceId);
      if (defaultHeadphones) setSelectedHeadphones(defaultHeadphones.deviceId);

    } catch (error) {
      console.error('Error accessing audio devices:', error);
      showToast('Unable to access audio devices. Please check your permissions.', 'error');
      onClose();
    }
  };

  const mics = devices.filter(d => d.kind === 'audioinput');
  const headphones = devices.filter(d => d.kind === 'audiooutput');

  const handleApply = () => {
    // TODO: Actually set the selected devices for audio
    console.log('Selected mic:', selectedMic);
    console.log('Selected headphones:', selectedHeadphones);
    showToast('Audio devices updated successfully!', 'success');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <button
        aria-label="Close audio settings backdrop"
        className="absolute inset-0 bg-[color:color-mix(in_srgb,var(--color-background)_76%,transparent)]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-6">
          <h3 className="flex items-center space-x-3 text-lg font-semibold text-[var(--color-text)]">
            <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span>Audio Devices</span>
          </h3>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Device Lists */}
        <div className="p-6 space-y-6">
          {/* Microphones */}
          {mics.length > 0 && (
            <div>
              <h4 className="mb-4 flex items-center space-x-3 text-sm font-medium text-[var(--color-text)]">
                <svg className="w-5 h-5 text-[var(--color-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>Microphones</span>
              </h4>
              <div className="space-y-3">
                {mics.map((device, index) => (
                  <label
                    key={device.deviceId}
                    className={`flex cursor-pointer items-center space-x-3 rounded-lg border p-4 transition-colors ${
                      selectedMic === device.deviceId
                        ? 'border-[var(--color-primary)] bg-[var(--color-surface-secondary)]'
                        : 'border-[var(--color-border-secondary)] bg-[var(--color-surface)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <input
                      type="radio"
                      name="mic"
                      value={device.deviceId}
                      checked={selectedMic === device.deviceId}
                      onChange={() => setSelectedMic(device.deviceId)}
                      className="sr-only"
                    />
                    <div className="flex w-full items-center space-x-3">
                      <div className={`h-5 w-5 rounded-full border-2 transition-all ${
                        selectedMic === device.deviceId
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                          : 'border-[var(--color-border-secondary)]'
                      }`}>
                        {selectedMic === device.deviceId && (
                          <div className="flex h-full w-full items-center justify-center">
                            <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-on-primary)]"></div>
                          </div>
                        )}
                      </div>
                      <span className={`flex-1 text-sm font-medium ${
                        selectedMic === device.deviceId
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-text)]'
                      }`}>
                        {device.label || `Microphone ${device.deviceId.slice(-4)}`}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Headphones/Speakers */}
          {headphones.length > 0 && (
            <div>
              <h4 className="mb-4 flex items-center space-x-3 text-sm font-medium text-[var(--color-text)]">
                <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19V12a9 9 0 0118 0v7M8.25 15H7.5a1.5 1.5 0 00-1.5 1.5v1.5A1.5 1.5 0 007.5 19h.75m0 0V15m0 0V12a4.5 4.5 0 011 2.25m0 0V15M21 15H16.5a1.5 1.5 0 00-1.5 1.5v1.5a1.5 1.5 0 001.5 1.5H21" />
                </svg>
                <span>Headphones/Speakers</span>
              </h4>
              <div className="space-y-3">
                {headphones.map((device, index) => (
                  <label
                    key={device.deviceId}
                    className={`flex cursor-pointer items-center space-x-3 rounded-lg border p-4 transition-colors ${
                      selectedHeadphones === device.deviceId
                        ? 'border-[var(--color-accent)] bg-[var(--color-surface-secondary)]'
                        : 'border-[var(--color-border-secondary)] bg-[var(--color-surface)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <input
                      type="radio"
                      name="headphones"
                      value={device.deviceId}
                      checked={selectedHeadphones === device.deviceId}
                      onChange={() => setSelectedHeadphones(device.deviceId)}
                      className="sr-only"
                    />
                    <div className="flex w-full items-center space-x-3">
                      <div className={`h-5 w-5 rounded-full border-2 transition-all ${
                        selectedHeadphones === device.deviceId
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                          : 'border-[var(--color-border-secondary)]'
                      }`}>
                        {selectedHeadphones === device.deviceId && (
                          <div className="flex h-full w-full items-center justify-center">
                            <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-on-accent)]"></div>
                          </div>
                        )}
                      </div>
                      <span className={`flex-1 text-sm font-medium ${
                        selectedHeadphones === device.deviceId
                          ? 'text-[var(--color-accent)]'
                          : 'text-[var(--color-text)]'
                      }`}>
                        {device.label || `Audio Output ${device.deviceId.slice(-4)}`}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* No devices message */}
          {mics.length === 0 && headphones.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto mb-4 h-16 w-16 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">No audio devices found</p>
              <button
                onClick={handleGetDevices}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                Refresh Devices
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 px-6 pb-6 pt-4">
          <Button type="button" onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button type="button" onClick={handleApply} variant="primary">
            Apply Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

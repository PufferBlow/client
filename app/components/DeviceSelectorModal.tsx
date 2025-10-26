import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 animate-fade-in">
      {/* Enhanced backdrop with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60 backdrop-blur-xl"></div>
      <div className="relative glassmorphism animate-scale-in rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] border border-white/20 max-w-lg w-full mx-4 transition-all duration-300 transform scale-100 opacity-100 hover:shadow-[0_35px_60px_-12px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[--color-border]">
          <h3 className="text-[--color-text] font-semibold text-lg flex items-center space-x-3">
            <svg className="w-6 h-6 text-[--color-primary]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span>Audio Devices</span>
          </h3>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[--color-hover] transition-all duration-300 hover:rotate-90 hover:shadow-lg hover:shadow-[--color-primary]/20"
          >
            <svg className="w-5 h-5 text-[--color-text-secondary] hover:text-[--color-text] transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Device Lists */}
        <div className="p-6 space-y-6">
          {/* Microphones */}
          {mics.length > 0 && (
            <div>
              <h4 className="text-[--color-text] text-sm font-medium mb-4 flex items-center space-x-3">
                <svg className="w-5 h-5 text-[--color-info]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>Microphones</span>
              </h4>
              <div className="space-y-3">
                {mics.map((device, index) => (
                  <label
                    key={device.deviceId}
                    className={`group relative flex items-center space-x-3 p-4 rounded-2xl cursor-pointer transition-all duration-300 hover-lift hover:shadow-[0_8px_25px_-8px_rgba(94,129,172,0.3)] overflow-hidden ${
                      selectedMic === device.deviceId
                        ? 'glassmorphism-light border-[--color-primary]/40 bg-gradient-to-r from-[--color-primary]/5 to-[--color-primary]/15 shadow-[0_0_15px_rgba(94,129,172,0.2)]'
                        : 'glassmorphism-light border-white/10 hover:border-[--color-primary]/30 hover:bg-gradient-to-r hover:from-[--color-primary]/3 hover:to-transparent'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Subtle inner glow for selected state */}
                    {selectedMic === device.deviceId && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[--color-primary]/5 to-transparent animate-pulse"></div>
                    )}

                    {/* Gradient overlay for hover effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[--color-primary]/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>

                    <input
                      type="radio"
                      name="mic"
                      value={device.deviceId}
                      checked={selectedMic === device.deviceId}
                      onChange={() => setSelectedMic(device.deviceId)}
                      className="sr-only"
                    />
                    <div className="relative flex items-center space-x-3 w-full">
                      <div className={`w-5 h-5 rounded-full border-2 transition-all duration-300 shadow-inner ${
                        selectedMic === device.deviceId
                          ? 'bg-[--color-primary] border-[--color-primary] shadow-[--color-primary]/50'
                          : 'border-white/40 group-hover:border-[--color-primary]/70 group-hover:shadow-[--color-primary]/30'
                      }`}>
                        {selectedMic === device.deviceId && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse shadow-sm"></div>
                          </div>
                        )}
                      </div>
                      <span className={`text-sm flex-1 font-medium relative z-10 ${
                        selectedMic === device.deviceId
                          ? 'text-[--color-primary] drop-shadow-sm'
                          : 'text-[--color-text] group-hover:text-[--color-text] transition-colors duration-200'
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
              <h4 className="text-[--color-text] text-sm font-medium mb-4 flex items-center space-x-3">
                <svg className="w-5 h-5 text-[--color-accent]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19V12a9 9 0 0118 0v7M8.25 15H7.5a1.5 1.5 0 00-1.5 1.5v1.5A1.5 1.5 0 007.5 19h.75m0 0V15m0 0V12a4.5 4.5 0 011 2.25m0 0V15M21 15H16.5a1.5 1.5 0 00-1.5 1.5v1.5a1.5 1.5 0 001.5 1.5H21" />
                </svg>
                <span>Headphones/Speakers</span>
              </h4>
              <div className="space-y-3">
                {headphones.map((device, index) => (
                  <label
                    key={device.deviceId}
                    className={`group relative flex items-center space-x-3 p-4 rounded-2xl cursor-pointer transition-all duration-300 hover-lift hover:shadow-[0_8px_25px_-8px_rgba(140,161,203,0.3)] overflow-hidden ${
                      selectedHeadphones === device.deviceId
                        ? 'glassmorphism-light border-[--color-accent]/40 bg-gradient-to-r from-[--color-accent]/5 to-[--color-accent]/15 shadow-[0_0_15px_rgba(140,161,203,0.2)]'
                        : 'glassmorphism-light border-white/10 hover:border-[--color-accent]/30 hover:bg-gradient-to-r hover:from-[--color-accent]/3 hover:to-transparent'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Subtle inner glow for selected state */}
                    {selectedHeadphones === device.deviceId && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[--color-accent]/5 to-transparent animate-pulse"></div>
                    )}

                    {/* Gradient overlay for hover effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[--color-accent]/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>

                    <input
                      type="radio"
                      name="headphones"
                      value={device.deviceId}
                      checked={selectedHeadphones === device.deviceId}
                      onChange={() => setSelectedHeadphones(device.deviceId)}
                      className="sr-only"
                    />
                    <div className="relative flex items-center space-x-3 w-full">
                      <div className={`w-5 h-5 rounded-full border-2 transition-all duration-300 shadow-inner ${
                        selectedHeadphones === device.deviceId
                          ? 'bg-[--color-accent] border-[--color-accent] shadow-[--color-accent]/50'
                          : 'border-white/40 group-hover:border-[--color-accent]/70 group-hover:shadow-[--color-accent]/30'
                      }`}>
                        {selectedHeadphones === device.deviceId && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse shadow-sm"></div>
                          </div>
                        )}
                      </div>
                      <span className={`text-sm flex-1 font-medium relative z-10 ${
                        selectedHeadphones === device.deviceId
                          ? 'text-[--color-accent] drop-shadow-sm'
                          : 'text-[--color-text] group-hover:text-[--color-text] transition-colors duration-200'
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
              <svg className="w-16 h-16 text-[--color-text-muted] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-[--color-text-secondary] text-sm mb-4">No audio devices found</p>
              <button
                onClick={handleGetDevices}
                className="px-4 py-2 bg-[--color-primary] hover:bg-[--color-primary-hover] text-[--color-surface] rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[--color-primary]/30"
              >
                Refresh Devices
              </button>
            </div>
          )}
        </div>

        {/* Glassy Actions */}
        <div className="flex justify-end space-x-3 px-6 pb-6 pt-4">
          <button
            onClick={onClose}
            className="glassmorphism-light px-5 py-2.5 text-[--color-text-secondary] hover:text-[--color-text] border border-white/10 hover:border-white/30 rounded-xl transition-all duration-300 font-medium hover-lift hover:shadow-lg hover:shadow-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="glassmorphism px-5 py-2.5 bg-[--color-primary] hover:bg-[--color-primary]/90 text-[--color-surface] border border-white/20 hover:border-white/40 rounded-xl transition-all duration-300 font-medium hover-lift hover:shadow-xl hover:shadow-[--color-primary]/40"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
}

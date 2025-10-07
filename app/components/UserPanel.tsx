import React, { useState } from 'react';

interface Device {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface UserPanelProps {
  username: string;
  avatar?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  onClick?: () => void;
  onSettingsClick?: () => void;
  className?: string;
}

export function UserPanel({
  username,
  avatar,
  status,
  onClick,
  onSettingsClick,
  className = ""
}: UserPanelProps) {
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [selectedHeadphones, setSelectedHeadphones] = useState<string>('');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'idle': return 'Idle';
      case 'dnd': return 'Do Not Disturb';
      default: return 'Offline';
    }
  };

  const handleDeviceButtonClick = async () => {
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
      setShowDeviceSelector(true);

      // Set default selections
      const defaultMic = availableDevices.find(d => d.kind === 'audioinput');
      const defaultHeadphones = availableDevices.find(d => d.kind === 'audiooutput');

      if (defaultMic) setSelectedMic(defaultMic.deviceId);
      if (defaultHeadphones) setSelectedHeadphones(defaultHeadphones.deviceId);

    } catch (error) {
      console.error('Error accessing audio devices:', error);
      alert('Unable to access audio devices. Please check your permissions.');
    }
  };

  const mics = devices.filter(d => d.kind === 'audioinput');
  const headphones = devices.filter(d => d.kind === 'audiooutput');

  return (
    <>
      <div className={`relative bg-gray-800 rounded-lg shadow-lg border border-gray-700 ${className}`}>
        <div className="flex items-center px-3 py-2">
          {/* Clickable User Info Area */}
          <div
            className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer hover:bg-gray-750 transition-colors rounded p-1 -m-1"
            onClick={onClick}
            title="Open User Profile"
          >
            <div className="relative flex-shrink-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt={username}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold capitalize">{username.charAt(0)}</span>
                </div>
              )}
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${getStatusColor(status)}`}></div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{username}</div>
              <div className="text-gray-400 text-xs capitalize truncate">{status.replace('_', ' ')}</div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center space-x-1 flex-shrink-0 ml-3">
            {/* Microphone Button */}
            <button
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 transition-colors group"
              title="Microphone: Muted"
            >
              <svg className="w-4 h-4 text-red-500 group-hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12l4 4m0 0l-4 4m4-4H12" />
              </svg>
            </button>

            {/* Headphones Button */}
            <button
              onClick={handleDeviceButtonClick}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 transition-colors group"
              title="Select Audio Devices"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19V12a9 9 0 0118 0v7M8.25 15H7.5a1.5 1.5 0 00-1.5 1.5v1.5A1.5 1.5 0 007.5 19h.75m0 0V15m0 0V12a4.5 4.5 0 011 2.25m0 0V15M21 15H16.5a1.5 1.5 0 00-1.5 1.5v1.5a1.5 1.5 0 001.5 1.5H21" />
              </svg>
            </button>

            {/* Settings Button */}
            <button
              onClick={() => window.location.href = '/settings'}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 transition-colors group"
              title="Settings"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Device Selector Modal */}
      {showDeviceSelector && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg p-4 w-80 max-h-96 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Audio Devices</h3>
              <button
                onClick={() => setShowDeviceSelector(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Microphones */}
            {mics.length > 0 && (
              <div className="mb-4">
                <h4 className="text-gray-300 text-sm font-medium mb-2">Microphones</h4>
                <div className="space-y-1">
                  {mics.map(device => (
                    <label key={device.deviceId} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="mic"
                        value={device.deviceId}
                        checked={selectedMic === device.deviceId}
                        onChange={() => setSelectedMic(device.deviceId)}
                        className="text-indigo-600"
                      />
                      <span className="text-gray-300 text-sm">{device.label || `Microphone ${device.deviceId.slice(-4)}`}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Headphones/Speakers */}
            {headphones.length > 0 &&(
              <div className="mb-4">
                <h4 className="text-gray-300 text-sm font-medium mb-2">Headphones/Speakers</h4>
                <div className="space-y-1">
                  {headphones.map(device => (
                    <label key={device.deviceId} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="headphones"
                        value={device.deviceId}
                        checked={selectedHeadphones === device.deviceId}
                        onChange={() => setSelectedHeadphones(device.deviceId)}
                        className="text-indigo-600"
                      />
                      <span className="text-gray-300 text-sm">{device.label || `Audio Output ${device.deviceId.slice(-4)}`}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowDeviceSelector(false)}
                className="px-3 py-1 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Actually set the selected devices for audio
                  console.log('Selected mic:', selectedMic);
                  console.log('Selected headphones:', selectedHeadphones);
                  setShowDeviceSelector(false);
                }}
                className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

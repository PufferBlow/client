import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { UserCard } from './UserCard';

interface Device {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface UserPanelProps {
  username: string;
  avatar?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  onClick?: (event: React.MouseEvent) => void;
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
  const showToast = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [selectedHeadphones, setSelectedHeadphones] = useState<string>('');
  const [showUserCard, setShowUserCard] = useState(false);
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0 });

  const toggleMute = () => {
    setIsMuted(!isMuted);
    showToast(isMuted ? 'Microphone unmuted' : 'Microphone muted', 'success');
  };

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    if (newDeafened) {
      setIsMuted(true);
    }
    showToast(newDeafened ? 'Speakers/headphones muted' : 'Speakers/headphones unmuted', 'success');
  };

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

  const handleUserClick = (event: React.MouseEvent) => {
    // Call the original onClick if provided
    onClick?.(event);

    // Show the user card above the panel
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const cardHeight = 400; // Approximate height of UserCard

      // Position above if there's enough space, otherwise below
      let yPosition = rect.top - cardHeight - 10; // Above by default

      // If above would put it off-screen, position below
      if (yPosition < 10) {
        yPosition = rect.bottom + 10;
      }

      setCardPosition({
        x: rect.left,
        y: yPosition
      });

      setShowUserCard(!showUserCard);
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
      showToast('Unable to access audio devices. Please check your permissions.', 'error');
    }
  };

  // Close user card when clicking outside
  useEffect(() => {
    if (!showUserCard) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowUserCard(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserCard]);

  const mics = devices.filter(d => d.kind === 'audioinput');
  const headphones = devices.filter(d => d.kind === 'audiooutput');


  const handleUserInfoClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent event bubbling
    handleUserClick(event);
  };

  return (
    <>
      <div ref={panelRef} className={`relative bg-gray-800 rounded-lg shadow-lg border border-gray-700 ${className}`}>
        <div className="flex items-center px-3 py-2">
          {/* Clickable User Info Area */}
          <div
            className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer hover:bg-gray-750 transition-colors rounded p-1 -m-1"
            onClick={handleUserInfoClick}
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
              onClick={toggleMute}
              className={`w-7 h-7 flex items-center justify-center rounded transition-all duration-200 ${
                isMuted ? 'hover:bg-red-600/20' : 'hover:bg-gray-600'
              } group`}
              title={`Microphone: ${isMuted ? 'Muted' : 'Unmuted'}`}
            >
              {isMuted ? (
                <svg className="w-4 h-4 text-red-500 group-hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12l4 4m0 0l-4 4m4-4H12" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-green-500 group-hover:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            {/* Deafen Button */}
            <button
              onClick={toggleDeafen}
              className={`relative w-7 h-7 flex items-center justify-center rounded transition-all duration-200 ${
                isDeafened ? 'hover:bg-red-600/20' : 'hover:bg-gray-600'
              } group`}
              title={`Headphones: ${isDeafened ? 'Muted' : 'Unmuted'}`}
            >
              {isDeafened && (
                <svg className="absolute w-3 h-3 text-red-500 top-1 right-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <svg className={`w-4 h-4 ${isDeafened ? 'text-red-500 group-hover:text-red-400' : 'text-gray-400 group-hover:text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19V12a9 9 0 0118 0v7M8.25 15H7.5a1.5 1.5 0 00-1.5 1.5v1.5A1.5 1.5 0 007.5 19h.75m0 0V15m0 0V12a4.5 4.5 0 011 2.25m0 0V15M21 15H16.5a1.5 1.5 0 00-1.5 1.5v1.5a1.5 1.5 0 001.5 1.5H21" />
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
      <div className={`fixed inset-0 flex items-center justify-center z-50 transition-all duration-300 ease-out ${showDeviceSelector ? 'bg-black/50 backdrop-blur-sm opacity-100' : 'bg-transparent backdrop-blur-none opacity-0 pointer-events-none'}`}>
        <div className={`bg-gray-800 rounded-xl shadow-2xl border border-gray-700 transition-all duration-300 ease-out transform ${showDeviceSelector ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} ${showDeviceSelector ? 'p-6 w-full max-w-md' : 'p-0 w-0'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold text-lg flex items-center space-x-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <span>Audio Devices</span>
            </h3>
            <button
              onClick={() => setShowDeviceSelector(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700 transition-all duration-200 hover:rotate-90"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Device Lists */}
          <div className="space-y-6">
            {/* Microphones */}
            {mics.length > 0 && (
              <div>
                <h4 className="text-gray-300 text-sm font-medium mb-3 flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span>Microphones</span>
                </h4>
                <div className="space-y-2">
                  {mics.map(device => (
                    <label
                      key={device.deviceId}
                      className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        selectedMic === device.deviceId
                          ? 'bg-indigo-600/20 border-indigo-500'
                          : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mic"
                        value={device.deviceId}
                        checked={selectedMic === device.deviceId}
                        onChange={() => setSelectedMic(device.deviceId)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                        selectedMic === device.deviceId
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'border-gray-500'
                      }`}>
                        {selectedMic === device.deviceId && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                      <span className="text-gray-200 text-sm flex-1 truncate">{device.label || `Microphone ${device.deviceId.slice(-4)}`}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Headphones/Speakers */}
            {headphones.length > 0 && (
              <div>
                <h4 className="text-gray-300 text-sm font-medium mb-3 flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19V12a9 9 0 0118 0v7M8.25 15H7.5a1.5 1.5 0 00-1.5 1.5v1.5A1.5 1.5 0 007.5 19h.75m0 0V15m0 0V12a4.5 4.5 0 011 2.25m0 0V15M21 15H16.5a1.5 1.5 0 00-1.5 1.5v1.5a1.5 1.5 0 001.5 1.5H21" />
                  </svg>
                  <span>Headphones/Speakers</span>
                </h4>
                <div className="space-y-2">
                  {headphones.map(device => (
                    <label
                      key={device.deviceId}
                      className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        selectedHeadphones === device.deviceId
                          ? 'bg-indigo-600/20 border-indigo-500'
                          : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="headphones"
                        value={device.deviceId}
                        checked={selectedHeadphones === device.deviceId}
                        onChange={() => setSelectedHeadphones(device.deviceId)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                        selectedHeadphones === device.deviceId
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'border-gray-500'
                      }`}>
                        {selectedHeadphones === device.deviceId && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                      <span className="text-gray-200 text-sm flex-1 truncate">{device.label || `Audio Output ${device.deviceId.slice(-4)}`}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* No devices message */}
            {mics.length === 0 && headphones.length === 0 && (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-400 text-sm">No audio devices found</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-700 mt-6">
            <button
              onClick={() => setShowDeviceSelector(false)}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // TODO: Actually set the selected devices for audio
                console.log('Selected mic:', selectedMic);
                console.log('Selected headphones:', selectedHeadphones);
                setShowDeviceSelector(false);
                showToast('Audio devices updated successfully!', 'success');
              }}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200 font-medium shadow-lg hover:shadow-xl hover:scale-105"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>

      {/* User Card */}
      {showUserCard && (
        <div
          className="fixed z-50 shadow-2xl animate-scale-in"
          style={{
            left: cardPosition.x,
            top: cardPosition.y,
            maxWidth: '400px',
            width: '100%'
          }}
        >
          <UserCard
            username={username}
            status={status === 'online' ? 'active' : status}
            avatarUrl={avatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}&backgroundColor=5865f2`}
            showOnlineIndicator={true}
            onCardClick={() => setShowUserCard(false)}
          />
        </div>
      )}
    </>
  );
}

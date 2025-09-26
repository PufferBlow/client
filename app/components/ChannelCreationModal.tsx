import { useState } from "react";

interface ChannelCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChannel: (channelData: { name: string; type: 'text' | 'voice'; description?: string }) => void;
}

export function ChannelCreationModal({ isOpen, onClose, onCreateChannel }: ChannelCreationModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<'text' | 'voice'>('text');
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateChannel({
        name: name.trim(),
        type,
        description: description.trim() || undefined
      });
      setName("");
      setType('text');
      setDescription("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Create Channel</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="channelName" className="block text-sm font-medium text-gray-300 mb-2">
              Channel Name
            </label>
            <input
              id="channelName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="new-channel"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Channel Type
            </label>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  id="text"
                  name="channelType"
                  type="radio"
                  value="text"
                  checked={type === 'text'}
                  onChange={(e) => setType(e.target.value as 'text')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="text" className="ml-2 block text-sm text-gray-300">
                  <div className="flex items-center">
                    <span className="text-gray-400 mr-2">#</span>
                    Text Channel
                  </div>
                  <p className="text-xs text-gray-400 ml-6">Send messages, images, GIFs, emoji, opinions, and puns</p>
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="voice"
                  name="channelType"
                  type="radio"
                  value="voice"
                  checked={type === 'voice'}
                  onChange={(e) => setType(e.target.value as 'voice')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="voice" className="ml-2 block text-sm text-gray-300">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    Voice Channel
                  </div>
                  <p className="text-xs text-gray-400 ml-6">Hang out together with voice, video, and screen share</p>
                </label>
              </div>
            </div>
          </div>

          {type === 'text' && (
            <div>
              <label htmlFor="channelDescription" className="block text-sm font-medium text-gray-300 mb-2">
                Description (optional)
              </label>
              <textarea
                id="channelDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Let everyone know how to use this channel!"
                rows={2}
              />
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

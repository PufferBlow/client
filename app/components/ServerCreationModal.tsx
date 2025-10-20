import { useState } from "react";

interface ServerCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateServer: (serverData: { name: string; description: string; isPrivate: boolean }) => void;
}

export function ServerCreationModal({ isOpen, onClose, onCreateServer }: ServerCreationModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateServer({ name: name.trim(), description: description.trim(), isPrivate });
      setName("");
      setDescription("");
      setIsPrivate(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in">
      {/* Glassmorphism backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative glassmorphism animate-scale-in rounded-2xl p-8 w-full max-w-md mx-4 border border-white/20 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            🚀 Create New Server
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-full p-2 transition-all duration-200 hover:scale-110"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="serverName" className="block text-sm font-medium text-white/80 mb-2">
              Server Name
            </label>
            <input
              id="serverName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glassmorphism-light w-full px-4 py-3 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus-glow focus:border-white/40 hover:border-white/30 transition-all duration-200"
              placeholder="Enter server name"
              required
            />
          </div>

          <div>
            <label htmlFor="serverDescription" className="block text-sm font-medium text-white/80 mb-2">
              Description (optional)
            </label>
            <textarea
              id="serverDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="glassmorphism-light w-full px-4 py-3 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus-glow focus:border-white/40 hover:border-white/30 transition-all duration-200 resize-none"
              placeholder="What's this server about?"
              rows={3}
            />
          </div>

          <div className="flex items-center p-3 glassmorphism-light border border-white/10 rounded-xl hover-lift">
            <input
              id="isPrivate"
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-5 w-5 text-blue-400 focus:ring-blue-400 border-white/30 rounded focus:ring-offset-0"
            />
            <label htmlFor="isPrivate" className="ml-3 block text-sm text-white/90 font-medium">
              🔒 Make this server private
            </label>
          </div>

          <div className="flex justify-end space-x-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-sm font-semibold text-white/70 bg-white/5 border border-white/20 rounded-xl hover:bg-white/10 hover:border-white/30 transition-all duration-200 hover:scale-105"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 text-sm font-semibold text-white glassmorphism-light border border-white/20 rounded-xl hover:border-white/40 transition-all duration-200 hover:scale-105 hover-lift shadow-lg"
            >
              ✨ Create Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

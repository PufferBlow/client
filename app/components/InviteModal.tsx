import { useState, useEffect } from "react";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  serverId?: string;
  onGenerateInvite: (options: { maxUses?: number; expiresAt?: Date; isPermanent?: boolean }) => Promise<string>;
  onCopyInvite: (inviteCode: string) => void;
}

export function InviteModal({
  isOpen,
  onClose,
  serverName,
  serverId,
  onGenerateInvite,
  onCopyInvite
}: InviteModalProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [maxUses, setMaxUses] = useState<number | undefined>();
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [isPermanent, setIsPermanent] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setInviteCode(null);
      setMaxUses(undefined);
      setExpiresIn('never');
      setIsPermanent(true);
    }
  }, [isOpen]);

  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    try {
      let expiresAt: Date | undefined;
      if (!isPermanent && expiresIn !== 'never') {
        const now = new Date();
        switch (expiresIn) {
          case '30min':
            expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
            break;
          case '1hour':
            expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
            break;
          case '6hours':
            expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);
            break;
          case '1day':
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case '7days':
            expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
        }
      }

      const code = await onGenerateInvite({
        maxUses: maxUses || undefined,
        expiresAt,
        isPermanent
      });
      setInviteCode(code);
    } catch (error) {
      console.error('Failed to generate invite:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyInvite = () => {
    if (inviteCode) {
      onCopyInvite(inviteCode);
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
          <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
            Invite Friends
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

        <div className="mb-6">
          <div className="glassmorphism-light flex items-center space-x-3 p-4 rounded-xl border border-white/10 hover-lift">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center animate-float">
              <img
                src="/pufferblow-art-pixel-32x32.png"
                alt="Server Icon"
                className="w-8 h-8 rounded-full"
              />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">{serverName}</h3>
              <p className="text-white/70 text-sm">Decentralized Server</p>
            </div>
          </div>
        </div>

        {!inviteCode ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Invite Link Settings
              </label>

              <div className="space-y-3">
                <div>
                  <label htmlFor="maxUses" className="block text-sm text-white/80 mb-2 font-medium">
                    Maximum Uses (optional)
                  </label>
                  <input
                    id="maxUses"
                    type="number"
                    min="1"
                    value={maxUses || ''}
                    onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="glassmorphism-light w-full px-4 py-3 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus-glow focus:border-white/40 hover:border-white/30 transition-all duration-200"
                    placeholder="Unlimited"
                  />
                </div>

                <div>
                  <label htmlFor="expiresIn" className="block text-sm text-white/80 mb-2 font-medium">
                    Expires In
                  </label>
                  <select
                    id="expiresIn"
                    value={expiresIn}
                    onChange={(e) => {
                      setExpiresIn(e.target.value);
                      setIsPermanent(e.target.value === 'never');
                    }}
                    className="glassmorphism-light w-full px-4 py-3 border border-white/20 rounded-xl text-white focus:outline-none focus-glow focus:border-white/40 hover:border-white/30 transition-all duration-200 appearance-none bg-transparent"
                  >
                    <option value="never" className="bg-gray-700">Never</option>
                    <option value="30min" className="bg-gray-700">30 minutes</option>
                    <option value="1hour" className="bg-gray-700">1 hour</option>
                    <option value="6hours" className="bg-gray-700">6 hours</option>
                    <option value="1day" className="bg-gray-700">1 day</option>
                    <option value="7days" className="bg-gray-700">7 days</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateInvite}
              disabled={isGenerating}
              className="w-full glassmorphism-light border border-white/20 hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover-lift flex items-center justify-center shadow-lg"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-3"></div>
                  <span className="animate-pulse">Generating...</span>
                </>
              ) : (
                <>
                  <span>✨ Generate Invite Link</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="animate-bounce-in">
              <label className="block text-lg font-semibold text-white mb-3 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                🎉 Invite Link Generated!
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={`https://pufferblow.app/invite/${inviteCode}`}
                  readOnly
                  className="glassmorphism-light flex-1 px-4 py-3 border border-white/20 rounded-l-xl text-white focus:outline-none focus-glow focus:border-white/40 transition-all duration-200"
                />
                <button
                  onClick={handleCopyInvite}
                  className="glassmorphism-light px-6 py-3 border border-white/20 hover:border-white/40 text-white rounded-r-xl font-semibold transition-all duration-200 hover:scale-105 hover-lift flex items-center"
                >
                  <span className="mr-2">📋</span>
                  Copy
                </button>
              </div>
            </div>

            <div className="glassmorphism-light p-4 rounded-xl border border-white/20 bg-green-500/10">
              <p className="text-white/90 font-medium mb-2">📢 Share this link with friends!</p>
              <div className="text-sm text-white/70 space-y-1">
                {maxUses && <p className="flex items-center"><span className="mr-2">🔢</span> Can be used {maxUses} time{maxUses === 1 ? '' : 's'}</p>}
                {!isPermanent && expiresIn !== 'never' && (
                  <p className="flex items-center"><span className="mr-2">⏰</span> Expires in {expiresIn.replace(/(\d+)/, '$1 ').trim()}</p>
                )}
                {isPermanent && <p className="flex items-center"><span className="mr-2">♾️</span> Never expires</p>}
              </div>
            </div>

            <button
              onClick={() => setInviteCode(null)}
              className="w-full glassmorphism-light border border-white/20 hover:border-white/40 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover-lift flex items-center justify-center shadow-lg"
            >
              <span className="mr-2">🔄</span>
              Generate New Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

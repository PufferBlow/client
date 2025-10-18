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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Invite Friends</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
            <img
              src="/pufferblow-art-pixel-32x32.png"
              alt="Server Icon"
              className="w-10 h-10 rounded-full"
            />
            <div>
              <h3 className="text-white font-medium">{serverName}</h3>
              <p className="text-gray-400 text-sm">Decentralized Server</p>
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
                  <label htmlFor="maxUses" className="block text-sm text-gray-300 mb-1">
                    Maximum Uses (optional)
                  </label>
                  <input
                    id="maxUses"
                    type="number"
                    min="1"
                    value={maxUses || ''}
                    onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Unlimited"
                  />
                </div>

                <div>
                  <label htmlFor="expiresIn" className="block text-sm text-gray-300 mb-1">
                    Expires In
                  </label>
                  <select
                    id="expiresIn"
                    value={expiresIn}
                    onChange={(e) => {
                      setExpiresIn(e.target.value);
                      setIsPermanent(e.target.value === 'never');
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="never">Never</option>
                    <option value="30min">30 minutes</option>
                    <option value="1hour">1 hour</option>
                    <option value="6hours">6 hours</option>
                    <option value="1day">1 day</option>
                    <option value="7days">7 days</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateInvite}
              disabled={isGenerating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center justify-center"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                'Generate Invite Link'
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Invite Link
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={`https://pufferblow.app/invite/${inviteCode}`}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-l-md text-white focus:outline-none"
                />
                <button
                  onClick={handleCopyInvite}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-r-md font-medium transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-400">
              <p>Share this link with friends to invite them to {serverName}!</p>
              {maxUses && <p className="mt-1">• Can be used {maxUses} time{maxUses === 1 ? '' : 's'}</p>}
              {!isPermanent && expiresIn !== 'never' && (
                <p className="mt-1">• Expires in {expiresIn.replace(/(\d+)/, '$1 ').trim()}</p>
              )}
            </div>

            <button
              onClick={() => setInviteCode(null)}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              Generate New Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

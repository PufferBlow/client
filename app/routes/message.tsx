import type { Route } from "./+types/message";
import { redirect } from "react-router";
import { useEffect, useState } from "react";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { getMessageById, loadChannelMessagesAroundMessage } from "../services/channel";
import { getUserProfileById, getAuthTokenFromCookies } from "../services/user";
import type { Message } from "../models";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Pufferblow - Message" },
    { name: "description", content: "View shared message in Pufferblow" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  // Redirect to login if no auth token
  const authToken = getAuthTokenFromCookies() || '';
  if (!authToken) {
    return redirect('/login');
  }

  const messageId = params.messageId;

  try {
    // Get the main message
    const response = await getMessageById(messageId, authToken);

    if (response.success && response.data?.message) {
      return {
        message: response.data.message,
        authToken
      };
    } else {
      throw new Error(response.error || 'Message not found');
    }
  } catch (error) {
    console.error('Error loading message:', error);
    throw new Response("Message not found", { status: 404 });
  }
}

export default function MessagePage({ loaderData }: Route.ComponentProps) {
  const { message: initialMessage, authToken } = loaderData;
  const [message, setMessage] = useState(initialMessage);
  const [senderInfo, setSenderInfo] = useState<any>(null);
  const [contextMessages, setContextMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    const loadMessageDetails = async () => {
      if (!message || !authToken) return;

      setLoading(true);

      try {
        // Load sender profile
        const senderResponse = await getUserProfileById(message.sender_user_id, authToken);
        if (senderResponse.success && senderResponse.data?.user_data) {
          const userData = senderResponse.data.user_data;
          setSenderInfo({
            id: userData.user_id,
            username: userData.username,
            avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(userData.username)}&backgroundColor=5865f2`,
            status: userData.status,
            bio: userData.created_at, // Note: Using created_at as bio placeholder since bio isn't available in current API
        roles: userData.roles_ids?.includes('owner') || userData.roles_ids?.includes('Owner') ? ['Owner', 'Admin'] :
               userData.roles_ids?.includes('admin') || userData.roles_ids?.includes('Admin') ? ['Admin'] : ['Member']
          });
        }
      } catch (error) {
        console.error('Error loading sender info:', error);
      }

      setLoading(false);
    };

    loadMessageDetails();
  }, [message, authToken]);

  const handleLoadContext = async () => {
    if (!authToken || contextMessages.length > 0) return;

    try {
      const response = await loadChannelMessagesAroundMessage(message.message_id, authToken);
      if (response.success && response.data?.messages) {
        setContextMessages(response.data.messages);
        setShowContext(true);
      }
    } catch (error) {
      console.error('Error loading context messages:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  if (!message || !senderInfo) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[var(--color-text)] mb-4">Message not found</h1>
          <p className="text-[var(--color-text-secondary)]">The message you're looking for doesn't exist or you don't have permission to view it.</p>
        </div>
      </div>
    );
  }

  const messageTimestamp = new Date(message.sent_at).toLocaleString();

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Header */}
      <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <img
                  src="/pufferblow-art-pixel-32x32.png"
                  alt="Pufferblow"
                  className="w-6 h-6"
                />
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-text)]">Pufferblow Message</h1>
            </div>
            <div className="flex items-center space-x-4">
              {!showContext && (
                <button
                  onClick={handleLoadContext}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Load Context
                </button>
              )}
              <a
                href="/dashboard"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Back to Dashboard
              </a>
            </div>
          </div>

          {/* Share URL display */}
          <div className="bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-lg p-4">
            <div className="text-sm text-[var(--color-text-secondary)] mb-2">Share this message:</div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={`${window.location.origin}/m/${message.message_id}`}
                readOnly
                className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] font-mono text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/m/${message.message_id}`);
                }}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Message Card */}
        <div className="bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden">
          {/* Message Header */}
          <div className="bg-[var(--color-surface-secondary)] px-6 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center space-x-3">
              <img
                src={senderInfo.avatar}
                alt={senderInfo.username}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-[var(--color-text)]">{senderInfo.username}</span>
                  {senderInfo.roles.includes("Owner") && (
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-medium">OWNER</span>
                  )}
                  {senderInfo.roles.includes("Admin") && !senderInfo.roles.includes("Owner") && (
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-medium">ADMIN</span>
                  )}
                  {senderInfo.roles.includes("Moderator") && (
                    <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded font-medium">MOD</span>
                  )}
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  {messageTimestamp}
                </div>
              </div>
            </div>
          </div>

          {/* Message Content */}
          <div className="px-6 py-6">
            <div className="prose prose-invert max-w-none">
              <MarkdownRenderer content={message.message} className="text-[var(--color-text)]" />
            </div>
          </div>

          {/* Message Footer */}
          <div className="bg-[var(--color-surface-secondary)] px-6 py-4 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
              <div>
                Message ID: <code className="bg-[var(--color-background)] px-1 py-0.5 rounded text-xs font-mono">{message.message_id}</code>
              </div>
              <div>
                Shared from Pufferblow
              </div>
            </div>
          </div>
        </div>

        {/* Context Messages (if loaded) */}
        {showContext && contextMessages.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold text-[var(--color-text)] mb-4">Message Context</h3>
            <div className="bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] p-4 space-y-4 max-h-96 overflow-y-auto">
              {contextMessages.map((contextMsg) => (
                <div key={contextMsg.message_id} className="flex items-start space-x-3">
                  <img
                    src={contextMsg.sender_user_id === senderInfo?.id ? senderInfo.avatar : '/pufferblow-art-pixel-32x32.png'}
                    alt="User"
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {contextMsg.sender_user_id === senderInfo?.id ? senderInfo.username : 'Other User'}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {new Date(contextMsg.sent_at).toLocaleTimeString()}
                      </span>
                      {contextMsg.message_id === message.message_id && (
                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-medium">SHARED MESSAGE</span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      <MarkdownRenderer content={contextMsg.message} className="text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-[var(--color-text-secondary)]">
          <p>Join Pufferblow to see this message in context and participate in the conversation</p>
          <a
            href="/signup"
            className="inline-block mt-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-accent-hover)] text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200"
          >
            Join Pufferblow
          </a>
        </div>
      </div>
    </div>
  );
}

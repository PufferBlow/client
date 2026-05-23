import { useEffect, useMemo, useRef, useState } from "react";
import { Twemoji } from "./ui/Twemoji";
import {
  createFullUrl,
  getAuthTokenFromCookies,
  getHostPortFromCookies,
  getHostPortFromStorage,
} from "../services/user";
import { useStickers } from "../services/useStickers";
import type { StickerRecord } from "../services/stickers";

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onGifSelect?: (gif: { url: string; title: string }) => void;
  /**
   * Fires when the user clicks a sticker in the Stickers tab. When
   * not provided, the Stickers tab is hidden — keeps the picker
   * working unchanged in places that haven't wired the sticker
   * send path yet (e.g. an admin settings page that only wants
   * emoji insertion).
   */
  onStickerSelect?: (sticker: StickerRecord) => void;
}

type PickerTab = "emoji" | "gif" | "sticker";

interface GifResult {
  id: string;
  title: string;
  images: {
    fixed_height_small: {
      url: string;
      width: string;
      height: string;
    };
  };
}

export function EmojiPicker({
  isOpen,
  onClose,
  onEmojiSelect,
  onGifSelect,
  onStickerSelect,
}: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<PickerTab>('emoji');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);

  // Sticker library is read-only here — the picker just consumes
  // the cached list from useStickers. Active server inferred from
  // the same cookie/storage chain the rest of the app uses; null
  // host_port falls back to the in-page default automatically.
  const hostPort =
    (typeof window !== "undefined" &&
      (getHostPortFromStorage() || getHostPortFromCookies())) ||
    undefined;
  const authToken =
    (typeof window !== "undefined" && getAuthTokenFromCookies()) || undefined;
  const showStickersTab = !!onStickerSelect;
  const stickersQuery = useStickers(
    showStickersTab ? hostPort : undefined,
    showStickersTab ? authToken : undefined,
  );
  const stickers = stickersQuery.data ?? [];

  // Live-filter stickers by display_name / alias substring while the
  // user types in the search field. The library is small (a few
  // hundred entries at most) so a linear scan per keystroke is fine.
  const filteredStickers = useMemo(() => {
    if (!searchQuery.trim()) return stickers;
    const needle = searchQuery.trim().toLowerCase();
    return stickers.filter((s) => {
      const haystack = `${s.display_name} ${s.alias ?? ''} ${s.filename}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [stickers, searchQuery]);



  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);



  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setGifs([]);
      setGifError(null);
    }
  }, [isOpen]);

  // Fetch GIFs when search query changes and GIF tab is active
  useEffect(() => {
    if (activeTab === 'gif' && searchQuery.trim()) {
      fetchGifs(searchQuery.trim());
    } else if (activeTab === 'gif' && !searchQuery.trim()) {
      // Show trending GIFs when no search query
      fetchTrendingGifs();
    }
  }, [searchQuery, activeTab]);

  const fetchGifs = async (query: string) => {
    const apiKey = import.meta.env.VITE_GIPHY_API_KEY;
    if (!apiKey || apiKey === 'your_giphy_api_key_here') {
      setGifError('Giphy API key not configured. Please check your environment variables.');
      return;
    }

    setIsLoadingGifs(true);
    setGifError(null);

    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=20&rating=g`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch GIFs');
      }

      const data = await response.json();
      setGifs(data.data);
    } catch (error) {
      console.error('Error fetching GIFs:', error);
      setGifError('Failed to load GIFs');
    } finally {
      setIsLoadingGifs(false);
    }
  };

  const fetchTrendingGifs = async () => {
    const apiKey = import.meta.env.VITE_GIPHY_API_KEY;
    if (!apiKey || apiKey === 'your_giphy_api_key_here') {
      setGifError('Giphy API key not configured');
      return;
    }

    setIsLoadingGifs(true);
    setGifError(null);

    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch trending GIFs');
      }

      const data = await response.json();
      setGifs(data.data);
    } catch (error) {
      console.error('Error fetching trending GIFs:', error);
      setGifError('Failed to load GIFs');
    } finally {
      setIsLoadingGifs(false);
    }
  };

  if (!isOpen) return null;

  // Optimized emoji list - most commonly used emojis
  const emojiList = [
    // Faces & Emotions
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
    '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
    '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
    '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
    '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
    '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
    '💀', '☠️', '👽', '👾', '🤖', '🎃',

    // Gestures & People
    '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
    '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿',
    '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄',

    // Activities & Sports
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
    '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿',
    '⛷️', '🏂', '🪂', '🏋️', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🧘', '🏃', '🚶', '🧎', '🧍',

    // Food & Drink
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅',
    '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖',
    '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔',
    '🍟', '🍕', '🫓', '🥙', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱',
    '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁',
    '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖',
    '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾',

    // Travel & Places
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲',
    '🛴', '🛹', '🚁', '🚟', '🚠', '🚡', '🛤️', '🛣️', '🗺️', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓',
    '⛵', '🛶', '🚤', '🛳️', '⛴️', '🛥️', '🚢', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚀', '🛸',

    // Objects & Symbols
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘',
    '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉',
    '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
    '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️',
    '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚨', '⬆️',
    '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️', '↕️', '↔️', '↩️', '↪️', '⤴️', '⤵️', '🔃', '🔄', '🔙',
    '🔚', '🔛', '🔜', '🔝', '▶️', '⏩', '⏭️', '⏯️', '◀️', '⏪', '⏮️', '🔼', '⏫', '🔽', '⏬', '⏸️',
    '⏹️', '⏺️', '⏏️', '♀️', '♂️', '⚧️', '✖️', '➕', '➖', '➗', '♾️', '‼️', '⁉️', '❓', '❔', '❕', '❗'
  ];

  // Filter emojis based on search query
  const filteredEmojis = searchQuery
    ? emojiList.filter(emoji => emoji.includes(searchQuery.toLowerCase()))
    : emojiList;

  return (
    <div
      className="fixed z-50 rounded-2xl border border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] shadow-2xl backdrop-blur-md"
      style={{
        right: '20px',
        bottom: '100px',
        width: '400px',
        maxHeight: '350px'
      }}
    >
      {/* Header */}
      <div className="relative h-10 px-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          {activeTab === 'emoji' && 'Emoji'}
          {activeTab === 'gif' && 'GIF'}
          {activeTab === 'sticker' && 'Stickers'}
        </h3>

        {/* Close button */}
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Border separator */}
      <div className="border-t border-[var(--color-border-secondary)]"></div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[var(--color-border-secondary)]">
        <button
          onClick={() => setActiveTab('emoji')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'emoji'
              ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-text)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          😀
        </button>
        <button
          onClick={() => setActiveTab('gif')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'gif'
              ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-text)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          GIF
        </button>
        {showStickersTab && (
          <button
            onClick={() => setActiveTab('sticker')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === 'sticker'
                ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-text)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
            // Use a generic 'stamp / icon' glyph rather than a brand
            // emoji because the tab is showing the instance's own
            // stickers — emoji here would imply the wrong content.
            title="Stickers"
          >
            🏷️
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="p-4 pb-2">
        <input
          type="text"
          placeholder={
            activeTab === 'emoji'
              ? 'Search emojis...'
              : activeTab === 'gif'
                ? 'Search GIFs...'
                : 'Search stickers...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
        />
      </div>

      {/* Content based on active tab */}
      <div className="max-h-48 overflow-y-auto p-4 pt-0">
        {activeTab === 'emoji' && (
          <>
            <div className="grid grid-cols-8 gap-1">
              {filteredEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onEmojiSelect(emoji)}
                  className="emoji-button flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-hover)]"
                  title={`Add ${emoji}`}
                >
                  <Twemoji emoji={emoji} size={22} />
                </button>
              ))}
            </div>
            {filteredEmojis.length === 0 && searchQuery && (
              <div className="py-8 text-center text-[var(--color-text-secondary)]">
                No emojis found for "{searchQuery}"
              </div>
            )}
          </>
        )}

        {activeTab === 'gif' && (
          <>
            {gifError && (
              <div className="py-8 text-center text-[var(--color-error)]">
                <div className="text-3xl mb-2">⚠️</div>
                <div className="text-sm">{gifError}</div>
                <div className="mt-1 text-xs text-[var(--color-text-secondary)]">Please check your API key configuration</div>
              </div>
            )}

            {!gifError && (
              <div className="grid grid-cols-4 gap-2">
                {isLoadingGifs ? (
                  // Skeleton loading placeholders
                  Array.from({ length: 20 }).map((_, index) => (
                    <div
                      key={`skeleton-${index}`}
                      className="aspect-square rounded-md bg-[var(--color-surface-tertiary)] animate-pulse"
                    ></div>
                  ))
                ) : gifs.length > 0 ? (
                  // Actual GIFs
                  gifs.map((gif) => (
                    <button
                      key={gif.id}
                      onClick={() => {
                        if (onGifSelect) {
                          onGifSelect({
                            url: gif.images.fixed_height_small.url,
                            title: gif.title || 'GIF'
                          });
                          onClose();
                        }
                      }}
                      className="group aspect-square overflow-hidden rounded-md bg-[var(--color-surface-secondary)] transition-colors hover:bg-[var(--color-hover)]"
                      title={gif.title || 'GIF'}
                    >
                      <img
                        src={gif.images.fixed_height_small.url}
                        alt={gif.title || 'GIF'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    </button>
                  ))
                ) : searchQuery.trim() ? (
                  // No results for search
                  <div className="col-span-4 py-8 text-center text-[var(--color-text-secondary)]">
                    <div className="text-3xl mb-2">🔍</div>
                    <div className="text-sm">No GIFs found for "{searchQuery}"</div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">Try a different search term</div>
                  </div>
                ) : (
                  // Empty state for trending
                  <div className="col-span-4 py-8 text-center text-[var(--color-text-secondary)]">
                    <div className="text-3xl mb-2">🎬</div>
                    <div className="text-sm">Trending GIFs</div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">Start typing to search for GIFs</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Stickers tab — local-instance library. Empty state covers
            three cases: instance has no library, library is loading,
            or the search filter matched nothing. Sticker images are
            128×128 in the renderer; in the picker we constrain to
            72×72 with `object-contain` so non-square glyphs (square
            badges, tall posts) all read the same size. */}
        {activeTab === 'sticker' && showStickersTab && (
          <>
            {stickersQuery.isLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div
                    key={`sticker-skeleton-${index}`}
                    className="aspect-square rounded-md bg-[var(--color-surface-tertiary)] animate-pulse"
                  />
                ))}
              </div>
            ) : stickersQuery.isError ? (
              <div className="py-8 text-center text-[var(--color-error)]">
                <div className="text-3xl mb-2">⚠️</div>
                <div className="text-sm">Couldn't load stickers.</div>
                <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {stickersQuery.error instanceof Error
                    ? stickersQuery.error.message
                    : 'Try again in a moment.'}
                </div>
              </div>
            ) : filteredStickers.length === 0 ? (
              <div className="py-8 text-center text-[var(--color-text-secondary)]">
                <div className="text-3xl mb-2">🏷️</div>
                {searchQuery.trim() ? (
                  <>
                    <div className="text-sm">No stickers match "{searchQuery}".</div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Try a different search term.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm">No stickers yet.</div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Admins can upload stickers from server settings.
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {filteredStickers.map((sticker) => {
                  const fullUrl = createFullUrl(sticker.sticker_url) || sticker.sticker_url;
                  return (
                    <button
                      key={sticker.sticker_id}
                      onClick={() => {
                        if (onStickerSelect) {
                          onStickerSelect(sticker);
                          onClose();
                        }
                      }}
                      className="group flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[var(--color-surface-secondary)] p-1 transition-colors hover:bg-[var(--color-hover)]"
                      title={sticker.alias ? `${sticker.display_name} (:${sticker.alias}:)` : sticker.display_name}
                    >
                      <img
                        src={fullUrl}
                        alt={sticker.display_name}
                        className="h-full w-full object-contain transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

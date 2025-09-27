import { useEffect, useRef, useState } from "react";

interface EmojiPickerProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onGifSelect?: (gif: { url: string; title: string }) => void;
}

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

export function EmojiPicker({ isOpen, position, onClose, onEmojiSelect, onGifSelect }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);

  // Function to convert emoji to Twemoji code point
  const emojiToCodePoint = (emoji: string): string => {
    return [...emoji].map(char => char.codePointAt(0)?.toString(16).toLowerCase()).join('-');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  // Calculate adjusted position to stay within viewport bounds
  const getAdjustedPosition = () => {
    const pickerWidth = 320; // w-80
    const pickerHeight = 400; // Approximate height
    const gap = 8;

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Check horizontal bounds
    if (position.x + pickerWidth / 2 > window.innerWidth) {
      // Picker would extend beyond right edge, position from right
      adjustedX = window.innerWidth - pickerWidth - gap;
    } else if (position.x - pickerWidth / 2 < 0) {
      // Picker would extend beyond left edge, position from left
      adjustedX = gap;
    } else {
      // Center on click point
      adjustedX = position.x - pickerWidth / 2;
    }

    // Check vertical bounds - prefer above, fallback below
    if (position.y - pickerHeight - gap < 0) {
      // Not enough space above, position below
      adjustedY = position.y + gap;
    } else {
      // Position above
      adjustedY = position.y - pickerHeight - gap;
    }

    // Ensure picker doesn't go off bottom
    if (adjustedY + pickerHeight > window.innerHeight) {
      adjustedY = window.innerHeight - pickerHeight - gap;
    }

    return { x: adjustedX, y: adjustedY };
  };

  const adjustedPosition = getAdjustedPosition();

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
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        ref={pickerRef}
        className="absolute bg-gray-800 rounded-lg w-80 shadow-2xl border border-gray-700 relative"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        {/* Arrow pointing down */}
        <div
          className="absolute w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: '-4px',
          }}
        ></div>
        {/* Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-gray-700 bg-gray-800 rounded-t-lg">
          <h3 className="text-sm font-semibold text-white">
            {activeTab === 'emoji' && 'Emoji'}
            {activeTab === 'gif' && 'GIF'}
            {activeTab === 'sticker' && 'Sticker'}
          </h3>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-600 transition-colors text-gray-400 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('emoji')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === 'emoji'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            😀
          </button>
          <button
            onClick={() => setActiveTab('gif')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === 'gif'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            GIF
          </button>
          <button
            onClick={() => setActiveTab('sticker')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === 'sticker'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            🏷️
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 pb-2">
          <input
            type="text"
            placeholder={
              activeTab === 'emoji' ? 'Search emojis...' :
              activeTab === 'gif' ? 'Search GIFs...' :
              'Search stickers...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Content based on active tab */}
        <div className="max-h-52 overflow-y-auto p-4 pt-0">
          {activeTab === 'emoji' && (
            <>
              <div className="grid grid-cols-8 gap-1">
                {filteredEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onEmojiSelect(emoji)}
                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-700 rounded-md transition-colors"
                    title={`Add ${emoji}`}
                  >
                    <img
                      src={`/twemoji/assets/72x72/${emojiToCodePoint(emoji)}.png`}
                      alt={emoji}
                      className="w-6 h-6"
                    />
                  </button>
                ))}
              </div>
              {filteredEmojis.length === 0 && searchQuery && (
                <div className="text-center py-8 text-gray-400">
                  No emojis found for "{searchQuery}"
                </div>
              )}
            </>
          )}

          {activeTab === 'gif' && (
            <>
              {gifError && (
                <div className="text-center py-8 text-red-400">
                  <div className="text-4xl mb-2">⚠️</div>
                  <div className="text-sm">{gifError}</div>
                  <div className="text-xs mt-1">Please check your API key configuration</div>
                </div>
              )}

              {!gifError && (
                <div className="grid grid-cols-4 gap-2">
                  {isLoadingGifs ? (
                    // Skeleton loading placeholders
                    Array.from({ length: 20 }).map((_, index) => (
                      <div
                        key={`skeleton-${index}`}
                        className="aspect-square bg-gray-700 rounded-md animate-pulse"
                      >
                        <div className="w-full h-full bg-gray-600 rounded-md"></div>
                      </div>
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
                        className="aspect-square bg-gray-700 rounded-md overflow-hidden hover:bg-gray-600 transition-colors group"
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
                    <div className="col-span-4 text-center py-8 text-gray-400">
                      <div className="text-4xl mb-2">🔍</div>
                      <div className="text-sm">No GIFs found for "{searchQuery}"</div>
                      <div className="text-xs mt-1">Try a different search term</div>
                    </div>
                  ) : (
                    // Empty state for trending
                    <div className="col-span-4 text-center py-8 text-gray-400">
                      <div className="text-4xl mb-2">🎬</div>
                      <div className="text-sm">Trending GIFs</div>
                      <div className="text-xs mt-1">Start typing to search for GIFs</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'sticker' && (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">🏷️</div>
              <div className="text-sm">Sticker search coming soon</div>
              <div className="text-xs mt-1">Browse and send animated stickers</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

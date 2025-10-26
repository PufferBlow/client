import { useEffect, useRef, useState, useCallback } from "react";

interface EmojiPickerProps {
  isOpen: boolean;
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

export function EmojiPicker({ isOpen, onClose, onEmojiSelect, onGifSelect }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);

  // Drag functionality
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState(() => {
    // Load saved position from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pufferblow-emoji-picker-position');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // Fall through to default
        }
      }
    }
    // Default position (center of screen)
    return {
      x: window.innerWidth / 2 - 200, // Half picker width
      y: window.innerHeight / 2 - 200  // Half picker height
    };
  });

  // Function to convert emoji to Twemoji code point
  const emojiToCodePoint = (emoji: string): string => {
    return [...emoji].map(char => char.codePointAt(0)?.toString(16).toLowerCase()).join('-');
  };

  // Save position to localStorage
  const savePosition = useCallback((newPosition: { x: number; y: number }) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pufferblow-emoji-picker-position', JSON.stringify(newPosition));
    }
  }, []);

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

  // Drag event handlers
  const handleMouseDown = (event: React.MouseEvent) => {
    if (!pickerRef.current) return;

    setIsDragging(true);
    const rect = pickerRef.current.getBoundingClientRect();
    setDragOffset({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    event.preventDefault();
  };

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging) return;

    const newX = Math.max(0, Math.min(window.innerWidth - 400, event.clientX - dragOffset.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 350, event.clientY - dragOffset.y));

    const newPosition = { x: newX, y: newY };
    setPosition(newPosition);
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    savePosition(position);
  }, [position, savePosition]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

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
      ref={pickerRef}
      className={`
        fixed z-50 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl
        ${isDragging ? 'cursor-grabbing' : ''}
      `}
      style={{
        left: position.x,
        top: position.y,
        width: '400px',
        maxHeight: '350px'
      }}
    >
      {/* Draggable Header */}
      <div
        className="relative h-10 px-4 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
        {/* Drag handle indicator */}
        <div className="flex items-center space-x-2 flex-1">
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-white/30 rounded-full"></div>
            <div className="w-1 h-1 bg-white/30 rounded-full"></div>
            <div className="w-1 h-1 bg-white/30 rounded-full"></div>
          </div>
          <h3 className="text-sm font-semibold text-white">
            {activeTab === 'emoji' && 'Emoji'}
            {activeTab === 'gif' && 'GIF'}
            {activeTab === 'sticker' && 'Sticker'}
          </h3>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-white/70 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Border separator */}
      <div className="border-t border-white/10"></div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('emoji')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'emoji'
              ? 'text-white border-b-2 border-blue-400'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          😀
        </button>
        <button
          onClick={() => setActiveTab('gif')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'gif'
              ? 'text-white border-b-2 border-blue-400'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          GIF
        </button>
        <button
          onClick={() => setActiveTab('sticker')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'sticker'
              ? 'text-white border-b-2 border-blue-400'
              : 'text-white/60 hover:text-white/80'
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
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-white/20"
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
                  className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
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
              <div className="text-center py-8 text-white/60">
                No emojis found for "{searchQuery}"
              </div>
            )}
          </>
        )}

        {activeTab === 'gif' && (
          <>
            {gifError && (
              <div className="text-center py-8 text-red-300">
                <div className="text-3xl mb-2">⚠️</div>
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
                      className="aspect-square bg-white/5 rounded-md animate-pulse"
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
                      className="aspect-square bg-white/5 rounded-md overflow-hidden hover:bg-white/10 transition-colors group"
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
                  <div className="col-span-4 text-center py-8 text-white/60">
                    <div className="text-3xl mb-2">🔍</div>
                    <div className="text-sm">No GIFs found for "{searchQuery}"</div>
                    <div className="text-xs mt-1">Try a different search term</div>
                  </div>
                ) : (
                  // Empty state for trending
                  <div className="col-span-4 text-center py-8 text-white/60">
                    <div className="text-3xl mb-2">🎬</div>
                    <div className="text-sm">Trending GIFs</div>
                    <div className="text-xs mt-1">Start typing to search for GIFs</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'sticker' && (
          <div className="text-center py-8 text-white/60">
            <div className="text-3xl mb-2">🏷️</div>
            <div className="text-sm">Sticker search coming soon</div>
            <div className="text-xs mt-1">Browse and send animated stickers</div>
          </div>
        )}
      </div>
    </div>
  );
}

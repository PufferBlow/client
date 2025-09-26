import { useState, useEffect } from "react";

interface SearchResult {
  id: string;
  type: 'message' | 'user' | 'channel';
  title: string;
  subtitle?: string;
  content?: string;
  timestamp?: string;
  avatar?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
  onSelectResult: (result: SearchResult) => void;
}

export function SearchModal({ isOpen, onClose, onSearch, onSelectResult }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    const search = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchResults = await onSearch(query.trim());
        setResults(searchResults);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(search, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectResult(results[selectedIndex]);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    onSelectResult(result);
    onClose();
  };

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'message':
        return '💬';
      case 'user':
        return '👤';
      case 'channel':
        return '#';
      default:
        return '🔍';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl mx-4 max-h-[70vh] overflow-hidden shadow-2xl">
        {/* Search Input */}
        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search messages, users, and channels..."
              className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-5 w-5 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-96">
          {isLoading && (
            <div className="p-4 text-center text-gray-400">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="ml-2">Searching...</span>
            </div>
          )}

          {!isLoading && query.trim().length < 2 && (
            <div className="p-4 text-center text-gray-400">
              Type at least 2 characters to search
            </div>
          )}

          {!isLoading && query.trim().length >= 2 && results.length === 0 && (
            <div className="p-4 text-center text-gray-400">
              No results found for "{query}"
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="divide-y divide-gray-700">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectResult(result)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors ${
                    index === selectedIndex ? 'bg-gray-700' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {result.type === 'user' && result.avatar ? (
                        <img
                          src={result.avatar}
                          alt={result.title}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm">
                          {getResultIcon(result.type)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-medium truncate">{result.title}</span>
                        {result.type === 'message' && result.timestamp && (
                          <span className="text-gray-400 text-sm">
                            {new Date(result.timestamp).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="text-gray-400 text-sm truncate">{result.subtitle}</p>
                      )}
                      {result.content && (
                        <p className="text-gray-300 text-sm mt-1 line-clamp-2">{result.content}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div>
              <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">↑↓</kbd> Navigate
              <kbd className="ml-2 px-1 py-0.5 bg-gray-700 rounded text-xs">Enter</kbd> Select
              <kbd className="ml-2 px-1 py-0.5 bg-gray-700 rounded text-xs">Esc</kbd> Close
            </div>
            <div>
              {results.length > 0 && `${results.length} result${results.length === 1 ? '' : 's'}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

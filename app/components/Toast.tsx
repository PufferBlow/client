import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [currentToast, setCurrentToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ isOpen: false, message: '', type: 'success' });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setCurrentToast({ isOpen: true, message, type });
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setCurrentToast({ isOpen: false, message: '', type: 'success' });
    }, 3000);
  }, []);

  const contextValue = {
    showToast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {currentToast.isOpen && (
        <div className="fixed top-4 right-4 z-[9999] max-w-sm animate-slide-in-right">
          <div className={`glassmorphism px-4 py-3 rounded-xl flex items-center space-x-3 border transition-all duration-300 hover:scale-105 ${
            currentToast.type === 'error'
              ? 'bg-red-500/80 text-white border-red-400/60'
              : 'bg-emerald-500/80 text-white border-emerald-400/60'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 animate-bounce-in ${
              currentToast.type === 'error'
                ? 'bg-red-400/30'
                : 'bg-emerald-400/30'
            }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                  currentToast.type === 'error'
                    ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    : "M5 13l4 4L19 7"
                } />
              </svg>
            </div>
            <span className="text-sm font-medium leading-relaxed">{currentToast.message}</span>
            <button
              onClick={() => setCurrentToast({ isOpen: false, message: '', type: 'success' })}
              className="text-white hover:bg-white/20 rounded-full p-1.5 transition-all duration-200 hover:scale-110 hover:rotate-90 flex-shrink-0"
              aria-label="Close"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType['showToast'] {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.showToast;
}

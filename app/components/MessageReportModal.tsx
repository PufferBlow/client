import { useState, useEffect } from "react";

interface MessageReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (report: { category: string; description: string }) => void;
  messageCount: number;
}

const REPORT_CATEGORIES = [
  "Nudity or Sexual Content",
  "Racist or Discriminatory",
  "Spam or Solicitation",
  "Harassment or Bullying",
  "Violent or Threatening",
  "Hate Speech",
  "Misinformation",
  "Child Exploitation",
  "Illegal Activity",
  "Spam or Scams",
  "Copyright Infringement",
  "Other"
];

export function MessageReportModal({
  isOpen,
  onClose,
  onSubmit,
  messageCount
}: MessageReportModalProps) {
  const [step, setStep] = useState<'category' | 'description'>('category');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Reset state when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      setStep('category');
      setSelectedCategory('');
      setDescription('');
    }
  }, [isOpen]);

  const handleNext = () => {
    if (step === 'category' && selectedCategory) {
      setStep('description');
    }
  };

  const handleDone = () => {
    onSubmit({
      category: selectedCategory,
      description: description.trim()
    });
    onClose();
  };

  const handleBack = () => {
    if (step === 'description') {
      setStep('category');
    }
  };

  const canProceed = step === 'category' ? !!selectedCategory : true;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Report {messageCount === 1 ? 'Message' : `${messageCount} Messages`}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Help us keep the community safe by reporting violations
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {step === 'category' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  What is the issue with {messageCount === 1 ? 'this message' : 'these messages'}?
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {REPORT_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                        selectedCategory === category
                          ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                          : 'border-gray-600 hover:border-gray-500 text-gray-300 hover:bg-gray-700/50'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'description' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Describe the issue (optional, but helpful)
                </label>
                <div className="mb-2">
                  <span className="text-xs text-gray-400">Category: <span className="text-blue-400">{selectedCategory}</span></span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide additional details about why you're reporting this..."
                  className="w-full h-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
                  maxLength={500}
                />
                <div className="text-xs text-gray-400 text-right mt-1">
                  {description.length}/500
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-3">
            {step === 'description' && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Back
              </button>
            )}

            {step === 'category' && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            )}

            {step === 'category' && (
              <button
                onClick={handleNext}
                disabled={!canProceed}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  canProceed
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            )}

            {step === 'description' && (
              <button
                onClick={handleDone}
                disabled={!canProceed}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  canProceed
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                Report
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

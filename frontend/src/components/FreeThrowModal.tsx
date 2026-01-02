import React, { useState } from 'react';

interface FreeThrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (isMade: boolean) => void;
}

const FreeThrowModal: React.FC<FreeThrowModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [isMade, setIsMade] = useState<boolean | null>(null);

  const handleConfirm = () => {
    if (isMade === null) {
      alert('请选择罚球结果');
      return;
    }
    onConfirm(isMade);
    setIsMade(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">罚球</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">选择罚球结果</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setIsMade(true)}
              className={`px-6 py-4 rounded-lg border-2 transition-all ${
                isMade === true
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 hover:border-green-300'
              }`}
            >
              <div className="text-2xl mb-2">✓</div>
              <div className="font-semibold">命中</div>
            </button>
            <button
              onClick={() => setIsMade(false)}
              className={`px-6 py-4 rounded-lg border-2 transition-all ${
                isMade === false
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-300 hover:border-red-300'
              }`}
            >
              <div className="text-2xl mb-2">✗</div>
              <div className="font-semibold">不中</div>
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={isMade === null}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreeThrowModal;


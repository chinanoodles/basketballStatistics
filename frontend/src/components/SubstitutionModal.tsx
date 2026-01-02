import { useState } from 'react';
import { Player } from '../types';

interface SubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (subOutPlayerId: number, subInPlayerId: number) => void;
  onCourtPlayers: Player[];
  offCourtPlayers: Player[];
  isHome?: boolean;
}

const SubstitutionModal: React.FC<SubstitutionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCourtPlayers,
  offCourtPlayers,
}) => {
  const [subOutPlayerId, setSubOutPlayerId] = useState<number | null>(null);
  const [subInPlayerId, setSubInPlayerId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!subOutPlayerId || !subInPlayerId) {
      alert('请选择被替换和替换的球员');
      return;
    }
    onConfirm(subOutPlayerId, subInPlayerId);
    setSubOutPlayerId(null);
    setSubInPlayerId(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">球员替换</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              被替换球员（下场）
            </label>
            <select
              value={subOutPlayerId || ''}
              onChange={(e) => setSubOutPlayerId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="">请选择</option>
              {onCourtPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  #{player.number} {player.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              替换球员（上场）
            </label>
            <select
              value={subInPlayerId || ''}
              onChange={(e) => setSubInPlayerId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="">请选择</option>
              {offCourtPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  #{player.number} {player.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!subOutPlayerId || !subInPlayerId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            确认替换
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubstitutionModal;


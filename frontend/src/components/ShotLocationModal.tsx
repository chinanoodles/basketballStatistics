import React, { useState, useRef, useEffect } from 'react';
import { Player } from '../types';

interface ShotLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    x: number;
    y: number;
    assistedBy?: number;
    reboundedBy?: number;
    teamReboundTeamId?: number; // 团队篮板所属球队ID（球出界情况）
  }) => void;
  players: Player[];
  shotType: '2PM' | '2PA' | '3PM' | '3PA';
  isMade: boolean;
  shootingPlayer: Player; // 当前投篮的球员
  onCourtPlayers: Set<number>; // 场上球员ID集合
  homeTeamId: number; // 主队ID
  awayTeamId: number; // 客队ID
}

const ShotLocationModal: React.FC<ShotLocationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  players,
  shotType,
  isMade,
  shootingPlayer,
  onCourtPlayers,
  homeTeamId,
  awayTeamId,
}) => {
  const [shotLocation, setShotLocation] = useState<{ x: number; y: number } | null>(null);
  const [selectedAssistPlayer, setSelectedAssistPlayer] = useState<number | null>(null);
  const [selectedReboundPlayer, setSelectedReboundPlayer] = useState<number | null>(null);
  const [teamReboundTeamId, setTeamReboundTeamId] = useState<number | null>(null); // 团队篮板所属球队ID
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShotLocation(null);
      setSelectedAssistPlayer(null);
      setSelectedReboundPlayer(null);
      setTeamReboundTeamId(null);
    }
  }, [isOpen]);

  // 获取场上其他球员（排除投篮球员本人，且必须是同一球队的队友）
  const getOnCourtOtherPlayers = () => {
    const result = players.filter(
      (player) => 
        onCourtPlayers.has(player.id) && 
        player.id !== shootingPlayer.id &&
        player.team_id === shootingPlayer.team_id // 只显示同一球队的队友
    );
    // 调试信息
    if (isOpen && isMade) {
      console.log('助攻列表调试:', {
        shootingPlayer: { id: shootingPlayer.id, name: shootingPlayer.name, team_id: shootingPlayer.team_id },
        onCourtPlayers: Array.from(onCourtPlayers),
        allPlayers: players.map(p => ({ id: p.id, name: p.name, team_id: p.team_id, onCourt: onCourtPlayers.has(p.id) })),
        filteredPlayers: result.map(p => ({ id: p.id, name: p.name }))
      });
    }
    return result;
  };

  // 获取主队场上球员
  const getHomeOnCourtPlayers = () => {
    return players.filter(
      (player) => onCourtPlayers.has(player.id) && player.team_id === homeTeamId
    );
  };

  // 获取客队场上球员
  const getAwayOnCourtPlayers = () => {
    return players.filter(
      (player) => onCourtPlayers.has(player.id) && player.team_id === awayTeamId
    );
  };

  const handleCourtClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    try {
      // 获取图片元素
      const img = canvasRef.current.querySelector('img');
      if (!img) {
        console.warn('Image element not found');
        return;
      }
      
      // 获取图片的实际显示尺寸（考虑 object-contain 的缩放）
      const imgRect = img.getBoundingClientRect();
      
      if (imgRect.width === 0 || imgRect.height === 0) {
        console.warn('Image area is zero, cannot calculate position');
        return;
      }
      
      // 计算点击位置相对于图片的坐标
      const clickX = e.clientX - imgRect.left;
      const clickY = e.clientY - imgRect.top;
      
      // 检查点击是否在图片范围内
      if (clickX < 0 || clickX > imgRect.width || clickY < 0 || clickY > imgRect.height) {
        // 点击在图片外的留白区域，不记录
        return;
      }
      
      // 转换为相对于图片的百分比（0-100）
      // 这样无论容器如何变化，只要图片宽高比一致，坐标就能对齐
      const x = Math.max(0, Math.min(100, (clickX / imgRect.width) * 100));
      const y = Math.max(0, Math.min(100, (clickY / imgRect.height) * 100));
      
      setShotLocation({ x, y });
    } catch (error) {
      console.error('Error calculating shot location:', error);
    }
  };

  const handleConfirm = () => {
    if (!shotLocation) {
      alert('请先标记出手位置');
      return;
    }

    if (!isMade && !selectedReboundPlayer && !teamReboundTeamId) {
      alert('请选择抢篮板的球员或选择球出界');
      return;
    }

    onConfirm({
      x: shotLocation.x,
      y: shotLocation.y,
      assistedBy: isMade ? (selectedAssistPlayer || undefined) : undefined,
      reboundedBy: !isMade && selectedReboundPlayer ? selectedReboundPlayer : undefined,
      teamReboundTeamId: !isMade && teamReboundTeamId ? teamReboundTeamId : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {shotType.includes('3') ? '3分' : '2分'}投篮 - {isMade ? '命中' : '不中'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">点击球场标记出手位置</p>
          <div
            ref={canvasRef}
            className="relative w-full bg-court-bg rounded-lg overflow-hidden cursor-crosshair"
            style={{ aspectRatio: '500 / 470', maxHeight: '400px' }}
            onClick={handleCourtClick}
          >
            <img
              src="/assets/images/court/half-court.svg"
              alt="Basketball Court"
              className="w-full h-full object-contain opacity-50"
            />
            {/* 标记显示在图片实际显示区域内 */}
            {shotLocation && (() => {
              const img = canvasRef.current?.querySelector('img');
              if (!img) return null;
              
              const containerRect = canvasRef.current.getBoundingClientRect();
              const imgRect = img.getBoundingClientRect();
              
              // 计算图片在容器中的位置（百分比）
              const imgLeft = ((imgRect.left - containerRect.left) / containerRect.width) * 100;
              const imgTop = ((imgRect.top - containerRect.top) / containerRect.height) * 100;
              const imgWidth = (imgRect.width / containerRect.width) * 100;
              const imgHeight = (imgRect.height / containerRect.height) * 100;
              
              // 计算标记在容器中的位置（图片百分比坐标转换为容器百分比坐标）
              const markerLeft = imgLeft + (shotLocation.x / 100) * imgWidth;
              const markerTop = imgTop + (shotLocation.y / 100) * imgHeight;
              
              return isMade ? (
                <div
                  className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{
                    left: `${markerLeft}%`,
                    top: `${markerTop}%`,
                  }}
                >
                  <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
                </div>
              ) : (
                <div
                  className="absolute w-6 h-6 text-red-500 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center font-bold z-10"
                  style={{
                    left: `${markerLeft}%`,
                    top: `${markerTop}%`,
                  }}
                >
                  <span className="text-2xl">✕</span>
                </div>
              );
            })()}
          </div>
        </div>

        {shotLocation && (
          <div className="space-y-4">
            {isMade ? (
              <div>
                <label className="block text-sm font-medium mb-2">
                  助攻球员（可选）
                </label>
                <select
                  value={selectedAssistPlayer || ''}
                  onChange={(e) => {
                    setSelectedAssistPlayer(e.target.value ? Number(e.target.value) : null);
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">无助攻</option>
                  {getOnCourtOtherPlayers().map((player) => (
                    <option key={player.id} value={player.id}>
                      #{player.number} {player.name}
                    </option>
                  ))}
                </select>
                {getOnCourtOtherPlayers().length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    场上没有其他队友（需要至少2名同一球队的球员在场上）
                  </p>
                )}
                {getOnCourtOtherPlayers().length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    可选：{getOnCourtOtherPlayers().length} 名场上队友
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    抢篮板球员 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedReboundPlayer || ''}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : null;
                      setSelectedReboundPlayer(value);
                      if (value) {
                        setTeamReboundTeamId(null); // 选择球员时清除团队篮板
                      }
                    }}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="">请选择</option>
                    <optgroup label="主队">
                      {getHomeOnCourtPlayers().map((player) => (
                        <option key={player.id} value={player.id}>
                          #{player.number} {player.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="客队">
                      {getAwayOnCourtPlayers().map((player) => (
                        <option key={player.id} value={player.id}>
                          #{player.number} {player.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="border-t pt-3">
                  <label className="block text-sm font-medium mb-2">
                    或选择球出界（团队篮板）
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTeamReboundTeamId(homeTeamId);
                        setSelectedReboundPlayer(null); // 清除球员选择
                      }}
                      className={`flex-1 px-4 py-2 border rounded-lg ${
                        teamReboundTeamId === homeTeamId
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      主队球权
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTeamReboundTeamId(awayTeamId);
                        setSelectedReboundPlayer(null); // 清除球员选择
                      }}
                      className={`flex-1 px-4 py-2 border rounded-lg ${
                        teamReboundTeamId === awayTeamId
                          ? 'bg-red-500 text-white border-red-500'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      客队球权
                    </button>
                  </div>
                  {teamReboundTeamId && (
                    <p className="text-xs text-gray-500 mt-1">
                      已选择：{teamReboundTeamId === homeTeamId ? '主队' : '客队'}团队篮板
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!shotLocation || (!isMade && !selectedReboundPlayer && !teamReboundTeamId)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShotLocationModal;


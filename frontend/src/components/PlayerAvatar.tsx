import React from 'react';
import { Player } from '../types';

interface PlayerAvatarProps {
  player: Player;
  isHome?: boolean;
  size?: 'sm' | 'md' | 'lg';
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, player: Player) => void;
}

const sizeMap = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
};

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  player,
  isHome = true,
  size = 'md',
  draggable = false,
  onDragStart,
}) => {
  const avatarUrl = player.avatar || 
    (isHome 
      ? '/assets/images/avatars/default-blue.svg'
      : '/assets/images/avatars/default-red.svg');

  const handleDragStart = (e: React.DragEvent) => {
    if (draggable && onDragStart) {
      onDragStart(e, player);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  return (
    <div className={`relative ${sizeMap[size]} inline-block`}>
      <div
        className={`w-full h-full rounded-full border-2 ${
          isHome ? 'border-blue-500' : 'border-red-500'
        } bg-white shadow-md ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        draggable={draggable}
        onDragStart={handleDragStart}
      >
        <img
          src={avatarUrl}
          alt={player.name}
          className="w-full h-full rounded-full object-cover"
          onError={(e) => {
            // 如果图片加载失败，使用默认头像
            const target = e.target as HTMLImageElement;
            target.src = isHome
              ? '/assets/images/avatars/default-blue.svg'
              : '/assets/images/avatars/default-red.svg';
          }}
        />
      </div>
      <div className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
        {player.number}
      </div>
    </div>
  );
};

export default PlayerAvatar;


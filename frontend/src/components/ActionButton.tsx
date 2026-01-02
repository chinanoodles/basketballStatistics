import React from 'react';
import { ActionType } from '../types';

interface ActionButtonProps {
  action: ActionType;
  label: string;
  icon?: string;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

const actionColors: Record<ActionType, string> = {
  '2PM': 'bg-blue-500 hover:bg-blue-600',
  '2PA': 'bg-blue-300 hover:bg-blue-400',
  '3PM': 'bg-red-500 hover:bg-red-600',
  '3PA': 'bg-red-300 hover:bg-red-400',
  'FTM': 'bg-green-500 hover:bg-green-600',
  'FTA': 'bg-green-300 hover:bg-green-400',
  'OREB': 'bg-yellow-500 hover:bg-yellow-600',
  'DREB': 'bg-purple-500 hover:bg-purple-600',
  'AST': 'bg-pink-500 hover:bg-pink-600',
  'STL': 'bg-red-600 hover:bg-red-700',
  'BLK': 'bg-indigo-500 hover:bg-indigo-600',
  'TOV': 'bg-orange-500 hover:bg-orange-600',
  'PF': 'bg-red-700 hover:bg-red-800',
  'PFD': 'bg-blue-600 hover:bg-blue-700',
  'SUB_IN': 'bg-gray-500 hover:bg-gray-600',
  'SUB_OUT': 'bg-gray-400 hover:bg-gray-500',
};

const ActionButton: React.FC<ActionButtonProps> = ({
  action,
  label,
  icon,
  onDrop,
  onDragOver,
  onClick,
  className = '',
  disabled = false,
}) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDragOver) {
      onDragOver(e);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDrop) {
      onDrop(e);
    }
  };

  const handleClick = () => {
    if (onClick && !disabled) {
      onClick();
    }
  };

  return (
    <div
      className={`${actionColors[action]} text-white rounded-lg p-4 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer transition-all transform hover:scale-105'
      } ${className}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      {icon && (
        <img
          src={icon}
          alt={label}
          className="w-8 h-8 mx-auto mb-2"
        />
      )}
      <div className="text-center">
        <div className="font-bold text-lg">{action}</div>
        <div className="text-xs">{label}</div>
      </div>
    </div>
  );
};

export default ActionButton;


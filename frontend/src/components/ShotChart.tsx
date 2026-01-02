import React from 'react';
import Court from './Court';

interface Shot {
  x: number; // 百分比 0-100
  y: number; // 百分比 0-100
  made: boolean;
  type: '2PM' | '3PM' | '2PA' | '3PA';
}

interface ShotChartProps {
  shots: Shot[];
  playerName?: string;
}

const ShotChart: React.FC<ShotChartProps> = ({ shots, playerName }) => {
  return (
    <div className="w-full">
      {playerName && (
        <h3 className="text-lg font-semibold mb-4">#{playerName} 出手点分布</h3>
      )}
      <Court className="w-full" style={{ aspectRatio: '500 / 470', maxHeight: '384px' }}>
        {shots.map((shot, index) => (
          <div
            key={index}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
              shot.made ? 'text-green-500' : 'text-red-500'
            }`}
            style={{
              left: `${shot.x}%`,
              top: `${shot.y}%`,
            }}
          >
            {shot.made ? (
              <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg"></div>
            ) : (
              <div className="w-4 h-4 flex items-center justify-center">
                <svg
                  className="w-full h-full text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </Court>
      <div className="mt-4 flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
          <span>命中</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 flex items-center justify-center">
            <svg className="w-full h-full text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span>未命中</span>
        </div>
      </div>
    </div>
  );
};

export default ShotChart;


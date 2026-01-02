import React from 'react';

interface ScorePoint {
  x: number;
  homeScore: number;
  awayScore: number;
}

interface ScoreChartProps {
  data: ScorePoint[];
  homeTeamName: string;
  awayTeamName: string;
  width?: number;
  height?: number;
}

const ScoreChart: React.FC<ScoreChartProps> = ({
  data,
  homeTeamName,
  awayTeamName,
  width = 800,
  height = 300,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>暂无得分数据</p>
      </div>
    );
  }

  const maxScore = Math.max(
    ...data.map(d => Math.max(d.homeScore, d.awayScore)),
    30
  );
  const maxX = Math.max(...data.map(d => d.x), 1);

  const padding = { top: 20, right: 40, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const scaleX = (x: number) => (x / maxX) * chartWidth;
  const scaleY = (score: number) => chartHeight - (score / maxScore) * chartHeight;

  // 生成路径
  const homePath = data
    .map((point, index) => {
      const x = scaleX(point.x) + padding.left;
      const y = scaleY(point.homeScore) + padding.top;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const awayPath = data
    .map((point, index) => {
      const x = scaleX(point.x) + padding.left;
      const y = scaleY(point.awayScore) + padding.top;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // 生成网格线
  const gridLines = [];
  for (let i = 0; i <= 5; i++) {
    const score = (maxScore / 5) * i;
    const y = scaleY(score) + padding.top;
    gridLines.push(
      <line
        key={`grid-${i}`}
        x1={padding.left}
        y1={y}
        x2={width - padding.right}
        y2={y}
        stroke="#e5e7eb"
        strokeWidth={1}
      />
    );
    gridLines.push(
      <text
        key={`label-${i}`}
        x={padding.left - 10}
        y={y + 4}
        textAnchor="end"
        className="text-xs fill-gray-500"
      >
        {Math.round(score)}
      </text>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-center">得分曲线</h3>
      <svg width={width} height={height} className="w-full">
        {/* 网格线 */}
        {gridLines}

        {/* 坐标轴 */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="#374151"
          strokeWidth={2}
        />
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#374151"
          strokeWidth={2}
        />

        {/* 主队得分线 */}
        <path
          d={homePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((point, index) => (
          <circle
            key={`home-${index}`}
            cx={scaleX(point.x) + padding.left}
            cy={scaleY(point.homeScore) + padding.top}
            r={4}
            fill="#3b82f6"
          />
        ))}

        {/* 客队得分线 */}
        <path
          d={awayPath}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((point, index) => (
          <circle
            key={`away-${index}`}
            cx={scaleX(point.x) + padding.left}
            cy={scaleY(point.awayScore) + padding.top}
            r={4}
            fill="#ef4444"
          />
        ))}

        {/* 图例 */}
        <g transform={`translate(${width - padding.right - 100}, ${padding.top})`}>
          <rect x={0} y={0} width={12} height={12} fill="#3b82f6" />
          <text x={16} y={10} className="text-xs fill-gray-700">
            {homeTeamName}
          </text>
          <rect x={0} y={18} width={12} height={12} fill="#ef4444" />
          <text x={16} y={28} className="text-xs fill-gray-700">
            {awayTeamName}
          </text>
        </g>
      </svg>
    </div>
  );
};

export default ScoreChart;


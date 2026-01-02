import React from 'react';

interface TeamComparisonBoardProps {
  homeTeamName: string;
  awayTeamName: string;
  homeStats: {
    totalPoints: number;
    pointsOffTurnovers: number;
    pointsInPaint: number;
    secondChancePoints: number;
    fastBreakPoints: number;
    startersPoints: number;
    benchPoints: number;
    totalRebounds: number;
    totalAssists: number;
    totalTurnovers: number;
    totalSteals: number;
    totalBlocks: number;
    fieldGoalPercentage: number;
    threePointPercentage: number;
    twoPointPercentage: number;
    freeThrowPercentage: number;
  };
  awayStats: {
    totalPoints: number;
    pointsOffTurnovers: number;
    pointsInPaint: number;
    secondChancePoints: number;
    fastBreakPoints: number;
    startersPoints: number;
    benchPoints: number;
    totalRebounds: number;
    totalAssists: number;
    totalTurnovers: number;
    totalSteals: number;
    totalBlocks: number;
    fieldGoalPercentage: number;
    threePointPercentage: number;
    twoPointPercentage: number;
    freeThrowPercentage: number;
  };
}

const TeamComparisonBoard: React.FC<TeamComparisonBoardProps> = ({
  homeTeamName,
  awayTeamName,
  homeStats,
  awayStats,
}) => {
  const stats = [
    { label: '得分', home: homeStats.totalPoints, away: awayStats.totalPoints, isPercentage: false },
    { label: '失误得分', home: homeStats.pointsOffTurnovers, away: awayStats.pointsOffTurnovers, isPercentage: false },
    { label: '内线得分', home: homeStats.pointsInPaint, away: awayStats.pointsInPaint, isPercentage: false },
    { label: '二次进攻得分', home: homeStats.secondChancePoints, away: awayStats.secondChancePoints, isPercentage: false },
    { label: '快攻得分', home: homeStats.fastBreakPoints, away: awayStats.fastBreakPoints, isPercentage: false },
    { label: '首发得分', home: homeStats.startersPoints, away: awayStats.startersPoints, isPercentage: false },
    { label: '替补得分', home: homeStats.benchPoints, away: awayStats.benchPoints, isPercentage: false },
    { label: '篮板', home: homeStats.totalRebounds, away: awayStats.totalRebounds, isPercentage: false },
    { label: '助攻', home: homeStats.totalAssists, away: awayStats.totalAssists, isPercentage: false },
    { label: '失误', home: homeStats.totalTurnovers, away: awayStats.totalTurnovers, isPercentage: false },
    { label: '抢断', home: homeStats.totalSteals, away: awayStats.totalSteals, isPercentage: false },
    { label: '盖帽', home: homeStats.totalBlocks, away: awayStats.totalBlocks, isPercentage: false },
    { label: '投篮命中率', home: homeStats.fieldGoalPercentage, away: awayStats.fieldGoalPercentage, isPercentage: true },
    { label: '三分命中率', home: homeStats.threePointPercentage, away: awayStats.threePointPercentage, isPercentage: true },
    { label: '两分命中率', home: homeStats.twoPointPercentage, away: awayStats.twoPointPercentage, isPercentage: true },
    { label: '罚球命中率', home: homeStats.freeThrowPercentage, away: awayStats.freeThrowPercentage, isPercentage: true },
  ];

  return (
    <div className="bg-white rounded-lg p-3 h-full">
      <h3 className="text-sm font-semibold mb-2 text-center">球队对比</h3>
      <div className="space-y-1">
        {stats.map((stat, index) => {
          const max = Math.max(stat.home, stat.away, 1);
          const homeWidth = max > 0 ? (stat.home / max) * 50 : 0; // 最大50%宽度（从中心向左边）
          const awayWidth = max > 0 ? (stat.away / max) * 50 : 0; // 最大50%宽度（从中心向右边）
          const displayHome = stat.isPercentage ? `${stat.home.toFixed(0)}%` : stat.home.toString();
          const displayAway = stat.isPercentage ? `${stat.away.toFixed(0)}%` : stat.away.toString();

          return (
            <div key={index} className="relative py-0.5">
              <div className="flex items-center justify-center gap-1">
                {/* 左侧：主队数据和条形图 */}
                <div className="flex items-center gap-1" style={{ width: '50%', justifyContent: 'flex-end' }}>
                  <div className="bg-gray-200 rounded h-2 relative overflow-hidden" style={{ width: `${Math.max(homeWidth, 2)}%`, minWidth: '20px' }}>
                    <div className="bg-blue-500 h-full rounded" style={{ width: '100%' }} />
                  </div>
                  <span className="text-xs text-blue-600 font-semibold w-10 text-right">{displayHome}</span>
                </div>
                {/* 中间：统计项名称 */}
                <span className="text-xs font-medium text-gray-700 w-20 text-center px-1">{stat.label}</span>
                {/* 右侧：客队数据和条形图 */}
                <div className="flex items-center gap-1" style={{ width: '50%', justifyContent: 'flex-start' }}>
                  <span className="text-xs text-red-600 font-semibold w-10 text-left">{displayAway}</span>
                  <div className="bg-gray-200 rounded h-2 relative overflow-hidden" style={{ width: `${Math.max(awayWidth, 2)}%`, minWidth: '20px' }}>
                    <div className="bg-red-500 h-full rounded" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4 mt-2 pt-2 border-t">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-blue-500 rounded"></div>
          <span className="text-xs text-gray-600">{homeTeamName}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-red-500 rounded"></div>
          <span className="text-xs text-gray-600">{awayTeamName}</span>
        </div>
      </div>
    </div>
  );
};

export default TeamComparisonBoard;


import React from 'react';
import { Player, Statistic } from '../types';

interface PlayerStats {
  player: Player;
  stats: {
    points: number;
    fgm: number; // Field Goals Made
    fga: number; // Field Goals Attempted
    fg3m: number; // 3 Point Field Goals Made
    fg3a: number; // 3 Point Field Goals Attempted
    ftm: number; // Free Throws Made
    fta: number; // Free Throws Attempted
    oreb: number; // Offensive Rebounds
    dreb: number; // Defensive Rebounds
    reb: number; // Total Rebounds
    ast: number; // Assists
    stl: number; // Steals
    blk: number; // Blocks
    tov: number; // Turnovers
    pf: number; // Personal Fouls
    pfd: number; // Personal Fouls Drawn
  };
}

interface PlayerStatsTableProps {
  players: Player[];
  statistics: Statistic[];
  isHome: boolean;
}

const PlayerStatsTable: React.FC<PlayerStatsTableProps> = ({
  players,
  statistics,
  isHome,
}) => {
  const calculateStats = (player: Player): PlayerStats['stats'] => {
    const playerStats = statistics.filter((s) => s.player_id === player.id);
    
    const stats = {
      points: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      oreb: 0,
      dreb: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pf: 0,
      pfd: 0,
    };

    playerStats.forEach((stat) => {
      switch (stat.action_type) {
        case '2PM':
          stats.fgm++;
          stats.fga++;
          stats.points += 2;
          break;
        case '2PA':
          stats.fga++;
          break;
        case '3PM':
          stats.fg3m++;
          stats.fg3a++;
          stats.fgm++;
          stats.fga++;
          stats.points += 3;
          break;
        case '3PA':
          stats.fg3a++;
          stats.fga++;
          break;
        case 'FTM':
          stats.ftm++;
          stats.fta++;
          stats.points += 1;
          break;
        case 'FTA':
          stats.fta++;
          break;
        case 'OREB':
          stats.oreb++;
          stats.reb++;
          break;
        case 'DREB':
          stats.dreb++;
          stats.reb++;
          break;
        case 'AST':
          stats.ast++;
          break;
        case 'STL':
          stats.stl++;
          break;
        case 'BLK':
          stats.blk++;
          break;
        case 'TOV':
          stats.tov++;
          break;
        case 'PF':
          stats.pf++;
          break;
        case 'PFD':
          stats.pfd++;
          break;
      }
    });

    return stats;
  };

  const playerStatsList: PlayerStats[] = players.map((player) => ({
    player,
    stats: calculateStats(player),
  }));

  const teamTotals = playerStatsList.reduce(
    (acc, ps) => ({
      points: acc.points + ps.stats.points,
      fgm: acc.fgm + ps.stats.fgm,
      fga: acc.fga + ps.stats.fga,
      fg3m: acc.fg3m + ps.stats.fg3m,
      fg3a: acc.fg3a + ps.stats.fg3a,
      ftm: acc.ftm + ps.stats.ftm,
      fta: acc.fta + ps.stats.fta,
      oreb: acc.oreb + ps.stats.oreb,
      dreb: acc.dreb + ps.stats.dreb,
      reb: acc.reb + ps.stats.reb,
      ast: acc.ast + ps.stats.ast,
      stl: acc.stl + ps.stats.stl,
      blk: acc.blk + ps.stats.blk,
      tov: acc.tov + ps.stats.tov,
      pf: acc.pf + ps.stats.pf,
      pfd: acc.pfd + ps.stats.pfd,
    }),
    {
      points: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      oreb: 0,
      dreb: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pf: 0,
      pfd: 0,
    }
  );

  const formatPercentage = (made: number, attempted: number) => {
    if (attempted === 0) return '0.0%';
    return ((made / attempted) * 100).toFixed(1) + '%';
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className={`px-4 py-2 ${isHome ? 'bg-blue-600' : 'bg-red-600'} text-white font-semibold`}>
        {isHome ? '主队' : '客队'} 统计
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">球员</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">PTS</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">FG</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">3P</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">FT</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">REB</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">AST</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">STL</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">BLK</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">TOV</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">PF</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {playerStatsList.map((ps) => (
              <tr key={ps.player.id} className="hover:bg-gray-50">
                <td className="px-2 py-2 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="font-medium">#{ps.player.number}</span>
                    <span className="ml-1 text-gray-600">{ps.player.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center font-semibold">{ps.stats.points}</td>
                <td className="px-2 py-2 text-center">
                  {ps.stats.fgm}/{ps.stats.fga}
                  <div className="text-xs text-gray-500">
                    {formatPercentage(ps.stats.fgm, ps.stats.fga)}
                  </div>
                </td>
                <td className="px-2 py-2 text-center">
                  {ps.stats.fg3m}/{ps.stats.fg3a}
                  <div className="text-xs text-gray-500">
                    {formatPercentage(ps.stats.fg3m, ps.stats.fg3a)}
                  </div>
                </td>
                <td className="px-2 py-2 text-center">
                  {ps.stats.ftm}/{ps.stats.fta}
                  <div className="text-xs text-gray-500">
                    {formatPercentage(ps.stats.ftm, ps.stats.fta)}
                  </div>
                </td>
                <td className="px-2 py-2 text-center">{ps.stats.reb}</td>
                <td className="px-2 py-2 text-center">{ps.stats.ast}</td>
                <td className="px-2 py-2 text-center">{ps.stats.stl}</td>
                <td className="px-2 py-2 text-center">{ps.stats.blk}</td>
                <td className="px-2 py-2 text-center">{ps.stats.tov}</td>
                <td className="px-2 py-2 text-center">{ps.stats.pf}</td>
              </tr>
            ))}
            {/* 总计行 */}
            <tr className="bg-gray-100 font-semibold">
              <td className="px-2 py-2">总计</td>
              <td className="px-2 py-2 text-center">{teamTotals.points}</td>
              <td className="px-2 py-2 text-center">
                {teamTotals.fgm}/{teamTotals.fga}
                <div className="text-xs text-gray-500">
                  {formatPercentage(teamTotals.fgm, teamTotals.fga)}
                </div>
              </td>
              <td className="px-2 py-2 text-center">
                {teamTotals.fg3m}/{teamTotals.fg3a}
                <div className="text-xs text-gray-500">
                  {formatPercentage(teamTotals.fg3m, teamTotals.fg3a)}
                </div>
              </td>
              <td className="px-2 py-2 text-center">
                {teamTotals.ftm}/{teamTotals.fta}
                <div className="text-xs text-gray-500">
                  {formatPercentage(teamTotals.ftm, teamTotals.fta)}
                </div>
              </td>
              <td className="px-2 py-2 text-center">{teamTotals.reb}</td>
              <td className="px-2 py-2 text-center">{teamTotals.ast}</td>
              <td className="px-2 py-2 text-center">{teamTotals.stl}</td>
              <td className="px-2 py-2 text-center">{teamTotals.blk}</td>
              <td className="px-2 py-2 text-center">{teamTotals.tov}</td>
              <td className="px-2 py-2 text-center">{teamTotals.pf}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlayerStatsTable;


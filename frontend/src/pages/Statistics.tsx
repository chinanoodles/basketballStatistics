import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { statisticsApi, teamsApi, gamesApi, playersApi } from '../utils/api';
import { Player, Team, Statistic } from '../types';

interface PlayerStats {
  player: Player;
  team: Team;
  games: number;
  points: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  pfd: number; // Personal Fouls Drawn
  eff: number; // Efficiency
  pir: number; // Performance Index Rating
  plusMinus: number; // Plus Minus
}

interface TeamStats {
  team: Team;
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

function Statistics() {
  const navigate = useNavigate();
  const [season, setSeason] = useState('26/27');
  const [viewMode, setViewMode] = useState<'players' | 'teams'>('players');
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [_teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<keyof PlayerStats>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dataMode, setDataMode] = useState<'total' | 'average'>('total'); // 累积数据或场均数据

  useEffect(() => {
    loadStatistics();
  }, [season, viewMode, dataMode]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      
      if (viewMode === 'players') {
        await loadPlayerStatistics();
      } else {
        await loadTeamStatistics();
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayerStatistics = async () => {
    try {
      // 获取所有比赛（可以根据赛季筛选）
      const gamesResponse = await gamesApi.getAll();
      const games = gamesResponse.data.filter((g: any) => g.status === 'finished');

      // 获取所有球队
      const teamsResponse = await teamsApi.getAll();
      const teams = teamsResponse.data;

      // 获取所有球员
      const allPlayers: { [key: number]: { player: Player; team: Team } } = {};
      for (const team of teams) {
        try {
          const playersResponse = await playersApi.getByTeam(team.id);
          for (const player of playersResponse.data) {
            allPlayers[player.id] = { player, team };
          }
        } catch (error) {
          console.error(`加载球队 ${team.id} 球员失败:`, error);
        }
      }

      const allPlayerStats: { [key: number]: PlayerStats } = {};

      // 获取所有统计数据
      for (const game of games) {
        try {
          const statsResponse = await statisticsApi.getByGame(game.id);
          const stats = statsResponse.data;

          for (const stat of stats) {
            if (!allPlayerStats[stat.player_id]) {
              const playerInfo = allPlayers[stat.player_id];
              if (!playerInfo) continue;

              allPlayerStats[stat.player_id] = {
                player: playerInfo.player,
                team: playerInfo.team,
                games: 0,
                points: 0,
                fgm: 0,
                fga: 0,
                fg3m: 0,
                fg3a: 0,
                ftm: 0,
                fta: 0,
                reb: 0,
                ast: 0,
                stl: 0,
                blk: 0,
                tov: 0,
                pf: 0,
                pfd: 0,
                eff: 0,
                pir: 0,
                plusMinus: 0,
              };
            }

            const playerStat = allPlayerStats[stat.player_id];
            switch (stat.action_type) {
              case '2PM':
                playerStat.fgm++;
                playerStat.fga++;
                playerStat.points += 2;
                break;
              case '2PA':
                playerStat.fga++;
                break;
              case '3PM':
                playerStat.fg3m++;
                playerStat.fg3a++;
                playerStat.fgm++;
                playerStat.fga++;
                playerStat.points += 3;
                break;
              case '3PA':
                playerStat.fg3a++;
                playerStat.fga++;
                break;
              case 'FTM':
                playerStat.ftm++;
                playerStat.fta++;
                playerStat.points += 1;
                break;
              case 'FTA':
                playerStat.fta++;
                break;
              case 'OREB':
              case 'DREB':
                playerStat.reb++;
                break;
              case 'AST':
                playerStat.ast++;
                break;
              case 'STL':
                playerStat.stl++;
                break;
              case 'BLK':
                playerStat.blk++;
                break;
              case 'TOV':
                playerStat.tov++;
                break;
              case 'PF':
                playerStat.pf++;
                break;
              case 'PFD':
                playerStat.pfd++;
                break;
            }
          }
        } catch (error) {
          console.error(`加载比赛 ${game.id} 统计失败:`, error);
        }
      }

      // 计算+/-值（需要跟踪球员在场时的得分差）
      // 对于每场比赛，计算球员在场时球队的得分差
      for (const game of games) {
        try {
          const statsResponse = await statisticsApi.getByGame(game.id).catch(() => null);
          if (!statsResponse) continue;
          
          const stats = statsResponse.data;
          const gameSummaryResponse = await gamesApi.getStatistics(game.id).catch(() => null);
          if (!gameSummaryResponse) continue;
          
          const homeScore = gameSummaryResponse.data.home_score || 0;
          const awayScore = gameSummaryResponse.data.away_score || 0;
          
          // 获取主队和客队球员
          const homeTeam = teams.find((t: Team) => t.id === game.home_team_id);
          const awayTeam = teams.find((t: Team) => t.id === game.away_team_id);
          
          if (!homeTeam || !awayTeam) continue;
          
          // 获取主队和客队的所有球员ID
          const homePlayerIds = new Set<number>();
          const awayPlayerIds = new Set<number>();
          
          for (const stat of stats) {
            const playerInfo = allPlayers[stat.player_id];
            if (!playerInfo) continue;
            
            if (playerInfo.team.id === game.home_team_id) {
              homePlayerIds.add(stat.player_id);
            } else if (playerInfo.team.id === game.away_team_id) {
              awayPlayerIds.add(stat.player_id);
            }
          }
          
          // 计算每个球员的+/-值
          // 简化版本：假设所有球员都参与了整场比赛，使用最终比分差
          // 更精确的版本需要跟踪每个球员的上场/下场时间
          const finalScoreDiff = homeScore - awayScore;
          
          homePlayerIds.forEach((playerId) => {
            if (allPlayerStats[playerId]) {
              // 主队球员：如果主队赢了，+/-为正；如果主队输了，+/-为负
              allPlayerStats[playerId].plusMinus += finalScoreDiff;
            }
          });
          
          awayPlayerIds.forEach((playerId) => {
            if (allPlayerStats[playerId]) {
              // 客队球员：如果客队赢了，+/-为正；如果客队输了，+/-为负
              allPlayerStats[playerId].plusMinus -= finalScoreDiff;
            }
          });
        } catch (error) {
          console.error(`计算比赛 ${game.id} +/-值失败:`, error);
        }
      }

      // 计算EFF和PIR
      Object.values(allPlayerStats).forEach((playerStat) => {
        // EFF = ((PTS + REB + AST + STL + BLK) - ((FGA - FGM) + (FTA - FTM) + TOV))
        const positiveStats = playerStat.points + playerStat.reb + playerStat.ast + playerStat.stl + playerStat.blk;
        const negativeStats = (playerStat.fga - playerStat.fgm) + (playerStat.fta - playerStat.ftm) + playerStat.tov;
        playerStat.eff = positiveStats - negativeStats;
        
        // PIR = ((PTS + REB + AST + STL + BLK + PFD) - ((FGA - FGM) + (FTA - FTM) + TOV + PF))
        const positiveStatsPIR = playerStat.points + playerStat.reb + playerStat.ast + playerStat.stl + playerStat.blk + playerStat.pfd;
        const negativeStatsPIR = (playerStat.fga - playerStat.fgm) + (playerStat.fta - playerStat.ftm) + playerStat.tov + playerStat.pf;
        playerStat.pir = positiveStatsPIR - negativeStatsPIR;
      });

      // 计算每个球员参加的比赛数
      for (const game of games) {
        const statsResponse = await statisticsApi.getByGame(game.id).catch(() => null);
        if (!statsResponse) continue;
        
        const playerIds = new Set<number>(statsResponse.data.map((s: Statistic) => s.player_id));
        playerIds.forEach((playerId) => {
          if (allPlayerStats[playerId]) {
            allPlayerStats[playerId].games++;
          }
        });
      }

      // 根据数据模式计算显示值
      const processedStats = Object.values(allPlayerStats).map(ps => {
        if (dataMode === 'average' && ps.games > 0) {
          // 保存原始数据用于计算命中率
          const originalPs = { ...ps };
          return {
            ...ps,
            _original: originalPs, // 保存原始累积数据用于显示命中率
            points: ps.points / ps.games,
            fgm: ps.fgm / ps.games,
            fga: ps.fga / ps.games,
            fg3m: ps.fg3m / ps.games,
            fg3a: ps.fg3a / ps.games,
            ftm: ps.ftm / ps.games,
            fta: ps.fta / ps.games,
            reb: ps.reb / ps.games,
            ast: ps.ast / ps.games,
            stl: ps.stl / ps.games,
            blk: ps.blk / ps.games,
            tov: ps.tov / ps.games,
            pf: ps.pf / ps.games,
            pfd: ps.pfd / ps.games,
            eff: ps.eff / ps.games,
            pir: ps.pir / ps.games,
            plusMinus: ps.plusMinus / ps.games,
          };
        }
        return ps;
      });

      const sortedStats = processedStats.sort((a, b) => {
        const aVal = Number(a[sortBy as keyof PlayerStats]);
        const bVal = Number(b[sortBy as keyof PlayerStats]);
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });

      setPlayerStats(sortedStats);
    } catch (error) {
      console.error('加载球员统计失败:', error);
    }
  };

  const loadTeamStatistics = async () => {
    // TODO: 实现球队统计
    setTeamStats([]);
  };

  const formatPercentage = (made: number, attempted: number) => {
    if (attempted === 0) return '0.0%';
    return ((made / attempted) * 100).toFixed(1) + '%';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-gray-800">技术统计</h1>
            <div className="flex items-center gap-4">
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="26/27">2026/27 赛季</option>
                <option value="25/26">2025/26 赛季</option>
                <option value="24/25">2024/25 赛季</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* 视图切换 */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setViewMode('players')}
            className={`px-6 py-2 rounded-lg font-semibold ${
              viewMode === 'players' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            球员排名
          </button>
          <button
            onClick={() => setViewMode('teams')}
            className={`px-6 py-2 rounded-lg font-semibold ${
              viewMode === 'teams' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            球队排名
          </button>
        </div>

        {viewMode === 'players' ? (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* 数据模式切换 */}
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">数据模式：</span>
                <button
                  onClick={() => setDataMode('total')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
                    dataMode === 'total'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  累积数据
                </button>
                <button
                  onClick={() => setDataMode('average')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
                    dataMode === 'average'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  场均数据
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">排名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">球员</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">球队</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => { setSortBy('games'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>场次</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => { setSortBy('points'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>得分</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">投篮</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">三分</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">篮板</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => { setSortBy('ast'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>助攻</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">抢断</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">盖帽</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => { setSortBy('eff'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>EFF</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => { setSortBy('pir'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>PIR</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => { setSortBy('plusMinus'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>+/-</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {playerStats.map((ps, index) => (
                    <tr key={ps.player.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold">{index + 1}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">#{ps.player.number} {ps.player.name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ps.team.name}</td>
                      <td className="px-4 py-3 text-sm text-center">{ps.games}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold">
                        {typeof ps.points === 'number' ? ps.points.toFixed(dataMode === 'average' ? 1 : 0) : ps.points}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {typeof ps.fgm === 'number' ? ps.fgm.toFixed(dataMode === 'average' ? 1 : 0) : ps.fgm}/
                        {typeof ps.fga === 'number' ? ps.fga.toFixed(dataMode === 'average' ? 1 : 0) : ps.fga}
                        <div className="text-xs text-gray-500">
                          {formatPercentage(
                            (ps as any)._original?.fgm || ps.fgm,
                            (ps as any)._original?.fga || ps.fga
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {typeof ps.fg3m === 'number' ? ps.fg3m.toFixed(dataMode === 'average' ? 1 : 0) : ps.fg3m}/
                        {typeof ps.fg3a === 'number' ? ps.fg3a.toFixed(dataMode === 'average' ? 1 : 0) : ps.fg3a}
                        <div className="text-xs text-gray-500">
                          {formatPercentage(
                            (ps as any)._original?.fg3m || ps.fg3m,
                            (ps as any)._original?.fg3a || ps.fg3a
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {typeof ps.reb === 'number' ? ps.reb.toFixed(dataMode === 'average' ? 1 : 0) : ps.reb}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {typeof ps.ast === 'number' ? ps.ast.toFixed(dataMode === 'average' ? 1 : 0) : ps.ast}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {typeof ps.stl === 'number' ? ps.stl.toFixed(dataMode === 'average' ? 1 : 0) : ps.stl}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {typeof ps.blk === 'number' ? ps.blk.toFixed(dataMode === 'average' ? 1 : 0) : ps.blk}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-semibold">
                        {typeof ps.eff === 'number' ? ps.eff.toFixed(dataMode === 'average' ? 1 : 0) : ps.eff}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-semibold">
                        {typeof ps.pir === 'number' ? ps.pir.toFixed(dataMode === 'average' ? 1 : 0) : ps.pir}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-semibold">
                        {typeof ps.plusMinus === 'number' 
                          ? (ps.plusMinus >= 0 ? '+' : '') + ps.plusMinus.toFixed(dataMode === 'average' ? 1 : 0)
                          : ps.plusMinus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-500">球队排名功能开发中...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Statistics;

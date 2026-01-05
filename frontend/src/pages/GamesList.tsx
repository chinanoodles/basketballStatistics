import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { gamesApi, teamsApi, leaguesApi } from '../utils/api';
import { Game, League } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface GameWithTeams extends Game {
  home_team_name?: string;
  away_team_name?: string;
  home_score?: number;
  away_score?: number;
}

function GamesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [games, setGames] = useState<GameWithTeams[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'finished' | 'live' | 'pending'>('all');
  const [selectedGames, setSelectedGames] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [league, setLeague] = useState<League | null>(null);

  useEffect(() => {
    loadGames();
    loadLeague();
  }, [filter]);

  const loadLeague = async () => {
    if (user?.league_id) {
      try {
        const response = await leaguesApi.getById(user.league_id);
        setLeague(response.data);
      } catch (error) {
        console.error('加载联赛信息失败:', error);
      }
    }
  };

  const loadGames = async () => {
    try {
      setLoading(true);
      const response = await gamesApi.getAll();
      let gamesData = response.data;

      // 过滤比赛
      if (filter !== 'all') {
        gamesData = gamesData.filter((game: Game) => game.status === filter);
      }

      // 加载球队信息和比分
      const gamesWithTeams = await Promise.all(
        gamesData.map(async (game: Game) => {
          try {
            const [homeTeam, awayTeam, statsResponse] = await Promise.all([
              teamsApi.getById(game.home_team_id),
              teamsApi.getById(game.away_team_id),
              gamesApi.getStatistics(game.id).catch(() => null),
            ]);

            // 从统计摘要获取比分
            let homeScore = 0;
            let awayScore = 0;
            if (statsResponse && statsResponse.data) {
              homeScore = statsResponse.data.home_score || 0;
              awayScore = statsResponse.data.away_score || 0;
            }

            return {
              ...game,
              home_team_name: homeTeam.data.name,
              away_team_name: awayTeam.data.name,
              home_score: homeScore,
              away_score: awayScore,
            };
          } catch (error) {
            console.error('加载比赛详情失败:', error);
            return {
              ...game,
              home_team_name: '未知',
              away_team_name: '未知',
              home_score: 0,
              away_score: 0,
            };
          }
        })
      );

      // 按日期排序（最新的在前）
      gamesWithTeams.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setGames(gamesWithTeams);
    } catch (error) {
      console.error('加载比赛失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finished':
        return 'bg-gray-500';
      case 'live':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'finished':
        return '已结束';
      case 'live':
        return '进行中';
      case 'paused':
        return '已暂停';
      default:
        return '待开始';
    }
  };

  const getSeasonTypeLabel = (seasonType: 'regular' | 'playoff') => {
    if (seasonType === 'regular') {
      return league?.regular_season_name || '小组赛';
    } else {
      return league?.playoff_name || '季后赛';
    }
  };

  const getSeasonTypeColor = (seasonType: 'regular' | 'playoff') => {
    if (seasonType === 'regular') {
      return 'bg-green-100 text-green-700';
    } else {
      return 'bg-orange-100 text-orange-700';
    }
  };

  const handleToggleSelect = (gameId: number) => {
    const newSelected = new Set(selectedGames);
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId);
    } else {
      newSelected.add(gameId);
    }
    setSelectedGames(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedGames.size === games.length) {
      setSelectedGames(new Set());
    } else {
      setSelectedGames(new Set(games.map(g => g.id)));
    }
  };

  const handleDelete = async (gameId: number) => {
    if (!window.confirm('确定要删除这场比赛吗？此操作不可恢复。')) {
      return;
    }
    try {
      await gamesApi.delete(gameId);
      await loadGames();
      setSelectedGames(new Set());
    } catch (error) {
      console.error('删除比赛失败:', error);
      alert('删除比赛失败，请重试');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedGames.size === 0) {
      alert('请先选择要删除的比赛');
      return;
    }
    if (!window.confirm(`确定要删除选中的 ${selectedGames.size} 场比赛吗？此操作不可恢复。`)) {
      return;
    }
    try {
      await gamesApi.batchDelete(Array.from(selectedGames));
      await loadGames();
      setSelectedGames(new Set());
      setIsSelectMode(false);
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('批量删除失败，请重试');
    }
  };

  const handleExportPDF = async (gameId: number) => {
    // 在新窗口打开比赛报告页面，然后导出
    const reportUrl = `/game/${gameId}/report`;
    window.open(reportUrl, '_blank');
    // 注意：实际导出需要在GameReport页面中完成
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
            <h1 className="text-2xl font-bold text-gray-800">比赛记录</h1>
            <div className="flex gap-2">
              {isSelectMode ? (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    {selectedGames.size === games.length ? '取消全选' : '全选'}
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    disabled={selectedGames.size === 0}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    删除选中 ({selectedGames.size})
                  </button>
                  <button
                    onClick={() => {
                      setIsSelectMode(false);
                      setSelectedGames(new Set());
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsSelectMode(true)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    选择
                  </button>
                  <Link
                    to="/setup"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    + 新建比赛
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* 筛选器 */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setFilter('finished')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'finished' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            已结束
          </button>
          <button
            onClick={() => setFilter('live')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'live' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            进行中
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            待开始
          </button>
        </div>

        {games.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-xl text-gray-500 mb-4">暂无比赛记录</p>
            <Link
              to="/setup"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              创建第一场比赛
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {games.map((game) => (
              <div
                key={game.id}
                className={`relative bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-all ${
                  isSelectMode && selectedGames.has(game.id) ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {isSelectMode && (
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <input
                      type="checkbox"
                      checked={selectedGames.has(game.id)}
                      onChange={() => handleToggleSelect(game.id)}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className={`flex-1 ${isSelectMode ? 'ml-8' : ''}`}>
                    <div className="flex items-center gap-4 mb-2">
                      <span className={`px-3 py-1 rounded-full text-white text-sm ${getStatusColor(game.status)}`}>
                        {getStatusText(game.status)}
                      </span>
                      {game.season_type && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeasonTypeColor(game.season_type)}`}>
                          {getSeasonTypeLabel(game.season_type)}
                        </span>
                      )}
                      <span className="text-gray-500 text-sm">
                        {new Date(game.date).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-semibold text-blue-600">
                        {game.home_team_name}
                      </div>
                      <div className="text-2xl font-bold">
                        {game.home_score ?? 0} - {game.away_score ?? 0}
                      </div>
                      <div className="text-lg font-semibold text-red-600">
                        {game.away_team_name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isSelectMode && (
                      <>
                        {/* 未结束的比赛显示继续统计按钮 */}
                        {game.status !== 'finished' && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/game/${game.id}`);
                            }}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm flex items-center gap-1"
                            title="继续统计"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            继续统计
                          </button>
                        )}
                        {/* Play by Play 按钮 */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/game/${game.id}/play-by-play`);
                          }}
                          className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm flex items-center gap-1"
                          title="Play by Play"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Play by Play
                        </button>
                        {/* 查看统计结果按钮 */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/game/${game.id}/report`);
                          }}
                          className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm flex items-center gap-1"
                          title="查看统计结果"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          查看统计
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleExportPDF(game.id);
                          }}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm flex items-center gap-1"
                          title="导出PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          PDF
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(game.id);
                          }}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GamesList;


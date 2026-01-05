import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesApi, authApi } from '../utils/api';
import { League } from '../types';

function Home() {
  const { user, logout, isAdmin, isTeamAdmin, isPlayer, leagues, switchLeague, loadLeagues } = useAuth();
  const navigate = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  
  // 加载所有联赛（用于enroll）
  useEffect(() => {
    if (!isAdmin) {
      leaguesApi.getPublic()
        .then((response) => {
          setAllLeagues(response.data || []);
        })
        .catch((error) => {
          console.error('加载联赛列表失败:', error);
          setAllLeagues([]);
        });
    } else {
      // 管理员也可以看到所有联赛
      leaguesApi.getAll()
        .then((response) => {
          setAllLeagues(response.data || []);
        })
        .catch((error) => {
          console.error('加载联赛列表失败:', error);
          setAllLeagues([]);
        });
    }
  }, [isAdmin]);

  // 加载当前联赛信息
  useEffect(() => {
    if (user?.league_id) {
      leaguesApi.getById(user.league_id)
        .then((response) => {
          setLeague(response.data);
        })
        .catch((error) => {
          // 如果用户没有权限访问该league，尝试从leagues列表中获取
          if (error.response?.status === 403) {
            const currentLeague = leagues.find(l => l.id === user.league_id);
            if (currentLeague) {
              setLeague(currentLeague);
            }
          } else {
            console.error('加载联赛信息失败:', error);
          }
        });
    } else if (leagues.length > 0) {
      // 如果用户没有league_id，但leagues列表中有数据，使用第一个
      setLeague(leagues[0]);
    }
  }, [user, leagues]);
  
  const getRoleName = () => {
    if (user?.role === 'admin') return '系统管理员';
    if (user?.role === 'team_admin') return '球队管理员';
    if (user?.role === 'player') return '球员';
    return '用户';
  };
  
  const getPageTitle = () => {
    if (league) {
      return `${league.name} 技术统计`;
    }
    return '🏀 篮球比赛统计';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLeagueChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLeagueId = parseInt(e.target.value);
    if (newLeagueId === user?.league_id) {
      return; // 没有变化
    }

    try {
      setIsSwitching(true);
      await switchLeague(newLeagueId, user?.role === 'admin' ? undefined : user?.role as 'player' | 'team_admin');
      // 切换成功后，league会自动更新（通过useEffect）
    } catch (error: any) {
      console.error('切换league失败:', error);
      alert(error.message || '切换league失败');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleEnrollLeague = async (leagueId: number) => {
    try {
      setEnrolling(true);
      await authApi.enrollLeague(leagueId);
      await loadLeagues(); // 重新加载leagues列表
      setShowEnrollModal(false);
      alert('成功加入联赛！');
    } catch (error: any) {
      console.error('加入联赛失败:', error);
      alert(error.response?.data?.detail || '加入联赛失败');
    } finally {
      setEnrolling(false);
    }
  };

  // 获取用户未加入的联赛
  const getAvailableLeagues = () => {
    const userLeagueIds = leagues.map(l => l.id);
    return allLeagues.filter(l => !userLeagueIds.includes(l.id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 顶部导航栏 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-gray-800">
              {league ? `${league.name} 技术统计` : '🏀 篮球比赛统计'}
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-800">
                      {user.username}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">
                        {getRoleName()}
                      </span>
                      {leagues.length > 0 ? (
                        <>
                          {leagues.length > 1 ? (
                            <select
                              value={user.league_id || ''}
                              onChange={handleLeagueChange}
                              disabled={isSwitching}
                              className="text-xs text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              {leagues.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-500">
                              · {league?.name || leagues[0]?.name || '未选择联赛'}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">
                          · 未加入任何联赛
                        </span>
                      )}
                      {!isAdmin && (
                        <button
                          onClick={() => setShowEnrollModal(true)}
                          className="text-xs text-blue-600 hover:text-blue-800 ml-2 underline"
                          title="加入联赛"
                        >
                          {leagues.length === 0 ? '加入联赛' : '+加入更多联赛'}
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    登出
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            {getPageTitle()}
          </h1>
          <p className="text-xl text-gray-600">
            {league ? `${league.description || '专业的篮球比赛数据统计和分析工具'}` : '专业的篮球比赛数据统计和分析工具'}
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* 开始新比赛（球队管理员和管理员） */}
          {isTeamAdmin && (
            <Link
              to="/setup"
              className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-all transform hover:scale-105"
            >
              <div className="text-4xl mb-4">🏀</div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                开始新比赛
              </h2>
              <p className="text-gray-600">
                创建新的比赛，配置球队和球员信息
              </p>
            </Link>
          )}

          {/* 球队管理（球队管理员和管理员） */}
          {isTeamAdmin && (
            <Link
              to="/teams"
              className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-all transform hover:scale-105"
            >
              <div className="text-4xl mb-4">👥</div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                球队管理
              </h2>
              <p className="text-gray-600">
                管理现有球队，创建新球队，添加球员
              </p>
            </Link>
          )}

          {/* 比赛记录（所有用户） */}
          <Link
            to="/games"
            className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-all transform hover:scale-105"
          >
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              比赛记录
            </h2>
            <p className="text-gray-600">
              查看历史比赛数据，回顾比赛详情
            </p>
          </Link>

          {/* 技术统计（所有用户） */}
          <Link
            to="/statistics"
            className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-all transform hover:scale-105"
          >
            <div className="text-4xl mb-4">📈</div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              技术统计
            </h2>
            <p className="text-gray-600">
              查看球员和球队排名，按赛季统计
            </p>
          </Link>

          {/* 联赛管理（仅系统管理员） */}
          {isAdmin && (
            <Link
              to="/leagues"
              className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-all transform hover:scale-105 border-2 border-yellow-400"
            >
              <div className="text-4xl mb-4">⚙️</div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                联赛管理
              </h2>
              <p className="text-gray-600">
                创建和管理联赛，设置赛季类型
              </p>
            </Link>
          )}

          {/* 用户管理（仅系统管理员） */}
          {isAdmin && (
            <Link
              to="/users"
              className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-all transform hover:scale-105 border-2 border-yellow-400"
            >
              <div className="text-4xl mb-4">👤</div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                用户管理
              </h2>
              <p className="text-gray-600">
                管理用户权限、所属联赛和用户数据
              </p>
            </Link>
          )}
        </div>
      </div>

      {/* Enroll League Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">加入联赛</h2>
            <div className="space-y-4">
              {getAvailableLeagues().length === 0 ? (
                <p className="text-gray-600">没有可加入的联赛</p>
              ) : (
                getAvailableLeagues().map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{l.name}</div>
                      {l.description && (
                        <div className="text-sm text-gray-500">{l.description}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleEnrollLeague(l.id)}
                      disabled={enrolling}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      加入
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-6">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;

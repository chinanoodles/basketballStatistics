import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { teamsApi, leaguesApi, usersApi } from '../utils/api';
import { Team, League, User } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface TeamWithLeague extends Team {
  league_name?: string;
  team_admin_name?: string | null;
}

function TeamsList() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState<TeamWithLeague[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showBatchChangeLeagueModal, setShowBatchChangeLeagueModal] = useState(false);
  const [batchChangeLeagueId, setBatchChangeLeagueId] = useState<number | undefined>(undefined);
  const [teamAdmins, setTeamAdmins] = useState<User[]>([]);
  const [batchChangeTeamAdminId, setBatchChangeTeamAdminId] = useState<number | 'keep' | 'clear' | undefined>(undefined);

  useEffect(() => {
    loadTeams();
    if (isAdmin) {
      loadLeagues();
      loadTeamAdmins();
    }
  }, [isAdmin]);

  const loadTeamAdmins = async () => {
    try {
      const response = await usersApi.getAll(undefined, 'team_admin');
      setTeamAdmins(response.data);
    } catch (error) {
      console.error('加载领队列表失败:', error);
    }
  };

  // 当leagues加载完成后，更新teams的league信息
  useEffect(() => {
    if (isAdmin && leagues.length > 0 && teams.length > 0) {
      const teamsWithLeagues = teams.map((team) => {
        const league = leagues.find(l => l.id === team.league_id);
        return {
          ...team,
          league_name: league?.name || '未知联赛',
        };
      });
      setTeams(teamsWithLeagues);
    }
  }, [leagues, isAdmin]);

  const loadLeagues = async () => {
    try {
      const response = await leaguesApi.getAll();
      setLeagues(response.data);
    } catch (error) {
      console.error('加载联赛列表失败:', error);
    }
  };

  const loadTeams = async () => {
    try {
      setLoading(true);
      const response = await teamsApi.getAll();
      const teamsData: TeamWithLeague[] = response.data;
      setTeams(teamsData);
    } catch (error) {
      console.error('加载球队失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (teamId: number, teamName: string) => {
    try {
      // 先检查是否有相关比赛
      let relatedGamesCount = 0;
      try {
        const relatedGamesResponse = await teamsApi.getRelatedGames(teamId);
        relatedGamesCount = relatedGamesResponse.data.count;
      } catch (error) {
        // 如果获取相关比赛失败，继续执行删除流程
        console.error('获取相关比赛失败:', error);
      }

      let cascadeDelete = false;
      let confirmMessage = `确定要删除球队"${teamName}"吗？\n\n注意：删除球队将同时删除该球队的所有球员数据。`;

      if (relatedGamesCount > 0) {
        confirmMessage += `\n\n该球队还有 ${relatedGamesCount} 场相关比赛。`;
        const userChoice = window.confirm(
          confirmMessage + '\n\n是否同时删除这些比赛？\n\n点击"确定"删除球队和相关比赛\n点击"取消"只删除球队（如果可能）'
        );
        
        if (!userChoice) {
          // 用户取消删除
          return;
        }
        
        // 询问是否级联删除
        cascadeDelete = window.confirm(
          `警告：这将删除 ${relatedGamesCount} 场相关比赛及其所有统计数据。\n\n此操作不可恢复！\n\n确定要继续吗？`
        );
        
        if (!cascadeDelete) {
          // 用户不想级联删除，提示无法删除
          alert(`无法删除球队：该球队还有 ${relatedGamesCount} 场相关比赛。请先删除相关比赛后再删除球队。`);
          return;
        }
      } else {
        // 没有相关比赛，直接确认删除
        if (!window.confirm(confirmMessage + '\n\n此操作不可恢复！')) {
          return;
        }
      }

      // 执行删除
      const response = await teamsApi.delete(teamId, cascadeDelete);
      const message = response.data?.message || '球队已删除';
      alert(message);
      await loadTeams();
    } catch (error: any) {
      console.error('删除球队失败:', error);
      const errorMessage = error.response?.data?.detail || '删除球队失败，请重试';
      alert(errorMessage);
    }
  };

  const handleSelectAll = () => {
    if (selectedTeamIds.size === teams.length) {
      setSelectedTeamIds(new Set());
    } else {
      setSelectedTeamIds(new Set(teams.map(t => t.id)));
    }
  };

  const handleToggleSelect = (teamId: number) => {
    const newSelected = new Set(selectedTeamIds);
    if (newSelected.has(teamId)) {
      newSelected.delete(teamId);
    } else {
      newSelected.add(teamId);
    }
    setSelectedTeamIds(newSelected);
  };

  const handleBatchChangeLeague = async () => {
    if (!batchChangeLeagueId || selectedTeamIds.size === 0) {
      alert('请选择联赛和至少一个球队');
      return;
    }

    // 构建确认消息
    let confirmMessage = `确定要将选中的 ${selectedTeamIds.size} 个球队转移到该联赛吗？`;
    if (batchChangeTeamAdminId !== undefined) {
      if (batchChangeTeamAdminId === 'keep') {
        confirmMessage += '\n\n领队设置：保持现有设置';
      } else if (batchChangeTeamAdminId === 'clear') {
        confirmMessage += '\n\n领队设置：清除领队';
      } else {
        const adminName = teamAdmins.find(a => a.id === batchChangeTeamAdminId)?.username || '未知';
        confirmMessage += `\n\n领队设置：设置为 ${adminName}`;
      }
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // 先修改联赛
      await teamsApi.batchChangeLeague(Array.from(selectedTeamIds), batchChangeLeagueId);
      
      // 如果选择了领队设置，也修改领队
      if (batchChangeTeamAdminId !== undefined) {
        const teamAdminId = batchChangeTeamAdminId === 'keep' ? undefined : 
                           batchChangeTeamAdminId === 'clear' ? 0 : 
                           batchChangeTeamAdminId;
        await teamsApi.batchChangeTeamAdmin(Array.from(selectedTeamIds), teamAdminId);
      }
      
      alert(`成功修改 ${selectedTeamIds.size} 个球队`);
      setSelectedTeamIds(new Set());
      setShowBatchChangeLeagueModal(false);
      setBatchChangeLeagueId(undefined);
      setBatchChangeTeamAdminId(undefined);
      await loadTeams();
    } catch (error: any) {
      console.error('批量修改失败:', error);
      const errorMessage = error.response?.data?.detail || '批量修改失败，请重试';
      alert(errorMessage);
    }
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
            <h1 className="text-2xl font-bold text-gray-800">球队管理</h1>
            <div className="flex gap-2">
              {isSelectMode ? (
                <>
                  {isAdmin && (
                    <button
                      onClick={() => setShowBatchChangeLeagueModal(true)}
                      disabled={selectedTeamIds.size === 0}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      批量修改联赛 ({selectedTeamIds.size})
                    </button>
                  )}
                  <button
                    onClick={handleSelectAll}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    {selectedTeamIds.size === teams.length ? '取消全选' : '全选'}
                  </button>
                  <button
                    onClick={() => {
                      setIsSelectMode(false);
                      setSelectedTeamIds(new Set());
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  {isAdmin && (
                    <button
                      onClick={() => setIsSelectMode(true)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      选择
                    </button>
                  )}
                  <Link
                    to="/team/new"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    + 新建球队
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {teams.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏀</div>
            <p className="text-xl text-gray-500 mb-4">暂无球队</p>
            <Link
              to="/team/new"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              创建第一个球队
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <div
                key={team.id}
                className={`bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-all relative ${
                  isSelectMode && selectedTeamIds.has(team.id) ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {isSelectMode && (
                  <div className="absolute left-4 top-4">
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.has(team.id)}
                      onChange={() => handleToggleSelect(team.id)}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                  </div>
                )}
                <div className={`flex items-center justify-between mb-4 ${isSelectMode ? 'ml-8' : ''}`}>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800">{team.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {isAdmin && team.league_name && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {team.league_name}
                        </span>
                      )}
                      {team.team_admin_name && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          领队: {team.team_admin_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isSelectMode && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(team.id, team.name);
                      }}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                      title="删除球队"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                {!isSelectMode && (
                  <Link
                    to={`/team/${team.id}/edit`}
                    className="block text-sm text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    点击编辑球队信息 →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 批量修改联赛模态框 */}
      {showBatchChangeLeagueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">批量修改联赛</h2>
            <p className="text-sm text-gray-600 mb-4">
              将选中的 {selectedTeamIds.size} 个球队转移到以下联赛：
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">选择联赛</label>
                <select
                  value={batchChangeLeagueId || ''}
                  onChange={(e) => setBatchChangeLeagueId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">请选择联赛</option>
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">设置领队</label>
                <select
                  value={batchChangeTeamAdminId === undefined ? '' : 
                        batchChangeTeamAdminId === 'keep' ? 'keep' :
                        batchChangeTeamAdminId === 'clear' ? 'clear' :
                        batchChangeTeamAdminId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'keep') {
                      setBatchChangeTeamAdminId('keep');
                    } else if (value === 'clear') {
                      setBatchChangeTeamAdminId('clear');
                    } else if (value === '') {
                      setBatchChangeTeamAdminId(undefined);
                    } else {
                      setBatchChangeTeamAdminId(Number(value));
                    }
                  }}
                  className="w-full p-2 border rounded"
                >
                  <option value="">请选择领队设置</option>
                  <option value="keep">保持现有设置</option>
                  <option value="clear">清除领队（设为无）</option>
                  {teamAdmins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.username} {admin.email ? `(${admin.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={handleBatchChangeLeague}
                disabled={!batchChangeLeagueId || batchChangeTeamAdminId === undefined}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                确认修改
              </button>
              <button
                onClick={() => {
                  setShowBatchChangeLeagueModal(false);
                  setBatchChangeLeagueId(undefined);
                  setBatchChangeTeamAdminId(undefined);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamsList;


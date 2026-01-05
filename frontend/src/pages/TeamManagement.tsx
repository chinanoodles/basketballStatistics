import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { teamsApi, playersApi, leaguesApi, usersApi } from '../utils/api';
import { Player, Team, League, User } from '../types';
import { useAuth } from '../contexts/AuthContext';

function TeamManagement() {
  const { teamId } = useParams<{ teamId?: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const isEdit = !!teamId;

  const [teamName, setTeamName] = useState('');
  const [team, setTeam] = useState<Team | null>(null);
  const [coachName, setCoachName] = useState('');
  const [teamColor, setTeamColor] = useState('#0EA5E9'); // 默认蓝色
  const [season] = useState('26/27');
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState<{ [key: number]: string }>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(30);
  const [canEdit, setCanEdit] = useState<boolean>(true);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | undefined>(undefined);
  const [teamAdmins, setTeamAdmins] = useState<User[]>([]);
  const [selectedTeamAdminId, setSelectedTeamAdminId] = useState<number | undefined>(undefined);
  const [teamStats, setTeamStats] = useState<any>(null);
  const [showStats, setShowStats] = useState(false);
  const [statsMode, setStatsMode] = useState<'total' | 'average'>('total'); // 累积统计或场均统计
  const [sortBy, setSortBy] = useState<string>('points'); // 排序字段
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // 排序方向

  useEffect(() => {
    loadLeagues();
    if (isAdmin) {
      loadTeamAdmins();
    }
    if (isEdit && teamId) {
      loadTeam();
    } else {
      // 创建新球队时，初始化一些默认球员
      initializeDefaultPlayers();
      // 设置默认league_id为当前用户的league_id
      if (user?.league_id) {
        setSelectedLeagueId(user.league_id);
      }
    }
  }, [teamId, isEdit, user, isAdmin]);

  const loadLeagues = async () => {
    try {
      if (isAdmin) {
        // 管理员可以看到所有联赛
        const response = await leaguesApi.getAll();
        setLeagues(response.data);
      } else if (user?.league_id) {
        // 非管理员只能看到自己的联赛
        const response = await leaguesApi.getById(user.league_id);
        setLeagues([response.data]);
      }
    } catch (error) {
      console.error('加载联赛列表失败:', error);
    }
  };

  const loadTeamAdmins = async () => {
    try {
      // 获取所有team_admin角色的用户
      const response = await usersApi.getAll(undefined, 'team_admin');
      setTeamAdmins(response.data);
    } catch (error) {
      console.error('加载领队列表失败:', error);
    }
  };

  const loadTeamStatistics = async () => {
    if (!teamId) return;
    try {
      const response = await teamsApi.getTeamStatistics(Number(teamId));
      setTeamStats(response.data);
      setShowStats(true);
    } catch (error) {
      console.error('加载球队统计失败:', error);
    }
  };

  const loadTeam = async () => {
    if (!teamId) return;
    try {
      const teamResponse = await teamsApi.getById(Number(teamId));
      const teamData = teamResponse.data;
      setTeam(teamData);
      setTeamName(teamData.name);
      setSelectedLeagueId(teamData.league_id);
      setSelectedTeamAdminId(teamData.team_admin_id || undefined);
      setCoachName(''); // 教练名称不在当前模型中，可以后续扩展

      // 权限检查：team_admin只能管理自己管理的球队
      if (!isAdmin && user) {
        // team_admin可以查看自己管理的球队或自己league的球队，但只能编辑自己管理的球队
        if (teamData.team_admin_id !== user.id && teamData.league_id !== user.league_id) {
          setCanEdit(false);
          alert('您没有权限访问此球队。');
          navigate('/teams');
          return;
        }
        // 如果不是自己管理的球队，只能查看，不能编辑
        if (teamData.team_admin_id !== user.id) {
          setCanEdit(false);
        } else {
          // 如果是自己管理的球队，加载技术统计
          loadTeamStatistics();
        }
      } else if (isAdmin) {
        // 管理员也可以查看技术统计
        loadTeamStatistics();
      }

      const playersResponse = await playersApi.getByTeam(Number(teamId));
      const playersData: Player[] = playersResponse.data;
      // 按display_order排序，如果没有则按number排序
      const sortedPlayers = playersData.sort((a: Player, b: Player) => {
        const orderA = a.display_order ?? a.number;
        const orderB = b.display_order ?? b.number;
        return orderA - orderB;
      });
      setPlayers(sortedPlayers);
      setPlayerCount(sortedPlayers.length || 30);
      
      // 初始化球员名称
      const names: { [key: number]: string } = {};
      playersData.forEach((p: Player) => {
        names[p.id] = p.name;
      });
      setNewPlayerName(names);
    } catch (error: any) {
      console.error('加载球队失败:', error);
      if (error.response?.status === 403) {
        alert('您没有权限访问此球队。只能管理自己联赛的球队。');
        navigate('/teams');
      } else {
        alert('加载球队信息失败');
      }
    }
  };

  const initializeDefaultPlayers = (count: number = 30) => {
    // 创建指定数量的默认球员
    const defaultPlayers: Player[] = [];
    for (let i = 1; i <= count; i++) {
      const tempId = -i; // 使用负数作为临时ID，避免与真实ID冲突
      defaultPlayers.push({
        id: tempId,
        team_id: 0,
        name: '',
        number: i,
        avatar: undefined,
        position: undefined,
        display_order: i - 1,
      });
      setNewPlayerName((prev) => ({ ...prev, [tempId]: '' }));
    }
    setPlayers(defaultPlayers);
  };

  const handlePlayerCountChange = (count: number) => {
    const numCount = Math.max(1, Math.min(100, count)); // 限制在1-100之间
    setPlayerCount(numCount);
    
    if (isEdit && teamId) {
      // 编辑模式：调整现有球员列表
      const currentCount = players.length;
      if (numCount > currentCount) {
        // 增加球员
        const newPlayers: Player[] = [];
        for (let i = currentCount + 1; i <= numCount; i++) {
          const tempId = -Date.now() - i;
          newPlayers.push({
            id: tempId,
            team_id: Number(teamId),
            name: '',
            number: i,
            avatar: undefined,
            position: undefined,
            display_order: currentCount + i - currentCount,
          });
          setNewPlayerName((prev) => ({ ...prev, [tempId]: '' }));
        }
        setPlayers([...players, ...newPlayers]);
      } else if (numCount < currentCount) {
        // 减少球员（删除末尾的）
        const playersToKeep = players.slice(0, numCount);
        const playersToRemove = players.slice(numCount);
        setPlayers(playersToKeep);
        // 清理被删除球员的名称
        playersToRemove.forEach((p) => {
          setNewPlayerName((prev) => {
            const updated = { ...prev };
            delete updated[p.id];
            return updated;
          });
        });
      }
    } else {
      // 新建模式：重新初始化
      initializeDefaultPlayers(numCount);
    }
  };

  const handlePlayerNumberChange = (playerId: number, number: number) => {
    const numNumber = Math.max(0, Math.min(99, number)); // 限制在0-99之间
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, number: numNumber } : p))
    );
  };

  const handlePlayerNameChange = (playerId: number, name: string) => {
    setNewPlayerName((prev) => ({ ...prev, [playerId]: name }));
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, name } : p))
    );
  };

  const handleAddPlayer = () => {
    const nextNumber = players.length > 0 
      ? Math.max(...players.map((p) => p.number)) + 1 
      : 1;
    const tempId = -Date.now(); // 使用负数作为临时ID
    const newPlayer: Player = {
      id: tempId,
      team_id: 0,
      name: '',
      number: nextNumber,
      avatar: undefined,
      position: undefined,
    };
    setPlayers([...players, newPlayer]);
    setNewPlayerName((prev) => ({ ...prev, [tempId]: '' }));
  };

  const handleDeletePlayer = (playerId: number) => {
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    setNewPlayerName((prev) => {
      const updated = { ...prev };
      delete updated[playerId];
      return updated;
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    
    const newPlayers = [...players];
    const draggedPlayer = newPlayers[draggedIndex];
    newPlayers.splice(draggedIndex, 1);
    newPlayers.splice(index, 0, draggedPlayer);
    
    // 更新display_order
    newPlayers.forEach((p, i) => {
      p.display_order = i;
    });
    
    setPlayers(newPlayers);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSaveOrder = async () => {
    if (!teamId) return;
    try {
      const orders = players.map((p, index) => ({
        player_id: p.id,
        display_order: index,
      }));
      await playersApi.updateOrder(Number(teamId), orders);
      alert('顺序已保存');
      // 重新加载球员列表
      await loadTeam();
    } catch (error) {
      console.error('保存顺序失败:', error);
      alert('保存顺序失败，请重试');
    }
  };

  const handleSave = async () => {
    if (!teamName.trim()) {
      alert('请输入球队名称');
      return;
    }

    try {
      let savedTeamId: number;

      if (isEdit && teamId) {
        // 更新球队
        const updateData: any = { name: teamName, logo: undefined };
        // 只有admin可以修改league_id
        if (isAdmin) {
          // 如果selectedLeagueId有值，或者与当前team.league_id不同，则更新
          if (selectedLeagueId !== undefined && selectedLeagueId !== team?.league_id) {
            updateData.league_id = selectedLeagueId;
          }
          // 只有admin可以修改team_admin_id
          if (selectedTeamAdminId !== undefined && selectedTeamAdminId !== (team?.team_admin_id || null)) {
            updateData.team_admin_id = selectedTeamAdminId || null;
          }
        }
        await teamsApi.update(Number(teamId), updateData);
        savedTeamId = Number(teamId);

        // 删除现有球员（简化处理：删除所有后重新创建）
        const existingPlayers = await playersApi.getByTeam(Number(teamId));
        for (const player of existingPlayers.data) {
          try {
            await playersApi.delete(player.id);
          } catch (error) {
            console.error('删除球员失败:', error);
          }
        }
      } else {
        // 创建新球队
        const createData: any = { name: teamName, logo: undefined };
        if (selectedLeagueId !== undefined) {
          createData.league_id = selectedLeagueId;
        }
        // 只有admin可以设置team_admin_id
        if (isAdmin && selectedTeamAdminId !== undefined) {
          createData.team_admin_id = selectedTeamAdminId || null;
        }
        const teamResponse = await teamsApi.create(createData);
        savedTeamId = teamResponse.data.id;
      }

      // 保存球员（只保存有名称的球员）
      const playersToSave = players.filter((p: Player) => newPlayerName[p.id]?.trim());
      const savePromises = playersToSave.map((player, index) =>
        playersApi.create({
          team_id: savedTeamId,
          name: newPlayerName[player.id] || '',
          number: player.number,
          avatar: undefined,
          position: undefined,
          display_order: index,
        }).catch((error) => {
          console.error('创建球员失败:', error);
          return null;
        })
      );
      await Promise.all(savePromises);

      alert('保存成功！');
      navigate('/');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-green-600 text-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 text-orange-300 hover:text-orange-200"
              >
                <span>←</span>
                <span>Saved teams</span>
              </button>
              <span className="text-white">{isEdit ? 'Edit team' : 'Create team'}</span>
            </div>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canEdit}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* 球队详情卡片 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">球队信息</h2>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                球队名称
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canEdit}
              />
            </div>
            {(isAdmin || !isEdit) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  所属联赛 {isEdit && <span className="text-xs text-gray-500">(仅管理员可修改)</span>}
                </label>
                <select
                  value={selectedLeagueId || ''}
                  onChange={(e) => setSelectedLeagueId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canEdit || (isEdit && !isAdmin)}
                >
                  <option value="">请选择联赛</option>
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isAdmin && isEdit && team && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  所属联赛
                </label>
                <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600">
                  {leagues.find(l => l.id === team.league_id)?.name || '未知联赛'}
                </div>
              </div>
            )}
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  所属领队（可选）
                </label>
                <select
                  value={selectedTeamAdminId || ''}
                  onChange={(e) => setSelectedTeamAdminId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canEdit}
                >
                  <option value="">无（未分配）</option>
                  {teamAdmins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.username} {admin.email ? `(${admin.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isAdmin && isEdit && team && team.team_admin_name && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  所属领队
                </label>
                <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600">
                  {team.team_admin_name}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                教练名称
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  placeholder="Coach name"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button className="p-2 border border-orange-500 rounded-lg text-orange-500 hover:bg-orange-50">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 球队颜色选择 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              球队颜色
            </label>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setTeamColor('#0EA5E9')}
                className={`w-12 h-12 rounded-full ${
                  teamColor === '#0EA5E9' ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                }`}
                style={{ backgroundColor: '#0EA5E9' }}
              />
              <button
                onClick={() => setTeamColor('#000000')}
                className={`w-12 h-12 rounded-full ${
                  teamColor === '#000000' ? 'ring-2 ring-offset-2 ring-gray-500' : ''
                }`}
                style={{ backgroundColor: '#000000' }}
              />
              <button
                onClick={() => setTeamColor('#FF6B6B')}
                className={`w-12 h-12 rounded-full ${
                  teamColor === '#FF6B6B' ? 'ring-2 ring-offset-2 ring-red-500' : ''
                }`}
                style={{ backgroundColor: '#FF6B6B' }}
              />
              <input
                type="color"
                value={teamColor}
                onChange={(e) => setTeamColor(e.target.value)}
                className="w-12 h-12 rounded-full border-2 border-gray-300 cursor-pointer"
              />
            </div>
          </div>

          {/* 统计信息 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-gray-300 rounded-lg p-3">
              <div className="text-sm text-gray-600 mb-1">球员数量</div>
              <div className="text-2xl font-bold">N° of players: {players.filter((p: Player) => newPlayerName[p.id]?.trim()).length}</div>
            </div>
            <div className="border border-gray-300 rounded-lg p-3">
              <div className="text-sm text-gray-600 mb-1">赛季</div>
              <div className="text-2xl font-bold">Season: {season}</div>
            </div>
            <div 
              className="border border-gray-300 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => navigate(`/team/${teamId || 'new'}/offensive-plays`)}
            >
              <div className="text-sm text-gray-600 mb-1">进攻战术</div>
              <div className="text-lg font-semibold">Offensive plays</div>
            </div>
            <div 
              className="border border-gray-300 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => navigate(`/team/${teamId || 'new'}/defensive-plays`)}
            >
              <div className="text-sm text-gray-600 mb-1">防守战术</div>
              <div className="text-lg font-semibold">Defensive plays</div>
            </div>
          </div>
        </div>

        {/* 球员列表 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">球员列表</h2>
              <p className="text-sm text-gray-500">前5个为首发球员，可拖拽调整顺序</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">球员数量：</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={playerCount}
                  onChange={(e) => handlePlayerCountChange(Number(e.target.value))}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveOrder}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isEdit || !canEdit}
                >
                  保存顺序
                </button>
                <button
                  onClick={handleAddPlayer}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canEdit}
                >
                  + 添加球员
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {players.map((player, index) => {
              const isStarter = index < 5;
              return (
                <div
                key={player.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-100 cursor-move ${
                  isStarter ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-gray-50'
                }`}
              >
                {/* 拖拽手柄 */}
                <div className="text-gray-400 cursor-grab active:cursor-grabbing">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM13 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM13 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM13 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
                  </svg>
                </div>

                {/* 首发标记 */}
                {isStarter && (
                  <div className="px-2 py-1 bg-yellow-400 text-yellow-900 rounded text-xs font-bold">
                    首发
                  </div>
                )}

                {/* 序号 */}
                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                {/* 人物图标 */}
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>

                {/* 球衣图标 */}
                <div
                  className="w-12 h-16 rounded border-2 flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: teamColor }}
                >
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={player.number}
                    onChange={(e) => handlePlayerNumberChange(player.id, Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full h-full text-center bg-transparent border-none text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-white rounded"
                    disabled={!canEdit}
                    style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                  />
                </div>

                {/* 球员名称输入 */}
                {player.id > 0 && newPlayerName[player.id]?.trim() ? (
                  <Link
                    to={`/player/${player.id}/statistics`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-blue-50 hover:border-blue-500 transition-colors text-blue-600 font-medium"
                  >
                    {newPlayerName[player.id]}
                  </Link>
                ) : (
                  <input
                    type="text"
                    value={newPlayerName[player.id] || ''}
                    onChange={(e) => handlePlayerNameChange(player.id, e.target.value)}
                    placeholder="Player name"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!canEdit}
                  />
                )}

                {/* 号码徽章 */}
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm">
                  {player.number}
                </div>

                {/* 删除按钮 */}
                <button
                  onClick={() => handleDeletePlayer(player.id)}
                  className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canEdit}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
              );
            })}
          </div>
        </div>

        {/* 技术统计（仅自己管理的球队显示，放在球员列表后面） */}
        {showStats && teamStats && isEdit && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">球队技术统计</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">显示模式：</label>
                  <select
                    value={statsMode}
                    onChange={(e) => setStatsMode(e.target.value as 'total' | 'average')}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="total">累积统计</option>
                    <option value="average">场均统计</option>
                  </select>
                </div>
                <div className="text-sm text-gray-600">
                  共 {teamStats.total_games} 场比赛，{teamStats.total_stats} 条统计记录
                </div>
              </div>
            </div>
            {teamStats.players && teamStats.players.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">排名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">球员</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('games_played'); setSortOrder(sortBy === 'games_played' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>场次 {sortBy === 'games_played' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('minutes'); setSortOrder(sortBy === 'minutes' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>时长 {sortBy === 'minutes' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('points'); setSortOrder(sortBy === 'points' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>得分 {sortBy === 'points' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">投篮</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">三分</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('reb'); setSortOrder(sortBy === 'reb' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>篮板 {sortBy === 'reb' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('ast'); setSortOrder(sortBy === 'ast' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>助攻 {sortBy === 'ast' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('stl'); setSortOrder(sortBy === 'stl' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>抢断 {sortBy === 'stl' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('blk'); setSortOrder(sortBy === 'blk' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>盖帽 {sortBy === 'blk' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('eff'); setSortOrder(sortBy === 'eff' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>EFF {sortBy === 'eff' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('pir'); setSortOrder(sortBy === 'pir' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>PIR {sortBy === 'pir' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('plus_minus'); setSortOrder(sortBy === 'plus_minus' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>+/- {sortBy === 'plus_minus' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // 排序球员数据
                      const sortedPlayers = [...teamStats.players].sort((a: any, b: any) => {
                        const aVal = a[sortBy] || 0;
                        const bVal = b[sortBy] || 0;
                        if (sortOrder === 'desc') {
                          return bVal - aVal;
                        } else {
                          return aVal - bVal;
                        }
                      });
                      
                      return sortedPlayers.map((playerStat: any, index: number) => {
                      const gamesPlayed = playerStat.games_played || 1;
                      const isAverage = statsMode === 'average';
                      
                      // 使用后端返回的计算好的数据
                      const points = playerStat.points || 0;
                      const fgm = playerStat.fgm || 0;
                      const fga = playerStat.fga || 0;
                      const fg3m = playerStat.fg3m || 0;
                      const fg3a = playerStat.fg3a || 0;
                      const reb = playerStat.reb || 0;
                      const ast = playerStat.ast || 0;
                      const stl = playerStat.stl || 0;
                      const blk = playerStat.blk || 0;
                      const eff = playerStat.eff || 0;
                      const pir = playerStat.pir || 0;
                      const plusMinus = playerStat.plus_minus || 0;
                      
                      // 计算命中率
                      const fgPercentage = fga > 0 ? ((fgm / fga) * 100).toFixed(1) : '0.0';
                      const fg3Percentage = fg3a > 0 ? ((fg3m / fg3a) * 100).toFixed(1) : '0.0';
                      
                      // 格式化显示值
                      const formatValue = (value: number) => {
                        if (isAverage && gamesPlayed > 0) {
                          return (value / gamesPlayed).toFixed(1);
                        }
                        return value.toFixed(0);
                      };
                      
                      return (
                        <tr key={playerStat.player_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-center text-sm font-semibold text-gray-600">{index + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Link
                              to={`/player/${playerStat.player_id}/statistics`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              #{playerStat.player_number} {playerStat.player_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">{gamesPlayed}</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">
                            {(() => {
                              const totalSeconds = playerStat.minutes || 0;
                              const mins = Math.floor(totalSeconds / 60);
                              const secs = Math.floor(totalSeconds % 60);
                              if (isAverage && gamesPlayed > 0) {
                                const avgSeconds = totalSeconds / gamesPlayed;
                                const avgMins = Math.floor(avgSeconds / 60);
                                const avgSecs = Math.floor(avgSeconds % 60);
                                return `${avgMins}:${avgSecs.toString().padStart(2, '0')}`;
                              }
                              return `${mins}:${secs.toString().padStart(2, '0')}`;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                            {formatValue(points)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">
                            {formatValue(fgm)}/{formatValue(fga)}
                            <div className="text-xs text-gray-500">{fgPercentage}%</div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">
                            {formatValue(fg3m)}/{formatValue(fg3a)}
                            <div className="text-xs text-gray-500">{fg3Percentage}%</div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">
                            {formatValue(reb)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">
                            {formatValue(ast)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">
                            {formatValue(stl)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">
                            {formatValue(blk)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                            {formatValue(eff)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                            {formatValue(pir)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                            {plusMinus >= 0 ? '+' : ''}{formatValue(plusMinus)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            <Link
                              to={`/player/${playerStat.player_id}/statistics`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              详情
                            </Link>
                          </td>
                        </tr>
                      );
                    });
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">暂无统计数据</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamManagement;


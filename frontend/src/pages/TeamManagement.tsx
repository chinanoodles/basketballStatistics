import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { teamsApi, playersApi } from '../utils/api';
import { Player } from '../types';

function TeamManagement() {
  const { teamId } = useParams<{ teamId?: string }>();
  const navigate = useNavigate();
  const isEdit = !!teamId;

  const [teamName, setTeamName] = useState('');
  const [coachName, setCoachName] = useState('');
  const [teamColor, setTeamColor] = useState('#0EA5E9'); // 默认蓝色
  const [season] = useState('26/27');
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState<{ [key: number]: string }>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isEdit && teamId) {
      loadTeam();
    } else {
      // 创建新球队时，初始化一些默认球员
      initializeDefaultPlayers();
    }
  }, [teamId, isEdit]);

  const loadTeam = async () => {
    if (!teamId) return;
    try {
      const teamResponse = await teamsApi.getById(Number(teamId));
      const team = teamResponse.data;
      setTeamName(team.name);
      setCoachName(''); // 教练名称不在当前模型中，可以后续扩展

      const playersResponse = await playersApi.getByTeam(Number(teamId));
      const playersData: Player[] = playersResponse.data;
      // 按display_order排序，如果没有则按number排序
      const sortedPlayers = playersData.sort((a: Player, b: Player) => {
        const orderA = a.display_order ?? a.number;
        const orderB = b.display_order ?? b.number;
        return orderA - orderB;
      });
      setPlayers(sortedPlayers);
      
      // 初始化球员名称
      const names: { [key: number]: string } = {};
      playersData.forEach((p: Player) => {
        names[p.id] = p.name;
      });
      setNewPlayerName(names);
    } catch (error) {
      console.error('加载球队失败:', error);
      alert('加载球队信息失败');
    }
  };

  const initializeDefaultPlayers = () => {
    // 创建30个默认球员（号码1-30）
    const defaultPlayers: Player[] = [];
    for (let i = 1; i <= 30; i++) {
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
        await teamsApi.update(Number(teamId), { name: teamName, logo: undefined });
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
        const teamResponse = await teamsApi.create({ name: teamName, logo: undefined });
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
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-semibold"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

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
            <div className="border border-gray-300 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="text-sm text-gray-600 mb-1">进攻战术</div>
              <div className="text-lg font-semibold">Offensive plays</div>
            </div>
            <div className="border border-gray-300 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors">
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
            <div className="flex gap-2">
              <button
                onClick={handleSaveOrder}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                disabled={!isEdit}
              >
                保存顺序
              </button>
              <button
                onClick={handleAddPlayer}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + 添加球员
              </button>
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
                  {player.number}
                </div>

                {/* 球员名称输入 */}
                <input
                  type="text"
                  value={newPlayerName[player.id] || ''}
                  onChange={(e) => handlePlayerNameChange(player.id, e.target.value)}
                  placeholder="Player name"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {/* 号码徽章 */}
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm">
                  {player.number}
                </div>

                {/* 删除按钮 */}
                <button
                  onClick={() => handleDeletePlayer(player.id)}
                  className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg"
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
      </div>
    </div>
  );
}

export default TeamManagement;


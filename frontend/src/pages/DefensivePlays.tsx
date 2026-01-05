import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { teamsApi } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface Play {
  id: number;
  name: string;
  description?: string;
  diagram?: string; // 战术图URL或base64
}

function DefensivePlays() {
  const { teamId } = useParams<{ teamId?: string }>();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [team, setTeam] = useState<any>(null);
  const [plays, setPlays] = useState<Play[]>([]);
  const [editingPlay, setEditingPlay] = useState<Play | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [playName, setPlayName] = useState('');
  const [playDescription, setPlayDescription] = useState('');
  const [canEdit, setCanEdit] = useState<boolean>(true);

  useEffect(() => {
    if (teamId && teamId !== 'new') {
      loadTeam();
      loadPlays();
    } else {
      setCanEdit(false);
      alert('请先保存球队信息');
      navigate('/teams');
    }
  }, [teamId]);

  const loadTeam = async () => {
    if (!teamId || teamId === 'new') return;
    try {
      const response = await teamsApi.getById(Number(teamId));
      const teamData = response.data;
      setTeam(teamData);

      // 权限检查：team_admin只能管理自己联赛的球队
      if (!isAdmin && user && teamData.league_id !== user.league_id) {
        setCanEdit(false);
        alert('您没有权限编辑此球队的战术。只能管理自己联赛的球队。');
        navigate(`/team/${teamId}/edit`);
        return;
      }
    } catch (error: any) {
      console.error('加载球队失败:', error);
      if (error.response?.status === 403) {
        alert('您没有权限访问此球队。');
        navigate('/teams');
      }
    }
  };

  const loadPlays = async () => {
    // TODO: 从后端API加载战术数据
    // 目前使用本地存储模拟
    const stored = localStorage.getItem(`defensive_plays_${teamId}`);
    if (stored) {
      setPlays(JSON.parse(stored));
    }
  };

  const savePlays = async (updatedPlays: Play[]) => {
    // TODO: 保存到后端API
    // 目前使用本地存储模拟
    localStorage.setItem(`defensive_plays_${teamId}`, JSON.stringify(updatedPlays));
    setPlays(updatedPlays);
  };

  const handleAddPlay = () => {
    if (!playName.trim()) {
      alert('请输入战术名称');
      return;
    }

    const newPlay: Play = {
      id: Date.now(),
      name: playName,
      description: playDescription,
    };

    savePlays([...plays, newPlay]);
    setShowAddModal(false);
    setPlayName('');
    setPlayDescription('');
  };

  const handleDeletePlay = (playId: number) => {
    if (!window.confirm('确定要删除此战术吗？')) {
      return;
    }
    savePlays(plays.filter((p) => p.id !== playId));
  };

  const handleEditPlay = (play: Play) => {
    setEditingPlay(play);
    setPlayName(play.name);
    setPlayDescription(play.description || '');
    setShowAddModal(true);
  };

  const handleUpdatePlay = () => {
    if (!editingPlay || !playName.trim()) {
      alert('请输入战术名称');
      return;
    }

    const updatedPlays = plays.map((p) =>
      p.id === editingPlay.id
        ? { ...p, name: playName, description: playDescription }
        : p
    );

    savePlays(updatedPlays);
    setShowAddModal(false);
    setEditingPlay(null);
    setPlayName('');
    setPlayDescription('');
  };

  if (!teamId || teamId === 'new') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-red-600 text-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/team/${teamId}/edit`)}
                className="flex items-center space-x-2 text-red-200 hover:text-white"
              >
                <span>←</span>
                <span>返回球队管理</span>
              </button>
              <span className="text-white">防守战术 - {team?.name || '加载中...'}</span>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingPlay(null);
                  setPlayName('');
                  setPlayDescription('');
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
              >
                + 添加战术
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {plays.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <div className="text-6xl mb-4">🛡️</div>
            <p className="text-xl text-gray-500 mb-4">暂无防守战术</p>
            {canEdit && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
              >
                添加第一个战术
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plays.map((play) => (
              <div
                key={play.id}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">{play.name}</h3>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditPlay(play)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeletePlay(play.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                {play.description && (
                  <p className="text-sm text-gray-600 mb-4">{play.description}</p>
                )}
                <div className="text-sm text-gray-500">
                  点击查看战术详情
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加/编辑战术模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {editingPlay ? '编辑战术' : '添加战术'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">战术名称</label>
                <input
                  type="text"
                  value={playName}
                  onChange={(e) => setPlayName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="输入战术名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">战术描述（可选）</label>
                <textarea
                  value={playDescription}
                  onChange={(e) => setPlayDescription(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={4}
                  placeholder="输入战术描述"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-4">
              <button
                onClick={editingPlay ? handleUpdatePlay : handleAddPlay}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                {editingPlay ? '更新' : '添加'}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPlay(null);
                  setPlayName('');
                  setPlayDescription('');
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

export default DefensivePlays;



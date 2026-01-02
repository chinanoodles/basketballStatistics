import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { teamsApi } from '../utils/api';
import { Team } from '../types';

function TeamsList() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const response = await teamsApi.getAll();
      setTeams(response.data);
    } catch (error) {
      console.error('加载球队失败:', error);
    } finally {
      setLoading(false);
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
            <Link
              to="/team/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + 新建球队
            </Link>
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
              <Link
                key={team.id}
                to={`/team/${team.id}/edit`}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-all transform hover:scale-105"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">{team.name}</h3>
                  <span className="text-gray-400 text-2xl">→</span>
                </div>
                <div className="text-sm text-gray-500">
                  点击编辑球队信息
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamsList;


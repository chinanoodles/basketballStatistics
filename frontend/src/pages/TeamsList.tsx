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
              <div
                key={team.id}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-all relative"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">{team.name}</h3>
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
                </div>
                <Link
                  to={`/team/${team.id}/edit`}
                  className="block text-sm text-gray-500 hover:text-blue-600 transition-colors"
                >
                  点击编辑球队信息 →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamsList;


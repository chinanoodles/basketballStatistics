import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, leaguesApi } from '../utils/api';
import { User, League } from '../types';

function UserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterLeagueId, setFilterLeagueId] = useState<number | undefined>(undefined);
  const [filterRole, setFilterRole] = useState<string>('');
  
  // 批量操作状态
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [showBatchEnrollModal, setShowBatchEnrollModal] = useState(false);
  const [batchEnrollLeagueId, setBatchEnrollLeagueId] = useState<number | undefined>(undefined);
  
  // 编辑状态
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    role: '',
    league_ids: [] as number[],
    is_active: true,
    password: '',
  });

  useEffect(() => {
    if (!isAdmin) {
      setError('只有管理员可以访问此页面');
      return;
    }
    loadLeagues();
    loadUsers();
  }, [isAdmin, filterLeagueId, filterRole]);

  const loadLeagues = async () => {
    try {
      const response = await leaguesApi.getAll();
      setLeagues(response.data);
    } catch (err: any) {
      console.error('加载联赛列表失败:', err);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await usersApi.getAll(filterLeagueId, filterRole);
      setUsers(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    // 使用league_ids（如果存在），否则使用league_id
    const leagueIds = (user as any).league_ids || (user.league_id ? [user.league_id] : []);
    setEditForm({
      email: user.email || '',
      role: user.role,
      league_ids: leagueIds,
      is_active: user.is_active,
      password: '',
    });
  };

  const handleSave = async () => {
    if (!editingUser) return;
    
    setLoading(true);
    setError('');
    try {
      await usersApi.update(editingUser.id, {
        email: editForm.email || undefined,
        role: editForm.role,
        league_ids: editForm.league_ids.length > 0 ? editForm.league_ids : undefined,
        is_active: editForm.is_active,
        password: editForm.password || undefined,
      });
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || '更新用户失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('确定要删除此用户吗？此操作不可恢复。')) {
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await usersApi.delete(userId);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || '删除用户失败');
    } finally {
      setLoading(false);
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'player': return '球员';
      case 'team_admin': return '领队';
      case 'admin': return '管理员';
      default: return role;
    }
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(users.map(u => u.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  // 单个选择
  const handleSelectUser = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUserIds([...selectedUserIds, userId]);
    } else {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    }
  };

  // 批量enroll
  const handleBatchEnroll = async () => {
    if (!batchEnrollLeagueId || selectedUserIds.length === 0) {
      setError('请选择联赛和至少一个用户');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await usersApi.batchEnroll(selectedUserIds, batchEnrollLeagueId);
      setSelectedUserIds([]);
      setShowBatchEnrollModal(false);
      setBatchEnrollLeagueId(undefined);
      loadUsers();
      alert(`成功将 ${selectedUserIds.length} 个用户加入联赛`);
    } catch (err: any) {
      setError(err.response?.data?.detail || '批量enroll失败');
    } finally {
      setLoading(false);
    }
  };

  // 按上赛季league筛选用户
  const handleFilterByPreviousLeague = (leagueId: number) => {
    setFilterLeagueId(leagueId);
    loadUsers();
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          只有管理员可以访问此页面
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">用户管理</h1>
        <p className="text-gray-600">管理用户权限、所属联赛和用户数据</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* 筛选器 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">按联赛筛选</label>
            <select
              value={filterLeagueId || ''}
              onChange={(e) => setFilterLeagueId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full p-2 border rounded"
            >
              <option value="">全部联赛</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">按角色筛选</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">全部角色</option>
              <option value="player">球员</option>
              <option value="team_admin">领队</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadUsers}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              刷新
            </button>
          </div>
        </div>
        
        {/* 批量操作工具栏 */}
        {selectedUserIds.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                已选择 {selectedUserIds.length} 个用户
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBatchEnrollModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  批量加入联赛
                </button>
                <button
                  onClick={() => setSelectedUserIds([])}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                >
                  取消选择
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedUserIds.length === users.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  邮箱
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  角色
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  所属联赛
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center">
                    加载中...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    暂无用户
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getRoleName(user.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(() => {
                        const userLeagueIds = (user as any).league_ids || (user.league_id ? [user.league_id] : []);
                        if (userLeagueIds.length === 0) return '-';
                        const leagueNames = userLeagueIds
                          .map((id: number) => leagues.find(l => l.id === id)?.name)
                          .filter(Boolean)
                          .join(', ');
                        return leagueNames || '-';
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? '激活' : '禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 编辑模态框 */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">编辑用户：{editingUser.username}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">邮箱</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">角色</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full p-2 border rounded"
                >
                  <option value="player">球员</option>
                  <option value="team_admin">领队</option>
                  <option value="admin">管理员</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">所属联赛（可多选）</label>
                <div className="border rounded p-3 max-h-48 overflow-y-auto">
                  {leagues.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无联赛</p>
                  ) : (
                    leagues.map((league) => (
                      <label key={league.id} className="flex items-center mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.league_ids.includes(league.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditForm({
                                ...editForm,
                                league_ids: [...editForm.league_ids, league.id],
                              });
                            } else {
                              setEditForm({
                                ...editForm,
                                league_ids: editForm.league_ids.filter(id => id !== league.id),
                              });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{league.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">状态</label>
                <select
                  value={editForm.is_active ? 'true' : 'false'}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
                  className="w-full p-2 border rounded"
                >
                  <option value="true">激活</option>
                  <option value="false">禁用</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">重置密码（留空不修改）</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="输入新密码"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                保存
              </button>
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量enroll模态框 */}
      {showBatchEnrollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">批量加入联赛</h2>
            <p className="text-sm text-gray-600 mb-4">
              将选中的 {selectedUserIds.length} 个用户加入以下联赛：
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">选择联赛</label>
                <select
                  value={batchEnrollLeagueId || ''}
                  onChange={(e) => setBatchEnrollLeagueId(e.target.value ? Number(e.target.value) : undefined)}
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
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={handleBatchEnroll}
                disabled={loading || !batchEnrollLeagueId}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                确认加入
              </button>
              <button
                onClick={() => {
                  setShowBatchEnrollModal(false);
                  setBatchEnrollLeagueId(undefined);
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

export default UserManagement;


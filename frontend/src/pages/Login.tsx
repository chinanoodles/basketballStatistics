import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leaguesApi } from '../utils/api';
import { League } from '../types';

function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'player' | 'team_admin'>('player');
  const [leagueId, setLeagueId] = useState<number | undefined>(undefined);
  
  // 登录时的league和role选择
  const [loginLeagueId, setLoginLeagueId] = useState<number | undefined>(undefined);
  const [loginRole, setLoginRole] = useState<'player' | 'team_admin' | undefined>(undefined);
  
  // 重置表单
  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('player');
    setLeagueId(undefined);
    setError('');
  };
  const [leagues, setLeagues] = useState<League[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 加载联赛列表（用于注册）- 使用公开API
  const loadLeagues = async () => {
    try {
      const response = await leaguesApi.getPublic();
      setLeagues(response.data);
    } catch (error: any) {
      console.error('加载联赛列表失败:', error);
      // 如果加载失败，不显示错误，联赛列表为空也可以注册
      setLeagues([]);
    }
  };

  // 加载联赛列表（登录和注册都需要）
  useEffect(() => {
    loadLeagues();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // 非管理员登录时需要选择league和角色
        // 注意：我们无法在登录前知道用户是否是管理员
        // 所以先尝试登录，如果后端返回错误，再显示错误信息
        await login(username, password, loginLeagueId, loginRole);
        navigate('/');
      } else {
        await register(username, email, password, role, leagueId);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            🏀 篮球比赛统计
          </h2>
          <p className="text-gray-600">
            {isLogin ? '登录您的账户' : '创建新账户'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入用户名"
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  邮箱（可选）
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入邮箱"
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入密码"
              />
            </div>

            {isLogin && (
              <>
                <div>
                  <label htmlFor="loginLeague" className="block text-sm font-medium text-gray-700">
                    所属联赛 <span className="text-gray-500 text-xs">(管理员可不选)</span>
                  </label>
                  <select
                    id="loginLeague"
                    value={loginLeagueId || ''}
                    onChange={(e) => setLoginLeagueId(e.target.value ? Number(e.target.value) : undefined)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">请选择联赛（管理员可不选）</option>
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id}>
                        {league.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="loginRole" className="block text-sm font-medium text-gray-700">
                    身份 <span className="text-gray-500 text-xs">(管理员可不选)</span>
                  </label>
                  <select
                    id="loginRole"
                    value={loginRole || ''}
                    onChange={(e) => setLoginRole(e.target.value as 'player' | 'team_admin' | undefined)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">请选择身份（管理员可不选）</option>
                    <option value="player">球员</option>
                    <option value="team_admin">领队（球队管理员）</option>
                  </select>
                </div>
              </>
            )}

            {!isLogin && (
              <>
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    用户角色 <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="role"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'player' | 'team_admin')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="player">球员（只能查看比赛记录和技术统计）</option>
                    <option value="team_admin">球队管理员（可以管理球队和球员）</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="league" className="block text-sm font-medium text-gray-700">
                    所属联赛 <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="league"
                    required
                    value={leagueId || ''}
                    onChange={(e) => setLeagueId(e.target.value ? Number(e.target.value) : undefined)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">请选择联赛</option>
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id}>
                        {league.name}
                      </option>
                    ))}
                  </select>
                  {leagues.length === 0 && (
                    <p className="mt-1 text-xs text-yellow-600">
                      正在加载联赛列表...
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '处理中...' : isLogin ? '登录' : '注册'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                resetForm();
                if (!isLogin) {
                  loadLeagues();
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              {isLogin ? '还没有账户？点击注册' : '已有账户？点击登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;


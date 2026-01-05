import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { statisticsApi, playersApi } from '../utils/api';
import { Statistic } from '../types';
import Court from '../components/Court';

interface ShotData {
  x: number;
  y: number;
  made: boolean;
  type: '2P' | '3P';
}

function PlayerStatistics() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<any>(null);
  const [statistics, setStatistics] = useState<Statistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonType, setSeasonType] = useState<'all' | 'regular' | 'playoff'>('all');
  const [shots, setShots] = useState<ShotData[]>([]);

  useEffect(() => {
    if (playerId) {
      loadPlayer();
      loadStatistics();
    }
  }, [playerId, seasonType]);

  const loadPlayer = async () => {
    if (!playerId) return;
    try {
      const response = await playersApi.getById(Number(playerId));
      setPlayer(response.data);
    } catch (error) {
      console.error('加载球员信息失败:', error);
    }
  };

  const loadStatistics = async () => {
    if (!playerId) return;
    try {
      setLoading(true);
      const seasonTypeParam = seasonType === 'all' ? undefined : seasonType;
      const response = await statisticsApi.getPlayerAllStatistics(Number(playerId), seasonTypeParam);
      const stats: Statistic[] = response.data;
      setStatistics(stats);

      // 提取投篮点位
      const shotData: ShotData[] = [];
      stats.forEach((stat) => {
        if (stat.shot_x !== null && stat.shot_x !== undefined && 
            stat.shot_y !== null && stat.shot_y !== undefined) {
          const action = stat.action_type;
          if (action === '2PM' || action === '2PA' || action === '3PM' || action === '3PA') {
            shotData.push({
              x: stat.shot_x,
              y: stat.shot_y,
              made: action === '2PM' || action === '3PM',
              type: (action === '2PM' || action === '2PA') ? '2P' : '3P'
            });
          }
        }
      });
      setShots(shotData);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算统计数据
  const calculateStats = () => {
    const stats = {
      '2PM': 0, '2PA': 0, '3PM': 0, '3PA': 0,
      'FTM': 0, 'FTA': 0, 'OREB': 0, 'DREB': 0,
      'AST': 0, 'STL': 0, 'BLK': 0, 'TOV': 0, 'PF': 0, 'PFD': 0
    };

    statistics.forEach((stat) => {
      const action = stat.action_type;
      if (action in stats) {
        stats[action as keyof typeof stats]++;
      }
    });

    const fgMade = stats['2PM'] + stats['3PM'];
    const fgAttempted = stats['2PA'] + stats['3PA'];
    const fgPercentage = fgAttempted > 0 ? ((fgMade / fgAttempted) * 100).toFixed(1) : '0.0';
    const twoPointPercentage = stats['2PA'] > 0 ? ((stats['2PM'] / stats['2PA']) * 100).toFixed(1) : '0.0';
    const threePointPercentage = stats['3PA'] > 0 ? ((stats['3PM'] / stats['3PA']) * 100).toFixed(1) : '0.0';
    const ftPercentage = stats['FTA'] > 0 ? ((stats['FTM'] / stats['FTA']) * 100).toFixed(1) : '0.0';
    const points = stats['2PM'] * 2 + stats['3PM'] * 3 + stats['FTM'];
    const rebounds = stats['OREB'] + stats['DREB'];

    return {
      ...stats,
      fgMade,
      fgAttempted,
      fgPercentage,
      twoPointPercentage,
      threePointPercentage,
      ftPercentage,
      points,
      rebounds
    };
  };

  const stats = calculateStats();

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
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              {player?.name || '球员'} - 技术统计
            </h1>
            <div className="flex items-center gap-4">
              <select
                value={seasonType}
                onChange={(e) => setSeasonType(e.target.value as 'all' | 'regular' | 'playoff')}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="all">全部</option>
                <option value="regular">常规赛/小组赛</option>
                <option value="playoff">季后赛</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* 球员信息卡片 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
              {player?.number || '?'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{player?.name || '未知球员'}</h2>
              <p className="text-gray-600">球衣号码: {player?.number || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* 统计数据表格 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">统计数据</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">得分</div>
              <div className="text-2xl font-bold">{stats.points}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">篮板</div>
              <div className="text-2xl font-bold">{stats.rebounds}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">助攻</div>
              <div className="text-2xl font-bold">{stats.AST}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">抢断</div>
              <div className="text-2xl font-bold">{stats.STL}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">盖帽</div>
              <div className="text-2xl font-bold">{stats.BLK}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">失误</div>
              <div className="text-2xl font-bold">{stats.TOV}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">犯规</div>
              <div className="text-2xl font-bold">{stats.PF}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">投篮命中率</div>
              <div className="text-2xl font-bold">{stats.fgPercentage}%</div>
              <div className="text-xs text-gray-500">{stats.fgMade}/{stats.fgAttempted}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">两分命中率</div>
              <div className="text-2xl font-bold">{stats.twoPointPercentage}%</div>
              <div className="text-xs text-gray-500">{stats['2PM']}/{stats['2PA']}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">三分命中率</div>
              <div className="text-2xl font-bold">{stats.threePointPercentage}%</div>
              <div className="text-xs text-gray-500">{stats['3PM']}/{stats['3PA']}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">罚球命中率</div>
              <div className="text-2xl font-bold">{stats.ftPercentage}%</div>
              <div className="text-xs text-gray-500">{stats.FTM}/{stats.FTA}</div>
            </div>
          </div>
        </div>

        {/* 投篮热区图 */}
        {shots.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">投篮热区图</h2>
            <div className="relative" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
              <Court>
                {shots.map((shot, index) => (
                  <div
                    key={index}
                    className={`absolute w-3 h-3 rounded-full ${
                      shot.made ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{
                      left: `${shot.x}%`,
                      top: `${shot.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    title={`${shot.type} - ${shot.made ? '命中' : '未命中'}`}
                  />
                ))}
              </Court>
            </div>
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm">命中</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm">未命中</span>
              </div>
            </div>
          </div>
        )}

        {shots.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center text-gray-500">
            暂无投篮数据
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerStatistics;



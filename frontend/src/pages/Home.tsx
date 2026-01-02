import { Link } from 'react-router-dom';

function Home() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            🏀 篮球比赛统计
          </h1>
          <p className="text-xl text-gray-600">
            专业的篮球比赛数据统计和分析工具
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* 开始新比赛 */}
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

          {/* 球队管理 */}
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

          {/* 比赛记录 */}
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

          {/* 技术统计 */}
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
        </div>
      </div>
    </div>
  );
}

export default Home;

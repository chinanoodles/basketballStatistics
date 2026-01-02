# 篮球比赛统计应用

一个功能完整的篮球比赛统计应用，支持实时记录比赛数据并生成详细统计报告。

## 功能特性

- 🏀 球队和球员管理
- ⚙️ 灵活的比赛配置（时长、节数、出场队员）
- 🎯 拖拽式实时统计记录
- 📊 详细的统计报告生成（PDF格式）
- 📱 现代化响应式UI
- 📋 Play by Play 比赛详情查看和CSV导出
- 📈 技术统计排名（EFF、PIR、+/-）

## 技术栈

### 后端
- Python 3.11+
- FastAPI
- SQLAlchemy
- SQLite

### 前端
- React 18+
- TypeScript
- Tailwind CSS
- React DnD

## 快速开始

### 1. 创建虚拟环境

```bash
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 运行后端

```bash
cd backend
# 仅本地访问
uvicorn app.main:app --reload

# 允许外网访问
ALLOW_EXTERNAL=true uvicorn app.main:app --reload --host 0.0.0.0
# 或者使用启动脚本
./start_server.sh --external
```

### 4. 运行前端

```bash
cd frontend
npm install

# 仅本地访问
npm run dev

# 允许外网访问
npm run dev:host

# 如果后端也在外网，需要配置API地址
# 创建 .env 文件，设置 VITE_API_URL=http://你的服务器IP:8000/api/v1
```

## 数据存储说明

**重要：所有数据都存储在SQLite数据库中，不是本地缓存！**

- 数据库位置：`backend/database/basketball.db`
- 所有比赛记录、统计数据、球队和球员信息都存储在数据库中
- 多个用户访问同一服务器时，会看到相同的数据
- 数据是持久化的，重启服务器后数据不会丢失

## 外网访问配置

### 后端配置

1. **启动后端服务器（允许外网访问）**：
   ```bash
   cd backend
   ALLOW_EXTERNAL=true uvicorn app.main:app --reload --host 0.0.0.0
   ```

2. **确保防火墙允许8000端口**：
   - macOS: 系统偏好设置 > 安全性与隐私 > 防火墙
   - Linux: `sudo ufw allow 8000`
   - Windows: 控制面板 > Windows Defender 防火墙

### 前端配置

1. **启动前端服务器（允许外网访问）**：
   ```bash
   cd frontend
   npm run dev:host
   ```

2. **配置后端API地址**（如果后端在不同服务器）：
   - 在 `frontend` 目录创建 `.env` 文件
   - 设置 `VITE_API_URL=http://你的后端服务器IP:8000/api/v1`

3. **确保防火墙允许3000端口**

### 访问方式

- 本地访问：`http://localhost:3000`
- 同一网络其他设备：`http://你的本机IP:3000`
- 外网访问：需要配置路由器端口转发

## 项目结构

```
basketballStatistics/
├── backend/          # 后端代码
│   ├── app/          # 应用代码
│   ├── database/     # SQLite数据库文件
│   └── start_server.sh  # 启动脚本
├── frontend/         # 前端代码
│   └── .env.example  # 环境变量示例
├── reference/        # 参考文件
├── requirements.txt  # Python依赖
└── README.md        # 项目说明
```

## 开发计划

详见 [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)

## 代码规范

详见 [CODE_STANDARDS.md](./CODE_STANDARDS.md)

## 许可证

MIT License

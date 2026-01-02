# 篮球比赛统计应用 - 开发计划

## 1. 项目概述

创建一个功能完整的篮球比赛统计应用，支持：
- 球队和球员管理
- 比赛配置（时长、节数、出场队员）
- 实时统计记录（通过拖拽球员avatar）
- 生成详细的统计报告

## 2. 技术栈选择

### 后端
- **Python 3.11+** - 主要开发语言
- **FastAPI** - 现代化Web框架，支持异步和自动API文档
- **SQLAlchemy** - ORM数据库操作
- **SQLite** - 轻量级数据库（可升级到PostgreSQL）
- **Pydantic** - 数据验证和序列化

### 前端
- **React 18+** - 现代化UI框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 快速样式开发
- **React DnD** - 拖拽功能
- **Recharts** - 数据可视化

### 报告生成
- **ReportLab** - PDF报告生成
- **Jinja2** - 模板引擎

## 3. 项目架构

```
basketballStatistics/
├── backend/              # 后端代码
│   ├── app/
│   │   ├── api/         # API路由
│   │   ├── models/      # 数据模型
│   │   ├── services/    # 业务逻辑
│   │   └── utils/       # 工具函数
│   ├── database/        # 数据库配置
│   └── main.py         # 应用入口
├── frontend/            # 前端代码
│   ├── src/
│   │   ├── components/  # React组件
│   │   ├── pages/       # 页面
│   │   ├── hooks/       # 自定义Hooks
│   │   └── utils/       # 工具函数
│   └── public/          # 静态资源
├── reference/           # 参考文件
└── requirements.txt     # Python依赖
```

## 4. 核心功能模块

### 4.1 球队管理
- 创建/编辑/删除球队
- 添加/管理球员信息
- 球员头像管理

### 4.2 比赛设置
- 选择主队和客队
- 配置比赛时长（10/12/40分钟等）
- 选择节数（2/4节）
- 选择出场队员（5v5）
- 设置比赛日期和时间

### 4.3 实时统计
- 拖拽球员avatar到动作区域记录：
  - 得分（2分、3分、罚球）
  - 篮板（进攻、防守）
  - 助攻
  - 抢断
  - 盖帽
  - 失误
  - 犯规
- 实时更新比分和统计数据
- 比赛时间控制（开始/暂停/结束）

### 4.4 统计报告
- 生成PDF报告
- 包含：
  - 比赛基本信息
  - 每节得分
  - 球员详细统计
  - 球队统计对比
  - 效率值计算（PIR, EFF）

## 5. 开发阶段

### Phase 1: 基础架构 (当前阶段)
- [x] 项目结构搭建
- [ ] 虚拟环境配置
- [ ] 数据库模型设计
- [ ] API基础框架

### Phase 2: 核心功能
- [ ] 球队和球员管理API
- [ ] 比赛设置功能
- [ ] 前端基础UI框架

### Phase 3: 统计功能
- [ ] 拖拽交互实现
- [ ] 统计数据记录
- [ ] 实时数据更新

### Phase 4: 报告生成
- [ ] PDF报告模板
- [ ] 数据导出功能

### Phase 5: 优化和测试
- [ ] 性能优化
- [ ] 单元测试
- [ ] 用户体验优化

## 6. 数据模型设计

### Team (球队)
- id, name, logo, created_at

### Player (球员)
- id, team_id, name, number, avatar, position

### Game (比赛)
- id, home_team_id, away_team_id, date, duration, quarters, status

### GamePlayer (比赛球员)
- id, game_id, player_id, is_starter

### Statistic (统计数据)
- id, game_id, player_id, quarter, action_type, timestamp

## 7. API设计

### 球队管理
- GET /api/teams - 获取所有球队
- POST /api/teams - 创建球队
- GET /api/teams/{id} - 获取球队详情
- PUT /api/teams/{id} - 更新球队
- DELETE /api/teams/{id} - 删除球队

### 球员管理
- GET /api/teams/{team_id}/players - 获取球队球员
- POST /api/teams/{team_id}/players - 添加球员
- PUT /api/players/{id} - 更新球员
- DELETE /api/players/{id} - 删除球员

### 比赛管理
- POST /api/games - 创建比赛
- GET /api/games/{id} - 获取比赛详情
- PUT /api/games/{id}/start - 开始比赛
- PUT /api/games/{id}/pause - 暂停比赛
- POST /api/games/{id}/statistics - 记录统计数据
- GET /api/games/{id}/statistics - 获取统计数据
- GET /api/games/{id}/report - 生成报告


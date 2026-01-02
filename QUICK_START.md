# 快速开始指南

## 1. 初始化项目

### 后端初始化

```bash
# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 初始化数据库
cd backend
python init_db.py

# 创建测试数据（可选）
python create_test_data.py

# 启动后端服务器
uvicorn app.main:app --reload
```

后端将在 `http://localhost:8000` 运行
API文档: `http://localhost:8000/docs`

### 前端初始化

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将在 `http://localhost:3000` 运行

## 2. 使用流程

1. **访问首页** (`http://localhost:3000`)
   - 查看现有球队
   - 点击"开始新比赛"

2. **创建比赛**
   - 选择主队和客队
   - 选择出场球员（至少每队5名）
   - 配置比赛参数（时长、节数）
   - 点击"开始比赛"

3. **记录统计**
   - 拖拽球员头像到动作按钮
   - 系统自动记录统计数据
   - 实时查看比分和统计

## 3. 测试数据

运行 `python backend/create_test_data.py` 创建：
- 2支测试球队
- 每队7名球员

## 4. API测试

可以使用以下方式测试API：

### 使用curl

```bash
# 获取所有球队
curl http://localhost:8000/api/v1/teams

# 创建球队
curl -X POST http://localhost:8000/api/v1/teams \
  -H "Content-Type: application/json" \
  -d '{"name": "新球队"}'
```

### 使用浏览器

访问 `http://localhost:8000/docs` 查看交互式API文档

## 5. 常见问题

### 端口被占用

如果8000端口被占用，可以修改：
```bash
uvicorn app.main:app --reload --port 8001
```

然后修改 `frontend/vite.config.ts` 中的代理端口。

### 数据库错误

如果遇到数据库错误，删除 `backend/database/basketball.db` 并重新运行 `init_db.py`

### 前端无法连接后端

检查：
1. 后端是否正在运行
2. CORS配置是否正确
3. 代理配置是否正确

## 6. 下一步

- 完善统计计算功能
- 添加实时比分更新
- 实现报告生成功能
- 优化UI/UX


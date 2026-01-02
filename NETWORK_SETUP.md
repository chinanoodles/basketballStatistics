# 外网访问配置指南

## 数据存储说明

**重要：所有数据都存储在SQLite数据库中，不是本地缓存！**

- 数据库位置：`backend/database/basketball.db`
- 所有比赛记录、统计数据、球队和球员信息都存储在数据库中
- 多个用户访问同一服务器时，会看到相同的数据
- 数据是持久化的，重启服务器后数据不会丢失

## 配置外网访问

### 方案一：前后端在同一台服务器

1. **启动后端（允许外网访问）**：
   ```bash
   cd backend
   ALLOW_EXTERNAL=true uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **启动前端（允许外网访问）**：
   ```bash
   cd frontend
   npm run dev:host
   ```

3. **访问**：
   - 同一网络其他设备：`http://服务器IP:3000`
   - 外网访问：需要配置路由器端口转发（3000端口）

### 方案二：前后端分离部署

1. **后端服务器配置**：
   ```bash
   cd backend
   ALLOW_EXTERNAL=true uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **前端服务器配置**：
   ```bash
   cd frontend
   # 创建 .env 文件
   echo "VITE_API_URL=http://后端服务器IP:8000/api/v1" > .env
   
   # 启动前端
   npm run dev:host
   ```

3. **访问**：
   - 前端地址：`http://前端服务器IP:3000`
   - 前端会自动连接到后端服务器

## 防火墙配置

### macOS
1. 系统偏好设置 > 安全性与隐私 > 防火墙
2. 点击"防火墙选项"
3. 添加应用程序：Python 和 Node.js
4. 或添加端口：3000 和 8000

### Linux
```bash
# Ubuntu/Debian
sudo ufw allow 3000
sudo ufw allow 8000

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

### Windows
1. 控制面板 > Windows Defender 防火墙
2. 高级设置 > 入站规则 > 新建规则
3. 选择"端口"，添加 3000 和 8000

## 路由器端口转发（外网访问）

如果需要从互联网访问，需要配置路由器端口转发：

1. 登录路由器管理界面
2. 找到"端口转发"或"虚拟服务器"设置
3. 添加规则：
   - 外部端口：3000（前端）
   - 内部IP：你的服务器IP
   - 内部端口：3000
   - 协议：TCP

4. 如果后端也在外网，同样配置8000端口

## 验证配置

1. **检查后端是否可访问**：
   ```bash
   curl http://服务器IP:8000/health
   ```

2. **检查前端是否可访问**：
   在浏览器中访问 `http://服务器IP:3000`

3. **检查API连接**：
   打开浏览器开发者工具（F12），查看Network标签，确认API请求是否成功

## 常见问题

### Q: 外网访问时看不到数据
A: 检查以下几点：
1. 后端是否设置了 `ALLOW_EXTERNAL=true` 和 `--host 0.0.0.0`
2. 前端 `.env` 文件中的 `VITE_API_URL` 是否正确
3. 防火墙是否允许 8000 和 3000 端口
4. 浏览器控制台是否有CORS错误

### Q: 数据是否同步？
A: 是的，所有数据都存储在SQLite数据库中，所有用户访问同一服务器时会看到相同的数据。

### Q: 如何备份数据？
A: 复制 `backend/database/basketball.db` 文件即可。


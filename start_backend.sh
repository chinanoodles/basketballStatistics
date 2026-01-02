#!/bin/bash
# 启动后端服务器

cd backend

# 激活虚拟环境
source ../venv/bin/activate

# 初始化数据库（如果不存在）
python init_db.py

# 检查是否允许外网访问
if [[ "$1" == "--external" ]]; then
    echo "允许外网访问，启用CORS..."
    ALLOW_EXTERNAL=true uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
else
    echo "仅本地访问..."
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
fi


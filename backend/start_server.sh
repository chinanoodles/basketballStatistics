#!/bin/bash
# 启动后端服务器脚本

# 获取脚本所在目录的父目录（backend目录）
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR" || exit 1

# 激活虚拟环境（如果在项目根目录有venv）
if [ -f "../venv/bin/activate" ]; then
    source ../venv/bin/activate
fi

# 初始化数据库（如果不存在）
if [ -f "init_db.py" ]; then
    python init_db.py
fi

# 检查是否允许外网访问
if [ "$1" == "--external" ] || [ "$1" == "-e" ]; then
    echo "启动服务器（允许外网访问）..."
    export ALLOW_EXTERNAL=true
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
else
    echo "启动服务器（仅本地访问）..."
    uvicorn app.main:app --reload --host localhost --port 8000
fi


#!/bin/bash
# 启动后端服务器脚本

# 检查是否允许外网访问
if [ "$1" == "--external" ] || [ "$1" == "-e" ]; then
    echo "启动服务器（允许外网访问）..."
    export ALLOW_EXTERNAL=true
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
else
    echo "启动服务器（仅本地访问）..."
    uvicorn app.main:app --reload --host localhost --port 8000
fi


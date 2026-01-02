#!/bin/bash
# 启动前端开发服务器

cd frontend

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装前端依赖..."
    npm install
fi

# 启动开发服务器
npm run dev


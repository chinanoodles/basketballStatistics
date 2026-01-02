"""
FastAPI应用主入口
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import teams, players, games, statistics, player_time

app = FastAPI(
    title="篮球比赛统计API",
    description="篮球比赛统计应用后端API",
    version="1.0.0"
)

# CORS配置
# 允许外网访问：设置环境变量 ALLOW_EXTERNAL=true
allow_external = os.getenv("ALLOW_EXTERNAL", "false").lower() == "true"

if allow_external:
    # 允许所有来源（用于外网访问）
    # 注意：使用 ["*"] 时不能设置 allow_credentials=True
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # 仅允许本地访问
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# 注册路由
app.include_router(teams.router, prefix="/api/v1/teams", tags=["球队"])
app.include_router(players.router, prefix="/api/v1/players", tags=["球员"])
app.include_router(games.router, prefix="/api/v1/games", tags=["比赛"])
app.include_router(statistics.router, prefix="/api/v1/statistics", tags=["统计"])
app.include_router(player_time.router, prefix="/api/v1/player-time", tags=["出场时间"])


@app.get("/")
async def root():
    """根路径"""
    return {"message": "篮球比赛统计API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


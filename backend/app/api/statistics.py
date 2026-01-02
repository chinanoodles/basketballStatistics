"""统计API路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.statistic import Statistic
from app.models.game import Game
from app.models.player import Player
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


class StatisticCreate(BaseModel):
    """创建统计数据请求模型"""
    game_id: int
    player_id: int
    quarter: int
    action_type: str  # 2PM, 2PA, 3PM, 3PA, FTM, FTA, OREB, DREB, AST, STL, BLK, TOV, PF, PFD
    shot_x: Optional[float] = None  # 投篮X坐标（百分比 0-100）
    shot_y: Optional[float] = None  # 投篮Y坐标（百分比 0-100）
    assisted_by_player_id: Optional[int] = None  # 助攻球员ID
    rebounded_by_player_id: Optional[int] = None  # 篮板球员ID


class StatisticResponse(BaseModel):
    """统计数据响应模型"""
    id: int
    game_id: int
    player_id: int
    quarter: int
    action_type: str
    shot_x: Optional[float] = None
    shot_y: Optional[float] = None
    assisted_by_player_id: Optional[int] = None
    rebounded_by_player_id: Optional[int] = None
    timestamp: datetime

    class Config:
        from_attributes = True


@router.post("/", response_model=StatisticResponse)
async def create_statistic(statistic: StatisticCreate, db: Session = Depends(get_db)):
    """记录统计数据"""
    # 验证比赛是否存在
    game = db.query(Game).filter(Game.id == statistic.game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 验证球员是否存在
    player = db.query(Player).filter(Player.id == statistic.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="球员不存在")
    
    # 验证动作类型
    valid_actions = ["2PM", "2PA", "3PM", "3PA", "FTM", "FTA", "OREB", "DREB", "AST", "STL", "BLK", "TOV", "PF", "PFD", "SUB_IN", "SUB_OUT"]
    if statistic.action_type not in valid_actions:
        raise HTTPException(status_code=400, detail=f"无效的动作类型，必须是: {', '.join(valid_actions)}")
    
    # 创建统计数据
    db_statistic = Statistic(**statistic.model_dump())
    db.add(db_statistic)
    db.commit()
    db.refresh(db_statistic)
    return db_statistic


@router.get("/game/{game_id}", response_model=List[StatisticResponse])
async def get_game_statistics(game_id: int, db: Session = Depends(get_db)):
    """获取比赛的所有统计数据"""
    statistics = db.query(Statistic).filter(Statistic.game_id == game_id).all()
    return statistics


@router.get("/game/{game_id}/player/{player_id}", response_model=List[StatisticResponse])
async def get_player_statistics(game_id: int, player_id: int, db: Session = Depends(get_db)):
    """获取球员在比赛中的统计数据"""
    statistics = db.query(Statistic).filter(
        Statistic.game_id == game_id,
        Statistic.player_id == player_id
    ).all()
    return statistics


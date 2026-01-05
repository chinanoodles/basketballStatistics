"""球员出场时间API路由"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.player_time import PlayerTime
from app.models.game import Game
from app.models.player import Player
from app.models.user import User
from app.core.dependencies import get_current_active_user, get_current_league_id, get_current_role
from pydantic import BaseModel

router = APIRouter()


class PlayerTimeCreate(BaseModel):
    """创建出场时间记录请求模型"""
    game_id: int
    player_id: int
    quarter: int
    enter_time: datetime
    exit_time: Optional[datetime] = None


class PlayerTimeResponse(BaseModel):
    """出场时间响应模型"""
    id: int
    game_id: int
    player_id: int
    quarter: int
    enter_time: datetime
    exit_time: Optional[datetime]
    duration_seconds: Optional[float]

    class Config:
        from_attributes = True


@router.post("/enter", response_model=PlayerTimeResponse)
async def player_enter(
    game_id: int,
    player_id: int,
    quarter: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """记录球员上场"""
    # 验证比赛和球员
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：普通用户只能在自己league的比赛中操作
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    if current_role != "admin" and game.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限操作此比赛"
        )
    
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="球员不存在")
    
    # 检查是否已经在场上（有未结束的记录）
    existing = db.query(PlayerTime).filter(
        PlayerTime.game_id == game_id,
        PlayerTime.player_id == player_id,
        PlayerTime.exit_time.is_(None)
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="球员已在场上")
    
    # 创建上场记录
    player_time = PlayerTime(
        game_id=game_id,
        player_id=player_id,
        quarter=quarter,
        enter_time=datetime.now()
    )
    db.add(player_time)
    db.commit()
    db.refresh(player_time)
    return player_time


@router.post("/exit", response_model=PlayerTimeResponse)
async def player_exit(
    game_id: int,
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """记录球员下场"""
    # 验证比赛权限
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：普通用户只能在自己league的比赛中操作
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    if current_role != "admin" and game.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限操作此比赛"
        )
    
    # 查找未结束的上场记录
    player_time = db.query(PlayerTime).filter(
        PlayerTime.game_id == game_id,
        PlayerTime.player_id == player_id,
        PlayerTime.exit_time.is_(None)
    ).first()
    
    if not player_time:
        raise HTTPException(status_code=404, detail="未找到上场记录")
    
    # 计算出场时长
    exit_time = datetime.now()
    duration = (exit_time - player_time.enter_time).total_seconds()
    
    player_time.exit_time = exit_time
    player_time.duration_seconds = duration
    
    db.commit()
    db.refresh(player_time)
    return player_time


@router.get("/game/{game_id}/player/{player_id}", response_model=List[PlayerTimeResponse])
async def get_player_time(
    game_id: int,
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取球员在比赛中的出场时间记录"""
    # 验证比赛权限
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：普通用户只能查看自己league的比赛数据
    if current_user.role.value != "admin" and game.league_id != current_user.league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限访问此比赛数据"
        )
    
    times = db.query(PlayerTime).filter(
        PlayerTime.game_id == game_id,
        PlayerTime.player_id == player_id
    ).all()
    return times


@router.get("/game/{game_id}/total")
async def get_all_players_time(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取比赛中所有球员的总出场时间和上场状态"""
    from sqlalchemy import func as sql_func
    from datetime import datetime
    
    # 验证比赛权限
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：普通用户只能查看自己league的比赛数据
    if current_user.role.value != "admin" and game.league_id != current_user.league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限访问此比赛数据"
        )
    
    # 查询所有出场时间记录
    times = db.query(
        PlayerTime.player_id,
        sql_func.sum(PlayerTime.duration_seconds).label('total_seconds')
    ).filter(
        PlayerTime.game_id == game_id,
        PlayerTime.duration_seconds.isnot(None)
    ).group_by(PlayerTime.player_id).all()
    
    # 查询还在场上的球员
    on_court = db.query(PlayerTime).filter(
        PlayerTime.game_id == game_id,
        PlayerTime.exit_time.is_(None)
    ).all()
    
    result = {}
    on_court_ids = []
    
    # 计算总出场时间
    for player_id, total_seconds in times:
        result[player_id] = total_seconds or 0
    
    # 添加还在场上的球员的当前时间
    current_time = datetime.now()
    for pt in on_court:
        current_duration = (current_time - pt.enter_time).total_seconds()
        result[pt.player_id] = result.get(pt.player_id, 0) + current_duration
        on_court_ids.append(pt.player_id)
    
    return {
        "times": result,
        "on_court": on_court_ids
    }


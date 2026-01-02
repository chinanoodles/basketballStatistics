"""比赛API路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.game import Game, GamePlayer, GameStatus
from app.models.team import Team
from pydantic import BaseModel

router = APIRouter()


class GameCreate(BaseModel):
    """创建比赛请求模型"""
    home_team_id: int
    away_team_id: int
    date: datetime
    duration: int = 40
    quarters: int = 4
    player_ids: List[int] = []  # 出场球员ID列表


class GameResponse(BaseModel):
    """比赛响应模型"""
    id: int
    home_team_id: int
    away_team_id: int
    date: datetime
    duration: int
    quarters: int
    status: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[GameResponse])
async def get_games(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取所有比赛"""
    games = db.query(Game).offset(skip).limit(limit).all()
    return games


@router.get("/{game_id}", response_model=GameResponse)
async def get_game(game_id: int, db: Session = Depends(get_db)):
    """获取比赛详情"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    return game


@router.post("/", response_model=GameResponse)
async def create_game(game: GameCreate, db: Session = Depends(get_db)):
    """创建比赛"""
    # 验证球队是否存在
    home_team = db.query(Team).filter(Team.id == game.home_team_id).first()
    away_team = db.query(Team).filter(Team.id == game.away_team_id).first()
    
    if not home_team or not away_team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    if game.home_team_id == game.away_team_id:
        raise HTTPException(status_code=400, detail="主队和客队不能相同")
    
    # 创建比赛
    db_game = Game(
        home_team_id=game.home_team_id,
        away_team_id=game.away_team_id,
        date=game.date,
        duration=game.duration,
        quarters=game.quarters,
        status=GameStatus.PENDING
    )
    db.add(db_game)
    db.commit()
    db.refresh(db_game)
    
    # 添加出场球员
    if game.player_ids:
        for player_id in game.player_ids:
            game_player = GamePlayer(
                game_id=db_game.id,
                player_id=player_id,
                is_starter=False  # 默认非首发，可以后续优化
            )
            db.add(game_player)
        db.commit()
    
    return db_game


@router.put("/{game_id}/start")
async def start_game(game_id: int, db: Session = Depends(get_db)):
    """开始比赛"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    game.status = GameStatus.LIVE
    db.commit()
    return {"message": "比赛已开始", "status": game.status}


@router.put("/{game_id}/pause")
async def pause_game(game_id: int, db: Session = Depends(get_db)):
    """暂停比赛"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    game.status = GameStatus.PAUSED
    db.commit()
    return {"message": "比赛已暂停", "status": game.status}


@router.put("/{game_id}/finish")
async def finish_game(game_id: int, db: Session = Depends(get_db)):
    """结束比赛"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    game.status = GameStatus.FINISHED
    db.commit()
    return {"message": "比赛已结束", "status": game.status}


@router.delete("/{game_id}")
async def delete_game(game_id: int, db: Session = Depends(get_db)):
    """删除比赛"""
    from app.models.statistic import Statistic
    from app.models.player_time import PlayerTime
    
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 显式删除相关数据（确保数据同步）
    # 删除统计数据
    stats_count = db.query(Statistic).filter(Statistic.game_id == game_id).delete()
    
    # 删除球员时间记录
    player_times_count = db.query(PlayerTime).filter(PlayerTime.game_id == game_id).delete()
    
    # 删除比赛（GamePlayer会通过cascade自动删除）
    db.delete(game)
    db.commit()
    
    return {
        "message": "比赛已删除",
        "deleted_stats": stats_count,
        "deleted_player_times": player_times_count
    }


@router.post("/batch-delete")
async def batch_delete_games(game_ids: List[int], db: Session = Depends(get_db)):
    """批量删除比赛"""
    from app.models.statistic import Statistic
    from app.models.player_time import PlayerTime
    
    games = db.query(Game).filter(Game.id.in_(game_ids)).all()
    if not games:
        raise HTTPException(status_code=404, detail="未找到要删除的比赛")
    
    total_stats_deleted = 0
    total_player_times_deleted = 0
    
    for game in games:
        # 显式删除相关数据
        stats_count = db.query(Statistic).filter(Statistic.game_id == game.id).delete()
        player_times_count = db.query(PlayerTime).filter(PlayerTime.game_id == game.id).delete()
        
        total_stats_deleted += stats_count
        total_player_times_deleted += player_times_count
        
        # 删除比赛（GamePlayer会通过cascade自动删除）
        db.delete(game)
    
    db.commit()
    
    return {
        "message": f"已删除 {len(games)} 场比赛",
        "deleted_stats": total_stats_deleted,
        "deleted_player_times": total_player_times_deleted
    }


@router.get("/{game_id}/statistics")
async def get_game_statistics_summary(game_id: int, db: Session = Depends(get_db)):
    """获取比赛统计摘要（包括比分）"""
    from app.models.statistic import Statistic
    from app.models.player import Player
    
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 获取所有统计数据
    stats = db.query(Statistic).filter(Statistic.game_id == game_id).all()
    
    # 计算主队和客队得分
    # 获取主队球员ID（直接通过team_id查询）
    home_players = db.query(Player).filter(Player.team_id == game.home_team_id).all()
    home_player_ids = [p.id for p in home_players]
    
    # 获取客队球员ID
    away_players = db.query(Player).filter(Player.team_id == game.away_team_id).all()
    away_player_ids = [p.id for p in away_players]
    
    home_score = sum(
        2 if s.action_type == '2PM' else
        3 if s.action_type == '3PM' else
        1 if s.action_type == 'FTM' else 0
        for s in stats if s.player_id in home_player_ids
    )
    
    away_score = sum(
        2 if s.action_type == '2PM' else
        3 if s.action_type == '3PM' else
        1 if s.action_type == 'FTM' else 0
        for s in stats if s.player_id in away_player_ids
    )
    
    return {
        "home_score": home_score,
        "away_score": away_score,
        "total_stats": len(stats)
    }


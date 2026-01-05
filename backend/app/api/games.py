"""比赛API路由"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.game import Game, GamePlayer, GameStatus, SeasonType
from app.models.team import Team
from app.models.user import User
from app.core.dependencies import get_current_active_user, get_current_league_id, get_current_role
from pydantic import BaseModel

router = APIRouter()


class GameCreate(BaseModel):
    """创建比赛请求模型"""
    league_id: Optional[int] = None  # 如果未指定，使用当前用户的league_id
    home_team_id: int
    away_team_id: int
    date: datetime
    duration: int = 40
    quarters: int = 4
    season_type: str = "regular"  # "regular" 或 "playoff"
    player_ids: List[int] = []  # 出场球员ID列表


class GameResponse(BaseModel):
    """比赛响应模型"""
    id: int
    league_id: int
    home_team_id: int
    away_team_id: int
    date: datetime
    duration: int
    quarters: int
    status: str
    season_type: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[GameResponse])
async def get_games(
    skip: int = 0,
    limit: int = 100,
    season_type: Optional[str] = Query(None, description="赛季类型: regular 或 playoff"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取比赛列表（只能看到自己league的比赛）"""
    # 管理员可以看到所有比赛，普通用户只能看到自己league的比赛
    query = db.query(Game)
    
    # 获取当前使用的league_id和role（优先使用token中的临时值）
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    
    if current_role != "admin":
        # 如果用户切换了league（token中有_temp_league_id），只显示该league的数据
        # 否则显示用户所有加入的league的数据
        if current_league_id and hasattr(current_user, '_temp_league_id') and current_user._temp_league_id is not None:
            # 用户切换了league，只显示当前选择的league
            query = query.filter(Game.league_id == current_league_id)
        else:
            # 用户没有切换league，显示所有用户加入的league的数据
            league_ids = set()
            
            # 从多对多关系获取
            if current_user.leagues:
                league_ids.update([league.id for league in current_user.leagues])
            
            # 从主league_id获取（向后兼容）
            if current_user.league_id:
                league_ids.add(current_user.league_id)
            
            if not league_ids:
                return []  # 用户没有关联league，返回空列表
            
            # 过滤多个league
            query = query.filter(Game.league_id.in_(list(league_ids)))
    
    # 按season_type筛选
    if season_type:
        if season_type not in ["regular", "playoff"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="season_type 必须是 'regular' 或 'playoff'"
            )
        # 将小写值转换为枚举值
        from app.models.game import SeasonType
        season_enum = SeasonType.REGULAR if season_type == "regular" else SeasonType.PLAYOFF
        query = query.filter(Game.season_type == season_enum)
    
    games = query.order_by(Game.date.desc()).offset(skip).limit(limit).all()
    return games


@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取比赛详情"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：普通用户只能查看自己league的比赛
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    if current_role != "admin" and game.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限访问此比赛"
        )
    
    return game


@router.post("/", response_model=GameResponse)
async def create_game(
    game: GameCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """创建比赛（球队管理员和管理员）"""
    # 权限检查：球员不能创建比赛
    if current_user.role.value == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限创建比赛"
        )
    
    # 确定league_id
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    
    league_id = game.league_id
    if not league_id:
        # 如果未指定，使用当前用户的league_id
        if not current_league_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户未关联联赛，请指定league_id"
            )
        league_id = current_league_id
    else:
        # 如果指定了league_id，检查权限
        if current_role != "admin" and league_id != current_league_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限在此联赛创建比赛"
            )
    
    # 验证球队是否存在
    home_team = db.query(Team).filter(Team.id == game.home_team_id).first()
    away_team = db.query(Team).filter(Team.id == game.away_team_id).first()
    
    if not home_team or not away_team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    # 检查球队是否属于指定的league
    if home_team.league_id != league_id or away_team.league_id != league_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="球队必须属于指定的联赛"
        )
    
    if game.home_team_id == game.away_team_id:
        raise HTTPException(status_code=400, detail="主队和客队不能相同")
    
    # 验证season_type
    if game.season_type not in ["regular", "playoff"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="season_type 必须是 'regular' 或 'playoff'"
        )
    
    # 创建比赛
    db_game = Game(
        league_id=league_id,
        home_team_id=game.home_team_id,
        away_team_id=game.away_team_id,
        date=game.date,
        duration=game.duration,
        quarters=game.quarters,
        status=GameStatus.PENDING,
        season_type=SeasonType.REGULAR if game.season_type == "regular" else SeasonType.PLAYOFF
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
async def start_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """开始比赛（球队管理员和管理员）"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：球员不能操作比赛
    current_role = get_current_role(current_user)
    if current_role == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限操作比赛"
        )
    
    # 权限检查：球队管理员和管理员只能操作自己league的比赛
    current_league_id = get_current_league_id(current_user)
    if current_role != "admin" and game.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限操作此比赛"
        )
    
    game.status = GameStatus.LIVE
    db.commit()
    return {"message": "比赛已开始", "status": game.status}


@router.put("/{game_id}/pause")
async def pause_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """暂停比赛（球队管理员和管理员）"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：球员不能操作比赛
    current_role = get_current_role(current_user)
    if current_role == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限操作比赛"
        )
    
    # 权限检查：球队管理员和管理员只能操作自己league的比赛
    current_league_id = get_current_league_id(current_user)
    if current_role != "admin" and game.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限操作此比赛"
        )
    
    game.status = GameStatus.PAUSED
    db.commit()
    return {"message": "比赛已暂停", "status": game.status}


@router.put("/{game_id}/finish")
async def finish_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """结束比赛（球队管理员和管理员）"""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：球员不能操作比赛
    current_role = get_current_role(current_user)
    if current_role == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限操作比赛"
        )
    
    # 权限检查：球队管理员和管理员只能操作自己league的比赛
    current_league_id = get_current_league_id(current_user)
    if current_role != "admin" and game.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限操作此比赛"
        )
    
    game.status = GameStatus.FINISHED
    db.commit()
    return {"message": "比赛已结束", "status": game.status}


@router.delete("/{game_id}")
async def delete_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """删除比赛"""
    from app.models.statistic import Statistic
    from app.models.player_time import PlayerTime
    
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：普通用户只能删除自己league的比赛
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    if current_role != "admin" and game.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限删除此比赛"
        )
    
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
async def batch_delete_games(
    game_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """批量删除比赛"""
    from app.models.statistic import Statistic
    from app.models.player_time import PlayerTime
    
    games = db.query(Game).filter(Game.id.in_(game_ids)).all()
    if not games:
        raise HTTPException(status_code=404, detail="未找到要删除的比赛")
    
    # 权限检查：普通用户只能删除自己league的比赛
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    if current_role != "admin":
        for game in games:
            if game.league_id != current_league_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"没有权限删除比赛 {game.id}"
                )
    
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
async def get_game_statistics_summary(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取比赛统计摘要（包括比分）"""
    from app.models.statistic import Statistic
    from app.models.player import Player
    
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：普通用户只能查看自己league的比赛统计
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    if current_role != "admin" and game.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限访问此比赛统计"
        )
    
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


"""统计API路由"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.statistic import Statistic
from app.models.game import Game, SeasonType
from app.models.player import Player
from app.models.user import User
from app.core.dependencies import get_current_active_user, get_current_league_id, get_current_role
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
async def create_statistic(
    statistic: StatisticCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """记录统计数据"""
    # 验证比赛是否存在
    game = db.query(Game).filter(Game.id == statistic.game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：普通用户只能在自己league的比赛中记录统计
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    
    if current_role != "admin":
        # 如果用户切换了league，检查是否匹配
        if current_league_id and hasattr(current_user, '_temp_league_id') and current_user._temp_league_id is not None:
            if game.league_id != current_league_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限在此比赛中记录统计"
                )
        else:
            # 用户没有切换league，检查是否在用户的所有league中
            league_ids = set()
            if current_user.leagues:
                league_ids.update([league.id for league in current_user.leagues])
            if current_user.league_id:
                league_ids.add(current_user.league_id)
            
            if game.league_id not in league_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限在此比赛中记录统计"
                )
    
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
async def get_game_statistics(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取比赛的所有统计数据"""
    # 验证比赛是否存在
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：普通用户只能查看自己league的比赛统计
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    
    if current_role != "admin":
        # 如果用户切换了league，检查是否匹配
        if current_league_id and hasattr(current_user, '_temp_league_id') and current_user._temp_league_id is not None:
            # 用户切换了league，只允许访问当前选择的league
            if game.league_id != current_league_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限访问此比赛统计"
                )
        else:
            # 用户没有切换league，检查是否在用户的所有league中
            league_ids = set()
            if current_user.leagues:
                league_ids.update([league.id for league in current_user.leagues])
            if current_user.league_id:
                league_ids.add(current_user.league_id)
            
            if game.league_id not in league_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限访问此比赛统计"
                )
    
    statistics = db.query(Statistic).filter(Statistic.game_id == game_id).all()
    return statistics


@router.get("/game/{game_id}/player/{player_id}", response_model=List[StatisticResponse])
async def get_player_statistics(
    game_id: int,
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取球员在比赛中的统计数据"""
    # 验证比赛是否存在
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    
    # 权限检查：普通用户只能查看自己league的比赛统计
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    
    if current_role != "admin":
        # 如果用户切换了league，检查是否匹配
        if current_league_id and hasattr(current_user, '_temp_league_id') and current_user._temp_league_id is not None:
            if game.league_id != current_league_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限访问此比赛统计"
                )
        else:
            # 用户没有切换league，检查是否在用户的所有league中
            league_ids = set()
            if current_user.leagues:
                league_ids.update([league.id for league in current_user.leagues])
            if current_user.league_id:
                league_ids.add(current_user.league_id)
            
            if game.league_id not in league_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限访问此比赛统计"
                )
    
    statistics = db.query(Statistic).filter(
        Statistic.game_id == game_id,
        Statistic.player_id == player_id
    ).all()
    return statistics


@router.get("/league/{league_id}", response_model=List[StatisticResponse])
async def get_league_statistics(
    league_id: int,
    season_type: Optional[str] = Query(None, description="赛季类型: regular 或 playoff"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取联赛的所有统计数据（支持按season_type筛选）"""
    # 权限检查：普通用户只能查看自己league的统计
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    
    if current_role != "admin":
        # 如果用户切换了league，只允许访问当前选择的league
        if current_league_id and hasattr(current_user, '_temp_league_id') and current_user._temp_league_id is not None:
            if league_id != current_league_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限访问此联赛统计"
                )
        else:
            # 用户没有切换league，检查是否在用户的所有league中
            league_ids = set()
            if current_user.leagues:
                league_ids.update([league.id for league in current_user.leagues])
            if current_user.league_id:
                league_ids.add(current_user.league_id)
            
            if league_id not in league_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="没有权限访问此联赛统计"
                )
    
    # 构建查询：通过Game关联查询
    query = db.query(Statistic).join(Game).filter(Game.league_id == league_id)
    
    # 按season_type筛选
    if season_type:
        if season_type not in ["regular", "playoff"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="season_type 必须是 'regular' 或 'playoff'"
            )
        query = query.filter(
            Game.season_type == (SeasonType.REGULAR if season_type == "regular" else SeasonType.PLAYOFF)
        )
    
    statistics = query.order_by(Statistic.timestamp.desc()).all()
    return statistics


@router.get("/player/{player_id}", response_model=List[StatisticResponse])
async def get_player_all_statistics(
    player_id: int,
    season_type: Optional[str] = Query(None, description="赛季类型: regular 或 playoff"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取球员的所有统计数据（跨所有比赛）"""
    from app.models.player import Player
    from app.models.team import Team
    
    # 验证球员是否存在
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="球员不存在")
    
    # 获取球员所属球队
    team = db.query(Team).filter(Team.id == player.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="球员所属球队不存在")
    
    # 权限检查：team_admin可以查看自己管理的球队的球员，管理员可以查看所有球员
    if current_user.role.value == "admin":
        pass  # 管理员可以查看所有球员
    elif current_user.role.value == "team_admin":
        # team_admin可以查看自己管理的球队的球员或自己league的球员
        if team.team_admin_id != current_user.id and team.league_id != current_user.league_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限访问此球员统计"
            )
    else:
        # player只能查看自己league的球员
        if team.league_id != current_user.league_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限访问此球员统计"
            )
    
    # 获取球员参与的所有比赛
    games_query = db.query(Game).filter(
        ((Game.home_team_id == team.id) | (Game.away_team_id == team.id)),
        Game.status == "finished"
    )
    
    # 按season_type筛选
    if season_type:
        if season_type not in ["regular", "playoff"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="season_type 必须是 'regular' 或 'playoff'"
            )
        games_query = games_query.filter(
            Game.season_type == (SeasonType.REGULAR if season_type == "regular" else SeasonType.PLAYOFF)
        )
    
    games = games_query.all()
    game_ids = [g.id for g in games]
    
    if not game_ids:
        return []
    
    # 获取所有统计数据
    statistics = db.query(Statistic).filter(
        Statistic.player_id == player_id,
        Statistic.game_id.in_(game_ids)
    ).order_by(Statistic.timestamp.desc()).all()
    
    return statistics


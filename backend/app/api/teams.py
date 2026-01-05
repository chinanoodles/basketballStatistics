"""球队API路由"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.team import Team
from app.models.user import User
from app.core.dependencies import get_current_active_user
from pydantic import BaseModel

router = APIRouter()


class TeamCreate(BaseModel):
    """创建球队请求模型"""
    name: str
    logo: Optional[str] = None
    league_id: Optional[int] = None  # 如果未指定，使用当前用户的league_id


class TeamResponse(BaseModel):
    """球队响应模型"""
    id: int
    name: str
    logo: Optional[str]

    class Config:
        from_attributes = True


@router.get("/", response_model=List[TeamResponse])
async def get_teams(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取球队列表（只能看到自己league的球队）"""
    # 管理员可以看到所有球队，普通用户只能看到自己league的球队
    query = db.query(Team)
    
    # 获取当前使用的league_id（优先使用token中的临时值）
    current_league_id = getattr(current_user, '_temp_league_id', None) or current_user.league_id
    current_role = getattr(current_user, '_temp_role', None) or current_user.role.value
    
    if current_role != "admin":
        if not current_league_id:
            return []  # 用户没有关联league，返回空列表
        query = query.filter(Team.league_id == current_league_id)
    
    teams = query.offset(skip).limit(limit).all()
    return teams


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取球队详情"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    # 权限检查：普通用户只能查看自己league的球队
    if current_user.role.value != "admin" and team.league_id != current_user.league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限访问此球队"
        )
    
    return team


@router.post("/", response_model=TeamResponse)
async def create_team(
    team: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """创建球队（球队管理员和管理员）"""
    # 权限检查：只有球队管理员和管理员可以创建球队
    if current_user.role.value == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限创建球队"
        )
    
    # 确定league_id
    league_id = team.league_id
    if not league_id:
        # 如果未指定，使用当前用户的league_id
        if not current_user.league_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户未关联联赛，请指定league_id"
            )
        league_id = current_user.league_id
    else:
        # 如果指定了league_id，检查权限
        if current_user.role.value != "admin" and league_id != current_user.league_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限在此联赛创建球队"
            )
    
    # 检查名称是否已存在（同一league内）
    existing_team = db.query(Team).filter(
        Team.name == team.name,
        Team.league_id == league_id
    ).first()
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该联赛中已存在同名球队"
        )
    
    db_team = Team(
        name=team.name,
        logo=team.logo,
        league_id=league_id
    )
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: int,
    team: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """更新球队（球队管理员和管理员）"""
    db_team = db.query(Team).filter(Team.id == team_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    # 权限检查：球员不能修改球队
    if current_user.role.value == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限修改球队"
        )
    
    # 权限检查：球队管理员和管理员只能修改自己league的球队
    if current_user.role.value != "admin" and db_team.league_id != current_user.league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限修改此球队"
        )
    
    # 如果修改了league_id，检查权限
    if team.league_id and team.league_id != db_team.league_id:
        if current_user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限将球队转移到其他联赛"
            )
    
    # 如果修改了名称，检查是否与其他球队冲突
    if team.name != db_team.name:
        league_id = team.league_id or db_team.league_id
        existing_team = db.query(Team).filter(
            Team.name == team.name,
            Team.league_id == league_id,
            Team.id != team_id
        ).first()
        if existing_team:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该联赛中已存在同名球队"
            )
    
    # 更新字段
    db_team.name = team.name
    if team.logo is not None:
        db_team.logo = team.logo
    if team.league_id is not None:
        db_team.league_id = team.league_id
    
    db.commit()
    db.refresh(db_team)
    return db_team


@router.get("/{team_id}/related-games")
async def get_related_games(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取球队的相关比赛数量"""
    from app.models.game import Game
    
    db_team = db.query(Team).filter(Team.id == team_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    # 权限检查：普通用户只能查看自己league的球队
    if current_user.role.value != "admin" and db_team.league_id != current_user.league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限访问此球队"
        )
    
    related_games = db.query(Game).filter(
        (Game.home_team_id == team_id) | (Game.away_team_id == team_id)
    ).all()
    
    return {
        "count": len(related_games),
        "games": [
            {
                "id": game.id,
                "date": game.date.isoformat() if game.date else None,
                "status": game.status.value if game.status else None,
            }
            for game in related_games
        ]
    }


@router.delete("/{team_id}")
async def delete_team(
    team_id: int,
    cascade_delete_games: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """删除球队（球队管理员和管理员）
    
    Args:
        team_id: 球队ID
        cascade_delete_games: 是否级联删除相关比赛，默认为False
    """
    from app.models.game import Game
    from app.models.statistic import Statistic
    from app.models.player_time import PlayerTime
    
    db_team = db.query(Team).filter(Team.id == team_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    # 权限检查：球员不能删除球队
    if current_user.role.value == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限删除球队"
        )
    
    # 权限检查：球队管理员和管理员只能删除自己league的球队
    if current_user.role.value != "admin" and db_team.league_id != current_user.league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限删除此球队"
        )
    
    # 检查是否有相关比赛
    related_games = db.query(Game).filter(
        (Game.home_team_id == team_id) | (Game.away_team_id == team_id)
    ).all()
    
    if len(related_games) > 0:
        if not cascade_delete_games:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无法删除球队：该球队还有 {len(related_games)} 场相关比赛。请先删除相关比赛后再删除球队，或使用 cascade_delete_games=true 参数级联删除。"
            )
        else:
            # 级联删除相关比赛及其数据
            game_ids = [game.id for game in related_games]
            
            # 删除所有相关比赛的统计数据
            stats_count = db.query(Statistic).filter(Statistic.game_id.in_(game_ids)).delete(synchronize_session=False)
            
            # 删除所有相关比赛的球员时间记录
            player_times_count = db.query(PlayerTime).filter(PlayerTime.game_id.in_(game_ids)).delete(synchronize_session=False)
            
            # 删除所有相关比赛
            for game in related_games:
                db.delete(game)
    
    # 删除球队（球员会通过cascade自动删除）
    db.delete(db_team)
    db.commit()
    
    if len(related_games) > 0:
        return {
            "message": f"球队已删除，同时删除了 {len(related_games)} 场相关比赛",
            "deleted_games": len(related_games),
            "deleted_stats": stats_count if cascade_delete_games else 0,
            "deleted_player_times": player_times_count if cascade_delete_games else 0
        }
    else:
        return {"message": "球队已删除"}


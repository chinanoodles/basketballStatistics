"""球员API路由"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.database import get_db
from app.models.player import Player
from app.models.team import Team
from app.models.user import User
from app.core.dependencies import get_current_active_user, get_current_league_id, get_current_role
from pydantic import BaseModel

router = APIRouter()


class PlayerCreate(BaseModel):
    """创建球员请求模型"""
    team_id: int
    name: str
    number: int
    avatar: Optional[str] = None
    position: Optional[str] = None
    display_order: Optional[int] = None


class PlayerResponse(BaseModel):
    """球员响应模型"""
    id: int
    team_id: int
    name: str
    number: int
    avatar: Optional[str]
    position: Optional[str]
    display_order: Optional[int] = None

    class Config:
        from_attributes = True


@router.get("/team/{team_id}", response_model=List[PlayerResponse])
async def get_team_players(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取球队的所有球员，按display_order排序"""
    # 先检查球队是否存在和权限
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    # 权限检查：普通用户只能查看自己league的球队的球员
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    if current_role != "admin" and team.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限访问此球队的球员"
        )
    
    players = db.query(Player).filter(Player.team_id == team_id).order_by(Player.display_order.asc(), Player.number.asc()).all()
    return players


@router.get("/{player_id}", response_model=PlayerResponse)
async def get_player(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取球员详情"""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="球员不存在")
    
    # 通过球队检查权限
    team = db.query(Team).filter(Team.id == player.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="球员所属球队不存在")
    
    # 权限检查：普通用户只能查看自己league的球员
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    if current_role != "admin" and team.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限访问此球员"
        )
    
    return player


@router.post("/", response_model=PlayerResponse)
async def create_player(
    player: PlayerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """创建球员（球队管理员和管理员）"""
    # 权限检查：球员不能创建球员
    current_role = get_current_role(current_user)
    if current_role == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限创建球员"
        )
    
    # 验证球队是否存在
    team = db.query(Team).filter(Team.id == player.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    # 权限检查：球队管理员和管理员只能在自己league的球队中创建球员
    current_league_id = get_current_league_id(current_user)
    if current_role != "admin" and team.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限在此球队创建球员"
        )
    
    # 检查同一球队中是否已有相同号码的球员
    existing_player = db.query(Player).filter(
        Player.team_id == player.team_id,
        Player.number == player.number
    ).first()
    if existing_player:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该球队中已存在相同号码的球员"
        )
    
    db_player = Player(**player.model_dump())
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player


@router.put("/{player_id}", response_model=PlayerResponse)
async def update_player(
    player_id: int,
    player: PlayerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """更新球员（球队管理员和管理员）"""
    db_player = db.query(Player).filter(Player.id == player_id).first()
    if not db_player:
        raise HTTPException(status_code=404, detail="球员不存在")
    
    # 权限检查：球员不能修改球员
    if current_user.role.value == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限修改球员"
        )
    
    # 检查原球队权限
    old_team = db.query(Team).filter(Team.id == db_player.team_id).first()
    if not old_team:
        raise HTTPException(status_code=404, detail="球员所属球队不存在")
    
    if current_user.role.value != "admin" and old_team.league_id != current_user.league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限修改此球员"
        )
    
    # 如果修改了球队，检查新球队权限
    if player.team_id != db_player.team_id:
        new_team = db.query(Team).filter(Team.id == player.team_id).first()
        if not new_team:
            raise HTTPException(status_code=404, detail="目标球队不存在")
        
        if current_user.role.value != "admin" and new_team.league_id != current_user.league_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限将球员转移到该球队"
            )
    
    # 如果修改了号码，检查是否与新球队中的其他球员冲突
    if player.number != db_player.number or player.team_id != db_player.team_id:
        existing_player = db.query(Player).filter(
            Player.team_id == player.team_id,
            Player.number == player.number,
            Player.id != player_id
        ).first()
        if existing_player:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="目标球队中已存在相同号码的球员"
            )
    
    # 更新字段
    for key, value in player.model_dump().items():
        setattr(db_player, key, value)
    
    db.commit()
    db.refresh(db_player)
    return db_player


@router.delete("/{player_id}")
async def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """删除球员（球队管理员和管理员）"""
    db_player = db.query(Player).filter(Player.id == player_id).first()
    if not db_player:
        raise HTTPException(status_code=404, detail="球员不存在")
    
    # 权限检查：球员不能删除球员
    current_role = get_current_role(current_user)
    if current_role == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限删除球员"
        )
    
    # 通过球队检查权限
    current_league_id = get_current_league_id(current_user)
    team = db.query(Team).filter(Team.id == db_player.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="球员所属球队不存在")
    
    # 权限检查：球队管理员和管理员只能删除自己league的球员
    if current_role != "admin" and team.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限删除此球员"
        )
    
    db.delete(db_player)
    db.commit()
    return {"message": "球员已删除"}


@router.put("/team/{team_id}/order")
async def update_player_order(
    team_id: int,
    player_orders: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """批量更新球员顺序（球队管理员和管理员）"""
    # 权限检查：球员不能修改球员顺序
    current_role = get_current_role(current_user)
    if current_role == "player":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限修改球员顺序"
        )
    
    # 检查球队权限
    current_league_id = get_current_league_id(current_user)
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    # 权限检查：球队管理员和管理员只能修改自己league的球队的球员顺序
    if current_role != "admin" and team.league_id != current_league_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限修改此球队的球员顺序"
        )
    
    for order_data in player_orders:
        player_id = order_data.get("player_id")
        display_order = order_data.get("display_order")
        if player_id and display_order is not None:
            player = db.query(Player).filter(
                Player.id == player_id,
                Player.team_id == team_id
            ).first()
            if player:
                player.display_order = display_order
    db.commit()
    
    # 返回更新后的球员列表
    players = db.query(Player).filter(Player.team_id == team_id).order_by(Player.display_order.asc(), Player.number.asc()).all()
    return players


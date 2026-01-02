"""球员API路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Dict, Any
from app.database import get_db
from app.models.player import Player
from app.models.team import Team
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
async def get_team_players(team_id: int, db: Session = Depends(get_db)):
    """获取球队的所有球员，按display_order排序"""
    players = db.query(Player).filter(Player.team_id == team_id).order_by(Player.display_order.asc(), Player.number.asc()).all()
    return players


@router.get("/{player_id}", response_model=PlayerResponse)
async def get_player(player_id: int, db: Session = Depends(get_db)):
    """获取球员详情"""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="球员不存在")
    return player


@router.post("/", response_model=PlayerResponse)
async def create_player(player: PlayerCreate, db: Session = Depends(get_db)):
    """创建球员"""
    # 验证球队是否存在
    team = db.query(Team).filter(Team.id == player.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    db_player = Player(**player.model_dump())
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player


@router.put("/{player_id}", response_model=PlayerResponse)
async def update_player(player_id: int, player: PlayerCreate, db: Session = Depends(get_db)):
    """更新球员"""
    db_player = db.query(Player).filter(Player.id == player_id).first()
    if not db_player:
        raise HTTPException(status_code=404, detail="球员不存在")
    
    for key, value in player.model_dump().items():
        setattr(db_player, key, value)
    
    db.commit()
    db.refresh(db_player)
    return db_player


@router.delete("/{player_id}")
async def delete_player(player_id: int, db: Session = Depends(get_db)):
    """删除球员"""
    db_player = db.query(Player).filter(Player.id == player_id).first()
    if not db_player:
        raise HTTPException(status_code=404, detail="球员不存在")
    
    db.delete(db_player)
    db.commit()
    return {"message": "球员已删除"}


@router.put("/team/{team_id}/order")
async def update_player_order(
    team_id: int,
    player_orders: List[Dict[str, Any]],
    db: Session = Depends(get_db)
):
    """批量更新球员顺序"""
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


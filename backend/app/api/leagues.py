"""联赛API路由"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_serializer
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.league import League
from app.models.user import User
from app.core.dependencies import get_current_active_user, get_current_admin, get_current_league_id, get_current_role

router = APIRouter()


class LeagueCreate(BaseModel):
    """创建联赛请求模型"""
    name: str
    description: Optional[str] = None
    regular_season_name: str = "小组赛"
    playoff_name: str = "季后赛"


class LeagueUpdate(BaseModel):
    """更新联赛请求模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    regular_season_name: Optional[str] = None
    playoff_name: Optional[str] = None
    is_active: Optional[bool] = None


class LeagueResponse(BaseModel):
    """联赛响应模型"""
    id: int
    name: str
    description: Optional[str]
    regular_season_name: str
    playoff_name: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


@router.post("/", response_model=LeagueResponse)
async def create_league(
    league_data: LeagueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """创建新联赛（仅管理员）"""
    # 检查名称是否已存在
    existing_league = db.query(League).filter(League.name == league_data.name).first()
    if existing_league:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="League name already exists"
        )
    
    new_league = League(
        name=league_data.name,
        description=league_data.description,
        regular_season_name=league_data.regular_season_name,
        playoff_name=league_data.playoff_name
    )
    
    db.add(new_league)
    db.commit()
    db.refresh(new_league)
    
    return new_league


@router.get("/public", response_model=List[LeagueResponse])
async def get_public_leagues(db: Session = Depends(get_db)):
    """获取公开的联赛列表（用于注册时选择，不需要认证）"""
    leagues = db.query(League).filter(League.is_active == True).all()
    return leagues


@router.get("/", response_model=List[LeagueResponse])
async def get_leagues(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取联赛列表"""
    # 管理员可以看到所有联赛，其他用户只能看到自己的联赛
    current_role = get_current_role(current_user)
    
    if current_role == "admin":
        leagues = db.query(League).all()
    else:
        # 获取用户可访问的所有league IDs
        league_ids = set()
        
        # 从多对多关系获取
        if current_user.leagues:
            league_ids.update([league.id for league in current_user.leagues])
        
        # 从主league_id获取（向后兼容）
        if current_user.league_id:
            league_ids.add(current_user.league_id)
        
        if league_ids:
            leagues = db.query(League).filter(League.id.in_(list(league_ids))).all()
        else:
            leagues = []
    
    return leagues


@router.get("/{league_id}", response_model=LeagueResponse)
async def get_league(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取联赛详情"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League not found"
        )
    
    # 权限检查：管理员可以查看所有联赛，普通用户只能查看自己的联赛
    current_league_id = get_current_league_id(current_user)
    current_role = get_current_role(current_user)
    
    if current_role != "admin":
        # 如果用户切换了league，检查是否匹配
        if current_league_id and hasattr(current_user, '_temp_league_id') and current_user._temp_league_id is not None:
            if league_id != current_league_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not enough permissions"
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
                    detail="Not enough permissions"
                )
    
    return league


@router.put("/{league_id}", response_model=LeagueResponse)
async def update_league(
    league_id: int,
    league_data: LeagueUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """更新联赛（仅管理员）"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League not found"
        )
    
    # 更新字段
    if league_data.name is not None:
        # 检查新名称是否与其他联赛冲突
        existing = db.query(League).filter(
            League.name == league_data.name,
            League.id != league_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="League name already exists"
            )
        league.name = league_data.name
    
    if league_data.description is not None:
        league.description = league_data.description
    if league_data.regular_season_name is not None:
        league.regular_season_name = league_data.regular_season_name
    if league_data.playoff_name is not None:
        league.playoff_name = league_data.playoff_name
    if league_data.is_active is not None:
        league.is_active = league_data.is_active
    
    db.commit()
    db.refresh(league)
    
    return league


@router.delete("/{league_id}")
async def delete_league(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """删除联赛（仅管理员）"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League not found"
        )
    
    db.delete(league)
    db.commit()
    
    return {"message": "League deleted successfully"}


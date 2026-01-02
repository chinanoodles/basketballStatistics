"""球队API路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.team import Team
from pydantic import BaseModel

router = APIRouter()


class TeamCreate(BaseModel):
    """创建球队请求模型"""
    name: str
    logo: Optional[str] = None


class TeamResponse(BaseModel):
    """球队响应模型"""
    id: int
    name: str
    logo: Optional[str]

    class Config:
        from_attributes = True


@router.get("/", response_model=List[TeamResponse])
async def get_teams(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取所有球队"""
    teams = db.query(Team).offset(skip).limit(limit).all()
    return teams


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(team_id: int, db: Session = Depends(get_db)):
    """获取球队详情"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="球队不存在")
    return team


@router.post("/", response_model=TeamResponse)
async def create_team(team: TeamCreate, db: Session = Depends(get_db)):
    """创建球队"""
    db_team = Team(**team.model_dump())
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(team_id: int, team: TeamCreate, db: Session = Depends(get_db)):
    """更新球队"""
    db_team = db.query(Team).filter(Team.id == team_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    for key, value in team.model_dump().items():
        setattr(db_team, key, value)
    
    db.commit()
    db.refresh(db_team)
    return db_team


@router.delete("/{team_id}")
async def delete_team(team_id: int, db: Session = Depends(get_db)):
    """删除球队"""
    db_team = db.query(Team).filter(Team.id == team_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    db.delete(db_team)
    db.commit()
    return {"message": "球队已删除"}


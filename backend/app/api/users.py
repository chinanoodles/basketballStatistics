"""用户管理API路由（仅管理员）"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import User, UserRole
from app.models.league import League
from app.models.user_league import user_league_association
from app.core.dependencies import get_current_admin
from app.core.security import get_password_hash

router = APIRouter()


class UserUpdate(BaseModel):
    """更新用户请求模型"""
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    league_id: Optional[int] = None  # 主league（向后兼容）
    league_ids: Optional[List[int]] = None  # 多league支持
    is_active: Optional[bool] = None
    password: Optional[str] = None  # 可选，用于重置密码


class UserResponse(BaseModel):
    """用户响应模型"""
    id: int
    username: str
    email: Optional[str]
    role: str
    league_id: Optional[int]
    league_ids: Optional[List[int]] = None  # 多league支持
    is_active: bool
    created_at: str
    updated_at: Optional[str]

    class Config:
        from_attributes = True


@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    league_id: Optional[int] = None,
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取用户列表（仅管理员）"""
    query = db.query(User)
    
    # 按league_id筛选（支持多对多关系）
    if league_id is not None:
        # 查找所有关联到该league的用户（包括主league_id和多对多关系）
        query = query.join(
            user_league_association,
            User.id == user_league_association.c.user_id,
            isouter=True
        ).filter(
            or_(
                User.league_id == league_id,  # 主league_id匹配
                user_league_association.c.league_id == league_id  # 多对多关系匹配
            )
        ).distinct()
    
    # 按角色筛选
    if role:
        if role not in ["player", "team_admin", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role"
            )
        # 将小写角色转换为枚举值
        role_enum = UserRole.PLAYER if role == "player" else (
            UserRole.TEAM_ADMIN if role == "team_admin" else UserRole.ADMIN
        )
        query = query.filter(User.role == role_enum)
    
    users = query.offset(skip).limit(limit).all()
    # 转换角色值为小写返回给前端
    user_responses = []
    for user in users:
        # 获取用户的所有league IDs
        league_ids = [league.id for league in user.leagues] if user.leagues else []
        # 如果没有多对多关系，使用主league_id
        if not league_ids and user.league_id:
            league_ids = [user.league_id]
        
        user_response = UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            role=user.role.value.lower(),  # 转换为小写
            league_id=user.league_id,
            league_ids=league_ids if league_ids else None,
            is_active=user.is_active,
            created_at=user.created_at.isoformat() if user.created_at else "",
            updated_at=user.updated_at.isoformat() if user.updated_at else None
        )
        user_responses.append(user_response)
    return user_responses


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取用户详情（仅管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 返回用户响应对象
    # 获取用户的所有league IDs
    league_ids = [league.id for league in user.leagues] if user.leagues else []
    # 如果没有多对多关系，使用主league_id
    if not league_ids and user.league_id:
        league_ids = [user.league_id]
    
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role.value.lower(),  # 转换为小写
        league_id=user.league_id,
        league_ids=league_ids if league_ids else None,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else "",
        updated_at=user.updated_at.isoformat() if user.updated_at else None
    )
    return user_response


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """更新用户信息（仅管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 不能修改自己的角色（防止误操作）
    if user_id == current_user.id and user_data.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )
    
    # 更新字段
    if user_data.email is not None:
        # 检查邮箱是否已被其他用户使用
        existing = db.query(User).filter(
            User.email == user_data.email,
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        user.email = user_data.email
    
    if user_data.role is not None:
        if user_data.role not in ["player", "team_admin", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role"
            )
        user.role = UserRole.PLAYER if user_data.role == "player" else (
            UserRole.TEAM_ADMIN if user_data.role == "team_admin" else UserRole.ADMIN
        )
    
    # 处理多league支持
    if user_data.league_ids is not None:
        # 验证所有leagues是否存在
        if len(user_data.league_ids) > 0:
            leagues = db.query(League).filter(League.id.in_(user_data.league_ids)).all()
            if len(leagues) != len(user_data.league_ids):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="One or more leagues not found"
                )
            # 更新多对多关系
            user.leagues = leagues
            # 如果只有一个league，也更新主league_id（向后兼容）
            if len(user_data.league_ids) == 1:
                user.league_id = user_data.league_ids[0]
            else:
                # 如果有多个league，使用第一个作为主league_id
                user.league_id = user_data.league_ids[0]
        else:
            # 如果没有league，清空所有关联
            user.leagues = []
            user.league_id = None
    elif user_data.league_id is not None:
        # 向后兼容：如果只提供了league_id
        if user_data.league_id != 0:  # 0表示清除league关联
            league = db.query(League).filter(League.id == user_data.league_id).first()
            if not league:
                raise HTTPException(status_code=404, detail="League not found")
            user.league_id = user_data.league_id
            # 如果用户还没有这个league，添加到多对多关系
            if league not in user.leagues:
                user.leagues.append(league)
        else:
            user.league_id = None
            user.leagues = []
    
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    
    if user_data.password:
        from app.core.security import get_password_hash
        user.hashed_password = get_password_hash(user_data.password)
    
    db.commit()
    db.refresh(user)
    
    # 返回用户响应对象
    # 获取用户的所有league IDs
    league_ids = [league.id for league in user.leagues] if user.leagues else []
    # 如果没有多对多关系，使用主league_id
    if not league_ids and user.league_id:
        league_ids = [user.league_id]
    
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role.value.lower(),  # 转换为小写
        league_id=user.league_id,
        league_ids=league_ids if league_ids else None,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else "",
        updated_at=user.updated_at.isoformat() if user.updated_at else None
    )
    
    return user_response


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """删除用户（仅管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 不能删除自己
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted successfully"}


class BatchEnrollRequest(BaseModel):
    """批量enroll请求模型"""
    user_ids: List[int]
    league_id: int


@router.post("/batch-enroll", response_model=dict)
async def batch_enroll_users(
    request: BatchEnrollRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """批量将用户enroll到league（仅管理员）"""
    # 验证league是否存在
    league = db.query(League).filter(League.id == request.league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # 验证所有用户是否存在
    users = db.query(User).filter(User.id.in_(request.user_ids)).all()
    if len(users) != len(request.user_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more users not found"
        )
    
    # 批量enroll
    enrolled_count = 0
    for user in users:
        # 如果用户还没有这个league，添加到多对多关系
        if league not in user.leagues:
            user.leagues.append(league)
            enrolled_count += 1
        # 如果用户没有主league_id，设置这个league为主league
        if not user.league_id:
            user.league_id = request.league_id
    
    db.commit()
    
    return {
        "message": f"Successfully enrolled {enrolled_count} users to league {league.name}",
        "enrolled_count": enrolled_count,
        "total_users": len(users)
    }


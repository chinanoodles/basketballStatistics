"""依赖注入"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """获取当前登录用户（支持从token中读取选择的league_id和role）"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
    
    # 如果token中有选择的league_id和role，临时设置到user对象上
    # 注意：这不会修改数据库，只是临时设置用于权限检查
    if "league_id" in payload:
        user._temp_league_id = payload.get("league_id")
    if "role" in payload:
        user._temp_role = payload.get("role")
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """获取当前活跃用户"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
    return current_user


async def get_current_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """获取当前管理员用户"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_current_team_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """获取当前球队管理员或系统管理员"""
    if current_user.role not in [UserRole.TEAM_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Team admin or admin required."
        )
    return current_user


def get_current_league_id(user: User) -> Optional[int]:
    """获取当前使用的league_id（优先使用token中的临时值）"""
    temp_league_id = getattr(user, '_temp_league_id', None)
    if temp_league_id is not None:
        return temp_league_id
    return user.league_id


def get_current_role(user: User) -> str:
    """获取当前使用的role（优先使用token中的临时值）"""
    temp_role = getattr(user, '_temp_role', None)
    if temp_role:
        return temp_role
    return user.role.value


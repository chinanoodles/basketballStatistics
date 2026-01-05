"""认证API路由"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import timedelta
from app.database import get_db
from app.models.user import User, UserRole
from app.models.league import League
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.core.dependencies import get_current_active_user

router = APIRouter()


class UserCreate(BaseModel):
    """用户注册请求模型"""
    username: str
    email: Optional[EmailStr] = None
    password: str
    role: str = "player"  # 默认角色为球员
    league_id: Optional[int] = None


class UserResponse(BaseModel):
    """用户响应模型"""
    id: int
    username: str
    email: Optional[str]
    role: str
    league_id: Optional[int]
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    """令牌响应模型"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseModel):
    """登录请求模型"""
    username: str
    password: str
    league_id: Optional[int] = None  # 选择的联赛ID
    role: Optional[str] = None  # 选择的角色（player/team_admin）


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """用户注册"""
    # 检查用户名是否已存在
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # 检查邮箱是否已存在
    if user_data.email:
        existing_email = db.query(User).filter(User.email == user_data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # 如果指定了league_id，验证league是否存在
    if user_data.league_id:
        league = db.query(League).filter(League.id == user_data.league_id).first()
        if not league:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="League not found"
            )
    
    # 验证角色
    valid_roles = ["player", "team_admin"]
    if user_data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )
    
    # 创建新用户
    hashed_password = get_password_hash(user_data.password)
    user_role = UserRole.PLAYER if user_data.role == "player" else UserRole.TEAM_ADMIN
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role=user_role,
        league_id=user_data.league_id
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 返回用户响应对象
    user_response = UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        role=new_user.role.value,
        league_id=new_user.league_id,
        is_active=new_user.is_active
    )
    
    return user_response


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """用户登录（支持选择league和角色）"""
    user = db.query(User).filter(User.username == login_data.username).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
    
    # 如果是管理员，不需要选择league和角色，直接使用默认值
    if user.role.value == "admin":
        selected_league_id = user.league_id  # 管理员可以使用默认league_id，也可以访问所有league
        selected_role = user.role.value  # 管理员使用admin角色
    else:
        # 非管理员：league和role都是可选的
        # 如果提供了league_id，验证用户是否有权限访问
        if login_data.league_id:
            selected_league_id = login_data.league_id
            league = db.query(League).filter(League.id == selected_league_id).first()
            if not league:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Selected league not found"
                )
            # 验证用户是否有权限访问该league（检查多对多关系和主league_id）
            has_access = (
                selected_league_id in [l.id for l in user.leagues] or 
                user.league_id == selected_league_id
            )
            if not has_access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User does not have access to this league"
                )
        else:
            # 如果没有提供league_id，使用用户的第一个league（如果有）
            if user.leagues:
                selected_league_id = user.leagues[0].id
            elif user.league_id:
                selected_league_id = user.league_id
            else:
                # 用户没有任何league，允许登录但不设置league_id
                selected_league_id = None
        
        # 验证选择的角色（可选）
        if login_data.role:
            selected_role = login_data.role
            if selected_role not in ["player", "team_admin"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid role. Must be 'player' or 'team_admin'"
                )
            # 验证用户是否有该角色权限
            if user.role.value != selected_role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User does not have '{selected_role}' role"
                )
        else:
            # 如果没有提供role，使用用户的默认role
            selected_role = user.role.value
    
    # 创建访问令牌（包含选择的league_id和role）
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.username,
            "role": selected_role,  # 使用选择的角色
            "league_id": selected_league_id,  # 使用选择的league_id
            "user_id": user.id,
            "original_role": user.role.value  # 保存原始角色
        },
        expires_delta=access_token_expires
    )
    
    # 构建用户响应对象（使用选择的league_id和role）
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=selected_role,  # 使用选择的角色
        league_id=selected_league_id,  # 使用选择的league_id
        is_active=user.is_active
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }


@router.get("/my-leagues")
async def get_my_leagues(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取当前用户可访问的所有leagues"""
    # 管理员可以看到所有leagues
    if current_user.role == UserRole.ADMIN:
        leagues = db.query(League).filter(League.is_active == True).all()
    else:
        # 普通用户：从多对多关系和主league_id获取
        league_ids = set()
        
        # 从多对多关系获取
        if current_user.leagues:
            league_ids.update([league.id for league in current_user.leagues])
        
        # 从主league_id获取（向后兼容）
        if current_user.league_id:
            league_ids.add(current_user.league_id)
        
        if not league_ids:
            return []
        
        leagues = db.query(League).filter(
            League.id.in_(list(league_ids)),
            League.is_active == True
        ).all()
    
    return [{"id": league.id, "name": league.name, "description": league.description} for league in leagues]


class SwitchLeagueRequest(BaseModel):
    """切换league请求模型"""
    league_id: int
    role: Optional[str] = None


@router.post("/switch-league")
async def switch_league(
    request: SwitchLeagueRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """切换当前用户的league（更新token）"""
    from app.core.dependencies import get_current_league_id, get_current_role
    
    league_id = request.league_id
    role = request.role
    
    # 验证league是否存在
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League not found"
        )
    
    # 检查用户是否有权限访问该league
    if current_user.role != UserRole.ADMIN:
        # 检查多对多关系
        has_access = league_id in [l.id for l in current_user.leagues]
        # 检查主league_id（向后兼容）
        if not has_access and current_user.league_id == league_id:
            has_access = True
        
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this league"
            )
    
    # 确定要使用的role
    selected_role = role
    if not selected_role:
        # 如果没有指定role，使用当前token中的role或用户的默认role
        current_role = get_current_role(current_user)
        selected_role = current_role if current_role != "admin" else current_user.role.value
    else:
        # 验证role
        if selected_role not in ["player", "team_admin"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role. Must be 'player' or 'team_admin'"
            )
        # 验证用户是否有该角色权限
        if current_user.role.value != selected_role and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have '{selected_role}' role"
            )
    
    # 创建新的访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": current_user.username,
            "role": selected_role,
            "league_id": league_id,
            "user_id": current_user.id,
            "original_role": current_user.role.value
        },
        expires_delta=access_token_expires
    )
    
    # 构建用户响应对象
    user_response = UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=selected_role,
        league_id=league_id,
        is_active=current_user.is_active
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """获取当前用户信息"""
    return current_user


class EnrollLeagueRequest(BaseModel):
    """加入league请求模型"""
    league_id: int


@router.post("/enroll-league")
async def enroll_league(
    request: EnrollLeagueRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """用户加入联赛"""
    league_id = request.league_id
    
    # 验证league是否存在
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League not found"
        )
    
    # 检查用户是否已经加入该league
    if league in current_user.leagues:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already enrolled in this league"
        )
    
    # 添加league到用户的多对多关系
    current_user.leagues.append(league)
    
    # 如果用户没有主league_id，设置第一个加入的league为主league
    if not current_user.league_id:
        current_user.league_id = league_id
    
    db.commit()
    db.refresh(current_user)
    
    return {"message": f"Successfully enrolled in league: {league.name}"}


@router.delete("/enroll-league/{league_id}")
async def unenroll_league(
    league_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """用户退出联赛"""
    # 验证league是否存在
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League not found"
        )
    
    # 检查用户是否在该league中
    if league not in current_user.leagues:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not enrolled in this league"
        )
    
    # 从多对多关系中移除
    current_user.leagues.remove(league)
    
    # 如果这是主league_id，需要更新
    if current_user.league_id == league_id:
        if current_user.leagues:
            # 如果有其他league，使用第一个作为主league
            current_user.league_id = current_user.leagues[0].id
        else:
            # 如果没有其他league，清空主league_id
            current_user.league_id = None
    
    db.commit()
    
    return {"message": f"Successfully unenrolled from league: {league.name}"}


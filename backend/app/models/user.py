"""用户数据模型"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Enum, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database.base import Base
from app.models.user_league import user_league_association


class UserRole(str, enum.Enum):
    """用户角色"""
    PLAYER = "player"  # 球员：只能查看比赛记录和技术统计
    TEAM_ADMIN = "team_admin"  # 球队管理员：可以管理球队和球员
    ADMIN = "admin"  # 系统管理员：可以管理所有内容


class User(Base):
    """用户模型"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.PLAYER, nullable=False)
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=True, index=True)  # 所属联赛
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    league = relationship("League", back_populates="users", foreign_keys=[league_id])  # 主联赛（向后兼容）
    leagues = relationship("League", secondary=user_league_association, back_populates="members")  # 多对多关系

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"


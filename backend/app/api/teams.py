"""球队API路由"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.team import Team
from app.models.user import User
from app.models.league import League
from app.core.dependencies import get_current_active_user, get_current_admin
from pydantic import BaseModel

router = APIRouter()


class TeamCreate(BaseModel):
    """创建球队请求模型"""
    name: str
    logo: Optional[str] = None
    league_id: Optional[int] = None  # 如果未指定，使用当前用户的league_id
    team_admin_id: Optional[int] = None  # 所属领队（仅管理员可设置）


class TeamResponse(BaseModel):
    """球队响应模型"""
    id: int
    name: str
    logo: Optional[str]
    league_id: int
    team_admin_id: Optional[int] = None
    team_admin_name: Optional[str] = None  # 领队用户名（用于显示）

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
    # 转换为TeamResponse格式
    team_responses = []
    for team in teams:
        team_admin_name = None
        if team.team_admin_id:
            team_admin = db.query(User).filter(User.id == team.team_admin_id).first()
            if team_admin:
                team_admin_name = team_admin.username
        team_responses.append(TeamResponse(
            id=team.id,
            name=team.name,
            logo=team.logo,
            league_id=team.league_id,
            team_admin_id=team.team_admin_id,
            team_admin_name=team_admin_name
        ))
    return team_responses


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
    # team_admin可以查看自己管理的球队，即使不在同一个league
    if current_user.role.value == "admin":
        pass  # 管理员可以查看所有球队
    elif current_user.role.value == "team_admin":
        # team_admin可以查看自己管理的球队或自己league的球队
        if team.team_admin_id != current_user.id and team.league_id != current_user.league_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限访问此球队"
            )
    else:
        # player只能查看自己league的球队
        if team.league_id != current_user.league_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限访问此球队"
            )
    
    # 添加领队信息
    team_admin_name = None
    if team.team_admin_id:
        team_admin = db.query(User).filter(User.id == team.team_admin_id).first()
        if team_admin:
            team_admin_name = team_admin.username
    
    return TeamResponse(
        id=team.id,
        name=team.name,
        logo=team.logo,
        league_id=team.league_id,
        team_admin_id=team.team_admin_id,
        team_admin_name=team_admin_name
    )


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
    
    # 权限检查：team_admin只能修改自己管理的球队，管理员可以修改所有球队
    if current_user.role.value == "admin":
        pass  # 管理员可以修改所有球队
    elif current_user.role.value == "team_admin":
        # team_admin只能修改自己管理的球队
        if db_team.team_admin_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限修改此球队，只能修改自己管理的球队"
            )
    else:
        # player不能修改球队
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="球员没有权限修改球队"
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
    
    # 更新team_admin_id（仅管理员可以修改）
    if team.team_admin_id is not None:
        if current_user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只有管理员可以修改球队领队"
            )
        # 验证用户是否存在且是team_admin
        if team.team_admin_id != 0:  # 0表示清除领队
            team_admin_user = db.query(User).filter(User.id == team.team_admin_id).first()
            if not team_admin_user:
                raise HTTPException(status_code=404, detail="指定的领队用户不存在")
            if team_admin_user.role.value != "team_admin":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="指定的用户不是领队"
                )
            db_team.team_admin_id = team.team_admin_id
        else:
            db_team.team_admin_id = None
    elif current_user.role.value == "admin":
        # 管理员更新时，如果没有提供team_admin_id，保持原值不变
        pass
    
    db.commit()
    db.refresh(db_team)
    
    # 返回响应
    team_admin_name = None
    if db_team.team_admin_id:
        team_admin = db.query(User).filter(User.id == db_team.team_admin_id).first()
        if team_admin:
            team_admin_name = team_admin.username
    
    return TeamResponse(
        id=db_team.id,
        name=db_team.name,
        logo=db_team.logo,
        league_id=db_team.league_id,
        team_admin_id=db_team.team_admin_id,
        team_admin_name=team_admin_name
    )


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


class BatchChangeLeagueRequest(BaseModel):
    """批量修改联赛请求模型"""
    team_ids: List[int]
    league_id: int


class BatchChangeTeamAdminRequest(BaseModel):
    """批量修改领队请求模型"""
    team_ids: List[int]
    team_admin_id: Optional[int] = None  # None表示保持现有设置，0表示清除领队


@router.post("/batch-change-league", response_model=dict)
async def batch_change_league(
    request: BatchChangeLeagueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """批量修改球队所属联赛（仅管理员）"""
    # 验证league是否存在
    league = db.query(League).filter(League.id == request.league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # 验证所有球队是否存在
    teams = db.query(Team).filter(Team.id.in_(request.team_ids)).all()
    if len(teams) != len(request.team_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more teams not found"
        )
    
    # 批量修改league_id
    updated_count = 0
    for team in teams:
        if team.league_id != request.league_id:
            team.league_id = request.league_id
            updated_count += 1
    
    db.commit()
    
    return {
        "message": f"Successfully changed {updated_count} teams to league {league.name}",
        "updated_count": updated_count,
        "total_teams": len(teams)
    }


@router.post("/batch-change-team-admin", response_model=dict)
async def batch_change_team_admin(
    request: BatchChangeTeamAdminRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """批量修改球队领队（仅管理员）"""
    # 验证所有球队是否存在
    teams = db.query(Team).filter(Team.id.in_(request.team_ids)).all()
    if len(teams) != len(request.team_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more teams not found"
        )
    
    # 如果提供了team_admin_id，验证用户是否存在且是team_admin
    if request.team_admin_id is not None and request.team_admin_id != 0:
        team_admin_user = db.query(User).filter(User.id == request.team_admin_id).first()
        if not team_admin_user:
            raise HTTPException(status_code=404, detail="指定的领队用户不存在")
        if team_admin_user.role.value != "team_admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="指定的用户不是领队"
            )
    
    # 批量修改team_admin_id
    updated_count = 0
    for team in teams:
        if request.team_admin_id is None:
            # 保持现有设置，不修改
            continue
        elif request.team_admin_id == 0:
            # 清除领队
            if team.team_admin_id is not None:
                team.team_admin_id = None
                updated_count += 1
        else:
            # 设置新领队
            if team.team_admin_id != request.team_admin_id:
                team.team_admin_id = request.team_admin_id
                updated_count += 1
    
    db.commit()
    
    if request.team_admin_id is None:
        message = f"已保持 {len(teams)} 个球队的现有领队设置"
    elif request.team_admin_id == 0:
        message = f"成功清除 {updated_count} 个球队的领队"
    else:
        team_admin_name = db.query(User).filter(User.id == request.team_admin_id).first().username
        message = f"成功将 {updated_count} 个球队的领队设置为 {team_admin_name}"
    
    return {
        "message": message,
        "updated_count": updated_count,
        "total_teams": len(teams)
    }


@router.get("/{team_id}/statistics")
async def get_team_statistics(
    team_id: int,
    season_type: Optional[str] = Query(None, description="赛季类型: regular 或 playoff"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取球队的统计数据"""
    from app.models.statistic import Statistic
    from app.models.game import Game, SeasonType
    from app.models.player import Player
    
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="球队不存在")
    
    # 权限检查：team_admin可以查看自己管理的球队，管理员可以查看所有球队
    if current_user.role.value == "admin":
        pass  # 管理员可以查看所有球队
    elif current_user.role.value == "team_admin":
        # team_admin可以查看自己管理的球队或自己league的球队
        if team.team_admin_id != current_user.id and team.league_id != current_user.league_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限访问此球队统计"
            )
    else:
        # player只能查看自己league的球队
        if team.league_id != current_user.league_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限访问此球队统计"
            )
    
    # 获取球队的所有球员
    players = db.query(Player).filter(Player.team_id == team_id).all()
    player_ids = [p.id for p in players]
    
    if not player_ids:
        return {
            "team_id": team_id,
            "team_name": team.name,
            "total_games": 0,
            "total_stats": 0,
            "players": []
        }
    
    # 获取球队参与的所有比赛
    # 与统计页面保持一致：只统计finished状态的比赛
    games_query = db.query(Game).filter(
        (Game.home_team_id == team_id) | (Game.away_team_id == team_id),
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
        return {
            "team_id": team_id,
            "team_name": team.name,
            "total_games": 0,
            "total_stats": 0,
            "players": []
        }
    
    # 获取所有统计数据（只统计该球队球员的数据）
    stats = db.query(Statistic).filter(
        Statistic.player_id.in_(player_ids),
        Statistic.game_id.in_(game_ids)
    ).all()
    
    # 只统计有统计数据的比赛
    games_with_stats = set(s.game_id for s in stats)
    games = [g for g in games if g.id in games_with_stats]
    game_ids = [g.id for g in games]
    
    # 重新获取统计数据（只包含有统计数据的比赛）
    if game_ids:
        stats = db.query(Statistic).filter(
            Statistic.player_id.in_(player_ids),
            Statistic.game_id.in_(game_ids)
        ).all()
    
    # 按球员汇总统计，并记录每个球员参与的比赛场次
    player_stats = {}
    player_games = {}  # 记录每个球员参与的比赛场次
    
    for stat in stats:
        if stat.player_id not in player_stats:
            player_stats[stat.player_id] = {
                "player_id": stat.player_id,
                "2PM": 0, "2PA": 0, "3PM": 0, "3PA": 0,
                "FTM": 0, "FTA": 0, "OREB": 0, "DREB": 0,
                "AST": 0, "STL": 0, "BLK": 0, "TOV": 0, "PF": 0, "PFD": 0,
                "shots": []  # 投篮点位
            }
            player_games[stat.player_id] = set()
        
        action = stat.action_type
        if action in player_stats[stat.player_id]:
            player_stats[stat.player_id][action] += 1
        
        # 记录该球员参与的比赛
        player_games[stat.player_id].add(stat.game_id)
        
        # 记录投篮点位（如果有坐标）
        if action in ["2PM", "2PA", "3PM", "3PA"] and stat.shot_x is not None and stat.shot_y is not None:
            player_stats[stat.player_id]["shots"].append({
                "x": stat.shot_x,
                "y": stat.shot_y,
                "made": action in ["2PM", "3PM"],
                "type": "2P" if action in ["2PM", "2PA"] else "3P"
            })
    
    # 计算+/-值和比赛时长（基于play-by-play数据）
    player_plus_minus = {}  # 记录每个球员的+/-值
    player_minutes = {}  # 记录每个球员的总比赛时长（秒）
    
    from app.models.player_time import PlayerTime
    from datetime import datetime
    
    for game in games:
        try:
            # 判断该球队是主队还是客队
            is_home_team = (game.home_team_id == team_id)
            
            # 获取该球队的球员ID（只统计该球队的球员）
            team_player_ids = set(p.id for p in players)
            
            # 获取该场比赛的所有统计数据，按时间戳排序
            game_stats = db.query(Statistic).filter(
                Statistic.game_id == game.id
            ).order_by(Statistic.timestamp).all()
            
            # 获取主队和客队的所有球员（用于计算得分）
            from app.models.player import Player as PlayerModel
            home_team_players = db.query(PlayerModel).filter(PlayerModel.team_id == game.home_team_id).all()
            away_team_players = db.query(PlayerModel).filter(PlayerModel.team_id == game.away_team_id).all()
            home_player_ids = set(p.id for p in home_team_players)
            away_player_ids = set(p.id for p in away_team_players)
            
            # 获取球员上场时间记录
            player_times = db.query(PlayerTime).filter(
                PlayerTime.game_id == game.id,
                PlayerTime.player_id.in_(list(team_player_ids))
            ).order_by(PlayerTime.enter_time).all()
            
            # 构建球员在场时间区间
            player_on_court = {}  # {player_id: [(enter_time, exit_time), ...]}
            # 获取比赛的最后统计数据时间作为比赛结束时间
            last_stat_time = None
            if game_stats:
                last_stat_time = max(s.timestamp for s in game_stats)
            
            for pt in player_times:
                if pt.player_id not in player_on_court:
                    player_on_court[pt.player_id] = []
                # 如果还在场上，使用最后统计数据的时间或当前时间
                exit_time = pt.exit_time if pt.exit_time else (last_stat_time if last_stat_time else datetime.now())
                player_on_court[pt.player_id].append((pt.enter_time, exit_time))
            
            # 计算每个球员的总比赛时长
            for player_id in team_player_ids:
                if player_id not in player_minutes:
                    player_minutes[player_id] = 0
                if player_id in player_on_court:
                    for enter_time, exit_time in player_on_court[player_id]:
                        duration = (exit_time - enter_time).total_seconds()
                        player_minutes[player_id] += duration
            
            # 初始化+/-值
            for player_id in team_player_ids:
                if player_id not in player_plus_minus:
                    player_plus_minus[player_id] = 0
            
            # 按时间顺序遍历统计数据，计算+/-值
            # 记录每个时刻的得分
            home_score = 0
            away_score = 0
            prev_home_score = 0
            prev_away_score = 0
            
            for stat in game_stats:
                prev_home_score = home_score
                prev_away_score = away_score
                
                # 更新比分
                if stat.action_type == '2PM':
                    if stat.player_id in home_player_ids:
                        home_score += 2
                    elif stat.player_id in away_player_ids:
                        away_score += 2
                elif stat.action_type == '3PM':
                    if stat.player_id in home_player_ids:
                        home_score += 3
                    elif stat.player_id in away_player_ids:
                        away_score += 3
                elif stat.action_type == 'FTM':
                    if stat.player_id in home_player_ids:
                        home_score += 1
                    elif stat.player_id in away_player_ids:
                        away_score += 1
                
                # 计算得分变化
                home_score_change = home_score - prev_home_score
                away_score_change = away_score - prev_away_score
                
                # 如果得分有变化，更新在场球员的+/-值
                if home_score_change != 0 or away_score_change != 0:
                    # 对于该球队的每个在场球员，更新+/-值
                    for player_id in team_player_ids:
                        if player_id in player_on_court:
                            # 检查该球员在此时刻是否在场
                            is_on_court = False
                            for enter_time, exit_time in player_on_court[player_id]:
                                if enter_time <= stat.timestamp <= exit_time:
                                    is_on_court = True
                                    break
                            
                            if is_on_court:
                                # 计算得分差变化
                                if is_home_team:
                                    # 该球队是主队：主队得分增加，+/-值增加；客队得分增加，+/-值减少
                                    score_change = home_score_change - away_score_change
                                    player_plus_minus[player_id] += score_change
                                else:
                                    # 该球队是客队：客队得分增加，+/-值增加；主队得分增加，+/-值减少
                                    score_change = away_score_change - home_score_change
                                    player_plus_minus[player_id] += score_change
        except Exception as e:
            import traceback
            traceback.print_exc()
            pass  # 如果计算失败，跳过
    
    # 转换为列表并添加球员信息，计算EFF和PIR
    result = []
    for player_id, stats_data in player_stats.items():
        player = next((p for p in players if p.id == player_id), None)
        if player:
            games_count = len(player_games.get(player_id, set()))
            
            # 计算基础数据
            points = stats_data['2PM'] * 2 + stats_data['3PM'] * 3 + stats_data['FTM']
            fgm = stats_data['2PM'] + stats_data['3PM']
            fga = stats_data['2PA'] + stats_data['3PA']
            fg3m = stats_data['3PM']
            fg3a = stats_data['3PA']
            ftm = stats_data['FTM']
            fta = stats_data['FTA']
            reb = stats_data['OREB'] + stats_data['DREB']
            ast = stats_data['AST']
            stl = stats_data['STL']
            blk = stats_data['BLK']
            tov = stats_data['TOV']
            pf = stats_data['PF']
            pfd = stats_data['PFD']
            
            # 计算EFF = ((PTS + REB + AST + STL + BLK) - ((FGA - FGM) + (FTA - FTM) + TOV))
            positive_stats = points + reb + ast + stl + blk
            negative_stats = (fga - fgm) + (fta - ftm) + tov
            eff = positive_stats - negative_stats
            
            # 计算PIR = ((PTS + REB + AST + STL + BLK + PFD) - ((FGA - FGM) + (FTA - FTM) + TOV + PF))
            positive_stats_pir = points + reb + ast + stl + blk + pfd
            negative_stats_pir = (fga - fgm) + (fta - ftm) + tov + pf
            pir = positive_stats_pir - negative_stats_pir
            
            # 获取+/-值
            plus_minus = player_plus_minus.get(player_id, 0)
            
            # 获取比赛时长（秒）
            total_seconds = player_minutes.get(player_id, 0)
            minutes = int(total_seconds // 60)
            seconds = int(total_seconds % 60)
            
            result.append({
                "player_id": player_id,
                "player_name": player.name,
                "player_number": player.number,
                "games_played": games_count,
                "minutes": total_seconds,  # 总秒数，用于排序和计算
                "minutes_display": f"{minutes}:{seconds:02d}",  # 格式化显示
                "points": points,
                "fgm": fgm,
                "fga": fga,
                "fg3m": fg3m,
                "fg3a": fg3a,
                "ftm": ftm,
                "fta": fta,
                "reb": reb,
                "ast": ast,
                "stl": stl,
                "blk": blk,
                "tov": tov,
                "pf": pf,
                "pfd": pfd,
                "eff": eff,
                "pir": pir,
                "plus_minus": plus_minus,
                **stats_data
            })
    
    return {
        "team_id": team_id,
        "team_name": team.name,
        "total_games": len(games),
        "total_stats": len(stats),
        "players": result
    }


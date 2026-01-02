# 代码规范和开发规则

## 1. Python代码规范

### 1.1 代码风格
- 遵循 **PEP 8** 规范
- 使用 **Black** 进行代码格式化（行长度：100字符）
- 使用 **isort** 进行导入排序
- 使用 **flake8** 进行代码检查

### 1.2 命名规范
- **文件名**: 使用小写字母和下划线，如 `game_service.py`
- **类名**: 使用大驼峰命名，如 `GameService`
- **函数/方法名**: 使用小写字母和下划线，如 `get_game_statistics`
- **常量**: 使用大写字母和下划线，如 `MAX_PLAYERS`
- **私有方法**: 使用单下划线前缀，如 `_validate_team`

### 1.3 类型提示
- 所有函数必须包含类型提示
- 使用 `typing` 模块的类型注解
- 示例：
```python
from typing import List, Optional
from datetime import datetime

def get_players(team_id: int) -> List[Player]:
    """获取球队的所有球员"""
    pass
```

### 1.4 文档字符串
- 所有公共函数、类、模块必须包含docstring
- 使用Google风格docstring
- 示例：
```python
def calculate_efficiency(player_stats: PlayerStats) -> float:
    """计算球员效率值(EFF)
    
    Args:
        player_stats: 球员统计数据对象
        
    Returns:
        计算得到的效率值
        
    Raises:
        ValueError: 当统计数据无效时
    """
    pass
```

## 2. 前端代码规范

### 2.1 代码风格
- 使用 **ESLint** 和 **Prettier** 进行代码格式化
- 遵循 **Airbnb JavaScript Style Guide**

### 2.2 命名规范
- **组件文件**: 使用大驼峰命名，如 `GameStatistics.tsx`
- **组件名**: 与文件名一致
- **函数/变量**: 使用小驼峰命名，如 `getPlayerStats`
- **常量**: 使用大写字母和下划线，如 `MAX_QUARTERS`
- **私有方法**: 使用下划线前缀，如 `_handleDragStart`

### 2.3 TypeScript规范
- 所有函数必须包含类型注解
- 避免使用 `any` 类型
- 使用接口定义数据结构
- 示例：
```typescript
interface Player {
  id: number;
  name: string;
  number: number;
  teamId: number;
}

const getPlayers = async (teamId: number): Promise<Player[]> => {
  // ...
};
```

### 2.4 组件结构
```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';

// 2. Types/Interfaces
interface Props {
  // ...
}

// 3. Component
const ComponentName: React.FC<Props> = ({ ... }) => {
  // 4. Hooks
  // 5. State
  // 6. Functions
  // 7. Effects
  // 8. Render
  return (...);
};

export default ComponentName;
```

## 3. Git工作流

### 3.1 分支策略
- `main` - 主分支，生产环境代码
- `develop` - 开发分支
- `feature/功能名` - 功能分支
- `fix/问题描述` - 修复分支

### 3.2 提交信息规范
使用约定式提交（Conventional Commits）：
- `feat:` 新功能
- `fix:` 修复bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具相关

示例：
```
feat: 添加拖拽球员记录统计功能
fix: 修复比赛时间计算错误
docs: 更新API文档
```

## 4. 测试规范

### 4.1 测试覆盖率
- 后端核心业务逻辑：≥80%
- 前端关键组件：≥70%

### 4.2 测试文件命名
- Python: `test_模块名.py`
- TypeScript: `组件名.test.tsx`

### 4.3 测试结构
```python
# test_game_service.py
import pytest
from app.services.game_service import GameService

class TestGameService:
    def test_create_game_success(self):
        """测试成功创建比赛"""
        pass
    
    def test_create_game_invalid_teams(self):
        """测试无效球队创建比赛"""
        pass
```

## 5. 错误处理

### 5.1 异常处理
- 使用具体的异常类型，避免使用裸露的 `except:`
- 记录异常日志
- 返回用户友好的错误信息

```python
from fastapi import HTTPException

async def get_game(game_id: int) -> Game:
    game = await db.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="比赛不存在")
    return game
```

### 5.2 日志规范
- 使用Python `logging` 模块
- 日志级别：DEBUG, INFO, WARNING, ERROR, CRITICAL
- 包含上下文信息（用户ID、请求ID等）

## 6. 数据库规范

### 6.1 表命名
- 使用复数形式，如 `teams`, `players`, `games`
- 关联表使用下划线连接，如 `game_players`

### 6.2 字段命名
- 使用小写字母和下划线
- 主键统一使用 `id`
- 外键使用 `表名_id`，如 `team_id`
- 时间字段：`created_at`, `updated_at`

### 6.3 索引
- 外键字段必须建立索引
- 经常查询的字段建立索引
- 联合查询字段建立联合索引

## 7. API设计规范

### 7.1 RESTful API
- 使用标准HTTP方法：GET, POST, PUT, DELETE
- 使用复数名词作为资源路径
- 使用HTTP状态码表示结果

### 7.2 响应格式
```json
{
  "success": true,
  "data": {...},
  "message": "操作成功"
}
```

错误响应：
```json
{
  "success": false,
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "比赛不存在"
  }
}
```

### 7.3 版本控制
- API版本通过URL路径控制：`/api/v1/...`

## 8. 安全规范

### 8.1 数据验证
- 所有用户输入必须验证
- 使用Pydantic进行数据验证
- 防止SQL注入（使用ORM）
- 防止XSS攻击（前端转义）

### 8.2 敏感信息
- 不在代码中硬编码密钥
- 使用环境变量管理配置
- 敏感数据加密存储

## 9. 性能规范

### 9.1 数据库查询
- 避免N+1查询问题
- 使用批量查询
- 合理使用缓存

### 9.2 前端优化
- 组件懒加载
- 图片优化和懒加载
- 合理使用React.memo和useMemo

## 10. 文档规范

### 10.1 代码注释
- 复杂逻辑必须添加注释
- 注释说明"为什么"而不是"是什么"

### 10.2 API文档
- 使用FastAPI自动生成文档
- 为每个端点添加详细描述
- 包含请求/响应示例


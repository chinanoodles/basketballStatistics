#!/bin/bash
# 数据库备份脚本

BACKUP_DIR="./backups"
DB_FILE="backend/database/basketball.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/basketball_${TIMESTAMP}.db"

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 检查数据库文件是否存在
if [ ! -f "${DB_FILE}" ]; then
    echo "❌ 数据库文件不存在: ${DB_FILE}"
    exit 1
fi

# 备份数据库
echo "📦 正在备份数据库..."
cp "${DB_FILE}" "${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    echo "✅ 备份成功: ${BACKUP_FILE}"
    
    # 显示备份文件大小
    echo "📊 备份文件大小: $(du -h ${BACKUP_FILE} | cut -f1)"
    
    # 压缩备份（可选，取消注释以启用）
    # gzip "${BACKUP_FILE}"
    # echo "✅ 压缩完成: ${BACKUP_FILE}.gz"
    
    # 删除7天前的备份（可选，取消注释以启用）
    # find ${BACKUP_DIR} -name "basketball_*.db" -mtime +7 -delete
    # echo "🗑️  已删除7天前的备份"
    
    echo ""
    echo "💡 提示："
    echo "   - 备份文件位置: ${BACKUP_FILE}"
    echo "   - 要上传到服务器，使用: scp ${BACKUP_FILE} user@server:/path/to/backend/database/basketball.db"
else
    echo "❌ 备份失败"
    exit 1
fi



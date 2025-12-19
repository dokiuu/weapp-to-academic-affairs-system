const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

// 清理60天前的帖子
exports.main = async (event, context) => {
  try {
    // 计算60天前的时间
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 90)
    
    console.log('清理时间点:', sixtyDaysAgo.toISOString())
    
    // 查询并删除60天前的帖子
    const result = await db.collection('posts')
      .where({
        createTime: _.lt(sixtyDaysAgo)
      })
      .remove()
    
    console.log('清理结果:', result)
    
    return {
      code: 200,
      message: '清理成功',
      data: {
        deletedCount: result.stats.removed,
        cleanBefore: sixtyDaysAgo.toISOString()
      }
    }
    
  } catch (error) {
    console.error('清理失败:', error)
    return {
      code: 500,
      message: '清理失败',
      error: error.message
    }
  }
}
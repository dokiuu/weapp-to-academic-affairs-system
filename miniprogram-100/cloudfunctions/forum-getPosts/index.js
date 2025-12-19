// cloudfunctions/forum-getPosts/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const db = cloud.database()
  const { zoneId = '', page = 1, size = 9 } = event

  try {
    console.log('开始获取帖子列表，参数:', event)

    // 1. 获取帖子列表
    const postsResult = await db.collection('posts')
      .where({ isPinned: false })
      .where(zoneId ? { zoneId } : {})
      .field({
        title: true,
        content: true,
        author: true,
        createTime: true,
        tag: true,
        imgs: true,
        likedBy: true,
        likeCount: true
      })
      .orderBy('createTime', 'desc')
      .skip((page - 1) * size)
      .limit(size)
      .get()

    console.log('获取到帖子数量:', postsResult.data.length)

    // 2. 确保每个帖子都有 commentCount 字段
    const postsWithCommentCount = postsResult.data.map(post => {
      return {
        ...post,
        commentCount: post.commentCount || 0 // 确保commentCount存在，默认为0
      }
    })

    // 3. 获取总数量（用于分页）
    const countResult = await db.collection('posts')
      .where({ isPinned: false })
      .where(zoneId ? { zoneId } : {})
      .count()

    console.log('总帖子数量:', countResult.total)

    return {
      code: 200,
      msg: '获取成功',
      data: postsWithCommentCount,
      total: countResult.total,
      page: page,
      size: size
    }

  } catch (error) {
    console.error('获取帖子列表失败:', error)
    return {
      code: 500,
      msg: '获取帖子列表失败',
      error: error.message
    }
  }
}
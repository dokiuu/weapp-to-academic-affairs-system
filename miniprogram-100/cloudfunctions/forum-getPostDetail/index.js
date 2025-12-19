const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const db = cloud.database();
  const { id } = event;

  // 尝试从普通帖子集合中获取帖子详情
  const postRes = await db.collection('posts').doc(id).get();

  if (postRes.data) {
    return { code: 200, data: postRes.data };
  }

  // 如果普通帖子集合中没有找到，尝试从置顶帖子集合中获取
  const pinnedPostRes = await db.collection('pinnedposts').doc(id).get();

  if (pinnedPostRes.data) {
    return { code: 200, data: pinnedPostRes.data };
  }

  // 如果两个集合中都没有找到，返回错误
  return { code: 404, msg: '帖子不存在' };
};
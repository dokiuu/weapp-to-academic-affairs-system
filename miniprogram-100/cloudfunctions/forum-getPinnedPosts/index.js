const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const db = cloud.database();
  const res = await db.collection('posts')
      .where({ isPinned: true, isPublished: true })
    .field({
      title: true,
      content: true,
      author: true,
      createTime: true,
      tag: true,
      imgs: true,
      likedBy: true,
      likeCount: true,
      isPinned: true
    })
    .orderBy('createTime', 'desc')
    .get();
  return { code: 200, data: res.data };
};
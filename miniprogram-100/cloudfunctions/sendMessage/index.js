// cloudfunctions/sendMessage/index.js
const cloud = require('wx-server-sdk');
cloud.init();

// 用于存储用户请求频率和消息历史
const rateLimit = {}; // 用户发送频率限制
const messageHistory = {}; // 用户消息历史记录，用于检测重复消息

exports.main = async (event) => {
  const { message, userId, action } = event;
  const currentTime = Date.now();

  // 检查用户是否被封禁
  const user = await cloud.database().collection('users').doc(userId).get();
  if (user.data.isBanned) {
    return { code: 403, msg: '您已被封禁，无法发送消息' };
  }

  if (action === 'sendMessage') {
    // 1. 消息频率控制
    if (rateLimit[userId] && currentTime - rateLimit[userId] < 60000 / 10) {
      return { code: 400, msg: '发送太频繁，请稍后再试' };
    }

    // 2. 内容重复检测
    if (messageHistory[userId]) {
      const recentMessages = messageHistory[userId].filter(msg => currentTime - msg.time < 60000);
      if (recentMessages.some(msg => msg.content === message)) {
        return { code: 400, msg: '重复消息被拦截' };
      }
    }

    // 3. 用户行为分析
    if (!messageHistory[userId]) {
      messageHistory[userId] = [];
    }
    messageHistory[userId].push({ content: message, time: currentTime });

    // 4. 服务器端请求频率限制
    rateLimit[userId] = currentTime;

    // 保存消息到数据库
    await cloud.database().collection('messages').add({
      data: {
        content: message,
        userId,
        createTime: new Date(),
        reportCount: 0 // 初始化举报次数
      }
    });

    return { code: 200, msg: '发送成功' };
  } else if (action === 'reportMessage') {
    const { messageId } = event;

    // 增加举报次数
    await cloud.database().collection('messages').doc(messageId).update({
      data: {
        reportCount: cloud.database().command.inc(1)
      }
    });

    // 获取举报次数
    const message = await cloud.database().collection('messages').doc(messageId).get();
    if (message.data.reportCount >= 5) {
      // 如果举报次数超过5次，删除消息
      await cloud.database().collection('messages').doc(messageId).remove();
    }

    return { code: 200, msg: '举报成功' };
  } else {
    return { code: 400, msg: '未知操作' };
  }
};
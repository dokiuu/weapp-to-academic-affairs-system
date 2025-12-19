const db = wx.cloud.database();
const app = getApp(); // 获取全局应用实例

Page({
  data: {
    currentStuId: '', // 初始化学号变量供wxml使用

    post: {},
    comments: [],
    cmtContent: '',
    id: '',
    currentUserOpenid: '', // 存储当前用户的 _openid
    replyContent: '',
    currentReplyCommentId: '',
    showReplyInput: false,
    userInfo: null // 用户信息
  },

  showReplyInput(e) {
    const commentId = e.currentTarget.dataset.id;
    this.setData({
      currentReplyCommentId: commentId,
      showReplyInput: true,
      replyContent: ''
    });
  },

  bindReplyInput(e) {
    this.setData({ replyContent: e.detail.value });
  },

  async sendReply() {
    const { currentReplyCommentId, replyContent, currentUserOpenid } = this.data;
    if (!replyContent.trim()) {
      wx.showToast({ title: '回复内容不能为空', icon: 'none' });
      return;
    }

    if (!currentUserOpenid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    try {
      // 直接使用当前学号
      if (!this.data.currentStuId) {
        wx.showToast({ title: '请先登录并绑定学号', icon: 'none' });
        return;
      }

      const userInfo = this.data.userInfo;
      const authorInfo = {
        nickName: userInfo ? userInfo.nickName : '用户' + this.data.currentStuId,
        avatarUrl: userInfo ? userInfo.avatarUrl : app.globalData.avatarUrl || '/images/default-avatar.png',
        stuId: this.data.currentStuId
      };

      await db.collection('comments').doc(currentReplyCommentId).update({
        data: {
          subComments: db.command.push({
            author: authorInfo,
            content: replyContent.trim(),
            createTime: new Date()
          })
        }
      });

      wx.showToast({ title: '回复成功', icon: 'success' });
      this.setData({ showReplyInput: false, replyContent: '' });
      this.getComments();
    } catch (error) {
      console.error('发送回复失败:', error);
      wx.showToast({ title: '回复失败', icon: 'none' });
    }
  },

  onLoad(opt) {
    // 保存帖子 ID
    this.setData({ id: opt.id });

    // 第一步：调用云函数获取当前用户的 openid
    wx.cloud.callFunction({
      name: 'getOpenId', // 你已有的云函数
      success: async (res) => {
        const openid = res.result.openid;
        if (!openid) {
          wx.showToast({
            title: '获取用户身份失败',
            icon: 'none'
          });
          return;
        }

        // 保存当前用户的 openid 到 data
        this.setData({ currentUserOpenid: openid });

        // 获取当前用户的学号
        // 先从全局数据获取学号
        // 从本地存储获取学号，确保与权限验证逻辑一致
        // 确保学号为字符串类型，避免数据类型不匹配导致比较失败
        // 输出存储原始值及类型
        const rawStuId = wx.getStorageSync('stuId');
        console.log('本地存储stuId原始值:', rawStuId, '类型:', typeof rawStuId);
        const stuId = rawStuId + '';
        console.log('转换后学号:', stuId, '类型:', typeof stuId);
        if (stuId) {
          this.setData({ currentStuId: stuId });
          console.log('页面数据currentStuId:', this.data.currentStuId, '类型:', typeof this.data.currentStuId);
          console.log('当前用户学号:', stuId); // 调试日志
          // 将学号同步到页面数据供wxml使用
          this.setData({ currentStuId: stuId });

          // 使用学号查询用户信息
          try {
            const userRes = await db.collection('users').where({ stuId: stuId }).limit(1).get();
            if (userRes.data.length > 0) {
              this.setData({
                userInfo: userRes.data[0]
              });
            } else {
              wx.showToast({ title: '用户不存在', icon: 'none' });
            }
          } catch (error) {
            console.error('查询用户信息失败:', error);
          }
        } else {
          wx.showToast({ title: '请先绑定学号', icon: 'none' });
        }

        // 获取帖子和评论
        this.getPost();
        this.getComments();
      },
      fail: (err) => {
        console.error('调用云函数 getOpenId 失败：', err);
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      }
    });
  },

  async getPost() {
    try {
      const res = await db.collection('posts').doc(this.data.id).get();
      this.setData({ post: res.data });
    } catch (error) {
      console.error('获取帖子失败：', error);
      wx.showToast({ title: '加载帖子失败', icon: 'none' });
    }
  },

  async getComments() {
    try {
      const res = await db.collection('comments')
        .where({ postId: this.data.id })
        .orderBy('createTime', 'asc')
        .get();

      this.setData({ comments: res.data });
      // 调试评论数据中的_stuId字段
      console.log('评论数据:', res.data.map(comment => ({ _id: comment._id, _stuId: comment._stuId })));
    } catch (error) {
      console.error('获取评论失败：', error);
      wx.showToast({ title: '加载评论失败', icon: 'none' });
    }
  },

  // 发送评论
  async sendCmt() {
    const content = this.data.cmtContent.trim();
    if (!content) {
      wx.showToast({ title: '评论内容不能为空', icon: 'none' });
      return;
    }

    const openid = this.data.currentUserOpenid;
    if (!openid) {
      wx.showToast({ title: '用户身份异常', icon: 'none' });
      return;
    }

    try {
      // ✅ 通过 _openid 查询用户资料（包含 stuId）
      // 直接使用本地存储的学号
      if (!this.data.currentStuId) {
        wx.showToast({ title: '请先登录并绑定学号', icon: 'none' });
        return;
      }

      // 构造作者信息（使用学号作为标识）
      const userInfo = this.data.userInfo;
      const authorInfo = {
        nickName: userInfo ? userInfo.nickName : '用户' + this.data.currentStuId,
        avatarUrl: userInfo ? userInfo.avatarUrl : app.globalData.avatarUrl || '/images/default-avatar.png',
        stuId: this.data.currentStuId
      };

      // 添加新评论
      await db.collection('comments').add({
        data: {
          postId: this.data.id,
          content: content,
          author: authorInfo,     // 包含 stuId
          _openid: openid,        // 用于权限控制（删除时用）
          _stuId: this.data.currentStuId, // ✅ 可选：方便以后直接查“某学号的所有评论”
          createTime: new Date()
        }
      });

      // 更新帖子评论数
      await db.collection('posts').doc(this.data.id).update({
        data: {
          commentCount: db.command.inc(1)
        }
      });

      // 清空输入框并刷新评论
      this.setData({ cmtContent: '' });
      this.getComments();

      wx.showToast({ title: '评论成功', icon: 'success' });

    } catch (error) {
      console.error('发送评论失败详情：', error);
      wx.showToast({
        title: '发送失败: ' + (error.errMsg || error.message).slice(0, 20),
        icon: 'none'
      });
    }
  },


  // 判断是否有删除权限
  hasDeletePermission(comment) {
    const localStuId = wx.getStorageSync('stuId');
    return localStuId && comment._stuId === localStuId;
  },

  // 图片预览
  previewImage(e) {
    const imgUrls = e.currentTarget.dataset.imgurls;
    const current = e.currentTarget.dataset.current;
    wx.previewImage({
      current: current,
      urls: imgUrls
    });
  },

  // 删除评论
  async deleteComment(e) {
    const commentId = e.currentTarget.dataset.id;
    const comment = this.data.comments.find(item => item._id === commentId);

    if (!comment) {
      wx.showToast({ title: '评论不存在', icon: 'none' });
      return;
    }

    // 安全校验：确保本地存在学号且与评论作者匹配
    const localStuId = wx.getStorageSync('stuId');
    if (!localStuId) {
      wx.showToast({ title: '请先绑定学号', icon: 'none' });
      return;
    }

    // 修正字段名匹配问题：使用与users集合一致的stuId字段
    // 使用comments集合中的_stuId字段进行权限匹配
    if (comment._stuId !== localStuId) {
      wx.showToast({ title: '无权限删除该评论', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条评论吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 删除评论
            await db.collection('comments').doc(commentId).remove();

            // 减少帖子评论数
            await db.collection('posts').doc(this.data.id).update({
              data: {
                commentCount: db.command.inc(-1)
              }
            });

            wx.showToast({ title: '删除成功', icon: 'success' });

            // 刷新数据
            this.getComments();
            this.getPost();
          } catch (error) {
            console.error('删除评论失败：', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  }
});
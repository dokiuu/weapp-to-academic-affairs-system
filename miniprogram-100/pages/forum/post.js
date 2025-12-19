// pages/forum/post.js
const db = wx.cloud.database();

Page({
  data: {
    title: '',
    content: '',
    imgs: []
  },

  // 标题输入
  onTitleInput(e) {
    this.setData({
      title: e.detail.value
    });
  },

  // 内容输入
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    });
  },

  // 选择图片
  chooseImg() {
    wx.chooseMedia({
      count: 9 - this.data.imgs.length,
      mediaType: ['image'],
      success: res => {
        const newImages = res.tempFiles.map(v => v.tempFilePath);
        this.setData({
          imgs: this.data.imgs.concat(newImages)
        });
      }
    });
  },

  // 移除图片
  removeImg(e) {
    const index = e.currentTarget.dataset.index;
    const newImgs = this.data.imgs.filter((_, i) => i !== index);
    this.setData({ imgs: newImgs });
  },

  // 提交表单
  async submit() {
    const { title, content, imgs } = this.data;

    // 验证必填字段
    if (!title || !title.trim()) {
      wx.showToast({
        title: '请填写标题',
        icon: 'none'
      });
      return;
    }

    if (!content || !content.trim()) {
      wx.showToast({
        title: '请填写内容',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '发布中',
      mask: true
    });

    try {
      const fileIDs = [];

      // 上传图片
      for (let imgPath of imgs) {
        const cloudPath = `forum/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
        const uploadResult = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: imgPath
        });
        fileIDs.push(uploadResult.fileID);
      }

      // 获取全局应用实例
      const app = getApp();
      const stuId = app.globalData.stuId;

      // 验证学号是否存在
      if (!stuId) {
        wx.hideLoading();
        wx.showToast({ title: '请先绑定学号', icon: 'none' });
        return;
      }

      // 使用学号查询用户信息
      let dbUserInfo = null;
      try {
        const userRes = await db.collection('users').where({ stuId: stuId }).limit(1).get();
        if (userRes.data.length > 0) {
          dbUserInfo = userRes.data[0];
        } else {
          wx.hideLoading();
          wx.showToast({ title: '用户不存在', icon: 'none' });
          return;
        }
      } catch (error) {
        wx.hideLoading();
        console.error('查询用户信息失败:', error);
        wx.showToast({ title: '获取用户信息失败', icon: 'none' });
        return;
      }

      // 构造用户信息（优先使用数据库数据）
      const userInfo = {
        nickName: dbUserInfo.nickName || app.globalData.nickName || '匿名用户',
        avatarUrl: dbUserInfo.avatarUrl || app.globalData.avatarUrl || '/images/default-avatar.png',
        stuId: stuId
      };

      // 保存到数据库
      await db.collection('posts').add({
        data: {
          title: title.trim(),
          content: content.trim(),
          imgs: fileIDs,
          author: userInfo, // 包含 stuId
          createTime: new Date(),
          updateTime: new Date(),
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          isPinned: false
        }
      });

      wx.hideLoading();
      wx.showToast({
        title: '发布成功',
        icon: 'success',
        duration: 1500
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (error) {
      wx.hideLoading();
      console.error('发布失败:', error);
      wx.showToast({
        title: '发布失败，请重试',
        icon: 'none'
      });
    }
  }
});
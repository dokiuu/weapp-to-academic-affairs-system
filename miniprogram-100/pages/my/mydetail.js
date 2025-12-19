const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    nickName: '',
    avatarUrl: '',
    stuId: '',
    signature: ''
  },

  onLoad() {
    this.initData();
  },

  async initData() {
    const { stuId } = app.globalData;

    if (!stuId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({ stuId });

    // 👇 关键：从数据库拉取最新用户信息，而不是只依赖 globalData
    try {
      const res = await db.collection('users').where({ stuId }).get();
      if (res.data.length > 0) {
        const { nickName, avatarUrl } = res.data[0];
        this.setData({
          nickName: nickName || '',
          avatarUrl: avatarUrl || '',
          signature: res.data[0].signature || ''
        });
        // 同步更新全局变量（可选，保持一致性）
        app.globalData.nickName = nickName || app.globalData.nickName;
        app.globalData.avatarUrl = avatarUrl || '';
      } else {
        // 用户不存在？可以提示或使用默认值
        this.setData({
          nickName: app.globalData.nickName || '',
          avatarUrl: app.globalData.avatarUrl || ''
        });
      }
    } catch (error) {
      console.error('加载用户数据失败:', error);
      wx.showToast({ title: '加载数据失败', icon: 'none' });
    }
  },

  // 设置昵称
  setNickName(e) {
    this.setData({
      nickName: e.detail.value
    })
  },

  // 设置个性签名
  setSignature(e) {
    this.setData({
      signature: e.detail.value
    })
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'], // 压缩图片
      sourceType: ['album', 'camera'],
      success: res => {
        wx.showLoading({ title: '上传中...' });
        wx.cloud.uploadFile({
          cloudPath: `avatars/${app.globalData.stuId}_${Date.now()}.png`,
          filePath: res.tempFilePaths[0],
          success: up => {
            wx.hideLoading();
            this.setData({
              avatarUrl: up.fileID
            });
            wx.showToast({ title: '头像已更新', icon: 'success' });
          },
          fail: err => {
            wx.hideLoading();
            console.error('上传失败:', err);
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        });
      },
      fail: err => {
        console.log('选择图片失败:', err);
      }
    });
  },

  // 保存更改到数据库
  async confirmChange() {
    const { nickName, avatarUrl, stuId } = this.data;

    if (!stuId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 可选：校验昵称不能为空
    if (!nickName.trim()) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const usersCollection = db.collection('users');
      const userExist = await usersCollection.where({ stuId }).get();

      if (userExist.data.length > 0) {
        const docId = userExist.data[0]._id;
        await usersCollection.doc(docId).update({
          data: {
            nickName: nickName.trim(),
            avatarUrl: avatarUrl,
            signature: this.data.signature.trim(),
            updateTime: new Date()
          }
        });

        // ✅ 更新全局变量 + 缓存（重要！）
        app.globalData.nickName = nickName.trim();
        app.globalData.avatarUrl = avatarUrl;
        wx.setStorageSync('nickName', nickName.trim());
        wx.setStorageSync('avatarUrl', avatarUrl);

        wx.showToast({
          title: '保存成功',
          icon: 'success',
          duration: 1500,
          success: () => {
            // 返回前，通知首页或其他页面更新（如果你有 globalEvent）
            if (app.globalEvent?.emit) {
              app.globalEvent.emit('userInfoUpdated', {
                nickName: nickName.trim(),
                avatarUrl: avatarUrl
              });
            }
            setTimeout(() => wx.navigateBack(), 1500);
          }
        });
      } else {
        wx.showToast({ title: '用户不存在', icon: 'none' });
      }
    } catch (error) {
      console.error('保存失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
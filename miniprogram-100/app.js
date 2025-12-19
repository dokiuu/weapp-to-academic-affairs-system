App({
  // minBaseLibraryVersion: "2.29.2",

  globalData: {
    stuId: '',
    pwd: '',
    userInfo: null,
    nickName: '匿名',
    avatarUrl: '',
    hasLogin: false // 添加全局登录状态标识
  },

  onLaunch: function () {
    // 初始化云环境
    wx.cloud.init({
      env: 'gzhl-1gx40yvz927ef35e',
      traceUser: true
    });

    // 检查登录状态并获取用户信息
    this.checkLoginStatus();

    // 获取微信用户信息（如果有授权）
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          wx.getUserInfo({
            success: res => {
              this.globalData.userInfo = res.userInfo;
              // 如果已有自定义昵称和头像，优先使用自定义的
              if (!wx.getStorageSync('nickName')) {
                this.globalData.nickName = res.userInfo.nickName;
              }
              if (!wx.getStorageSync('avatarUrl')) {
                this.globalData.avatarUrl = res.userInfo.avatarUrl;
              }
            }
          });
        }
      }
    });
  },

  // 全局登录状态检查方法
  async checkLoginStatus() {
    try {
      const stuId = wx.getStorageSync('stuId');
      const pwd = wx.getStorageSync('pwd');

      if (stuId && pwd) {
        this.globalData.stuId = stuId;
        console.log('app.js globalData.stuId:', stuId, '类型:', typeof stuId);
        this.globalData.pwd = pwd;
        this.globalData.hasLogin = true;

        // 从数据库获取用户完整信息
        await this.getUserInfoFromDB(stuId);

        return true;
      } else {
        this.globalData.hasLogin = false;
        return false;
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      this.globalData.hasLogin = false;
      return false;
    }
  },

  // 从数据库获取用户信息
  async getUserInfoFromDB(stuId) {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('users').where({ stuId: stuId }).get();

      if (res.data.length > 0) {
        const userInfo = res.data[0];

        // 更新全局数据
        this.globalData.nickName = userInfo.nickName || this.globalData.nickName;
        this.globalData.avatarUrl = userInfo.avatarUrl || this.globalData.avatarUrl;

        // 保存到本地存储
        if (userInfo.nickName) {
          wx.setStorageSync('nickName', userInfo.nickName);
        }
        if (userInfo.avatarUrl) {
          wx.setStorageSync('avatarUrl', userInfo.avatarUrl);
        }

        return userInfo;
      }
      return null;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }
});
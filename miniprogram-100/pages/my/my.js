const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    stuId: '',
    pwd: '', // 存储真实密码
    displayPassword: '', // 显示用的*号密码
    hasLogin: false,
    userInfo: {}, // 完整的用户信息
    showPassword: false,
    stuIdError: '',
    pwdError: '',
    pwdFocus: false
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
  },

  // 检查登录状态
  async checkLoginStatus() {
    try {
      const stuId = wx.getStorageSync('stuId');
      const pwd = wx.getStorageSync('pwd');
      const userInfo = wx.getStorageSync('userInfo'); // 读取缓存的用户信息

      if (stuId && pwd) {
        const app = getApp();
        app.globalData.stuId = stuId;
        app.globalData.pwd = pwd;
        app.globalData.hasLogin = true;

        // 如果有缓存的用户信息，先显示
        if (userInfo) {
          this.setData({
            userInfo: userInfo,
            hasLogin: true,
            stuId: stuId
          });

          // 更新全局数据
          app.globalData.nickName = userInfo.nickName;
          app.globalData.avatarUrl = userInfo.avatarUrl;
        }

        // 从数据库获取最新的用户信息
        await this.getUserInfoFromDB(stuId);
      } else {
        this.setData({ hasLogin: false });
        app.globalData.hasLogin = false;
      }
    } catch (error) {
      console.error('读取登录信息失败:', error);
    }
  },

  // 从数据库获取用户信息（基于学号）
  async getUserInfoFromDB(stuId) {
    try {
      const res = await db.collection('users').where({ stuId: stuId }).get();
      if (res.data.length > 0) {
        const userInfo = res.data[0];
        this.setData({
          userInfo: userInfo
        });

        // 更新全局变量
        const app = getApp();
        app.globalData.nickName = userInfo.nickName;
        app.globalData.avatarUrl = userInfo.avatarUrl;
        app.globalData.userInfo = userInfo;

        // 缓存用户信息到本地
        wx.setStorageSync('userInfo', userInfo);
        wx.setStorageSync('nickName', userInfo.nickName);
        wx.setStorageSync('avatarUrl', userInfo.avatarUrl);

        return userInfo;
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  },

  // 设置学号
  setStuId(e) {
    const value = e.detail.value;
    this.setData({
      stuId: value,
      stuIdError: value ? '' : '学号不能为空'
    });
  },

  // 设置密码（优化版，支持*号显示）
  setPwd(e) {
    const inputValue = e.detail.value;

    // 如果是删除操作
    if (inputValue.length < this.data.displayPassword.length) {
      const deleteCount = this.data.displayPassword.length - inputValue.length;
      this.data.pwd = this.data.pwd.slice(0, -deleteCount);
    }
    // 如果是输入操作
    else if (inputValue.length > this.data.displayPassword.length) {
      const newChars = inputValue.slice(this.data.displayPassword.length);
      this.data.pwd += newChars;
    }

    // 更新显示密码（全部显示为*号）
    const newDisplayPassword = '*'.repeat(inputValue.length);

    this.setData({
      displayPassword: newDisplayPassword,
      pwdError: this.data.pwd ? '' : '密码不能为空'
    });
  },

  // 切换密码显示
  togglePasswordShow() {
    if (this.data.showPassword) {
      // 切换到隐藏模式（显示*号）
      this.setData({
        showPassword: false,
        displayPassword: '*'.repeat(this.data.pwd.length)
      });
    } else {
      // 切换到显示模式（显示真实密码）
      this.setData({
        showPassword: true,
        displayPassword: this.data.pwd
      });
    }
  },

  // 输入框获得焦点
  onInputFocus(e) {
    const type = e.currentTarget.dataset.type;

    if (type === 'stuId') {
      this.setData({
        stuIdError: '',
        pwdFocus: false
      });
    } else if (type === 'password') {
      this.setData({
        pwdError: '',
        pwdFocus: true
      });

      // 如果当前是显示模式，切换到隐藏模式
      if (this.data.showPassword) {
        this.setData({
          displayPassword: '*'.repeat(this.data.pwd.length)
        });
      }
    }
  },

  // 输入框失去焦点
  onInputBlur(e) {
    const type = e.currentTarget.dataset.type;
    const value = e.detail.value;

    if (type === 'stuId' && !this.data.stuId) {
      this.setData({ stuIdError: '学号不能为空' });
    } else if (type === 'password' && !this.data.pwd) {
      this.setData({
        pwdError: '密码不能为空',
        pwdFocus: false
      });
    }

    // 确保密码显示为*号
    if (type === 'password' && !this.data.showPassword) {
      this.setData({
        displayPassword: '*'.repeat(this.data.pwd.length)
      });
    }
  },

  // 验证并保存
  validateAndSave() {
    const { stuId, pwd } = this.data;
    let isValid = true;

    if (!stuId) {
      this.setData({ stuIdError: '请输入学号' });
      isValid = false;
    }

    if (!pwd) {
      this.setData({ pwdError: '请输入密码' });
      isValid = false;
    }

    if (isValid) {
      this.save();
    }
  },

  // 登录
  async save() {
    const { stuId, pwd } = this.data; // 使用真实密码

    if (!stuId || !pwd) {
      wx.showToast({ title: '请填写学号和密码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '验证中' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'classtable',
        data: {
          stuId,
          pwd // 传递真实密码
        }
      });

      const result = res.result || res;
      if (result && result.valid) {
        // 保存登录信息
        wx.setStorageSync('stuId', stuId);
        wx.setStorageSync('pwd', pwd);

        const app = getApp();
        app.globalData.stuId = stuId;
        app.globalData.pwd = pwd;
        app.globalData.hasLogin = true;

        // 获取最新的用户信息
        const userInfo = await this.getUserInfoFromDB(stuId);

        wx.showToast({ title: '登录成功' });
        this.setData({
          hasLogin: true,
          stuIdError: '',
          pwdError: ''
        });

        // 触发全局同步 - 更新所有页面的用户信息
        this.globalSync();

      } else {
        wx.showToast({ title: result.msg || '账号或密码错误', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  // 全局同步方法
  globalSync() {
    const app = getApp();
    const pages = getCurrentPages();

    // 更新所有页面的用户信息
    pages.forEach(page => {
      if (page.route === 'pages/index/index') {
        // 更新首页的用户信息
        page.setData({
          nickName: app.globalData.nickName,
          avatarUrl: app.globalData.avatarUrl,
          hasLogin: true
        });
      }
    });

    // 发布全局登录状态变化事件
    if (app.globalEvent && app.globalEvent.emit) {
      app.globalEvent.emit('loginStatusChanged', {
        hasLogin: true,
        userInfo: app.globalData.userInfo
      });
    }

    console.log('全局同步完成');
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录信息
          wx.removeStorageSync('stuId');
          wx.removeStorageSync('pwd');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('nickName');
          wx.removeStorageSync('avatarUrl');

          const app = getApp();
          app.globalData.stuId = '';
          app.globalData.pwd = '';
          app.globalData.nickName = '';
          app.globalData.avatarUrl = '';
          app.globalData.userInfo = null;
          app.globalData.hasLogin = false;

          this.setData({
            hasLogin: false,
            stuId: '',
            pwd: '', // 清空真实密码
            displayPassword: '', // 清空显示密码
            userInfo: {},
            showPassword: false,
            stuIdError: '',
            pwdError: '',
            pwdFocus: false
          });

          // 触发全局同步 - 更新所有页面的登录状态
          this.globalSyncLogout();

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },

  // 退出登录的全局同步
  globalSyncLogout() {
    const app = getApp();
    const pages = getCurrentPages();

    // 更新所有页面的登录状态
    pages.forEach(page => {
      if (page.route === 'pages/index/index') {
        page.setData({
          hasLogin: false,
          nickName: '匿名',
          avatarUrl: ''
        });
      }
    });

    // 发布全局登出事件
    if (app.globalEvent && app.globalEvent.emit) {
      app.globalEvent.emit('loginStatusChanged', {
        hasLogin: false,
        userInfo: null
      });
    }
  },

  // 查看自己帖子
  seeMyPosts() {
    if (!this.data.hasLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/myPosts/myPosts'
    });
  },

  // 跳转到联系我们页面
  goContact() {
    wx.navigateTo({
      url: '/pages/my/contact/contact'
    });
  },

  // 跳转到用户协议页面
  goAgreement() {
    wx.navigateTo({
      url: '/pages/my/agreement/agreement'
    });
  },

  // 跳转到我的发布页
  goMyPublish() {
    if (!this.data.hasLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/my/mypublish'
    });
  },

  // 跳转到个人资料详情页
  goMyDetail() {
    if (!this.data.hasLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/my/mydetail' });
  }
});
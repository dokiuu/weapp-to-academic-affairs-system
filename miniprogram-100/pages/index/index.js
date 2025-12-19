
// 返回某年某月的第 n 个星期几（0=日，1=一，...）
function nthWeekday(year, month, n, weekday) {
  const d = new Date(year, month, 1);
  const offset = (weekday - d.getDay() + 7) % 7 + (n - 1) * 7;
  return new Date(year, month, 1 + offset);
}

Page({
  data: {
    // 日期相关
    date: '',
    week: '',
    todayDate: '',
    statusBarHeight: 0,
    
    // 用户信息
    userInfo: {
      avatarUrl: '',
      nickName: ''
    },

    
    // 运势相关
    hasDrawnToday: false,
    level: "",
    desc: "",
    levelType: "",
    luckyColor: "",
    luckyNumber: "",
    recommendedAction: "",
    
    // 考试倒计时
    cetDays: 0,
    jlptDays: 0,
  },

  onLoad() {
    // 初始化日期和运势
    this.initDate();
    this.checkDailyLimit();
    
    // 计算考试倒计时
    this.calculateExamDays();
    
    // 获取状态栏高度
    const windowInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight
    });
    
    // 获取用户信息
    this.getUserInfo();
  
    
    // 设置定时器更新日期时间
    this.updateDateTime();
    this.timer = setInterval(() => this.updateDateTime(), 1000);
  },

  onUnload() {
    // 页面卸载时清除定时器
    clearInterval(this.timer);
  },

  // 初始化日期
  initDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    
    // 设置日期和星期
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekDay = weekDays[now.getDay()];
    
    this.setData({
      date: `${month}月${day}日`,
      week: weekDay,
      todayDate: `${year}年${month}月${day}日`
    });
  },

  // 更新日期和星期
  updateDateTime() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const weekArr = ['周日你好~', '密码的周一', '今天星期二', '星期三', '"疯狂星期四"', '星期五———自由之夜~', '周末快乐！今天是星期六'];
    const week = weekArr[now.getDay()];

    this.setData({
      date: `${month}月${day}日`,
      week: week
    });
  },

  // 获取用户信息（根据您的app.js结构调整）
  getUserInfo() {
    const app = getApp();
    
    // 从全局数据获取用户信息
    this.setData({
      nickName: app.globalData.nickName || '匿名',
      avatarUrl: app.globalData.avatarUrl || '',
      hasLogin: app.globalData.hasLogin || false
    });
    
    // 如果全局数据中没有，尝试从本地存储获取
    if (!this.data.avatarUrl) {
      const storedAvatarUrl = wx.getStorageSync('avatarUrl');
      const storedNickName = wx.getStorageSync('nickName');
      
      if (storedAvatarUrl || storedNickName) {
        this.setData({
          avatarUrl: storedAvatarUrl || '',
          nickName: storedNickName || '匿名'
        });
      }
    }
    
    // 如果还没有用户信息，尝试获取微信用户信息
    if (!this.data.avatarUrl && !this.data.hasLogin) {
      this.getWechatUserInfo();
    }
  },

  // 获取微信用户信息
  getWechatUserInfo() {
    const that = this;
    
    // 检查是否已授权
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接获取用户信息
          wx.getUserInfo({
            success: (res) => {
              const userInfo = res.userInfo;
              that.setData({
                nickName: userInfo.nickName,
                avatarUrl: userInfo.avatarUrl
              });
            }
          });
        }
      }
    });
  },

  // 跳转到个人资料页
  goToProfile() {
    if (this.data.hasLogin) {
      wx.navigateTo({
        url: '/pages/my/my'
      });
    } else {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
    }
  },

  // 检查每日抽签限制
  checkDailyLimit() {
    const lastDraw = wx.getStorageSync('lastFortuneDraw');
    const today = new Date().toDateString();
    
    if (lastDraw && lastDraw.date === today) {
      this.setData({
        hasDrawnToday: true,
        level: lastDraw.level,
        desc: lastDraw.desc,
        levelType: lastDraw.levelType,
        luckyColor: lastDraw.luckyColor || "",
        luckyNumber: lastDraw.luckyNumber || "",
        recommendedAction: lastDraw.recommendedAction || ""
      });
    }
  },

  // 计算考试倒计时
  calculateExamDays() {
    const today = new Date();
    const year = today.getFullYear();

    // 四六级：当年 6 月 & 12 月第二个星期六
    const cet6 = nthWeekday(year, 5, 2, 6); // 6 月第 2 个周六
    const cet12 = nthWeekday(year, 11, 2, 6); // 12 月第 2 个周六
    const nextCet = today > cet6 ? cet12 : cet6;

    // JLPT：当年 7 月 & 12 月第一个星期日
    const jlpt7 = nthWeekday(year, 6, 1, 0); // 7 月第 1 个周日
    const jlpt12 = nthWeekday(year, 11, 1, 0); // 12 月第 1 个周日
    const nextJlpt = today > jlpt7 ? jlpt12 : jlpt7;

    this.setData({
      cetDays: Math.ceil((nextCet - today) / 86400000),
      jlptDays: Math.ceil((nextJlpt - today) / 86400000)
    });
  },

  // 抽签方法
  drawFortune() {
    const fortunes = [
      { 
        level: "大吉", 
        desc: "今天是你幸运日！一切顺利，心想事成。", 
        type: "great",
        luckyColor: "红色",
        luckyNumber: "7",
        recommendedAction: "尝试新事物"
      },
      { 
        level: "中吉", 
        desc: "运势很好，可以尝试重要的事情。", 
        type: "very-good",
        luckyColor: "橙色",
        luckyNumber: "3",
        recommendedAction: "做出决定"
      },
      { 
        level: "吉", 
        desc: "运势不错，保持积极态度会有好收获。", 
        type: "good",
        luckyColor: "黄色",
        luckyNumber: "8",
        recommendedAction: "与人合作"
      },
      { 
        level: "小吉", 
        desc: "可能会有小惊喜，注意观察周围。", 
        type: "slight-good",
        luckyColor: "绿色",
        luckyNumber: "5",
        recommendedAction: "留意机会"
      },
      { 
        level: "末吉", 
        desc: "需要稍加努力才能获得想要的结果。", 
        type: "little-good",
        luckyColor: "蓝色",
        luckyNumber: "2",
        recommendedAction: "坚持计划"
      },
      { 
        level: "凶", 
        desc: "今天可能有些小波折，保持耐心。", 
        type: "bad",
        luckyColor: "紫色",
        luckyNumber: "4",
        recommendedAction: "谨慎行事"
      },
      { 
        level: "大凶", 
        desc: "今天宜谨慎行事，三思而后行。", 
        type: "very-bad",
        luckyColor: "黑色",
        luckyNumber: "9",
        recommendedAction: "避免风险"
      }
    ];
    
    const today = new Date().toDateString();
    const selected = fortunes[Math.floor(Math.random() * fortunes.length)];
    
    // 保存抽签结果
    wx.setStorageSync('lastFortuneDraw', {
      date: today,
      level: selected.level,
      desc: selected.desc,
      levelType: selected.type,
      luckyColor: selected.luckyColor,
      luckyNumber: selected.luckyNumber,
      recommendedAction: selected.recommendedAction
    });
    
    // 更新界面
    this.setData({
      hasDrawnToday: true,
      level: selected.level,
      desc: selected.desc,
      levelType: selected.type,
      luckyColor: selected.luckyColor,
      luckyNumber: selected.luckyNumber,
      recommendedAction: selected.recommendedAction
    });
    
    // 添加一点动画效果
    wx.vibrateShort();
  },

  // 校园服务导航方法
  goToClubs() {
    wx.navigateTo({ 
      url: '/pages/clubs/clubs'
    });
  },

  // 跳转到健身房预约小程序
  navigateToGym() {
    wx.navigateToMiniProgram({
      appId: 'wxd9bdce38aa47ea6b',
      path: '',
      success(res) {
        console.log('打开健身房预约成功');
      },
      fail(err) {
        console.error('打开失败', err);
        wx.showToast({
          title: '打开失败，请稍后重试',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到外卖小程序
  navigateToTakeout() {
    wx.navigateToMiniProgram({
      appId: 'wxf9bdcdec193477c0',
      path: '',
      success(res) {
        console.log('打开外卖服务成功');
      },
      fail(err) {
        console.error('打开失败', err);
        wx.showToast({
          title: '打开失败，请稍后重试',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到打印小程序
  navigateToPrint() {
    wx.navigateToMiniProgram({
      appId: 'wxa991d711f60aa1e5',
      path: '',
      success(res) {
        console.log('打开打印服务成功');
      },
      fail(err) {
        console.error('打开失败', err);
        wx.showToast({
          title: '打开失败，请稍后重试',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到大巴车小程序
  navigateToTakeBus() {
    wx.navigateToMiniProgram({
      appId: 'wx7fbb025b72805090',
      path: '',
      success(res) {
        console.log('打开大巴车服务成功');
      },
      fail(err) {
        console.error('打开失败', err);
        wx.showToast({
          title: '打开失败，请稍后重试',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到通行码小程序
  navigateToPass() {
    wx.navigateToMiniProgram({
      appId: 'wxeacb1c681d9c9f7f',
      path: '',
      success(res) {
        console.log('打开通行码服务成功');
      },
      fail(err) {
        console.error('打开失败', err);
        wx.showToast({
          title: '打开失败，请稍后重试',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到电费查询网页
  navigateToElectric() {
    wx.navigateTo({
      url: '/pages/powerweb/powerweb'
    });
  },

  // 跳转到更多页面
  navigateToMore() {
    wx.navigateTo({
      url: '/pages/more/more'
    });
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: '校园一站式服务',
      path: '/pages/index/index'
    }
  },
  
  onShareTimeline() {
    return {
      title: '校园一站式服务',
      imageUrl: '/images/share.jpg'
    }
  }
})
// pages/my/profile.js
const db = wx.cloud.database();

Page({
  data: {
    userInfo: {},
    posts: [],
    targetStuId: '' // 改为 stuId
  },

  onLoad(options) {
    const app = getApp();
    
    // 校验是否登录 → 使用你自己的 hasLogin
    if (!app.globalData.hasLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/my/index' });
      }, 1500);
      return;
    }

    this.setData({ targetStuId: options.stuId }); // 接收 stuId
    this.getUserInfo();
    this.getPosts();
  },

  async getUserInfo() {
    try {
      const res = await db.collection('users')
        .where({ stuId: this.data.targetStuId }) // ✅ 用 stuId 查询
        .limit(1)
        .get();

      if (res.data.length > 0) {
        this.setData({ userInfo: res.data[0] });
      } else {
        wx.showToast({ title: '用户不存在', icon: 'none' });
        setTimeout(() => { wx.navigateBack(); }, 1500);
      }
    } catch (error) {
      console.error('获取用户信息失败：', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async getPosts() {
    try {
      const res = await db.collection('posts')
        .where({ 'author.stuId': this.data.targetStuId }) // ✅ 确保 posts 里存了 author.stuId
        .orderBy('createTime', 'desc')
        .get();

      this.setData({ posts: res.data });
    } catch (error) {
      console.error('获取帖子失败：', error);
      wx.showToast({ title: '加载帖子失败', icon: 'none' });
    }
  },

  formatTime(time) {
    if (!time) return '';
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
});
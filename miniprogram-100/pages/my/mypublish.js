// pages/my/mypublish.js
const db = wx.cloud.database();
const app = getApp();

Page({
  data: {
    goodsList: [],
    loading: true
  },

  onLoad() {
    this.loadMyGoods();
  },

  onPullDownRefresh() {
    this.loadMyGoods(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载我发布的商品
  async loadMyGoods(callback) {
    this.setData({ loading: true });

    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.stuId) {
        throw new Error('请先登录');
      }

      const res = await db.collection('goods')
        .where({ publisherStuId: userInfo.stuId })
        .orderBy('createTime', 'desc')
        .get();

      this.setData({
        goodsList: res.data || []
      });

    } catch (error) {
      console.error('加载我的商品失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
      callback && callback();
    }
  },

  // 编辑商品
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/secondhand/publish?id=${id}`
    });
  },

  // 上下架切换
  async onToggleStatus(e) {
    const id = e.currentTarget.dataset.id;
    const newStatus = parseInt(e.currentTarget.dataset.status);

    wx.showModal({
      title: newStatus === 0 ? '确认重新上架？' : '确认下架？',
      content: newStatus === 0 ? '商品将重新对所有人可见' : '商品将不再展示给其他用户',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.collection('goods').doc(id).update({
              data: {
                status: newStatus,
                updateTime: db.serverDate()
              }
            });

            wx.showToast({
              title: newStatus === 0 ? '上架成功' : '下架成功',
              icon: 'success'
            });

            // 刷新列表
            this.loadMyGoods();
          } catch (error) {
            console.error('更新状态失败:', error);
            wx.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 删除商品
  async onDelete(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除？',
      content: '删除后不可恢复，是否继续？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.collection('goods').doc(id).remove();

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });

            // 刷新列表
            this.loadMyGoods();
          } catch (error) {
            console.error('删除失败:', error);
            wx.showToast({
              title: '删除失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 跳转发布页
  goToPublish() {
    wx.navigateTo({
      url: '/pages/publish/publish'
    });
  }
});
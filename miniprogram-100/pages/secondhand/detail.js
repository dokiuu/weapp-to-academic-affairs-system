// pages/secondhand/detail.js
const db = wx.cloud.database();

// 日期格式化函数(精准到日期)
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

Page({
  data: {
    goods: {
      title: '',
      price: 0,
      description: '',
      images: [],
      location: '',
      contactText: '',
      contactQrCode: '',
      publisherStuId: ''
    },
    publisherInfo: { // 👈 新增：专门存放发布者信息，和 goods 分开更清晰
      nickname: '匿名用户',
      avatarUrl: '/images/default-avatar.png'
    },
    showQrPopup: false // 是否显示二维码弹窗
  },

  onLoad(options) {
    const goodsId = options.id;
    if (!goodsId) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    this.loadGoodsDetail(goodsId);
  },

  // 加载商品详情
  async loadGoodsDetail(goodsId) {
    wx.showLoading({ title: '加载中...' });

    try {
      // 第一步：查询商品
      const res = await db.collection('goods')
        .where({ _id: goodsId, status: 0 })
        .get();

      if (res.data.length === 0) {
        throw new Error('商品不存在或已下架');
      }

      const goodsData = res.data[0];

      // 第二步：根据 publisherStuId 查询用户信息（并做字段映射！）
      let userInfo = {
        nickname: '匿名用户',
        avatarUrl: '/images/default-avatar.png'
      };

      if (goodsData.publisherStuId) {
        const userRes = await db.collection('users')
          .where({ stuId: goodsData.publisherStuId })
          .field({ nickName: true, avatarUrl: true }) // ✅ 查数据库真实字段
          .get();

        if (userRes.data.length > 0) {
          // ✅ 关键修复：把 nickName 映射为 nickname！
          userInfo = {
            nickname: userRes.data[0].nickName || '匿名用户',
            avatarUrl: userRes.data[0].avatarUrl || '/images/default-avatar.png'
          };
        }
      }

      // 第三步：设置数据（✅ publisherInfo 单独设置）
      this.setData({
        goods: {
          ...goodsData,
          formattedCreateTime: formatDate(goodsData.createTime)
        },
        publisherInfo: userInfo // 👈 重点：publisherInfo 是独立字段
      });

    } catch (error) {
      console.error('加载商品失败:', error);
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } finally {
      wx.hideLoading();
    }
  },

  // 显示二维码弹窗
  showQrCode() {
    if (this.data.goods.contactQrCode) {
      this.setData({ showQrPopup: true });
    }
  },

  // 隐藏二维码弹窗
  hideQrCode() {
    this.setData({ showQrPopup: false });
  },

  // 复制联系方式
  copyContact(e) {
    const text = e.currentTarget.dataset.text;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  },

  // “我想要”按钮点击事件
  onWantClick() {
    const { contactText, contactQrCode } = this.data.goods;
    
    if (!contactText && !contactQrCode) {
      wx.showToast({ title: '卖家未提供联系方式', icon: 'none' });
      return;
    }
    
    // 如果有二维码，优先显示二维码
    if (contactQrCode) {
      this.showQrCode();
      return;
    }
    
    // 如果只有文字联系方式，自动复制
    if (contactText) {
      wx.setClipboardData({
        data: contactText,
        success: () => {
          wx.showToast({ title: '联系方式已复制，请粘贴给卖家', icon: 'success' });
        }
      });
    }
  },

  // 页面分享（可选功能）
  onShareAppMessage() {
    return {
      title: this.data.goods.title,
      path: `/pages/secondhand/detail?id=${this.data.goods._id}`,
      imageUrl: this.data.goods.images[0] || ''
    };
  }
});
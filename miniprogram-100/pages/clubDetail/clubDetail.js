Page({
  data: {
    club: null,
    isPreviewing: false
  },

  onLoad(options) {
    if (options.club) {
      const club = JSON.parse(decodeURIComponent(options.club));
      this.setData({ club });
      
      // 显示操作提示
      wx.showToast({
        title: '点击预览，长按识别',
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 点击预览二维码
  previewQRCode() {
    const that = this;
    wx.previewImage({
      urls: [that.data.club.qrCode],
      current: that.data.club.qrCode,
      success: () => {
        that.setData({ isPreviewing: true });
        // 显示操作提示
        wx.showModal({
          title: '操作提示',
          content: '请在预览界面长按二维码进行识别',
          showCancel: false,
          confirmText: '知道了'
        });
      },
      fail: (err) => {
        console.error('预览失败', err);
        wx.showToast({
          title: '预览失败',
          icon: 'none'
        });
      }
    });
  },

  // 长按处理 - 触发扫码功能
  handleLongPress() {
    const that = this;
    
    // 震动反馈
    wx.vibrateShort({
      type: 'medium'
    });
    
    // 显示识别中提示
    wx.showLoading({
      title: '识别中...',
      mask: true
    });
    
    // 模拟识别过程
    setTimeout(() => {
      wx.hideLoading();
      
      // 显示识别结果提示
      wx.showModal({
        title: '扫码提示',
        content: '请在微信扫一扫中打开相机，扫描此二维码',
        showCancel: false,
        confirmText: '知道了',
        success: () => {
          // 引导用户使用扫一扫
          that.guideToScan();
        }
      });
    }, 1500);
  },
  
  // 引导用户使用扫一扫
  guideToScan() {
    wx.showActionSheet({
      itemList: ['打开扫一扫'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.scanCode({
            success: (res) => {
              console.log('扫码结果:', res);
            },
            fail: (err) => {
              console.error('扫码失败:', err);
            }
          });
        }
      }
    });
  },

  // 返回社团列表
  goBack() {
    wx.navigateBack();
  }
});
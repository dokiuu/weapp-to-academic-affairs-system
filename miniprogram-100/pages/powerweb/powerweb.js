Page({
  data: {
    qrCode: '/image/electric-bill-qrcode.jpg',
  },

  // 预览二维码（调用微信内置预览接口）
  previewQRCode() {
    const that = this;
    wx.previewImage({
      urls: [that.data.qrCode], // 需要预览的图片链接列表
      current: that.data.qrCode, // 当前显示图片的链接
    });
  },

  // 返回首页
  goBack() {
    wx.navigateBack();
  },

  // 阻止事件冒泡
stopPropagation: function(e) {
  // 空方法，用于阻止事件冒泡
},
});
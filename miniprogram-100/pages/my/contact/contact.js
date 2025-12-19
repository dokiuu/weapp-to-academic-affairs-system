// contact.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 可以在这里添加页面所需的数据
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 页面加载时的初始化操作
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  },

  // 预览二维码图片
  previewQrCode: function() {
    wx.previewImage({
      current: '/image/开发者微信qr.jpg',
      urls: ['/image/开发者微信qr.jpg']
    })
  },

  // 长按扫描二维码
  scanQrCode: function() {
    wx.scanCode({
      success: (res) => {
        console.log('扫描结果:', res.result)
        wx.showToast({
          title: '扫描成功',
          icon: 'success'
        })
      },
      fail: (err) => {
        console.log('扫描失败:', err)
        wx.showToast({
          title: '扫描失败',
          icon: 'none'
        })
      }
    })
  }
})
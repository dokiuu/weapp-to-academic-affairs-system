const db = wx.cloud.database()

Page({
  data: {
    clubs: [],
    showModal: false,
    isEditing: false,
    currentClub: {
      name: '',
      description: '',
      poster: '',
      qrCode: ''
    },
    showPreview: false,
    previewImageUrl: ''
  },

  onLoad() {
    this.loadClubs()
  },

  // 加载社团列表
  async loadClubs() {
    try {
      wx.showLoading({ title: '加载中...' })
      const res = await db.collection('clubs').get()
      this.setData({ clubs: res.data })
      wx.hideLoading()
    } catch (error) {
      console.error('加载社团失败:', error)
      wx.hideLoading()
      wx.showToast({ 
        title: '加载失败，请重试', 
        icon: 'none' 
      })
    }
  },

  // 点击预览图片
  previewImage: function(e) {
    const imageUrl = e.currentTarget.dataset.src;
    if (!imageUrl) return;
    
    this.setData({
      previewImageUrl: imageUrl,
      showPreview: true
    });
  },

  // 隐藏图片预览
  hidePreview: function() {
    this.setData({
      showPreview: false
    });
  },

  // 长按扫码（如果有二维码）
  scanQRCodeIfAvailable: function(e) {
    const item = e.currentTarget.dataset.item;
    if (item.qrCode) {
      // 调用微信扫码API
      wx.scanCode({
        success: (res) => {
          console.log('扫码结果:', res.result);
          wx.showToast({
            title: '扫码成功',
            icon: 'success'
          });
        },
        fail: (err) => {
          console.error('扫码失败:', err);
          wx.showToast({
            title: '扫码失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.showToast({
        title: '该社团未设置二维码',
        icon: 'none'
      });
    }
  },

  // 添加新社团
  addNewClub() {
    this.setData({
      showModal: true,
      isEditing: false,
      currentClub: {
        name: '',
        description: '',
        poster: '',
        qrCode: ''
      }
    })
  },

  // 编辑社团
  editClub(e) {
    const club = e.currentTarget.dataset.item
    this.setData({
      showModal: true,
      isEditing: true,
      currentClub: { ...club }
    })
  },

  // 删除社团
  async deleteClub(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个社团吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            await db.collection('clubs').doc(id).remove()
            this.loadClubs()
            wx.showToast({ title: '删除成功' })
          } catch (error) {
            console.error('删除失败:', error)
            wx.showToast({ 
              title: '删除失败', 
              icon: 'none' 
            })
          }
        }
      }
    })
  },

  // 表单处理
  onNameChange(e) {
    this.setData({
      'currentClub.name': e.detail.value
    })
  },

  onDescChange(e) {
    this.setData({
      'currentClub.description': e.detail.value
    })
  },

  // 上传海报
  async uploadPoster() {
    await this.uploadImage('poster')
  },

  // 上传二维码
  async uploadQRCode() {
    await this.uploadImage('qrCode')
  },

  // 通用上传方法
  async uploadImage(type) {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })

      wx.showLoading({ title: '上传中...' })
      
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `clubs/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`,
        filePath: res.tempFilePaths[0]
      })

      this.setData({
        [`currentClub.${type}`]: uploadRes.fileID
      })

      wx.hideLoading()
      wx.showToast({ title: '上传成功' })
    } catch (error) {
      console.error('上传失败:', error)
      wx.hideLoading()
      wx.showToast({ 
        title: '上传失败', 
        icon: 'none' 
      })
    }
  },

  // 提交表单
  async submitForm() {
    const { currentClub, isEditing } = this.data

    if (!currentClub.name) {
      wx.showToast({ title: '请填写社团名称', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })
      
      if (isEditing) {
        await db.collection('clubs').doc(currentClub._id).update({
          data: {
            ...currentClub,
            updateTime: new Date()
          }
        })
      } else {
        await db.collection('clubs').add({
          data: {
            ...currentClub,
            createTime: new Date(),
            updateTime: new Date()
          }
        })
      }

      this.closeModal()
      this.loadClubs()
      wx.showToast({ title: '保存成功' })
    } catch (error) {
      console.error('保存失败:', error)
      wx.showToast({ 
        title: '保存失败', 
        icon: 'none' 
      })
    }
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showModal: false })
  },

  // 阻止事件冒泡
  stopPropagation(e) {
    // 空函数，仅用于阻止事件冒泡
  }
})
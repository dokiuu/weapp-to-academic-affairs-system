// pages/secondhand/publish.js
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    formData: {
      title: '',           // 标题
      price: '',           // 价格
      description: '',     // 描述
      images: [],          // 图片数组
      location: '',        // 地点
      contactText: '',     // 联系方式文字
      contactQrCode: ''    // 二维码图片
    },
    errors: {
      title: '',
      price: '',
      description: '',
      images: '',
      location: '',
      contact: ''
    },
    isSubmitting: false   // 是否正在提交
  },

  // 表单验证
  validateForm() {
    let isValid = true;
    const newErrors = { ...this.data.errors };

    // 验证标题
    if (!this.data.formData.title.trim()) {
      newErrors.title = '请输入商品标题';
      isValid = false;
    } else {
      newErrors.title = '';
    }

    // 验证价格
    if (!this.data.formData.price) {
      newErrors.price = '请输入价格';
      isValid = false;
    } else if (isNaN(this.data.formData.price) || parseFloat(this.data.formData.price) <= 0) {
      newErrors.price = '请输入有效的价格';
      isValid = false;
    } else {
      newErrors.price = '';
    }

    // 验证描述
    if (!this.data.formData.description.trim()) {
      newErrors.description = '请输入商品描述';
      isValid = false;
    } else {
      newErrors.description = '';
    }

    // 验证图片
    if (this.data.formData.images.length === 0) {
      newErrors.images = '请至少上传一张商品图片';
      isValid = false;
    } else {
      newErrors.images = '';
    }

    // 验证地点
    if (!this.data.formData.location.trim()) {
      newErrors.location = '请输入交易地点';
      isValid = false;
    } else {
      newErrors.location = '';
    }

    // 验证联系方式（至少填一个）
    if (!this.data.formData.contactText && !this.data.formData.contactQrCode) {
      newErrors.contact = '请至少填写一种联系方式（微信号/电话 或 微信二维码）';
      isValid = false;
    } else {
      newErrors.contact = '';
    }

    this.setData({ errors: newErrors });
    return isValid;
  },

  // 输入事件处理
  onTitleInput(e) {
    this.setData({
      ['formData.title']: e.detail.value,
      ['errors.title']: ''
    });
  },

  onPriceInput(e) {
    this.setData({
      ['formData.price']: e.detail.value,
      ['errors.price']: ''
    });
  },

  onDescInput(e) {
    this.setData({
      ['formData.description']: e.detail.value,
      ['errors.description']: ''
    });
  },

  onLocationInput(e) {
    this.setData({
      ['formData.location']: e.detail.value,
      ['errors.location']: ''
    });
  },

  onContactTextInput(e) {
    this.setData({
      ['formData.contactText']: e.detail.value,
      ['errors.contact']: ''
    });
  },

  // 选择商品图片
  async chooseImages() {
    try {
      const result = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 9 - this.data.formData.images.length, // 最多9张
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          maxDuration: 30,
          sizeType: ['compressed'],
          success: resolve,
          fail: reject
        });
      });

      if (result && result.tempFiles && result.tempFiles.length > 0) {
        const newImages = [...this.data.formData.images];

        for (let file of result.tempFiles) {
          // 上传到云存储
          const uploadResult = await this.uploadImageToCloud(file.tempFilePath);
          if (uploadResult) {
            newImages.push(uploadResult.fileID);
          }
        }

        this.setData({
          ['formData.images']: newImages,
          ['errors.images']: ''
        });
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      wx.showToast({ title: '选择图片失败', icon: 'none' });
    }
  },

  // 上传单张图片到云存储
  async uploadImageToCloud(filePath) {
    wx.showLoading({ title: '上传中...' });

    try {
      // 获取文件后缀
      const suffix = filePath.split('.').pop();
      // 生成唯一文件名
      const fileName = `goods/${Date.now()}_${Math.floor(Math.random() * 1000)}.${suffix}`;

      const result = await wx.cloud.uploadFile({
        cloudPath: fileName,
        filePath: filePath
      });

      wx.hideLoading();
      return result;
    } catch (error) {
      wx.hideLoading();
      console.error('上传图片失败:', error);
      wx.showToast({ title: '图片上传失败', icon: 'none' });
      return null;
    }
  },

  // 删除商品图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.formData.images];
    images.splice(index, 1);
    this.setData({
      ['formData.images']: images
    });
  },

  // 上传二维码
  async uploadQrCode() {
    try {
      const result = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          maxDuration: 30,
          sizeType: ['compressed'],
          success: resolve,
          fail: reject
        });
      });

      if (result && result.tempFiles && result.tempFiles.length > 0) {
        const uploadResult = await this.uploadImageToCloud(result.tempFiles[0].tempFilePath);
        if (uploadResult) {
          this.setData({
            ['formData.contactQrCode']: uploadResult.fileID,
            ['errors.contact']: ''
          });
        }
      }
    } catch (error) {
      console.error('上传二维码失败:', error);
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  // 删除二维码
  deleteQrCode() {
    this.setData({
      ['formData.contactQrCode']: ''
    });
  },

  // 提交表单
  async formSubmit() {
    if (this.data.isSubmitting) return; // 防止重复提交

    if (!this.validateForm()) {
      wx.showToast({ title: '请检查填写内容', icon: 'none' });
      return;
    }

    // 检查发布频率限制（每分钟一条）
    const lastPublishTime = wx.getStorageSync('lastPublishTime') || 0;
    const now = Date.now();
    const ONE_MINUTE = 60 * 1000; // 1分钟

    if (now - lastPublishTime < ONE_MINUTE) {
      const remainingSeconds = Math.ceil((ONE_MINUTE - (now - lastPublishTime)) / 1000);
      wx.showToast({
        title: `发布频率限制，请${remainingSeconds}秒后再试`,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '发布中...' });

    try {
      // 获取当前用户学号
      const stuId = app.globalData.stuId;
      if (!stuId) {
        throw new Error('未获取到用户信息，请重新登录');
      }

      // 准备数据
      const goodsData = {
        title: this.data.formData.title.trim(),
        price: parseFloat(this.data.formData.price),
        description: this.data.formData.description.trim(),
        images: this.data.formData.images,
        location: this.data.formData.location.trim(),
        contactText: this.data.formData.contactText.trim(),
        contactQrCode: this.data.formData.contactQrCode,
        publisherStuId: stuId,
        createTime: db.serverDate(),
        status: 0 // 0=上架
      };

      // 写入数据库
      const res = await db.collection('goods').add({
        data: goodsData
      });

      wx.hideLoading();
      wx.showToast({ title: '发布成功', icon: 'success' });

      // 记录发布时间
      wx.setStorageSync('lastPublishTime', Date.now());

      // 发布成功后跳转到二手首页并刷新数据
      setTimeout(() => {
        // 清除商品列表缓存，确保下次加载最新数据
        wx.removeStorageSync('secondhand_goods_list');
        // 跳转到二手首页
        wx.reLaunch({
          url: '/pages/secondhand/secondhand?timestamp=' + Date.now()
        });
      }, 4000);

    } catch (error) {
      wx.hideLoading();
      console.error('发布失败:', error);
      wx.showToast({ title: '发布失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
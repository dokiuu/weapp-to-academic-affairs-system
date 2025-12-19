// pages/bannerManage/bannerManage.js
const db = wx.cloud.database();
const _ = db.command;
const app = getApp(); // 获取全局 app 实例，用于获取用户 openid

Page({
  data: {
    banners: [],
    loading: true,
    currentUserOpenId: '', // 当前用户 openid
  },

  onLoad: function (options) {
    // 页面加载时获取用户 openid
    this.getUserOpenId().then(() => {
      this.loadBanners();
    });
  },

  // 获取当前用户 openid
  async getUserOpenId() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getOpenId' // 确保你有这个云函数
      });
      this.setData({
        currentUserOpenId: res.result.openid
      });
      console.log('当前用户 openid:', this.data.currentUserOpenId);
    } catch (error) {
      console.error('获取用户 openid 失败:', error);
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'none'
      });
    }
  },

  // 加载轮播图数据
  async loadBanners() {
    this.setData({ loading: true });
    try {
      // 查询所有轮播图，按创建时间倒序排列
      const res = await db.collection('banners')
        .orderBy('createTime', 'desc')
        .get();

      // 将 Date 对象转换为字符串以便显示
      const bannersWithFormattedDate = res.data.map(banner => {
        return {
          ...banner,
          createTime: banner.createTime ? this.formatDate(banner.createTime) : '未知时间'
        };
      });

      this.setData({
        banners: bannersWithFormattedDate,
        loading: false
      });
    } catch (error) {
      console.error('加载轮播图失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 格式化日期
  formatDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 图片预览
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url, // 当前显示图片的 http 链接
      urls: [url] // 需要预览的图片 http 链接列表
    });
  },

  // 点击添加轮播图按钮
  onAddBannerTap() {
    this.showBannerForm(); // 显示添加表单
  },

  // 点击编辑轮播图按钮
  onEditBannerTap(e) {
    const index = e.currentTarget.dataset.index;
    const banner = this.data.banners[index];
    this.showBannerForm(banner); // 传入选中的 banner 对象进行编辑
  },

  // 显示轮播图表单 (添加或编辑)
  showBannerForm(bannerToEdit = null) {
    const isEdit = !!bannerToEdit;
    const title = isEdit ? '编辑轮播图' : '添加轮播图';
    const placeholderTitle = isEdit ? bannerToEdit.title : '请输入标题';
    const placeholderLinkUrl = isEdit ? (bannerToEdit.linkUrl || '') : '请输入跳转链接 (可选)';
    const confirmText = isEdit ? '更新' : '添加';

    wx.showModal({
      title: title,
      editable: true,
      placeholderText: `${placeholderTitle}\n${placeholderLinkUrl}`, // 简单的多行提示
      content: '', // 初始内容为空，后续通过 success 回调处理
      confirmText: confirmText,
      success: (res) => {
        if (res.confirm) {
          // 处理用户输入
          const inputText = res.content || '';
          const lines = inputText.split('\n');
          const titleInput = lines[0] ? lines[0].trim() : '';
          const linkUrlInput = lines[1] ? lines[1].trim() : '';

          if (!titleInput) {
            wx.showToast({ title: '请输入标题', icon: 'none' });
            return;
          }

          if (isEdit) {
             this.updateBanner(bannerToEdit._id, titleInput, linkUrlInput);
          } else {
             this.uploadAndAddBanner(titleInput, linkUrlInput);
          }
        }
      }
    });
  },

  // 上传图片并添加轮播图
  uploadAndAddBanner(title, linkUrl) {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '上传中...' });

        try {
          // 上传图片到云存储
          const cloudPath = `banners/${Date.now()}-${Math.random().toString(36).substr(2, 5)}.jpg`;
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: tempFilePath,
          });

          const imageUrl = uploadResult.fileID;

          // 保存到数据库
          const newBannerData = {
            imageUrl: imageUrl,
            title: title,
            isActive: true,
            sortOrder: 0, // 可根据需要调整排序逻辑
            createTime: db.serverDate(),
            startTime: db.serverDate(), // 默认立即开始
            endTime: db.command.exists(false), // 默认无结束时间
            linkType: linkUrl ? 'page' : '', // 简单判断，有链接就是页面跳转
            linkUrl: linkUrl || ''
          };

          await db.collection('banners').add({
            data: newBannerData
          });

          wx.showToast({ title: '添加成功' });
          this.loadBanners(); // 重新加载列表

        } catch (error) {
          console.error('添加轮播图失败:', error);
          wx.showToast({ title: '添加失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({ title: '未选择图片', icon: 'none' });
      }
    });
  },

  // 更新轮播图 (仅更新标题和链接)
  async updateBanner(bannerId, newTitle, newLinkUrl) {
    wx.showLoading({ title: '更新中...' });
    try {
       await db.collection('banners').doc(bannerId).update({
        data: {
          title: newTitle,
          linkUrl: newLinkUrl || '', // 更新链接，如果为空则设为空字符串
          linkType: newLinkUrl ? 'page' : '' // 更新链接类型
        }
      });

      wx.showToast({ title: '更新成功' });
      this.loadBanners(); // 重新加载列表
    } catch (error) {
      console.error('更新轮播图失败:', error);
      wx.showToast({ title: '更新失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 点击删除轮播图按钮
  onDeleteBannerTap(e) {
    const id = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index; // 可用于优化体验，例如本地删除

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张轮播图吗？此操作不可恢复。',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          try {
            // 1. 先获取记录，拿到 imageUrl 用于删除云文件
            const docRes = await db.collection('banners').doc(id).get();
            const fileID = docRes.data.imageUrl;

            // 2. 从数据库删除记录
            await db.collection('banners').doc(id).remove();

            // 3. (可选) 从云存储删除文件
            if (fileID) {
              try {
                 await wx.cloud.deleteFile({
                  fileList: [fileID]
                });
                console.log('关联的云文件已删除:', fileID);
              } catch (deleteFileErr) {
                console.warn('删除云文件失败 (可能文件已不存在):', deleteFileErr);
                // 即使删除文件失败，也认为删除成功，因为数据库记录已删
              }
            }

            wx.showToast({ title: '删除成功' });
            this.loadBanners(); // 重新加载列表

          } catch (error) {
            console.error('删除轮播图失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  }
});
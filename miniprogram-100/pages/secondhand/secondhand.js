// secondhand.js
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    goodsList: [],
    leftColumnGoods: [],
    rightColumnGoods: [],
    showScrollTop: false,
    banners: [],
    currentBanner: 0,
    triggered: false,
    isLoadingMore: false,
    nomore: false
  },

  onLoad() {
    this.loadBanners();
    this.loadGoodsList();
  },

  onShow() {
    setTimeout(() => {
      this.loadGoodsList();
      this.loadBanners();
    }, 500);
  },

  // 加载轮播图数据
  async loadBanners() {
    try {
      const { data } = await db.collection('secondhand_banners')
        .where({
          isActive: true,
          createTime: db.command.lte(new Date())
        })
        .orderBy('sortOrder', 'asc')
        .orderBy('createTime', 'desc')
        .get();

      const banners = data && data.length > 0 ? data : [
        {
          _id: 'default1',
          imageUrl: '/images/secondhand-banner1.jpg',
          title: '校园二手市场',
          description: '优质闲置，轻松交易'
        },
        {
          _id: 'default2',
          imageUrl: '/images/secondhand-banner2.jpg',
          title: '特价优惠',
          description: '限时抢购，不容错过'
        }
      ];

      this.setData({ banners });
    } catch (error) {
      console.error('加载轮播图失败:', error);
      this.setData({
        banners: [
          {
            _id: 'default1',
            imageUrl: '/images/secondhand-banner1.jpg',
            title: '校园二手市场',
            description: '优质闲置，轻松交易'
          },
          {
            _id: 'default2',
            imageUrl: '/images/secondhand-banner2.jpg',
            title: '特价优惠',
            description: '限时抢购，不容错过'
          }
        ]
      });
    }
  },

  // 轮播图切换事件
  onBannerChange(e) {
    this.setData({ currentBanner: e.detail.current });
  },

  // 轮播图点击事件
  onBannerTap(e) {
    const item = e.currentTarget.dataset.item;
    if (!item.linkType || !item.linkUrl) return;

    switch (item.linkType) {
      case 'page':
        wx.navigateTo({ url: item.linkUrl });
        break;
      case 'web':
        wx.navigateTo({
          url: `/pages/webview/webview?url=${encodeURIComponent(item.linkUrl)}`
        });
        break;
      case 'miniProgram':
        wx.navigateToMiniProgram({ appId: item.linkUrl });
        break;
      case 'goods':
        if (item.targetGoodsId) {
          wx.navigateTo({
            url: `/pages/secondhand/detail?id=${item.targetGoodsId}`
          });
        }
        break;
    }
  },

  // 编辑轮播图（任何人都可以编辑）
  onEditBanner(e) {
    const index = e.currentTarget.dataset.index;
    const banner = this.data.banners[index];

    wx.showActionSheet({
      itemList: ['更换图片', '修改信息', '删除'],
      success: (res) => {
        const tapIndex = res.tapIndex;
        if (tapIndex === 0) {
          this.uploadBannerImage(banner._id);
        } else if (tapIndex === 1) {
          this.editBannerInfo(banner);
        } else if (tapIndex === 2) {
          this.deleteBanner(banner._id);
        }
      }
    });
  },

  // 添加快捷管理入口
  onQuickManage() {
    wx.showActionSheet({
      itemList: ['添加轮播图', '刷新轮播图'],
      success: (res) => {
        const tapIndex = res.tapIndex;
        if (tapIndex === 0) {
          this.addNewBanner();
        } else if (tapIndex === 1) {
          this.loadBanners();
          wx.showToast({ title: '已刷新', icon: 'success' });
        }
      }
    });
  },

  // 添加新轮播图
  async addNewBanner() {
    wx.showModal({
      title: '添加轮播图',
      content: '请选择操作方式',
      confirmText: '上传图片',
      cancelText: '手动输入',
      success: (res) => {
        if (res.confirm) {
          this.uploadNewBannerImage();
        } else {
          this.showAddBannerForm();
        }
      }
    });
  },

  // 上传新轮播图图片
  uploadNewBannerImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        wx.showLoading({ title: '上传中...' });
        try {
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: `secondhand/banners/${Date.now()}.jpg`,
            filePath: res.tempFilePaths[0],
          });

          this.showAddBannerForm(uploadResult.fileID);
        } catch (error) {
          console.error('上传图片失败:', error);
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
        wx.hideLoading();
      }
    });
  },

  // 显示添加轮播图表单
  showAddBannerForm(imageUrl = '') {
    wx.showModal({
      title: '添加轮播图',
      content: '请输入轮播图标题',
      editable: true,
      placeholderText: '请输入标题',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            await db.collection('secondhand_banners').add({
              data: {
                imageUrl: imageUrl,
                title: res.content,
                description: '',
                linkType: '',
                linkUrl: '',
                sortOrder: 0,
                isActive: true,
                createTime: db.serverDate(),
                updateTime: db.serverDate()
              }
            });

            wx.showToast({ title: '添加成功' });
            this.loadBanners();
          } catch (error) {
            console.error('添加轮播图失败:', error);
            wx.showToast({ title: '添加失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 上传轮播图图片
  async uploadBannerImage(bannerId) {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        wx.showLoading({ title: '上传中...' });
        try {
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: `secondhand/banners/${Date.now()}.jpg`,
            filePath: res.tempFilePaths[0],
          });

          await db.collection('secondhand_banners').doc(bannerId).update({
            data: {
              imageUrl: uploadResult.fileID,
              updateTime: db.serverDate()
            }
          });

          wx.showToast({ title: '图片更新成功' });
          this.loadBanners();
        } catch (error) {
          console.error('上传图片失败:', error);
          wx.showToast({ title: '更新失败', icon: 'none' });
        }
        wx.hideLoading();
      }
    });
  },

  // 编辑轮播图信息
  async editBannerInfo(banner) {
    wx.showModal({
      title: '修改轮播图信息',
      content: '请输入新的标题',
      editable: true,
      placeholderText: banner.title,
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            await db.collection('secondhand_banners').doc(banner._id).update({
              data: {
                title: res.content,
                updateTime: db.serverDate()
              }
            });
            wx.showToast({ title: '修改成功' });
            this.loadBanners();
          } catch (error) {
            console.error('修改轮播图失败:', error);
            wx.showToast({ title: '修改失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 删除轮播图
  async deleteBanner(bannerId) {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个轮播图吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.collection('secondhand_banners').doc(bannerId).update({
              data: {
                isActive: false,
                updateTime: db.serverDate()
              }
            });
            wx.showToast({ title: '删除成功' });
            this.loadBanners();
          } catch (error) {
            console.error('删除轮播图失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 加载商品列表
  async loadGoodsList() {
    wx.showLoading({ title: '加载中...' });

    try {
      const { data: goodsList } = await db.collection('goods')
        .where({ status: 0 })
        .orderBy('createTime', 'desc')
        .get({ fetchType: 'server' });

      const enhancedList = await this.enhanceGoodsWithUserInfo(goodsList);

      this.setData({
        goodsList: enhancedList
      }, () => {
        this.distributeGoods();
      });

    } catch (error) {
      console.error('加载商品列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 为商品补充用户信息和格式化时间
  async enhanceGoodsWithUserInfo(goodsList) {
    return Promise.all(
      goodsList.map(async (item) => {
        let userInfo = {
          nickname: '匿名用户',
          avatarUrl: '/images/default-avatar.png'
        };

        if (item.publisherStuId) {
          const userRes = await db.collection('users')
            .where({ stuId: item.publisherStuId })
            .field({ nickName: true, avatarUrl: true })
            .get();

          if (userRes.data.length > 0) {
            userInfo = {
              nickname: userRes.data[0].nickName || '匿名用户',
              avatarUrl: userRes.data[0].avatarUrl || '/images/default-avatar.png'
            };
          }
        }

        const formattedTime = this.formatTime(item.createTime);

        return {
          ...item,
          publisherInfo: userInfo,
          formattedTime
        };
      })
    );
  },

  // 将商品分配到左右两列
  distributeGoods() {
    const { goodsList } = this.data;
    const leftColumn = [];
    const rightColumn = [];

    goodsList.forEach((item, index) => {
      if (index % 2 === 0) {
        leftColumn.push(item);
      } else {
        rightColumn.push(item);
      }
    });

    this.setData({
      leftColumnGoods: leftColumn,
      rightColumnGoods: rightColumn
    });
  },

  // 跳转到发布页面
  goPublish() {
    if (!app.globalData.hasLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/secondhand/publish' });
  },

  // 跳转到详情页面
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/secondhand/detail?id=${id}` });
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '刚刚';

    const postTime = new Date(typeof timestamp === 'string' ? timestamp : (typeof timestamp === 'number' ? timestamp : timestamp));
    if (isNaN(postTime)) return '未知时间';

    const now = new Date();
    const diffMs = now - postTime;

    if (diffMs < 60000) {
      return '刚刚';
    }

    const intervals = [
      { check: 86400000, unit: '天前' },
      { check: 3600000, unit: '小时前' },
      { check: 60000, unit: '分钟前' },
    ];

    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];
      const diff = Math.floor(diffMs / interval.check);
      if (diff >= 1) {
        return `${diff}${interval.unit}`;
      }
    }

    return `${postTime.getFullYear()}-${(postTime.getMonth() + 1).toString().padStart(2, '0')}-${postTime.getDate().toString().padStart(2, '0')}`;
  },

  // 页面滚动事件
  onPageScroll(e) {
    if (e.scrollTop > 300) {
      this.setData({ showScrollTop: true });
    } else {
      this.setData({ showScrollTop: false });
    }
  },

  // 回到顶部
  scrollToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
  },

  // 下拉刷新
  async onRefresh() {
    this.setData({ triggered: true });
    await Promise.all([this.loadBanners(), this.loadGoodsList()]);
    this.setData({ triggered: false });
  },

  // 上拉加载更多
  async loadMore() {
    if (this.data.nomore || this.data.isLoadingMore) return;

    this.setData({ isLoadingMore: true });

    try {
      const { data: newGoods } = await db.collection('goods')
        .where({ status: 0 })
        .orderBy('createTime', 'desc')
        .skip(this.data.goodsList.length)
        .limit(10)
        .get();

      if (newGoods.length === 0) {
        this.setData({ nomore: true });
        return;
      }

      const enhancedGoods = await this.enhanceGoodsWithUserInfo(newGoods);
      const updatedGoodsList = [...this.data.goodsList, ...enhancedGoods];

      this.setData({
        goodsList: updatedGoodsList
      }, () => {
        this.distributeGoods();
      });

    } catch (error) {
      console.error('加载更多失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ isLoadingMore: false });
    }
  },

  onPullDownRefresh() {
    this.onRefresh().then(() => wx.stopPullDownRefresh());
  }
});
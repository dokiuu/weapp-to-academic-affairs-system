// pages/forum/forum.js
const db = wx.cloud.database();
const _ = db.command;

// 时间格式化工具函数
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

Page({
  data: {
    banners: [],
    currentBanner: 0,
    posts: [],
    pinnedPosts: [],
    page: 1,
    size: 20,
    nomore: false,
    triggered: false,
    loading: false,
    messageCooldown: 0,
    maxMessagesPerMinute: 10,
    messageQueue: [],
    currentUserOpenId: '',
    shareModalVisible: false,
    currentSharePost: null,
    showShareSuccess: false,
    isAdmin: false
  },

  onLoad() {
    this.loadBanners();
    this.getUserOpenId();
    this.getPinnedPosts();
    this.getPosts(true);
    this.checkAdminStatus();
  },

  // 检查管理员状态
  async checkAdminStatus() {
    try {
      const adminList = ['管理员openid1', '管理员openid2']; // 请替换为真实 openid
      const userOpenId = this.data.currentUserOpenId || await this.getCurrentUserOpenId();
      const isAdmin = adminList.includes(userOpenId);
      this.setData({ isAdmin });
    } catch (error) {
      console.error('检查管理员状态失败:', error);
    }
  },

  // 获取当前用户openid
  async getCurrentUserOpenId() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenId' });
      return res.result.openid;
    } catch (error) {
      console.error('获取用户openid失败:', error);
      return null;
    }
  },

  // 编辑轮播图
  onEditBanner(e) {
    const index = e.currentTarget.dataset.index;
    const banner = this.data.banners[index];
    wx.showActionSheet({
      itemList: ['更换图片', '修改信息', '删除'],
      success: (res) => {
        const tapIndex = res.tapIndex;
        if (tapIndex === 0) {
          this.uploadBannerImage(banner._id, index);
        } else if (tapIndex === 1) {
          this.editBannerInfo(banner);
        } else if (tapIndex === 2) {
          this.deleteBanner(banner._id, index);
        }
      }
    });
  },

  // 添加新轮播图
  onAddBanner() {
    wx.showModal({
      title: '添加轮播图',
      content: '请选择操作',
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

  uploadNewBannerImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '上传中...' });
        try {
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: `banners/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`,
            filePath: tempFilePath,
          });
          const imageUrl = uploadResult.fileID;
          this.showAddBannerForm(imageUrl);
        } catch (error) {
          console.error('上传图片失败:', error);
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
        wx.hideLoading();
      }
    });
  },

  showAddBannerForm(imageUrl = '') {
    wx.showModal({
      title: '添加轮播图',
      content: '请输入轮播图信息',
      editable: true,
      placeholderText: '请输入标题',
      success: async (res) => {
        if (res.confirm) {
          const title = res.content;
          try {
            await db.collection('banners').add({
              data: {
                imageUrl: imageUrl,
                title: title,
                isActive: true,
                sortOrder: 0,
                createTime: db.serverDate(),
                startTime: db.serverDate(),
                linkType: 'page',
                linkUrl: ''
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

  // 加载轮播图数据
  async loadBanners() {
    try {
      const { data } = await db.collection('banners')
        .where({
          isActive: true,
          startTime: db.command.lte(new Date()),
          endTime: db.command.or(
            db.command.exists(false),
            db.command.gte(new Date())
          )
        })
        .orderBy('sortOrder', 'asc')
        .orderBy('createTime', 'desc')
        .get();

      this.setData({ banners: data });
    } catch (error) {
      console.error('加载轮播图失败:', error);
      this.setData({
        banners: [
          { _id: 'default1', imageUrl: '/image/banner1.jpg', title: '校园活动预告', description: '最新学术讲座和社团活动' },
          { _id: 'default2', imageUrl: '/image/banner2.jpg', title: '热门话题讨论', description: '参与校园热点话题讨论' }
        ]
      });
    }
  },

  onBannerChange(e) {
    this.setData({ currentBanner: e.detail.current });
  },

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
    }
  },

  // 预览图片
  previewImage(e) {
    const imgUrls = e.currentTarget.dataset.imgurls;
    const current = e.currentTarget.dataset.current;
    wx.previewImage({
      current: current,
      urls: imgUrls
    });
  },

  // 获取用户openid
  async getUserOpenId() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenId' });
      this.setData({ currentUserOpenId: res.result.openid });
    } catch (error) {
      console.error('获取用户openid失败:', error);
    }
  },

  // 获取置顶帖子
  async getPinnedPosts() {
    try {
      const res = await db.collection('posts')
        .where({ isPinned: true })
        .orderBy('createTime', 'desc')
        .get();

      // 格式化时间
      const formattedPinnedPosts = res.data.map(post => ({
        ...post,
        formattedCreateTime: formatTime(post.createTime)
      }));

      this.setData({ pinnedPosts: formattedPinnedPosts });
    } catch (error) {
      console.error('获取置顶帖子失败:', error);
    }
    wx.showLoading({ title: '加载中' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'forum-getPinnedPosts'
      });

      const pinnedPostsWithLikeStatus = res.result.data.map(post => {
        const isLiked = post.likedBy && post.likedBy.includes(this.data.currentUserOpenId);
        const formattedTime = this.formatTime(post.createTime);
        return {
          ...post,
          isLiked: isLiked || false,
          likeCount: post.likeCount || 0,
          formattedTime: formattedTime
        };
      });

      this.setData({ pinnedPosts: pinnedPostsWithLikeStatus });
    } catch (error) {
      console.error('获取置顶帖子失败:', error);
    }
    wx.hideLoading();
  },

  // 获取帖子列表
  async getPosts(init = false) {
    if (init) {
      this.setData({ posts: [], page: 1, nomore: false });
    }

    if (this.data.nomore) return;

    this.setData({ loading: true });
    try {
      const res = await db.collection('posts')
        .where({ isPinned: false })
        .orderBy('createTime', 'desc')
        .skip((this.data.page - 1) * this.data.size)
        .limit(this.data.size)
        .get();

      if (res.data.length === 0) {
        this.setData({ nomore: true });
        return;
      }

      // 格式化时间
      const formattedPosts = res.data.map(post => ({
        ...post,
        formattedCreateTime: formatTime(post.createTime)
      }));

      this.setData({
        posts: init ? formattedPosts : [...this.data.posts, ...formattedPosts],
        page: this.data.page + 1
      });
    } catch (error) {
      console.error('获取帖子失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, triggered: false });
    }
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'forum-getPosts',
        data: { page: this.data.page, size: this.data.size }
      });

      const postsWithLikeStatus = res.result.data.map(post => {
        const isLiked = post.likedBy && post.likedBy.includes(this.data.currentUserOpenId);
        const formattedTime = this.formatTime(post.createTime);
        return {
          ...post,
          isLiked: isLiked || false,
          likeCount: post.likeCount || 0,
          formattedTime: formattedTime
        };
      });

      if (reset) {
        this.setData({ posts: postsWithLikeStatus });
      } else {
        if (postsWithLikeStatus.length === 0) {
          this.setData({ nomore: true });
        } else {
          this.setData({
            posts: this.data.posts.concat(postsWithLikeStatus)
          });
        }
      }
    } catch (error) {
      console.error('获取帖子失败:', error);
    }
    this.setData({ loading: false });
  },

  // ✅ 时间格式化
  formatTime(time) {
    const date = typeof time === 'string' ? new Date(time) : time;
    const now = new Date();
    const diff = now - date;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + '分钟前';
    if (date.getDate() === now.getDate()) return Math.floor(diff / hour) + '小时前';
    if (date.getDate() === now.getDate() - 1) {
      return '昨天 ' + date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
    }
    return (date.getMonth() + 1).toString().padStart(2, '0') + '-' +
           date.getDate().toString().padStart(2, '0') + ' ' +
           date.getHours().toString().padStart(2, '0') + ':' +
           date.getMinutes().toString().padStart(2, '0');
  },

  // 点赞处理
  async handleLike(e) {
    if (!this.data.currentUserOpenId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const post = e.currentTarget.dataset.post;
    const postId = post._id;

    try {
      const isLiked = post.isLiked;

      const updatedPosts = this.data.posts.map(p => {
        if (p._id === postId) {
          return {
            ...p,
            isLiked: !isLiked,
            likeCount: isLiked ? p.likeCount - 1 : p.likeCount + 1
          };
        }
        return p;
      });

      const updatedPinnedPosts = this.data.pinnedPosts.map(p => {
        if (p._id === postId) {
          return {
            ...p,
            isLiked: !isLiked,
            likeCount: isLiked ? p.likeCount - 1 : p.likeCount + 1
          };
        }
        return p;
      });

      this.setData({ posts: updatedPosts, pinnedPosts: updatedPinnedPosts });

      if (isLiked) {
        await db.collection('posts').doc(postId).update({
          data: {
            likeCount: _.inc(-1),
            likedBy: _.pull(this.data.currentUserOpenId)
          }
        });
      } else {
        await db.collection('posts').doc(postId).update({
          data: {
            likeCount: _.inc(1),
            likedBy: _.push(this.data.currentUserOpenId)
          }
        });
        wx.showToast({ title: '已点赞', icon: 'success', duration: 1000 });
      }
    } catch (error) {
      console.error('点赞失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
      this.getPinnedPosts();
      this.getPosts(true);
    }
  },

  // 下拉刷新
  async onRefresh() {
    this.setData({ triggered: true, page: 1, nomore: false });
    await this.loadBanners();
    await this.getPinnedPosts();
    await this.getPosts(true);
    this.setData({ triggered: false });
  },

  // 上拉加载更多
  async loadMore() {
    if (this.data.nomore) return;
    this.setData({ page: this.data.page + 1 });
    await this.getPosts(false);
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/forum/detail?id=${id}`
    });
  },

  goPost() {
    wx.navigateTo({
      url: '/pages/forum/post'
    });
  },

  // ✅ 修改：跳转到用户主页（他人）
  goUserProfile(e) {
    const openid = e.currentTarget.dataset.openid;
    if (!openid) {
      wx.showToast({ title: '用户信息异常', icon: 'none' });
      return;
    }
    // ✅ 正确跳转
    wx.navigateTo({
      url: `/pages/user-profile/index?openid=${openid}`
    });
  },

  // 发送消息（如聊天功能）
  sendMessage(e) {
    const message = e.detail.value.message;
    const currentTime = Date.now();

    if (this.data.messageCooldown > currentTime) {
      wx.showToast({ title: '发送太频繁，请稍后再试', icon: 'none' });
      return;
    }

    this.data.messageQueue.push(currentTime);
    const recentMessages = this.data.messageQueue.filter(time => currentTime - time < 60000);
    if (recentMessages.length > this.data.maxMessagesPerMinute) {
      wx.showToast({ title: '发送太频繁，请稍后再试', icon: 'none' });
      return;
    }

    this.sendToServer(message);
    this.setData({
      messageCooldown: currentTime + 60000 / this.data.maxMessagesPerMinute
    });
  },

  sendToServer(message) {
    wx.cloud.callFunction({
      name: 'sendMessage',
      data: { message, userId: wx.getStorageSync('userId'), action: 'sendMessage' }
    }).then(res => {
      if (res.result.code === 200) {
        wx.showToast({ title: '发送成功' });
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    }).catch(err => {
      wx.showToast({ title: '发送失败', icon: 'none' });
    });
  },

  // 分享相关
  openShareModal(e) {
    const post = e.currentTarget.dataset.post;
    this.setData({
      shareModalVisible: true,
      currentSharePost: post
    });
  },

  closeShareModal() {
    this.setData({ shareModalVisible: false });
  },

  preventTap() {},

  copyPostLink() {
    const post = this.data.currentSharePost;
    const link = `pages/forum/detail?id=${post._id}`;

    wx.setClipboardData({
      data: link,
      success: () => {
        this.closeShareModal();
        this.showShareSuccess();
        this.updateShareCount(post._id);
      }
    });
  },

  showShareSuccess() {
    this.setData({ showShareSuccess: true });
    setTimeout(() => {
      this.setData({ showShareSuccess: false });
    }, 2000);
  },

  onShareAppMessage(options) {
    const from = options.from;
    let title = '发现一个有趣的帖子';
    let path = '/pages/index/index';
    let imageUrl = '';

    if (from === 'button' && options.target) {
      const post = this.data.currentSharePost;
      if (post) {
        title = post.title;
        path = `/pages/forum/detail?id=${post._id}`;
        imageUrl = post.imageUrl || '/image/share-default.png';
      }
    }

    return {
      title,
      path,
      imageUrl,
      success: () => {
        this.showShareSuccess();
        if (this.data.currentSharePost) {
          this.updateShareCount(this.data.currentSharePost._id);
        }
      },
      fail: err => console.error('分享失败', err)
    };
  },

  onShareTimeline() {
    const post = this.data.currentSharePost;
    let title = '发现一个有趣的帖子';
    let imageUrl = '';

    if (post) {
      title = post.title;
      imageUrl = post.imageUrl || '/image/share-default.png';
    }

    return {
      title,
      imageUrl,
      success: () => {
        this.showShareSuccess();
        if (post) {
          this.updateShareCount(post._id);
        }
      },
      fail: err => console.error('分享到朋友圈失败', err)
    };
  },

  updateShareCount(postId) {
    db.collection('posts').doc(postId).update({
      data: { shareCount: _.inc(1) }
    }).then(() => {
      console.log('分享计数更新成功');
    }).catch(err => {
      console.error('分享计数更新失败', err);
    });
  },

  onPublicManageBannerTap() {
    wx.navigateTo({
      url: '/pages/bannerManage/bannerManage'
    });
  }
});
const db = wx.cloud.database()

Page({
  data: {
    clubs: [],
    leftColumnClubs: [],
    rightColumnClubs: [],
    loading: true,
    error: false,
    showBackTop: false
  },

  onLoad() {
    this.loadClubs()
    // 监听滚动显示回到顶部按钮
    wx.pageScrollTo({
      scrollTop: 0,
      success: () => {
        this.setData({ showBackTop: false })
      }
    })
  },

  onPageScroll(e) {
    // 显示/隐藏回到顶部按钮
    this.setData({
      showBackTop: e.scrollTop > 300
    })
  },

  // 加载社团列表
  async loadClubs() {
    try {
      this.setData({ loading: true, error: false })
      
      const res = await db.collection('clubs').get()
      
      // 分配瀑布流布局
      this.distributeWaterfall(res.data)
      
      this.setData({
        clubs: res.data,
        loading: false
      })
      
    } catch (error) {
      console.error('加载社团失败:', error)
      this.setData({
        loading: false,
        error: true
      })
    }
  },

  // 瀑布流分布算法
  distributeWaterfall(clubs) {
    const leftColumn = []
    const rightColumn = []
    let leftHeight = 0
    let rightHeight = 0

    // 假设每个卡片高度大致相同，可以根据实际情况调整
    clubs.forEach((club, index) => {
      const itemHeight = 400 // 预估每个卡片高度
      
      if (leftHeight <= rightHeight) {
        leftColumn.push(club)
        leftHeight += itemHeight
      } else {
        rightColumn.push(club)
        rightHeight += itemHeight
      }
    })

    this.setData({
      leftColumnClubs: leftColumn,
      rightColumnClubs: rightColumn
    })
  },

  // 回到顶部
  scrollToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    })
  },

  // 跳转到社团详情
  goClubDetail(e) {
    const clubId = e.currentTarget.dataset.id
    const club = this.data.clubs.find(item => item._id === clubId)
    
    if (club) {
      wx.navigateTo({
        url: `/pages/clubDetail/clubDetail?club=${encodeURIComponent(JSON.stringify(club))}`
      })
    }
  },

  // 跳转到管理页面
  goToManage() {
    wx.navigateTo({
      url: '/pages/clubManage/clubManage'
    })
  }
})
Page({
  data: {
    weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    currentWeek: 0,
    weekDays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    classTimes: [
      { name: '第一大节', time: '8:00-9:40' },
      { name: '第二大节', time: '10:00-11:40' },
      { name: '第三大节', time: '14:00-15:40' },
      { name: '第四大节', time: '16:00-17:40' },
      { name: '第五大节', time: '19:00-20:40' },
      { name: '第六大节', time: '21:00-22:40' }
    ],
    allScheduleData: [],
    filteredSchedule: [],
    isEmpty: false,
    showModal: false,
    currentClass: {},
    isRefreshing: false,
    lastUpdateTime: '',
    hasLogin: false,
    showWeekSetting: false,
    tempCurrentWeek: 1,
    currentDates: [],
    semesterStartDate: null
  },

  onLoad() {
    this.checkLoginStatus();
    this.autoRefreshTimer = setInterval(() => {
      this.autoRefreshSchedule();
    }, 30 * 60 * 1000);
    
    this.loadSemesterStartDate();
  },

  onUnload() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
  },

  onShow() {
    // 检查登录状态，如果已登录则刷新课表
    this.checkLoginStatusAndRefresh();
    this.calculateCurrentWeek();
    this.setData({
      currentWeek: this.data.currentWeek
    });
  },

  // 检查登录状态并刷新课表
  checkLoginStatusAndRefresh() {
    try {
      const stuId = wx.getStorageSync('stuId');
      const pwd = wx.getStorageSync('pwd');
      
      if (stuId && pwd) {
        const app = getApp();
        // 如果全局变量中没有登录信息，则设置
        if (!app.globalData.stuId || !app.globalData.pwd) {
          app.globalData.stuId = stuId;
          app.globalData.pwd = pwd;
        }
        
        // 如果之前未登录，现在有登录信息，则刷新课表
        if (!this.data.hasLogin) {
          this.setData({ hasLogin: true });
          this.loadScheduleDataFromCacheOrNetwork(); // 修改这里：优先从缓存加载
        }
      } else {
        this.setData({ hasLogin: false });
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    }
  },

  // 新增：从缓存或网络加载课表数据
  loadScheduleDataFromCacheOrNetwork() {
    // 先尝试从缓存读取
    const cachedData = this.getCachedScheduleData();
    if (cachedData) {
      // 缓存有效，使用缓存数据
      this.processScheduleData(cachedData);
      this.setData({ 
        isEmpty: false,
        lastUpdateTime: this.getCurrentTime()
      });
      this.calculateCurrentWeekDates();
      console.log('使用缓存的课表数据');
    } else {
      // 缓存无效或不存在，从网络获取
      this.loadScheduleData(true);
    }
  },

  // 新增：获取缓存的课表数据
  getCachedScheduleData() {
    try {
      const cachedData = wx.getStorageSync('cachedScheduleData');
      const cacheTimestamp = wx.getStorageSync('scheduleCacheTimestamp');
      
      if (cachedData && cacheTimestamp) {
        const now = new Date().getTime();
        const oneWeek = 7 * 24 * 60 * 60 * 1000; // 一周的毫秒数
        
        // 检查缓存是否在一周内
        if (now - cacheTimestamp < oneWeek) {
          return cachedData;
        } else {
          // 缓存过期，清除缓存
          this.clearScheduleCache();
        }
      }
    } catch (error) {
      console.error('读取缓存失败:', error);
    }
    return null;
  },

  // 新增：清除课表缓存
  clearScheduleCache() {
    try {
      wx.removeStorageSync('cachedScheduleData');
      wx.removeStorageSync('scheduleCacheTimestamp');
      console.log('已清除过期的课表缓存');
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  },

  // 新增：保存课表数据到缓存
  saveScheduleDataToCache(scheduleData) {
    try {
      wx.setStorageSync('cachedScheduleData', scheduleData);
      wx.setStorageSync('scheduleCacheTimestamp', new Date().getTime());
      console.log('课表数据已缓存');
    } catch (error) {
      console.error('保存缓存失败:', error);
    }
  },

  // 加载学期开始日期
  loadSemesterStartDate() {
    const savedDate = wx.getStorageSync('semesterStartDate');
    if (savedDate) {
      this.setData({
        semesterStartDate: new Date(savedDate)
      });
      this.calculateCurrentWeek();
    }
  },

  // 计算当前周数
  calculateCurrentWeek() {
    if (!this.data.semesterStartDate) return;

    const now = new Date();
    const startDate = new Date(this.data.semesterStartDate);
    
    const diffTime = now - startDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    let actualWeek = Math.floor(diffDays / 7) + 1;
    actualWeek = Math.max(1, Math.min(actualWeek, 20));
    
    const weekIndex = actualWeek - 1;
    
    if (weekIndex !== this.data.currentWeek) {
      this.setData({
        currentWeek: weekIndex,
        filteredSchedule: this.filterScheduleByWeek(this.data.allScheduleData, weekIndex)
      });
      this.calculateCurrentWeekDates();
    }
  },

  // 计算当前周对应的日期
  calculateCurrentWeekDates() {
    if (!this.data.semesterStartDate) return;

    const startDate = new Date(this.data.semesterStartDate);
    const currentWeekIndex = this.data.currentWeek;
    
    const weekStartDate = new Date(startDate);
    weekStartDate.setDate(startDate.getDate() + currentWeekIndex * 7);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + i);
      dates.push(this.formatDate(date));
    }
    
    this.setData({ currentDates: dates });
  },

  // 格式化日期为 "M月D日"
  formatDate(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  // 显示设置周数面板
  showWeekSettingPanel() {
    this.setData({
      showWeekSetting: true,
      tempCurrentWeek: this.data.currentWeek + 1
    });
  },

  // 隐藏设置周数面板
  hideWeekSettingPanel() {
    this.setData({ showWeekSetting: false });
  },

  // 设置临时周数
  setTempWeek(e) {
    this.setData({
      tempCurrentWeek: parseInt(e.detail.value)
    });
  },

  // 确认设置周数
  confirmWeekSetting() {
    const userWeek = this.data.tempCurrentWeek;
    const today = new Date();
    
    const daysFromStart = (userWeek - 1) * 7;
    const semesterStartDate = new Date(today);
    semesterStartDate.setDate(today.getDate() - daysFromStart - today.getDay() + 1);
    
    const weekIndex = userWeek - 1;
    
    this.setData({
      semesterStartDate: semesterStartDate,
      currentWeek: weekIndex,
      showWeekSetting: false,
      filteredSchedule: this.filterScheduleByWeek(this.data.allScheduleData, weekIndex)
    });
    
    wx.setStorageSync('semesterStartDate', semesterStartDate.toISOString());
    this.calculateCurrentWeekDates();
    
    wx.showToast({
      title: '设置成功',
      icon: 'success'
    });
  },

  // 检查登录状态
  checkLoginStatus() {
    try {
      const stuId = wx.getStorageSync('stuId');
      const pwd = wx.getStorageSync('pwd');
      
      if (stuId && pwd) {
        const app = getApp();
        app.globalData.stuId = stuId;
        app.globalData.pwd = pwd;
        
        this.setData({ hasLogin: true });
        this.loadScheduleDataFromCacheOrNetwork(); // 修改这里：优先从缓存加载
      } else {
        this.setData({ hasLogin: false });
        wx.showToast({
          title: '请先登录',
          icon: 'none',
          duration: 1500
        });
        
        setTimeout(() => {
          wx.switchTab({ url: '/pages/my/my' });
        }, 1500);
      }
    } catch (error) {
      console.error('读取登录信息失败:', error);
    }
  },

  // 自动刷新课程表
  autoRefreshSchedule() {
    if (this.data.hasLogin) {
      this.loadScheduleData(true);
      this.calculateCurrentWeek();
    }
  },

  // 手动刷新
  onRefresh() {
    if (this.data.isRefreshing || !this.data.hasLogin) return;
    
    this.setData({ isRefreshing: true });
    
    this.loadScheduleData(false, () => {
      setTimeout(() => {
        this.setData({ isRefreshing: false });
      }, 1000);
    });
  },

  // 加载课表数据（保持原有逻辑不变，只添加缓存保存）
  loadScheduleData(isAutoRefresh = false, callback = null) {
    const app = getApp();
    const { stuId, pwd } = app.globalData;
    
    if (!stuId || !pwd) {
      this.setData({ hasLogin: false });
      wx.switchTab({ url: '/pages/my/my' });
      if (callback) callback();
      return;
    }

    wx.showLoading({ title: '加载中' });
    
    wx.cloud.callFunction({
      name: 'classtable',
      data: { stuId, pwd }
    }).then(res => {
      wx.hideLoading();
      const result = res.result || res;
      
      if (result && result.code === 0) {
        const scheduleData = result.data || [];
        
        // 新增：保存数据到缓存
        this.saveScheduleDataToCache(scheduleData);
        
        this.processScheduleData(scheduleData);
        this.setData({ 
          isEmpty: false,
          hasLogin: true,
          lastUpdateTime: this.getCurrentTime()
        });
        
        this.calculateCurrentWeekDates();
        
        if (isAutoRefresh) {
          wx.showToast({
            title: '课表已自动更新',
            icon: 'success',
            duration: 2000
          });
        }
      } else {
        this.setData({ 
          allScheduleData: [],
          filteredSchedule: [],
          isEmpty: true,
          hasLogin: true 
        });
        wx.showToast({
          title: result.msg || '加载课表失败',
          icon: 'none'
        });
      }
      
      if (callback) callback();
    }).catch(err => {
      wx.hideLoading();
      console.error(err);
      this.setData({ 
        allScheduleData: [],
        filteredSchedule: [],
        isEmpty: true,
        hasLogin: true 
      });
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      });
      if (callback) callback();
    });
  },

  // 获取当前时间
  getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  },

  // 处理课表数据
  processScheduleData(kb) {
    const scheduleData = [];
    for (let i = 0; i < 7; i++) {
      const day = {
        day: this.data.weekDays[i],
        classes: []
      };
      for (let j = 0; j < 6; j++) {
        day.classes.push([]);
      }
      scheduleData.push(day);
    }

    kb.forEach((item, index) => {
      const dayIndex = parseInt(item.day) || 0;
      let timeIndex = this.parseTimeToIndex(item.time);
      const weekRanges = this.parseWeeks(item.weeks);
      
      const classItem = {
        id: index,
        course: item.course,
        teacher: item.teacher,
        room: item.room,
        weeks: item.weeks,
        time: item.time,
        weekRanges: weekRanges
      };
      
      if (dayIndex < 7 && timeIndex >= 0 && timeIndex < 6) {
        scheduleData[dayIndex].classes[timeIndex].push(classItem);
      }
    });

    this.setData({ 
      allScheduleData: scheduleData,
      filteredSchedule: this.filterScheduleByWeek(scheduleData, this.data.currentWeek)
    });
  },

  // 将时间段字符串转换为索引
  parseTimeToIndex(timeStr) {
    if (timeStr.includes('第一大节')) return 0;
    if (timeStr.includes('第二大节')) return 1;
    if (timeStr.includes('第三大节')) return 2;
    if (timeStr.includes('第四大节')) return 3;
    if (timeStr.includes('第五大节')) return 4;
    if (timeStr.includes('第六大节')) return 5;
    return 0;
  },

  // 解析周次字符串
  parseWeeks(weeksStr) {
    const ranges = [];
    
    let cleanWeeksStr = weeksStr
      .replace(/\(周\)|周|\[.*\]/g, '')
      .trim();
    
    const weekParts = cleanWeeksStr.split(',');
    
    weekParts.forEach(part => {
      part = part.trim();
      if (!part) return;
      
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(num => {
          const weekNum = parseInt(num.trim());
          return !isNaN(weekNum) ? weekNum - 1 : NaN;
        });
        if (!isNaN(start) && !isNaN(end)) {
          ranges.push({ start, end });
        }
      } else {
        const week = parseInt(part.trim());
        if (!isNaN(week)) {
          const adjustedWeek = week - 1;
          ranges.push({ start: adjustedWeek, end: adjustedWeek });
        }
      }
    });
    
    return ranges;
  },

  // 检查课程是否在当前周
  isClassInWeek(classItem, week) {
    return classItem.weekRanges.some(range => 
      week >= range.start && week <= range.end
    );
  },

  // 根据周数筛选课程
  filterScheduleByWeek(scheduleData, week) {
    return scheduleData.map(day => ({
      ...day,
      classes: day.classes.map(timeSlot => 
        timeSlot.filter(classItem => this.isClassInWeek(classItem, week))
      )
    }));
  },

  // 切换周次
  switchWeek(e) {
    const week = parseInt(e.currentTarget.dataset.week);
    this.setData({ 
      currentWeek: week,
      filteredSchedule: this.filterScheduleByWeek(this.data.allScheduleData, week)
    });
    this.calculateCurrentWeekDates();
  },

  // 显示课程详情
  showClassDetail(e) {
    const { day, time, index } = e.currentTarget.dataset;
    const classList = this.data.filteredSchedule[day].classes[time];
    
    if (classList && classList[index]) {
      this.setData({
        currentClass: classList[index],
        showModal: true
      });
    }
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({ showModal: false });
  },

  // 阻止事件冒泡
  stopPropagation() {}
});
App({
  globalData: {
    userInfo: null,
    checkinCount: 0,
    achievementLevel: 0
  },
  onLaunch() {
    const checkinCount = wx.getStorageSync('checkinCount') || 0;
    this.globalData.checkinCount = checkinCount;
  }
})

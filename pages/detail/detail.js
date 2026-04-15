const { contents } = require('../../data/mock')

Page({
  data: { content: null },
  onLoad(options) {
    const id = parseInt(options.id)
    const content = contents.find(c => c.id === id)
    this.setData({ content })
    wx.setNavigationBarTitle({ title: content ? content.title : '详情' })
  },
  onCheckin() {
    wx.showToast({ title: '打卡成功 +1', icon: 'success' })
    const app = getApp()
    app.globalData.checkinCount++
    wx.setStorageSync('checkinCount', app.globalData.checkinCount)
  },
  onMap() {
    wx.showToast({ title: '地图功能即将上线', icon: 'none' })
  },
  onActivity() {
    wx.switchTab({ url: '/pages/activity/activity' })
  }
})

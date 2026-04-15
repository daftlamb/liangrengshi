Page({
  data: {
    checkinCount: 0,
    achievementLevels: [1, 9, 33, 66, 99],
    currentLevel: 0,
    menuItems: [
      { id: 1, icon: '../../icons/target.png', label: '任务中心' },
      { id: 2, icon: '../../icons/parking.png', label: '停车缴费' },
      { id: 3, icon: '../../icons/receipt.png', label: '开具发票' },
      { id: 4, icon: '../../icons/feedback.png', label: '反馈建议' },
      { id: 5, icon: '../../icons/settings.png', label: '设置' },
    ]
  },
  onShow() {
    const app = getApp()
    const count = app.globalData.checkinCount
    const levels = [1, 9, 33, 66, 99]
    let currentLevel = 0
    for (let i = 0; i < levels.length; i++) {
      if (count >= levels[i]) currentLevel = i
    }
    this.setData({ checkinCount: count, currentLevel })
  },
  onMenuTap(e) {
    wx.showToast({ title: `${e.currentTarget.dataset.label} 即将上线`, icon: 'none' })
  }
})

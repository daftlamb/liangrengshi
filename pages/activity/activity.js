const { contents } = require('../../data/mock')

Page({
  data: {
    activeTab: 0,
    tabs: ['日历视图', '分类视图'],
    contents,
    categories: ['艺术季', '市集', '展览', '空间'],
    currentMonth: '',
    calendarDays: [],
    activeDates: [],
  },

  onLoad() {
    this.buildCalendar()
  },

  buildCalendar() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = now.getDate()

    // Active dates from mock (simplified: use day numbers)
    const activeDates = [18, 20, 22, 25, 28]

    const days = []
    for (let i = 0; i < firstDay; i++) days.push({ day: '', active: false, today: false })
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, active: activeDates.includes(d), today: d === today })
    }

    this.setData({
      currentMonth: `${year}年${month + 1}月`,
      calendarDays: days,
      activeDates
    })
  },

  onTabTap(e) {
    this.setData({ activeTab: e.currentTarget.dataset.idx })
  },

  onContentTap(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` })
  },

  getContentsByCategory(cat) {
    return this.data.contents.filter(c => c.category === cat)
  }
})

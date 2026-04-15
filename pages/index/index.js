const { banners, quickLinks, contents, categories } = require('../../data/mock')

Page({
  data: {
    banners,
    quickLinks,
    categories,
    activeCategory: '全部',
    filteredContents: contents,
    allContents: contents,
    statusBarHeight: 0,
    navBarHeight: 44,
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight })
  },

  onCategoryTap(e) {
    const cat = e.currentTarget.dataset.cat
    const filtered = cat === '全部'
      ? this.data.allContents
      : this.data.allContents.filter(c => c.category === cat || (cat === '新开' && c.tagType === 'new'))
    this.setData({ activeCategory: cat, filteredContents: filtered })
  },

  onContentTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  onQuickLinkTap(e) {
    const id = e.currentTarget.dataset.id
    if (id === 2) wx.navigateTo({ url: '/pages/mine/mine' })
    else if (id === 3) wx.switchTab({ url: '/pages/activity/activity' })
  }
})

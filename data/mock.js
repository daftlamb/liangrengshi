const banners = [
  { id: 1, title: '九十九台独角戏', subtitle: '实验艺术季 2026', color: '#1a1a2e' },
  { id: 2, title: '春日市集', subtitle: '4月20日 · 良壤广场', color: '#16213e' },
  { id: 3, title: '当代艺术展', subtitle: '持续展出中', color: '#0f3460' },
]

const quickLinks = [
  { id: 1, icon: '🚗', label: '停车缴费' },
  { id: 2, icon: '📍', label: '打卡积分' },
  { id: 3, icon: '🎭', label: '活动报名' },
  { id: 4, icon: '🗺️', label: '地图导览' },
]

const contents = [
  { id: 1, title: '九十九台独角戏', desc: '99个表演者，99个空间，99种相遇', tag: '进行中', tagType: 'active', time: '4.20 - 5.5', category: '艺术季', color: '#1a1a2e',
    detail: '九十九台独角戏是一场关于孤独与相遇的实验艺术季。99位表演者分散在良壤街区的99个角落，每一次相遇都是偶然，每一次驻足都是选择。\n\n没有舞台，没有观众席。你走进的每一个空间，都可能是一场演出的开始。\n\n参与方式：自由漫游街区，扫描点位二维码解锁表演。' },
  { id: 2, title: '春日陶艺市集', desc: '来自全国的独立陶艺师联展', tag: '新开', tagType: 'new', time: '4.18 - 4.28', category: '市集', color: '#2d1b00',
    detail: '汇聚来自全国20余位独立陶艺师，带来手工陶器、釉色实验与现场创作展示。每件作品都是唯一的，每一道釉色都是窑火的馈赠。' },
  { id: 3, title: '光影装置展', desc: '沉浸式光影体验，探索感知边界', tag: '推荐', tagType: 'rec', time: '持续展出', category: '展览', color: '#001a2d',
    detail: '艺术家以光为媒介，在黑暗空间中构建感知迷宫。观者在光影之间穿行，边界消失，自我重现。' },
  { id: 4, title: '独立书店 · 纸上良壤', desc: '艺术类独立出版物精选', tag: '新开', tagType: 'new', time: '已开业', category: '空间', color: '#1a0a00',
    detail: '专注艺术、设计、建筑类独立出版物。不只是书店，也是一个可以坐下来慢慢翻阅的空间。' },
  { id: 5, title: '声音艺术工作坊', desc: '用声音重新感知空间', tag: '即将开始', tagType: 'soon', time: '4.22', category: '艺术季', color: '#0a1a0a',
    detail: '声音艺术家带领参与者用录音设备探索街区的声音地景，最终共同创作一张街区声音地图。' },
  { id: 6, title: '良壤夜市', desc: '每周五夜间限定，街区限定美食', tag: '进行中', tagType: 'active', time: '每周五 18:00', category: '市集', color: '#1a1a00',
    detail: '每周五傍晚，良壤广场变身夜市。街区内外的独立餐饮品牌带来限定菜单，配合现场音乐演出。' },
]

const categories = ['全部', '艺术季', '展览', '市集', '空间', '新开']

module.exports = { banners, quickLinks, contents, categories }

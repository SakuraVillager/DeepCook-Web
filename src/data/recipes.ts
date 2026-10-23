export type MenuRecipe = {
  id: string
  title: string
  titleEn: string
  cover: string
  categories: string[]
  region: string
  servings: string
  minutes: number | null
  difficulty: number | null
}

export const menuRecipes: MenuRecipe[] = [
  {
    id: 'eu-paella',
    title: '西班牙海鲜饭',
    titleEn: 'PAELLA',
    cover: './photos/eu-paella.jpg',
    categories: ['海鲜', '主食'],
    region: '欧式',
    servings: '4 人份',
    minutes: null,
    difficulty: null,
  },
  {
    id: 'eu-beef-bourguignon',
    title: '红酒炖牛肉',
    titleEn: 'BEEF BOURGUIGNON',
    cover: './photos/eu-beef-bourguignon.jpg',
    categories: ['肉类', '家常菜'],
    region: '欧式',
    servings: '无',
    minutes: null,
    difficulty: null,
  },
  {
    id: 'cn-xiaolongbao',
    title: '小笼包',
    titleEn: 'XIAOLONGBAO',
    cover: './photos/cn-xiaolongbao.jpg',
    categories: ['主食', '早餐'],
    region: '中式',
    servings: '3—4 人份',
    minutes: null,
    difficulty: null,
  },
  {
    id: 'eu-margherita',
    title: '玛格丽特披萨',
    titleEn: 'MARGHERITA',
    cover: './photos/eu-margherita.jpg',
    categories: ['面食', '素食'],
    region: '欧式',
    servings: '2 人份',
    minutes: null,
    difficulty: null,
  },
  {
    id: 'htc-fce469feac21f46a',
    title: '啤酒鸭',
    titleEn: 'BEER DUCK',
    cover: './photos/pijiu-ya.jpg',
    categories: ['家常菜', '肉类'],
    region: '无',
    servings: '无',
    minutes: 60,
    difficulty: 4,
  },
  {
    id: 'htc-8c3af213e85c417e',
    title: '提拉米苏',
    titleEn: 'TIRAMISU',
    cover: './photos/eu-tiramisu.jpg',
    categories: ['甜点', '欧式'],
    region: '欧式',
    servings: '无',
    minutes: null,
    difficulty: 4,
  },
]

export const navItems = [
  { zh: '理念', en: 'MANIFESTO', href: '#manifesto' },
  { zh: '功能', en: 'FEATURES', href: '#features' },
  { zh: '菜单', en: 'MENU', href: '#menu' },
  { zh: '下载', en: 'DOWNLOAD', href: '#download' },
]

export const heatSections = [
  { id: 'top', num: '00', name: '开火', zh: '首页' },
  { id: 'manifesto', num: '01', name: '文火', zh: '理念' },
  { id: 'features', num: '02', name: '中火', zh: '找菜' },
  { id: 'cook', num: '03', name: '大火', zh: '烹饪' },
  { id: 'understand', num: '04', name: '余温', zh: '懂菜' },
  { id: 'menu', num: '05', name: '上菜', zh: '菜单' },
  { id: 'next', num: '06', name: '备菜', zh: '下一步' },
  { id: 'download', num: '07', name: '上桌', zh: '下载' },
]

export const searchResults = [
  {
    title: '番茄豆腐汤',
    meta: '家常菜 · 快手菜',
    time: '15 MIN · 难度 2',
    cover: './photos/tomato-tofu-soup.jpg',
  },
  {
    title: '北非风味番茄炖蛋',
    meta: '国际菜 · 早餐',
    time: '20 MIN',
    cover: './photos/shakshuka.jpg',
  },
  {
    title: '澳门湿版免治牛肉饭',
    meta: '家常菜 · 肉类',
    time: '30 MIN · 难度 2',
    cover: './photos/minced-beef-rice.jpg',
  },
]

export const tickerWords = [
  { zh: '大火爆炒', en: 'SEAR' },
  { zh: '小火慢炖', en: 'SIMMER' },
  { zh: '中火收汁', en: 'REDUCE' },
  { zh: '余温静置', en: 'REST' },
  { zh: '上锅蒸透', en: 'STEAM' },
  { zh: '热油快炸', en: 'FRY' },
  { zh: '凉拌入味', en: 'TOSS' },
]

export const cookSteps = [
  {
    num: '01',
    title: '切肉',
    text: '五花肉切 4.5cm 大块。冷冻半小时到一小时，会更好切。',
    timer: null,
  },
  {
    num: '02',
    title: '焯水',
    text: '冷水下锅，加入料酒与葱姜，煮 15 分钟去掉血腥。',
    timer: '15:00',
  },
  {
    num: '03',
    title: '煎出油',
    text: '中小火，不放食用油。五花肉每面都煎一下，煎至出油。',
    timer: null,
  },
  {
    num: '04',
    title: '炒糖色',
    text: '把肉推至一边，加入 15g 冰糖，翻炒至融化，再与肉一起上色。',
    timer: null,
  },
  {
    num: '05',
    title: '调味',
    text: '生抽 10ml、老抽 15ml、料酒 5ml，翻炒均匀。',
    timer: null,
  },
  {
    num: '06',
    title: '慢炖',
    text: '加入没过食材的开水，小火炖 60 分钟。',
    timer: '60:00',
  },
]

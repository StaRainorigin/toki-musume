/**
 * 应用分类表 — 借鉴 ActivityWatch 的分类系统
 * 用正则匹配进程名和窗口标题，判断应用属于哪个分类
 * 每个分类有 slackingWeight: 正数=摸鱼倾向，负数=工作倾向
 */

export type AppCategory = {
  name: string
  pattern: string  // 正则，匹配进程名或窗口标题
  slackingWeight: number  // >0 = 摸鱼，<0 = 工作，0 = 中性
  ignoreCase: boolean
}

export const CATEGORIES: AppCategory[] = [
  // ===== 开发工具（工作）=====
  { name: '开发-IDE', pattern: 'code|vscode|idea|webstorm|pycharm|clion|vim|emacs|sublime|neovim', slackingWeight: -2, ignoreCase: true },
  { name: '开发-终端', pattern: 'terminal|powershell|cmd|git bash|wsl|alacritty|windows terminal', slackingWeight: -2, ignoreCase: true },
  { name: '开发-Git', pattern: 'github|gitlab|bitbucket|git kraken|sourcetree', slackingWeight: -2, ignoreCase: true },
  { name: '开发-文档', pattern: 'stack overflow|stackoverflow|devdocs|mdn|npm|cargo|pypi', slackingWeight: -1, ignoreCase: true },

  // ===== 学习（工作）=====
  { name: '学习-文档', pattern: 'notion|obsidian|onenote|印象笔记|有道云|typora|marktext', slackingWeight: -2, ignoreCase: true },
  { name: '学习-网课', pattern: 'coursera|udemy|慕课|网易公开课|bilibili.*学习|leetcode|力扣', slackingWeight: -1, ignoreCase: true },

  // ===== 办公（工作）=====
  { name: '办公-文档', pattern: 'word|excel|powerpoint|wps|libreoffice|google docs|飞书|钉钉文档', slackingWeight: -2, ignoreCase: true },
  { name: '办公-邮件', pattern: 'outlook|gmail|thunderbird|foxmail|网易邮箱', slackingWeight: -1, ignoreCase: true },
  { name: '办公-通讯', pattern: 'teams|slack|discord|飞书|钉钉|企业微信|telegram|wechat|微信', slackingWeight: 0, ignoreCase: true },

  // ===== 摸鱼-视频 =====
  { name: '摸鱼-视频', pattern: 'bilibili|b站|youtube|netflix|iqiyi|优酷|腾讯视频|芒果tv|vlc|potplayer|mpv', slackingWeight: 3, ignoreCase: true },
  { name: '摸鱼-直播', pattern: '斗鱼|虎牙|twitch|抖音直播|快手', slackingWeight: 3, ignoreCase: true },

  // ===== 摸鱼-社交 =====
  { name: '摸鱼-社交', pattern: '微博|twitter|facebook|instagram|小红书|知乎|贴吧|reddit', slackingWeight: 2, ignoreCase: true },

  // ===== 摸鱼-游戏 =====
  { name: '摸鱼-游戏', pattern: 'steam|epic|原神|minecraft|league of legends|lol|csgo|dota|valorant|gta', slackingWeight: 3, ignoreCase: true },

  // ===== 摸鱼-购物 =====
  { name: '摸鱼-购物', pattern: '淘宝|京东|天猫|拼多多|amazon|ebay', slackingWeight: 2, ignoreCase: true },

  // ===== 摸鱼-音乐 =====
  { name: '摸鱼-音乐', pattern: 'spotify|网易云|qq音乐|酷狗|酷我|foobar', slackingWeight: 1, ignoreCase: true },

  // ===== 浏览器（中性，需要看标题）=====
  { name: '浏览器', pattern: 'chrome|firefox|edge|safari|opera|brave', slackingWeight: 0, ignoreCase: true },
]

/**
 * 对一个窗口进行分类
 * 返回最匹配的分类（权重绝对值最大的），如果没有匹配返回 null
 */
export function classifyWindow(processName: string, windowTitle: string): AppCategory | null {
  const text = `${processName} ${windowTitle}`
  let bestMatch: AppCategory | null = null
  let bestScore = 0

  for (const cat of CATEGORIES) {
    const regex = new RegExp(cat.pattern, cat.ignoreCase ? 'i' : '')
    if (regex.test(text)) {
      const score = Math.abs(cat.slackingWeight)
      if (score > bestScore) {
        bestScore = score
        bestMatch = cat
      }
    }
  }

  return bestMatch
}

/**
 * 判断窗口是否为摸鱼
 * weight > 0 = 摸鱼，weight <= 0 = 非摸鱼
 */
export function isSlacking(processName: string, windowTitle: string): boolean {
  const cat = classifyWindow(processName, windowTitle)
  return cat !== null && cat.slackingWeight > 0
}

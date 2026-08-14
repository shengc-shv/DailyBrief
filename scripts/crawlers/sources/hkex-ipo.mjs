import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 港交所披露易 - IPO/新上市公告爬虫
 * 网站: https://www.hkexnews.hk
 * 
 * 抓取目标: 新上市公告列表（含IPO招股书、上市文件等）
 */
export class HKEXCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '港交所IPO公告',
      keywords: ['上市', 'IPO', '招股', '招股书', '聆讯', '递表', '申请版本', 'Guangzhou', 'Guangdong'],
      timeout: 20000,
    });
  }

  /**
   * 获取要抓取的URL列表
   * 港交所披露易 - 新上市公告页面（简体中文版）
   */
  async getUrls() {
    return [
      // 新上市公告列表（简体中文）
      'https://www.hkexnews.hk/listingnews/alllistingsnewsdays_c.htm',
      // 如果需要监控更多天，可以增加日期参数
      // 但建议先用首页，后续再扩展
    ];
  }

  /**
   * 解析HTML，提取公告列表
   * @param {string} html - 页面HTML内容
   * @param {string} url - 原始URL
   * @returns {Array<{title: string, url: string, excerpt: string, publishedAt: string}>}
   */
  async parseArticle(html, url) {
    const articles = [];
    
    // 提取表格中的公告条目
    // 港交所页面结构通常是 <table> 包含 <tr> 每行一个公告
    // 每行包含：日期 | 公告标题（含链接）| 类型
    
    // 方法1：查找所有 <a> 标签，过滤出公告链接
    // 公告链接通常包含 "LTN" 或 "listnews" 等标识
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    // 同时记录日期信息（页面中的日期通常在链接附近）
    const dateRegex = /(\d{2}\/\d{2}\/\d{4})/g;
    const dates = [];
    let dateMatch;
    while ((dateMatch = dateRegex.exec(html)) !== null) {
      dates.push(dateMatch[1]);
    }
    
    // 重置正则
    linkRegex.lastIndex = 0;
    let linkIndex = 0;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const link = match[1];
      const title = match[2].trim();
      
      // 过滤出公告链接（而非导航、广告等）
      const isAnnouncement = 
        link.includes('/LTN_') || 
        link.includes('/listnews/') ||
        link.includes('c_') ||
        link.includes('_c.htm');
      
      // 排除明显不是公告的链接
      const isSkip = 
        link.includes('javascript:') ||
        link.includes('#') ||
        link.includes('main') ||
        link.includes('index') ||
        link.includes('css') ||
        link.includes('js') ||
        link.includes('image') ||
        link.includes('pdf') ||
        title.length < 4;
      
      if (isAnnouncement && !isSkip && title) {
        // 尝试获取对应的日期
        const pubDate = dates[linkIndex] || new Date().toLocaleDateString('zh-CN');
        linkIndex++;
        
        // 过滤关键词（使用基类的关键词列表）
        const shouldKeep = this.keywords.some(kw => 
          title.includes(kw)
        );
        
        // 如果标题不含关键词，但包含"上市"、"IPO"等通用词也保留
        const isIPO = /上市|IPO|招股|聆讯|递表|申请/i.test(title);
        
        if (shouldKeep || isIPO) {
          // 构造完整URL
          const fullUrl = link.startsWith('http') 
            ? link 
            : `https://www.hkexnews.hk${link.startsWith('/') ? '' : '/'}${link}`;
          
          articles.push({
            title: title,
            url: fullUrl,
            excerpt: `港交所公告：${title}`,
            publishedAt: this._parseDate(pubDate),
          });
        }
      }
    }
    
    // 如果上面的方法没抓到数据，尝试备用方案：按表格行解析
    if (articles.length === 0) {
      console.warn(`[${this.name}] 正则匹配未抓到数据，尝试备用解析...`);
      return this._parseByTable(html);
    }
    
    return articles;
  }

  /**
   * 备用方案：按表格结构解析
   */
  _parseByTable(html) {
    const articles = [];
    
    // 查找表格行 <tr> 包含公告信息
    // 简化方案：查找所有包含 .htm 的链接，且文本长度 > 10
    const linkRegex = /<a[^>]*href=["']([^"']*\.htm[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const link = match[1];
      const title = match[2].trim();
      
      // 过滤
      if (title.length > 10 && !link.includes('javascript')) {
        const fullUrl = link.startsWith('http') 
          ? link 
          : `https://www.hkexnews.hk${link.startsWith('/') ? '' : '/'}${link}`;
        
        const isRelevant = /上市|IPO|招股|聆讯|递表|申请|Guangzhou|Guangdong/i.test(title);
        if (isRelevant) {
          articles.push({
            title: title,
            url: fullUrl,
            excerpt: `港交所公告：${title}`,
            publishedAt: new Date().toISOString().slice(0, 10),
          });
        }
      }
    }
    
    return articles;
  }

  /**
   * 解析日期格式（港交所常用 dd/mm/yyyy）
   */
  _parseDate(dateStr) {
    if (!dateStr) return new Date().toISOString();
    
    try {
      // 尝试解析 dd/mm/yyyy 格式
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }
      return dateStr;
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }
}

/**
 * 工厂函数：供 run-all.mjs 动态加载
 */
export function createCrawler() {
  return new HKEXCrawler();
}

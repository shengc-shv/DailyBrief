import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 港交所披露易 - 公告爬虫（使用官方JSON接口）
 * 数据来源: https://www1.hkexnews.hk/ncms/json/eds/lcisehk7relsde_1.json
 * 
 * 注意：接口数据为英文，关键词请使用英文
 */
export class HKEXCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '港交所IPO公告',
      keywords: [
        // 地区关键词（英文）
        'Guangzhou', 'Guangdong', 'Shenzhen', 'China',
        // IPO相关关键词（英文）
        'IPO', 'listing', 'prospectus', 'listing document',
        'initial public offering', 'offer', 'placing',
        'global offering', 'public offer', 'subscription',
        // 预留部分中文（接口偶尔会有中文标题）
        '广州', '广东', '深圳', '上市', '招股'
      ],
      timeout: 15000,
    });
  }

  async getUrls() {
    const timestamp = Date.now();
    return [
      `https://www1.hkexnews.hk/ncms/json/eds/lcisehk7relsde_1.json?_=${timestamp}`,
      // 如果需要更多数据，可以取消下面注释
      // `https://www1.hkexnews.hk/ncms/json/eds/lcisehk7relsde_2.json?_=${timestamp}`,
    ];
  }

  async parseArticle(responseText, url) {
    const articles = [];
    // 计算 30 天前的时间戳
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    try {
      const data = JSON.parse(responseText);
      
      if (!data.newsInfoLst || !Array.isArray(data.newsInfoLst)) {
        console.warn(`[${this.name}] JSON中未找到 newsInfoLst 数组`);
        return articles;
      }

      const list = data.newsInfoLst;

      for (const item of list) {
        const title = item.title || item.lTxt || '';
        const shortTitle = item.sTxt || '';
        const relTime = item.relTime || '';
        const webPath = item.webPath || '';
        const fileExt = item.ext || 'pdf';
        const fileSize = item.size || '';
        
        const stockInfo = item.stock || [];
        const stockCodes = stockInfo.map(s => s.sc || '').filter(Boolean).join(', ');
        const stockNames = stockInfo.map(s => s.sn || '').filter(Boolean).join(', ');

        // 所有文本合并用于关键词匹配
        const allText = `${title} ${shortTitle} ${stockNames} ${stockCodes}`;
        
        // 检查是否包含关键词（不区分大小写）
        const isRelevant = this.keywords.some(kw => 
          allText.toLowerCase().includes(kw.toLowerCase())
        );

        if (!isRelevant) continue;

        // 解析日期
        let pubDate = relTime;
        if (pubDate) {
          const dateMatch = pubDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dateMatch) {
            pubDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
          }
        } else {
          pubDate = new Date().toISOString().slice(0, 10);
        }

        // ⭐ 过滤 30 天前的数据
        const itemDate = new Date(pubDate);
        if (itemDate < thirtyDaysAgo) {
          continue;  // 跳过 30 天前的公告
        }

        let fullTitle = title;
        if (stockNames) fullTitle += ` (${stockNames})`;

        let pdfUrl = '';
        if (webPath) {
          pdfUrl = webPath.startsWith('http') 
            ? webPath 
            : `https://www1.hkexnews.hk${webPath}`;
        }

        let excerpt = `港交所公告: ${title}`;
        if (stockCodes) excerpt += ` | 股票: ${stockCodes}`;
        if (stockNames) excerpt += ` (${stockNames})`;
        if (relTime) excerpt += ` | 时间: ${relTime}`;
        if (fileExt) excerpt += ` | 格式: ${fileExt.toUpperCase()}`;
        if (fileSize) excerpt += ` | 大小: ${fileSize}`;

        articles.push({
          title: fullTitle,
          url: pdfUrl || url,
          excerpt: excerpt,
          publishedAt: pubDate,
        });
      }

      console.log(`[${this.name}] 匹配到 ${articles.length} 条相关公告（共 ${list.length} 条，最近30天）`);
      
    } catch (err) {
      console.error(`[${this.name}] 解析JSON失败:`, err.message);
    }

    return articles;
  }
}

export function createCrawler() {
  return new HKEXCrawler();
}

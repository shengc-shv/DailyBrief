import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 港交所披露易 - 公告爬虫（使用官方JSON接口）
 * 数据来源: https://www1.hkexnews.hk/ncms/json/eds/lcisehk7relsde_1.json
 * 
 * 过滤逻辑：必须同时满足「广东地区」+「IPO相关」
 * - 地区关键词：Guangzhou, Guangdong, Shenzhen, China, 广州, 广东, 深圳
 * - IPO关键词：IPO, listing, prospectus, 上市, 招股, 公开发行, 辅导备案
 */
export class HKEXCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '港交所IPO公告',
      // 父类不再使用 keywords 过滤，但保留以便子类可能引用
      keywords: [],
      timeout: 15000,
    });
  }

  async getUrls() {
    const timestamp = Date.now();
    return [
      `https://www1.hkexnews.hk/ncms/json/eds/lcisehk7relsde_1.json?_=${timestamp}`,
    ];
  }

  async parseArticle(responseText, url) {
    const articles = [];
    // 计算 30 天前的时间戳
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 地区关键词（中英文）
    const regionKeywords = [
      'Guangzhou', 'Guangdong', 'Shenzhen', 'China',
      '广州', '广东', '深圳'
    ];

    // IPO 相关关键词
    const ipoKeywords = [
      'IPO', 'listing', 'prospectus', 'listing document',
      'initial public offering', 'offer', 'placing',
      'global offering', 'public offer', 'subscription',
      '上市', '招股', '公开发行', '辅导备案'
    ];

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
          continue;
        }

        // ⭐ 双重过滤：地区 + IPO（AND 逻辑）
        const allText = `${title} ${shortTitle} ${stockNames} ${stockCodes}`;
        const lowerText = allText.toLowerCase();

        // 检查地区关键词
        const isRegion = regionKeywords.some(kw =>
          lowerText.includes(kw.toLowerCase())
        );

        // 检查 IPO 关键词
        const isIpo = ipoKeywords.some(kw =>
          lowerText.includes(kw.toLowerCase())
        );

        // 必须同时满足地区 + IPO
        if (!isRegion || !isIpo) {
          continue;
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

      console.log(`[${this.name}] 匹配到 ${articles.length} 条广东IPO相关公告（共 ${list.length} 条，最近30天）`);

    } catch (err) {
      console.error(`[${this.name}] 解析JSON失败:`, err.message);
    }

    return articles;
  }
}

export function createCrawler() {
  return new HKEXCrawler();
}

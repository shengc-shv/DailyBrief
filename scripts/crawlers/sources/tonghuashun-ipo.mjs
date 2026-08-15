import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 同花顺 - 新股数据爬虫
 * 数据来源: https://data.10jqka.com.cn/ipo/xgsgyzq/
 *
 * 过滤逻辑：只保留广东地区的新股（数据本身已是 IPO/新股，无需额外 IPO 过滤）
 * - 地区关键词：广东、广州、深圳、东莞、佛山、珠海等
 * - 窗口期：最近30天
 */
export class TonghuashunIPOCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '同花顺新股',
      keywords: [],   // 父类不过滤，传空数组
      timeout: 15000,
    });
  }

  async getUrls() {
    return [
      'https://data.10jqka.com.cn/ipo/xgsgyzq/',
    ];
  }

  async parseArticle(html, url) {
    const articles = [];
    // 计算 30 天前的时间戳
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 地区关键词（广东及主要城市）
    const regionKeywords = [
      '广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州',
      '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江',
      '清远', '潮州', '揭阳', '云浮'
    ];

    try {
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const linkRegex = /<a[^>]*>([^<]*)<\/a>/i;

      const allTds = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(html)) !== null) {
        let content = tdMatch[1].trim();
        const linkMatch = content.match(linkRegex);
        if (linkMatch) {
          content = linkMatch[1].trim();
        }
        content = content.replace(/\s+/g, ' ').trim();
        if (content && content.length > 0 && !content.includes('javascript:')) {
          allTds.push(content);
        }
      }

      const FIELDS_PER_ROW = 18;
      const startIndex = FIELDS_PER_ROW; // 跳过表头

      for (let i = startIndex; i + FIELDS_PER_ROW <= allTds.length; i += FIELDS_PER_ROW) {
        const row = allTds.slice(i, i + FIELDS_PER_ROW);

        const stockCode = row[0] || '';
        const stockName = row[1] || '';
        const subscribeCode = row[2] || '';
        const totalShares = row[3] || '';
        const price = row[7] || '';
        const pe = row[8] || '';
        const subscribeDate = row[10] || '';
        const listDate = row[14] || '';

        // ⭐ 检查地区（公司名包含地区关键词）
        const isRegion = regionKeywords.some(kw => stockName.includes(kw));
        if (!isRegion) {
          continue;
        }

        // 解析日期
        let pubDate = listDate || subscribeDate || '';
        if (pubDate) {
          const dateMatch = pubDate.match(/(\d{2})-(\d{2})/);
          if (dateMatch) {
            const month = dateMatch[1];
            const day = dateMatch[2];
            const year = new Date().getFullYear();
            pubDate = `${year}-${month}-${day}`;
          }
        } else {
          pubDate = new Date().toISOString().slice(0, 10);
        }

        // 过滤 30 天前的数据
        const itemDate = new Date(pubDate);
        if (itemDate < thirtyDaysAgo) {
          continue;
        }

        // 构建标题
        let title = `${stockName} (${stockCode})`;
        if (listDate && listDate !== '-') {
          title += ` [已上市 ${listDate}]`;
        } else if (subscribeDate && subscribeDate !== '-') {
          title += ` [申购日 ${subscribeDate}]`;
        }

        // 构建摘要
        let excerpt = `同花顺新股`;
        if (subscribeCode && subscribeCode !== '-') excerpt += ` | 申购代码: ${subscribeCode}`;
        if (price && price !== '-') excerpt += ` | 发行价: ${price}元`;
        if (pe && pe !== '-') excerpt += ` | 市盈率: ${pe}`;
        if (subscribeDate && subscribeDate !== '-') excerpt += ` | 申购: ${subscribeDate}`;
        if (listDate && listDate !== '-') excerpt += ` | 上市: ${listDate}`;

        const detailUrl = stockCode
          ? `https://quote.10jqka.com.cn/${stockCode}/`
          : url;

        articles.push({
          title,
          url: detailUrl,
          excerpt,
          publishedAt: pubDate,
        });
      }

      console.log(`[${this.name}] 匹配到 ${articles.length} 家广东新股（最近30天）`);

    } catch (err) {
      console.error(`[${this.name}] 解析HTML失败:`, err.message);
    }

    return articles;
  }
}

export function createCrawler() {
  return new TonghuashunIPOCrawler();
}

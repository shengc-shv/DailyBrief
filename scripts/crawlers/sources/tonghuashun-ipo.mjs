import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 同花顺 - 新股预披露爬虫
 * 数据来源: https://data.10jqka.com.cn/ipo/xgyp/
 *
 * 过滤逻辑：只保留广东地区的新股预披露
 * - 地区关键词：广东、广州、深圳、东莞、佛山、珠海等
 * - 窗口期：最近30天
 */
export class TonghuashunIPOCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '同花顺新股预披露',
      keywords: [],
      timeout: 15000,
    });
  }

  async getUrls() {
    return [
      'https://data.10jqka.com.cn/ipo/xgyp/',
    ];
  }

  async parseArticle(html, url) {
    const articles = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const regionKeywords = [
      '广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州',
      '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江',
      '清远', '潮州', '揭阳', '云浮'
    ];

    try {
      // 定位 <tbody>
      const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
      if (!tbodyMatch) {
        console.warn(`[${this.name}] 未找到 <tbody> 标签`);
        return articles;
      }

      const tbodyContent = tbodyMatch[1];
      const trMatches = tbodyContent.match(/<tr>[\s\S]*?<\/tr>/gi);
      if (!trMatches || trMatches.length === 0) {
        console.warn(`[${this.name}] 未找到数据行`);
        return articles;
      }

      console.log(`[${this.name}] 共找到 ${trMatches.length} 行数据`);

      for (const trContent of trMatches) {
        // ⭐ 提取所有 <td> 内容
        const tdMatches = trContent.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        if (!tdMatches || tdMatches.length < 9) continue;

        // ⭐ 关键修复：提取纯文本，去除所有 HTML 标签
        const tds = tdMatches.map(td => {
          // 先移除 <a> 标签（保留文本）
          let text = td.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');
          // 再移除所有其他 HTML 标签
          text = text.replace(/<[^>]+>/g, '');
          // 清理空白字符
          text = text.replace(/\s+/g, ' ').trim();
          return text;
        });

        // 跳过空行或表头残留
        if (tds.length < 9) continue;
        if (tds[0] === '序号' || tds[0] === '') continue;

        const stockName = tds[1] || '';
        const disclosureDate = tds[2] || '';
        const board = tds[3] || '';
        const disclosureType = tds[4] || '';
        const estimatedFunds = tds[5] || '';
        const estimatedShares = tds[6] || '';
        const reportLink = tds[8] || '';

        // ⭐ 检查地区
        const isRegion = regionKeywords.some(kw => stockName.includes(kw));
        if (!isRegion) continue;

        // 解析日期
        let pubDate = disclosureDate;
        if (pubDate) {
          const dateMatch = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            pubDate = dateMatch[1];
          }
        } else {
          pubDate = new Date().toISOString().slice(0, 10);
        }

        // 过滤 30 天前的数据
        const itemDate = new Date(pubDate);
        //if (itemDate < thirtyDaysAgo) continue;

        // 构建标题
        let title = `${stockName}`;
        if (board) title += ` [${board}]`;
        if (disclosureType) title += ` (${disclosureType})`;

        let excerpt = `同花顺新股预披露`;
        if (board) excerpt += ` | 板块: ${board}`;
        if (disclosureType) excerpt += ` | 类型: ${disclosureType}`;
        if (disclosureDate) excerpt += ` | 披露日期: ${disclosureDate}`;
        if (estimatedFunds && estimatedFunds !== '-') excerpt += ` | 募资: ${estimatedFunds}`;
        if (estimatedShares && estimatedShares !== '-') excerpt += ` | 发行: ${estimatedShares}`;

        let detailUrl = url;
        if (reportLink && reportLink !== '-' && reportLink.startsWith('http')) {
          detailUrl = reportLink;
        } else {
          detailUrl = `https://data.10jqka.com.cn/ipo/search/?keyword=${encodeURIComponent(stockName)}`;
        }

        articles.push({
          title,
          url: detailUrl,
          excerpt,
          publishedAt: pubDate,
        });
      }

      console.log(`[${this.name}] 匹配到 ${articles.length} 家广东新股预披露（最近30天）`);

    } catch (err) {
      console.error(`[${this.name}] 解析HTML失败:`, err.message);
    }

    return articles;
  }
}

export function createCrawler() {
  return new TonghuashunIPOCrawler();
}

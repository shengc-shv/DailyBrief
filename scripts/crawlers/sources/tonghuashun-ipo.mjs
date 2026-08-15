import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 同花顺 - 新股预披露爬虫
 * 数据来源: https://data.10jqka.com.cn/ipo/xgyp/
 *
 * 过滤逻辑：只保留广东地区的新股预披露（数据本身已是 IPO 相关）
 * - 地区关键词：广东、广州、深圳、东莞、佛山、珠海等
 * - 窗口期：最近30天
 */
export class TonghuashunIPOCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '同花顺新股预披露',
      keywords: [],   // 父类不过滤，传空数组
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
      // 方法：按 <tr> 行解析，每行包含 9 个 <td>
      const trRegex = /<tr>[\s\S]*?<\/tr>/gi;
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

      let trMatch;
      let rowIndex = 0;

      while ((trMatch = trRegex.exec(html)) !== null) {
        const trContent = trMatch[0];

        // 跳过表头行（包含 <th> 而非 <td>）
        if (trContent.includes('<th')) {
          continue;
        }

        // 提取所有 td 单元格内容
        const tds = [];
        let tdMatch;
        tdRegex.lastIndex = 0;
        while ((tdMatch = tdRegex.exec(trContent)) !== null) {
          let content = tdMatch[1].trim();
          // 清理多余空白和换行
          content = content.replace(/\s+/g, ' ').trim();
          tds.push(content);
        }

        // 正常行应该有 9 列: 序号 | 公司名称 | 披露日期 | 上市板块 | 披露类型 | 预计募集资金 | 预计发行股数 | 预计股东发售股数 | 报告全文
        if (tds.length < 9) continue;

        const seq = tds[0] || '';
        const stockName = tds[1] || '';
        const disclosureDate = tds[2] || '';
        const board = tds[3] || '';
        const disclosureType = tds[4] || '';
        const estimatedFunds = tds[5] || '';
        const estimatedShares = tds[6] || '';
        const shareholderShares = tds[7] || '';
        const reportLink = tds[8] || '';

        // ⭐ 检查地区（公司名包含地区关键词）
        const isRegion = regionKeywords.some(kw => stockName.includes(kw));
        if (!isRegion) {
          continue;
        }

        // 解析日期（格式: YYYY-MM-DD）
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
        if (itemDate < thirtyDaysAgo) {
          continue;
        }

        // 构建标题
        let title = `${stockName}`;
        if (board) title += ` [${board}]`;
        if (disclosureType) title += ` (${disclosureType})`;

        // 构建摘要
        let excerpt = `同花顺新股预披露`;
        if (board) excerpt += ` | 板块: ${board}`;
        if (disclosureType) excerpt += ` | 类型: ${disclosureType}`;
        if (disclosureDate) excerpt += ` | 披露日期: ${disclosureDate}`;
        if (estimatedFunds && estimatedFunds !== '-') excerpt += ` | 募资: ${estimatedFunds}`;
        if (estimatedShares && estimatedShares !== '-') excerpt += ` | 发行: ${estimatedShares}`;

        // 构造详情链接（如果有报告全文链接则使用，否则用公司搜索页）
        let detailUrl = url;
        if (reportLink && reportLink !== '-' && reportLink.includes('http')) {
          detailUrl = reportLink;
        } else {
          // 使用公司名称搜索作为备选
          detailUrl = `https://data.10jqka.com.cn/ipo/search/?keyword=${encodeURIComponent(stockName)}`;
        }

        articles.push({
          title,
          url: detailUrl,
          excerpt,
          publishedAt: pubDate,
        });

        rowIndex++;
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

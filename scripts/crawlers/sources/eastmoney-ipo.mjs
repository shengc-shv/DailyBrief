import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 东方财富 - IPO辅导备案信息爬虫
 * 数据来源: https://data.eastmoney.com/xg/ipo/fd.html
 * 
 * 页面结构: 静态HTML表格，包含辅导对象、辅导机构、备案时间、辅导状态、派出机构等
 * 数据更新: 每日更新
 */
export class EastMoneyIPOCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '东方财富IPO辅导',
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州', 
                 '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江', 
                 '清远', '潮州', '揭阳', '云浮'],
      timeout: 15000,
    });
  }

  /**
   * 获取要抓取的URL列表
   * 东方财富IPO辅导数据表格直接渲染在HTML中
   */
  async getUrls() {
    return [
      'https://data.eastmoney.com/xg/ipo/fd.html',
      // 如果需要翻页，可以增加：
      // 'https://data.eastmoney.com/xg/ipo/fd.html?p=2',
      // 'https://data.eastmoney.com/xg/ipo/fd.html?p=3',
    ];
  }

  /**
   * 解析HTML，提取辅导备案信息
   */
  async parseArticle(html, url) {
    const articles = [];

    try {
      // 方法1：通过正则提取表格行
      // 东方财富的表格结构: <tr> 包含多个 <td>
      const trRegex = /<tr>[\s\S]*?<\/tr>/gi;
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/i;

      let trMatch;
      let rowIndex = 0;

      while ((trMatch = trRegex.exec(html)) !== null) {
        const trContent = trMatch[0];

        // 跳过表头行（包含"辅导对象"、"辅导机构"等）
        if (/辅导对象/.test(trContent) && /辅导机构/.test(trContent)) {
          continue;
        }

        // 提取所有td单元格
        const tds = [];
        let tdMatch;
        tdRegex.lastIndex = 0;
        while ((tdMatch = tdRegex.exec(trContent)) !== null) {
          tds.push(tdMatch[1].trim());
        }

        // 正常行应该有7列: 辅导对象 | 辅导机构 | 备案时间 | 辅导状态 | 派出机构 | 报告类型 | 操作
        if (tds.length < 6) continue;

        // ----- 提取公司名称和详情链接 -----
        const companyRaw = tds[0] || '';
        const linkMatch = companyRaw.match(linkRegex);
        const companyName = linkMatch ? linkMatch[2].trim() : companyRaw.replace(/<[^>]*>/g, '').trim();
        const detailUrl = linkMatch ? `https://data.eastmoney.com${linkMatch[1]}` : '';

        // ----- 提取辅导机构 -----
        const institution = tds[1] ? tds[1].replace(/<[^>]*>/g, '').trim() : '';

        // ----- 提取备案时间 -----
        const filingDate = tds[2] ? tds[2].replace(/<[^>]*>/g, '').trim() : '';

        // ----- 提取辅导状态 -----
        const status = tds[3] ? tds[3].replace(/<[^>]*>/g, '').trim() : '';

        // ----- 提取派出机构（证监局）-----
        const bureau = tds[4] ? tds[4].replace(/<[^>]*>/g, '').trim() : '';

        // ----- 提取报告类型 -----
        const reportType = tds[5] ? tds[5].replace(/<[^>]*>/g, '').trim() : '';

        // 检查是否包含广东地区关键词（公司名或派出机构）
        const isGuangdong = this.keywords.some(kw =>
          companyName.includes(kw) || bureau.includes(kw)
        );

        // 如果公司名和派出机构都不含广东关键词，跳过
        if (!isGuangdong) continue;

        // ----- 构建标题 -----
        let title = companyName;
        if (status) title += ` (${status})`;
        if (bureau) title += ` [${bureau}]`;

        // ----- 构建摘要 -----
        let excerpt = `IPO辅导备案`;
        if (institution) excerpt += ` | 辅导机构: ${institution}`;
        if (filingDate) excerpt += ` | 备案时间: ${filingDate}`;
        if (status) excerpt += ` | 状态: ${status}`;
        if (reportType) excerpt += ` | 报告: ${reportType}`;

        // ----- 发布时间（使用备案时间）-----
        let pubDate = filingDate;
        if (pubDate) {
          // 日期格式已经是 YYYY-MM-DD
          const dateMatch = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            pubDate = dateMatch[1];
          }
        } else {
          pubDate = new Date().toISOString().slice(0, 10);
        }

        articles.push({
          title: title,
          url: detailUrl || url,
          excerpt: excerpt,
          publishedAt: pubDate,
        });

        rowIndex++;
      }

      console.log(`[${this.name}] 匹配到 ${articles.length} 家广东辅导企业`);

    } catch (err) {
      console.error(`[${this.name}] 解析HTML失败:`, err.message);
    }

    return articles;
  }
}

export function createCrawler() {
  return new EastMoneyIPOCrawler();
}

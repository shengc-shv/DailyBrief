import { BaseCrawler } from '../base-crawler.mjs';

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

  async getUrls() {
    return [
      'https://data.eastmoney.com/xg/ipo/fd.html',
    ];
  }

  async parseArticle(html, url) {
    const articles = [];
    // 调试：打印页面片段，确认表格存在
    // console.log(html.slice(0, 2000)); // 如果需要看页面开头

    // 提取所有表格行（含表头）
    const trRegex = /<tr>[\s\S]*?<\/tr>/gi;
    let trMatch;
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/i;

    let rowIndex = 0;
    while ((trMatch = trRegex.exec(html)) !== null) {
      const trContent = trMatch[0];
      // 跳过表头
      if (/辅导对象/.test(trContent) && /辅导机构/.test(trContent)) {
        continue;
      }

      const tds = [];
      let tdMatch;
      tdRegex.lastIndex = 0;
      while ((tdMatch = tdRegex.exec(trContent)) !== null) {
        tds.push(tdMatch[1].trim());
      }

      // 如果td数量不足，跳过
      if (tds.length < 6) {
        // 打印出行内容以便调试
        // console.log(`行${rowIndex} td数量不足: ${tds.length}`);
        // console.log(trContent.slice(0, 200));
        continue;
      }

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

      // ----- 提取派出机构 -----
      const bureau = tds[4] ? tds[4].replace(/<[^>]*>/g, '').trim() : '';

      // ⭐ 调试输出：打印每一行提取到的公司名和派出机构
      console.log(`[调试] 公司: ${companyName}, 派出机构: ${bureau}`);

      // 检查是否包含广东地区关键词（公司名或派出机构）
      const isGuangdong = this.keywords.some(kw =>
        companyName.includes(kw) || bureau.includes(kw)
      );

      if (!isGuangdong) continue;

      // ... 后面构建 article 的代码不变 ...
      let title = companyName;
      if (status) title += ` (${status})`;
      if (bureau) title += ` [${bureau}]`;

      let excerpt = `IPO辅导备案`;
      if (institution) excerpt += ` | 辅导机构: ${institution}`;
      if (filingDate) excerpt += ` | 备案时间: ${filingDate}`;
      if (status) excerpt += ` | 状态: ${status}`;

      let pubDate = filingDate.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || new Date().toISOString().slice(0, 10);

      articles.push({
        title,
        url: detailUrl || url,
        excerpt,
        publishedAt: pubDate,
      });

      rowIndex++;
    }

    console.log(`[${this.name}] 匹配到 ${articles.length} 家广东辅导企业`);
    return articles;
  }
}

export function createCrawler() {
  return new EastMoneyIPOCrawler();
}

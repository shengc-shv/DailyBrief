import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 上交所IPO信息披露爬虫
 * 数据来源: https://www.sse.com.cn/listing/disclosure/ipo/
 * 
 * 页面结构: 静态HTML表格，包含发行人、文件名称、披露日期
 */
export class SSEIPOCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '上交所IPO披露',
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州', '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江', '清远', '潮州', '揭阳', '云浮'],
      timeout: 15000,
    });
  }

  async getUrls() {
    return [
      'https://www.sse.com.cn/listing/disclosure/ipo/',
    ];
  }

  async parseArticle(html, url) {
    const articles = [];
    
    // 页面结构: 每一行包含 发行人 | 文件名称 | 披露日期
    // 用正则匹配 <tr> 中的内容
    const trRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    
    let trMatch;
    while ((trMatch = trRegex.exec(html)) !== null) {
      const trContent = trMatch[0];
      
      // 跳过表头行（包含"发行人"、"文件名称"等）
      if (/发行人/.test(trContent) && /文件名称/.test(trContent)) {
        continue;
      }
      
      // 提取所有td单元格
      const tds = [];
      let tdMatch;
      tdRegex.lastIndex = 0;
      while ((tdMatch = tdRegex.exec(trContent)) !== null) {
        tds.push(tdMatch[1].trim());
      }
      
      // 正常行应该有3列: 发行人 | 文件名称 | 披露日期
      // 但有时文件名称可能包含多个链接，需要特殊处理
      if (tds.length < 2) continue;
      
      const issuerRaw = tds[0] || '';
      const fileRaw = tds[1] || '';
      const dateRaw = tds[2] || '';
      
      // 从发行人列提取公司名称和详情页链接
      const issuerMatch = issuerRaw.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i);
      const companyName = issuerMatch ? issuerMatch[2].trim() : issuerRaw.replace(/<[^>]*>/g, '').trim();
      const detailUrl = issuerMatch ? `https://www.sse.com.cn${issuerMatch[1]}` : '';
      
      // 从文件名称列提取文件链接和标题
      const fileMatch = fileRaw.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i);
      const fileName = fileMatch ? fileMatch[2].trim() : fileRaw.replace(/<[^>]*>/g, '').trim();
      const fileUrl = fileMatch ? `https:${fileMatch[1]}` : '';
      
      // 提取披露日期
      const dateMatch = dateRaw.match(/(\d{4}-\d{2}-\d{2})/);
      const pubDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
      
      // 检查是否包含广东关键词
      const isGuangdong = this.keywords.some(kw => 
        companyName.includes(kw)
      );
      
      // 只保留广东地区的企业（可根据需要调整）
      if (!isGuangdong) {
        continue;
      }
      
      // 构建标题
      const title = `${companyName} - ${fileName}`;
      
      // 构建摘要
      let excerpt = `上交所IPO披露: ${companyName}`;
      if (fileName) excerpt += `，${fileName}`;
      if (pubDate) excerpt += `，披露日期: ${pubDate}`;
      
      articles.push({
        title: title,
        url: fileUrl || detailUrl || url,
        excerpt: excerpt,
        publishedAt: pubDate,
      });
    }
    
    return articles;
  }
}

export function createCrawler() {
  return new SSEIPOCrawler();
}

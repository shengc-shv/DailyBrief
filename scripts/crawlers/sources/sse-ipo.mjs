import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 上交所IPO信息披露爬虫
 * 数据来源: https://www.sse.com.cn/listing/disclosure/ipo/
 * 
 * 页面结构: 静态HTML表格，直接渲染，无需额外API请求
 */
export class SSEIPOCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '上交所IPO披露',
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州', 
                 '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河阳', '阳江', 
                 '清远', '潮州', '揭阳', '云浮'],
      timeout: 15000,
    });
  }

  async getUrls() {
    // 直接抓取IPO披露页面，数据在HTML中直接渲染
    return [
      'https://www.sse.com.cn/listing/disclosure/ipo/',
    ];
  }

  async parseArticle(html, url) {
    const articles = [];
    
    // 1. 提取所有表格行 <tr>
    const trRegex = /<tr>[\s\S]*?<\/tr>/gi;
    let trMatch;
    
    // 2. 提取每个 <td> 的内容（含内部链接）
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    
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
      if (tds.length < 3) continue;
      
      const issuerRaw = tds[0] || '';
      const fileRaw = tds[1] || '';
      const dateRaw = tds[2] || '';
      
      // ----- 提取发行人信息 -----
      const issuerMatch = issuerRaw.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i);
      const companyName = issuerMatch ? issuerMatch[2].trim() : issuerRaw.replace(/<[^>]*>/g, '').trim();
      const detailUrl = issuerMatch ? `https://www.sse.com.cn${issuerMatch[1]}` : '';
      
      // ----- 提取文件信息 -----
      const fileMatch = fileRaw.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i);
      const fileName = fileMatch ? fileMatch[2].trim() : fileRaw.replace(/<[^>]*>/g, '').trim();
      const fileUrl = fileMatch ? `https:${fileMatch[1]}` : '';  // 注意是 https: 前缀
      
      // ----- 提取披露日期 -----
      const dateMatch = dateRaw.match(/(\d{4}-\d{2}-\d{2})/);
      const pubDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
      
      // ----- 关键词过滤（广东地区企业）-----
      const isGuangdong = this.keywords.some(kw => 
        companyName.includes(kw)
      );
      
      // 只保留广东地区的企业
      if (!isGuangdong) continue;
      
      // ----- 构建输出 -----
      const title = `${companyName} - ${fileName}`;
      const excerpt = `上交所IPO披露 | 发行人: ${companyName} | 文件: ${fileName} | 日期: ${pubDate}`;
      
      articles.push({
        title: title,
        url: fileUrl || detailUrl || url,
        excerpt: excerpt,
        publishedAt: pubDate,
      });
    }
    
    // 日志输出
    if (articles.length === 0) {
      console.log(`[${this.name}] 未匹配到广东地区企业`);
    } else {
      const companies = articles.map(a => a.title.split(' - ')[0]).join(', ');
      console.log(`[${this.name}] 匹配到 ${articles.length} 家广东企业: ${companies}`);
    }
    
    return articles;
  }
}

export function createCrawler() {
  return new SSEIPOCrawler();
}

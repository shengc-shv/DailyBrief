import { BaseCrawler } from '../base-crawler.mjs';

export class SSEIPOCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '上交所IPO披露',
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州', 
                 '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江', 
                 '清远', '潮州', '揭阳', '云浮'],
      timeout: 20000,  // 增加超时时间
    });
  }

  async getUrls() {
    return [
      {
        url: 'https://www.sse.com.cn/listing/disclosure/ipo/',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
        }
      }
    ];
  }

  async parseArticle(html, url) {
    const articles = [];
    const trRegex = /<tr>[\s\S]*?<\/tr>/gi;
    let trMatch;
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    
    while ((trMatch = trRegex.exec(html)) !== null) {
      const trContent = trMatch[0];
      if (/发行人/.test(trContent) && /文件名称/.test(trContent)) continue;
      
      const tds = [];
      let tdMatch;
      tdRegex.lastIndex = 0;
      while ((tdMatch = tdRegex.exec(trContent)) !== null) {
        tds.push(tdMatch[1].trim());
      }
      
      if (tds.length < 3) continue;
      
      const issuerRaw = tds[0] || '';
      const fileRaw = tds[1] || '';
      const dateRaw = tds[2] || '';
      
      const issuerMatch = issuerRaw.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i);
      const companyName = issuerMatch ? issuerMatch[2].trim() : issuerRaw.replace(/<[^>]*>/g, '').trim();
      const detailUrl = issuerMatch ? `https://www.sse.com.cn${issuerMatch[1]}` : '';
      
      const fileMatch = fileRaw.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i);
      const fileName = fileMatch ? fileMatch[2].trim() : fileRaw.replace(/<[^>]*>/g, '').trim();
      const fileUrl = fileMatch ? `https:${fileMatch[1]}` : '';
      
      const dateMatch = dateRaw.match(/(\d{4}-\d{2}-\d{2})/);
      const pubDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
      
      const isGuangdong = this.keywords.some(kw => companyName.includes(kw));
      if (!isGuangdong) continue;
      
      articles.push({
        title: `${companyName} - ${fileName}`,
        url: fileUrl || detailUrl || url,
        excerpt: `上交所IPO披露 | 发行人: ${companyName} | 文件: ${fileName} | 日期: ${pubDate}`,
        publishedAt: pubDate,
      });
    }
    
    if (articles.length === 0) {
      console.log(`[${this.name}] 未匹配到广东地区企业`);
    }
    return articles;
  }
}

export function createCrawler() {
  return new SSEIPOCrawler();
}

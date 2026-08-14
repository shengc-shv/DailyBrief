import { BaseCrawler } from '../base-crawler.mjs';

export class SSEAPICrawler extends BaseCrawler {
  constructor() {
    super({
      name: '上交所IPO公告',
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州', 
                 '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江', 
                 '清远', '潮州', '揭阳', '云浮'],
      timeout: 15000,
    });
  }

  async getUrls() {
    return [{
      url: 'https://query.sse.com.cn/commonSoaQuery.do',
      method: 'POST',
      headers: {
        'Referer': 'https://www.sse.com.cn/listing/disclosure/ipo/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams({
        isPagination: 'true',
        sqlId: 'GP_COMMON_FILE_SEARCH',
        fileTypeMap: 'I0011,I0012,I0013,I3010',
        marketType: '',
        fileTitle: '',
        searchDateBegin: '',
        searchDateEnd: '',
        'pageHelp.pageSize': '25',   // ← 修复：带点号的属性名加引号
        'pageHelp.pageNo': '1',      // ← 修复：同上
      }).toString(),
    }];
  }

  async parseArticle(responseText, url) {
    const articles = [];
    try {
      const data = JSON.parse(responseText);
      if (!data.result || !Array.isArray(data.result)) {
        console.warn(`[${this.name}] API返回数据格式异常`);
        return articles;
      }
      const list = data.result;
      console.log(`[${this.name}] API共返回 ${list.length} 条公告`);

      const guangdongStocks = new Set();
      for (const item of list) {
        const stockName = item.stockName || '';
        const isGuangdong = this.keywords.some(kw => stockName.includes(kw));
        if (!isGuangdong) continue;
        const key = `${item.stockCode || ''}_${stockName}`;
        if (guangdongStocks.has(key)) continue;
        guangdongStocks.add(key);

        const title = `${stockName} (${item.stockCode || ''})`;
        const excerpt = `上交所IPO动态 | ${item.fileTitle || ''} | 日期: ${item.filedate || ''}`;
        const detailUrl = `https://www.sse.com.cn/listing/disclosure/ipo/detail.shtml?stockCode=${item.stockCode || ''}`;
        const pubDate = (item.filedate || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1] || new Date().toISOString().slice(0, 10);

        articles.push({ title, url: detailUrl, excerpt, publishedAt: pubDate });
      }

      console.log(`[${this.name}] 匹配到 ${articles.length} 家广东企业`);
      return articles;
    } catch (err) {
      console.error(`[${this.name}] 解析失败:`, err.message);
      return articles;
    }
  }
}

export function createCrawler() {
  return new SSEAPICrawler();
}

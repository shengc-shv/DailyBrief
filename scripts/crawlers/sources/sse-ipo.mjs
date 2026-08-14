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
        'pageHelp.pageSize': '25',
        'pageHelp.pageNo': '1',
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
        const stockCode = item.stockCode || '';
        const stockName = item.stockName || '';
        const fileTitle = item.fileTitle || '';
        const fileType = item.fileType || '';
        const filedate = item.filedate || '';
        const isGuangdong = this.keywords.some(kw => stockName.includes(kw));
        if (!isGuangdong) continue;
        const key = `${stockCode}_${stockName}`;
        if (guangdongStocks.has(key)) continue;
        guangdongStocks.add(key);
        const title = `${stockName} (${stockCode})`;
        let excerpt = `上交所IPO动态`;
        if (fileTitle) excerpt += ` | ${fileTitle}`;
        if (fileType) excerpt += ` | 类型: ${fileType}`;
        if (filedate) excerpt += ` | 日期: ${filedate}`;
        const detailUrl = `https://www.sse.com.cn/listing/disclosure/ipo/detail.shtml?stockCode=${stockCode}`;
        let pubDate = filedate;
        if (pubDate) {
          const dateMatch = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) pubDate = dateMatch[1];
        } else {
          pubDate = new Date().toISOString().slice(0, 10);
        }
        articles.push({
          title: title,
          url: detailUrl,
          excerpt: excerpt,
          publishedAt: pubDate,
        });
      }
      const seen = new Set();
      const unique = articles.filter(a => {
        const code = a.title.match(/\((\d+)\)/)?.[1] || a.title;
        if (seen.has(code)) return false;
        seen.add(code);
        return true;
      });
      console.log(`[${this.name}] 匹配到 ${unique.length} 家广东企业`);
      return unique;
    } catch (err) {
      console.error(`[${this.name}] 解析失败:`, err.message);
      return articles;
    }
  }
}

export function createCrawler() {
  return new SSEAPICrawler();
}

import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 上交所公开数据接口 - 科创板/主板IPO公告爬虫
 * 接口: https://query.sse.com.cn/commonSoaQuery.do
 * 
 * 返回数据包含股票代码、名称、公告标题、公告类型、日期等
 */
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

  /**
   * 使用 POST 请求调用上交所接口
   */
  async getUrls() {
    // 返回一个对象，包含 method、headers、body
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
        fileTypeMap: 'I0011,I0012,I0013,I3010',  // I0011=科创板注册稿, I0012=问询回复, I0013=上会稿, I3010=主板
        marketType: '',
        fileTitle: '',
        searchDateBegin: '',
        searchDateEnd: '',
        pageHelp.pageSize: '25',
        pageHelp.pageNo: '1',
      }).toString(),
    }];
  }

  /**
   * 解析 JSON 响应
   */
  async parseArticle(responseText, url) {
    const articles = [];

    try {
      const data = JSON.parse(responseText);

      // 检查数据结构
      if (!data.result || !Array.isArray(data.result)) {
        console.warn(`[${this.name}] API返回数据格式异常`);
        return articles;
      }

      const list = data.result;
      console.log(`[${this.name}] API共返回 ${list.length} 条公告`);

      // 提取所有广东企业的公告
      const guangdongStocks = new Set();

      for (const item of list) {
        const stockCode = item.stockCode || '';
        const stockName = item.stockName || '';
        const fileTitle = item.fileTitle || '';
        const fileType = item.fileType || '';
        const filedate = item.filedate || '';

        // 检查是否广东企业
        const isGuangdong = this.keywords.some(kw => 
          stockName.includes(kw)
        );

        if (!isGuangdong) continue;

        // 记录已处理的股票（去重）
        const key = `${stockCode}_${stockName}`;
        if (guangdongStocks.has(key)) continue;
        guangdongStocks.add(key);

        // 构建标题
        const title = `${stockName} (${stockCode})`;

        // 构建摘要
        let excerpt = `上交所IPO动态`;
        if (fileTitle) excerpt += ` | ${fileTitle}`;
        if (fileType) excerpt += ` | 类型: ${fileType}`;
        if (filedate) excerpt += ` | 日期: ${filedate}`;

        // 构造详情链接
        const detailUrl = `https://www.sse.com.cn/listing/disclosure/ipo/detail.shtml?stockCode=${stockCode}`;

        // 解析日期
        let pubDate = filedate;
        if (pubDate) {
          const dateMatch = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            pubDate = dateMatch[1];
          }
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

      // 去重（按股票代码）
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

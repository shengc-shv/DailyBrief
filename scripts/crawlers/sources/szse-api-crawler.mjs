import { BaseCrawler } from '../base-crawler.mjs';

const SZSE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export class SZSEAPICrawler extends BaseCrawler {
  constructor() {
    super({
      name: '深交所IPO公告',
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州',
                 '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江',
                 '清远', '潮州', '揭阳', '云浮'],
      timeout: 20000,  // 增加超时
    });
    this.stockCodeWhitelist = [];
    this.categoryWhitelist = ['0102'];
    this.ipoKeywords = ['发行', '上市', '招股', '公开发行', 'IPO'];
    this.pages = 2;
  }

  getUrls() {
    const urls = [];
    const pages = Math.max(1, Number(this.pages) || 1);
    for (let p = 1; p <= pages; p++) {
      urls.push({
        url: `https://www.szse.cn/api/disc/announcement/detailinfo?random=${Math.random()}&pageSize=50&pageNum=${p}&plateCode=szse`,
        method: 'GET',
        headers: {
          'Referer': 'https://www.szse.cn/disclosure/listed/notice/index.html',
          'User-Agent': SZSE_UA,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
        },
      });
    }
    return urls;
  }

  // ⭐ 重写 run 方法，确保 headers 被正确传递
  async run() {
    console.log(`[${this.name}] 开始抓取...`);
    const items = await this.getUrls();
    let total = 0;

    for (const item of items) {
      const targetUrl = typeof item === 'string' ? item : item.url;
      const method = item.method || 'GET';
      const headers = item.headers || { 'User-Agent': this.userAgent };

      try {
        const fetchOptions = {
          method: method,
          headers: headers,
          signal: AbortSignal.timeout(this.timeout),
        };

        if (method === 'POST' && item.body) {
          fetchOptions.body = item.body;
        }

        console.log(`[${this.name}] 请求: ${targetUrl}`);
        const resp = await fetch(targetUrl, fetchOptions);

        if (!resp.ok) {
          console.warn(`[${this.name}] ${targetUrl} 返回 ${resp.status}，跳过`);
          continue;
        }

        const text = await resp.text();
        const articles = await this.parseArticle(text, targetUrl);

        const filtered = articles.filter(a =>
          this.keywords.some(kw =>
            (a.title || '').includes(kw) || (a.excerpt || '').includes(kw)
          )
        );

        this.results.push(...filtered);
        total += filtered.length;
        console.log(`[${this.name}] 从 ${targetUrl} 抓取 ${filtered.length} 条（共 ${articles.length} 条原始）`);
      } catch (err) {
        console.warn(`[${this.name}] ${targetUrl} 抓取失败: ${err.message}`);
        // 打印更详细的错误信息
        if (err.cause) {
          console.warn(`[${this.name}] 原因:`, err.cause);
        }
      }

      await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
    }

    console.log(`[${this.name}] 完成，共 ${this.results.length} 条`);
    return this.results;
  }

  // parseArticle 保持不变...
  async parseArticle(responseText, url) {
    // ... 你原来的代码不变 ...
  }
}

export function createCrawler() {
  return new SZSEAPICrawler();
}

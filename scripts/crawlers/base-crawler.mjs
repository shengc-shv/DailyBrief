import { fetch, Headers } from 'undici';

/**
 * 通用爬虫基类 - 专门为 DailyBrief 格式设计
 * 每个子类只需实现 getUrls() 和 parseArticle() 两个方法
 */
export class BaseCrawler {
  constructor(options = {}) {
    this.name = options.name || 'unknown';
    this.keywords = options.keywords || ['广州', '上市', 'IPO', '辅导备案'];
    this.timeout = options.timeout || 15000;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    this.results = [];
  }

  /**
   * 子类必须实现：返回要抓取的 URL 列表
   */
  async getUrls() {
    throw new Error('子类必须实现 getUrls() 方法');
  }

  /**
   * 子类必须实现：从 HTML 中解析出文章列表
   * 返回: [{ title, url, excerpt, publishedAt? }]
   */
  async parseArticle(html, url) {
    throw new Error('子类必须实现 parseArticle() 方法');
  }

  /**
   * 通用抓取方法 - 子类一般不需要重写
   */
  async run() {
  console.log(`[${this.name}] 开始抓取...`);
  const items = await this.getUrls();
  let total = 0;

  for (const item of items) {
    // 兼容多种格式
    const targetUrl = typeof item === 'string' ? item : item.url;
    const method = item.method || 'GET';
    const headers = item.headers || { 'User-Agent': this.userAgent };
    const body = item.body || undefined;

    try {
      const fetchOptions = {
        method: method,
        headers: headers,
        signal: AbortSignal.timeout(this.timeout),
      };
      
      // POST 请求需要 body
      if (method === 'POST' && body) {
        fetchOptions.body = body;
      }

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
    }

    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
  }

  console.log(`[${this.name}] 完成，共 ${this.results.length} 条`);
  return this.results;
}

  /**
   * 转换格式供 DailyBrief 使用
   */
  toDailyBriefFormat() {
    return this.results.map(item => ({
      title: item.title || '无标题',
      url: item.url || '',
      excerpt: item.excerpt || '',
      publishedAt: item.publishedAt || new Date().toISOString(),
      source: this.name,
    }));
  }
}

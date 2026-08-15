import { BaseCrawler } from '../base-crawler.mjs';

const CNINFO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export class CNInfoCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '巨潮资讯公告',
      keywords: [],  // 保留空数组，但重写 run 后不会用到
      timeout: 15000,
    });
    this.columns = ['szse'];
    this.windowDays = 7;
  }

  getUrls() {
    const end = new Date();
    const start = new Date(Date.now() - (this.windowDays || 7) * 86400000);
    const fmt = d => d.toISOString().slice(0, 10);
    const seDate = `${fmt(start)}~${fmt(end)}`;

    return (this.columns || ['szse']).map(column => ({
      url: 'https://www.cninfo.com.cn/new/hisAnnouncement/query',
      method: 'POST',
      headers: {
        'Referer': 'https://www.cninfo.com.cn/new/index',
        'Origin': 'https://www.cninfo.com.cn',
        'User-Agent': CNINFO_UA,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams({
        pageNum: '1',
        pageSize: '30',
        column,
        tabName: 'fulltext',
        plate: '',
        stock: '',
        searchkey: '',
        secid: '',
        category: '',
        trade: '',
        seDate,
        sortName: '',
        sortType: '',
        isHLtitle: 'true',
      }).toString(),
    }));
  }

  // ⭐ 重写 run 方法：完全绕过基类的过滤逻辑
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

        const resp = await fetch(targetUrl, fetchOptions);

        if (!resp.ok) {
          console.warn(`[${this.name}] ${targetUrl} 返回 ${resp.status}，跳过`);
          continue;
        }

        const text = await resp.text();
        const articles = await this.parseArticle(text, targetUrl);

        // ⭐ 直接使用全部数据，不做任何过滤
        this.results.push(...articles);
        total += articles.length;
        console.log(`[${this.name}] 从 ${targetUrl} 抓取 ${articles.length} 条（共 ${articles.length} 条原始）`);
      } catch (err) {
        console.warn(`[${this.name}] ${targetUrl} 抓取失败: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    }

    console.log(`[${this.name}] 完成，共 ${this.results.length} 条`);
    return this.results;
  }

  async parseArticle(responseText, url) {
    const articles = [];
    try {
      const data = JSON.parse(responseText);
      const list = data?.announcements;
      if (!Array.isArray(list)) {
        console.warn(`[${this.name}] 返回数据格式异常`);
        return articles;
      }
      console.log(`[${this.name}] 接口共返回 ${list.length} 条公告`);

      for (const item of list) {
        const stockName = item.secName || '';
        const stockCode = item.secCode || '';
        const titleText = item.announcementTitle || '';

        const ts = Number(item.announcementTime) || 0;
        const pubDate = ts ? new Date(ts).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const title = `${stockName} (${stockCode})`;
        const excerpt = `巨潮公告 | ${titleText} | 日期: ${pubDate}`;
        const detailUrl = item.adjunctUrl
          ? `https://static.cninfo.com.cn/${item.adjunctUrl}`
          : '';

        articles.push({ title, url: detailUrl, excerpt, publishedAt: pubDate });
      }

      console.log(`[${this.name}] 共输出 ${articles.length} 条公告`);
      return articles;
    } catch (err) {
      console.error(`[${this.name}] 解析失败:`, err.message);
      return articles;
    }
  }
}

export function createCrawler() {
  return new CNInfoCrawler();
}

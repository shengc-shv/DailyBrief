import { BaseCrawler } from '../base-crawler.mjs';

const CNINFO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export class CNInfoCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '巨潮资讯公告',
      keywords: [],
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

      // ⭐ 去掉所有过滤，直接展示所有公告
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

import { BaseCrawler } from '../base-crawler.mjs';

const CNINFO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// 巨潮资讯网（cninfo.com.cn）公告接口要点（已实测，2026-08）：
// 1. 接口稳定、无 WAF，无需预热 Cookie，直接 POST 即可；
// 2. URL: /new/hisAnnouncement/query，column=szse|sse|bse（北交所 bse 列实测返回空，请用北交所官网爬虫）；
// 3. seDate 格式 "YYYY-MM-DD~YYYY-MM-DD"；单页 pageSize 上限约 30；
// 4. 返回 announcements[]：secCode/secName(简称!)/announcementTitle/announcementTime(ms)/adjunctUrl；
// 5. 附件 PDF 直链 = https://static.cninfo.com.cn + adjunctUrl；
// 6. 同北交所：secName 是股票简称，不含注册地，广东企业建议配合 stockCodeWhitelist 使用。

export class CNInfoCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '巨潮资讯IPO公告',
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州',
                 '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江',
                 '清远', '潮州', '揭阳', '云浮'],
      timeout: 15000,
    });
    // 广东企业代码白名单（沪深均可）：命中白名单的公司输出其全部公告
    this.stockCodeWhitelist = [];
    // 标题 IPO 关键词：命中任一才输出（白名单公司不受此限制）
    this.ipoKeywords = ['发行', '上市', '招股', '公开发行', 'IPO'];
    // 查询市场：'szse'(深市) / 'sse'(沪市)；实测 2026-08 巨潮 column 参数已不区分市场
    // （szse/sse 返回同一批全市场公告），因此默认只请求一次，避免重复入库。
    this.columns = ['szse'];
    // 抓取近 N 天公告
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

      const seen = new Set();
      for (const item of list) {
        const stockName = item.secName || '';
        const stockCode = item.secCode || '';
        const titleText = item.announcementTitle || '';

        const isGuangdong = this.keywords.some(kw => stockName.includes(kw))
          || (Array.isArray(this.stockCodeWhitelist) && this.stockCodeWhitelist.includes(stockCode));
        if (!isGuangdong) continue;

        // IPO 主题过滤：白名单公司全量输出，其余按标题关键词
        const inWhitelist = Array.isArray(this.stockCodeWhitelist) && this.stockCodeWhitelist.includes(stockCode);
        const isIpo = (this.ipoKeywords || []).some(kw => titleText.includes(kw));
        if (!inWhitelist && !isIpo) continue;

        const key = `${stockCode}_${titleText}`;
        if (seen.has(key)) continue;
        seen.add(key);

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

      console.log(`[${this.name}] 匹配到 ${articles.length} 条广东企业IPO动态`);
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

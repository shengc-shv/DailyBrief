import { BaseCrawler } from '../base-crawler.mjs';

const CNINFO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * 巨潮资讯公告爬虫
 * 数据来源: https://www.cninfo.com.cn/new/hisAnnouncement/query
 *
 * 过滤逻辑：必须同时满足「广东地区」+「IPO/上市辅导相关」
 * - 地区关键词：广东、广州、深圳、东莞、佛山、珠海等
 * - IPO关键词：发行、上市、招股、公开发行、IPO、辅导备案等
 */
export class CNInfoCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '巨潮资讯公告',
      keywords: [],   // 父类不过滤，传空数组
      timeout: 15000,
    });
    this.columns = ['szse'];
    this.windowDays = 7;  // 巨潮资讯窗口期（可调整）
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

  // 继承父类 run 方法（父类已不再过滤），无需重写

  async parseArticle(responseText, url) {
    const articles = [];
    // 计算 7 天前的时间戳（与 windowDays 保持一致）
    const windowDaysAgo = new Date();
    windowDaysAgo.setDate(windowDaysAgo.getDate() - (this.windowDays || 7));

    // 地区关键词（广东及主要城市）
    const regionKeywords = [
      '广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州',
      '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江',
      '清远', '潮州', '揭阳', '云浮'
    ];

    // IPO / 上市辅导关键词
    const ipoKeywords = [
      '发行', '上市', '招股', '公开发行', 'IPO',
      '注册', '受理', '问询', '上会', '过会', '注册生效',
      '首次公开发行', '辅导备案', '辅导验收'
    ];

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

        // 解析日期
        const ts = Number(item.announcementTime) || 0;
        const pubDate = ts ? new Date(ts).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        // 过滤 7 天前的数据
        const itemDate = new Date(pubDate);
        if (itemDate < windowDaysAgo) {
          continue;
        }

        // ⭐ 双重过滤：地区 + IPO（AND 逻辑）
        const allText = `${stockName} ${titleText}`;

        // 检查地区关键词（公司名或标题中包含地区词）
        const isRegion = regionKeywords.some(kw =>
          allText.includes(kw)
        );

        // 检查 IPO 关键词（标题中包含 IPO 关键词）
        const isIpo = ipoKeywords.some(kw =>
          titleText.includes(kw)
        );

        // 必须同时满足地区 + IPO
        if (!isRegion || !isIpo) {
          continue;
        }

        // 去重
        const key = `${stockCode}_${titleText}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const title = `${stockName} (${stockCode})`;
        const excerpt = `巨潮公告 | ${titleText} | 日期: ${pubDate}`;
        const detailUrl = item.adjunctUrl
          ? `https://static.cninfo.com.cn/${item.adjunctUrl}`
          : '';

        articles.push({
          title,
          url: detailUrl,
          excerpt,
          publishedAt: pubDate,
        });
      }

      console.log(`[${this.name}] 匹配到 ${articles.length} 条广东IPO相关公告（最近${this.windowDays || 7}天）`);
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

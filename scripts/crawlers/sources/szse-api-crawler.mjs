import { BaseCrawler } from '../base-crawler.mjs';

const SZSE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// 深交所公告接口要点（已实测，2026-08）：
// 1. 无 Cookie 挑战，GET + Referer + UA 即可直连；
// 2. 列表接口：GET /api/disc/announcement/detailinfo?pageSize=50&pageNum=1&plateCode=szse
//    （random 参数可随意），固定返回「近 2 天」全部公告，按公司分组 data[].announList[]；
// 3. 不支持服务端按类别过滤（bigCategoryId 参数无效），IPO 过滤在解析端做：
//    公告自带 bigCategoryId/bigCategoryName，0102 = 首次公开发行及上市（见 searchQuery 字典）；
// 4. 附件 PDF 直链 = https://disc.static.szse.cn + attachPath（www.szse.cn 域名会 403）；
// 5. 同其他交易所：secName 是简称，不含注册地，广东企业建议配合 stockCodeWhitelist。

export class SZSEAPICrawler extends BaseCrawler {
  constructor() {
    super({
      name: '深交所IPO公告',
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州',
                 '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江',
                 '清远', '潮州', '揭阳', '云浮'],
      timeout: 15000,
    });
    // 广东企业代码白名单（命中则输出该公司的全部公告）
    this.stockCodeWhitelist = [];
    // IPO 相关公告类别（searchQuery 字典）：0102=首次公开发行及上市；可追加 0107 增发等
    this.categoryWhitelist = ['0102'];
    // 标题关键词兜底（类别未命中时使用）
    this.ipoKeywords = ['发行', '上市', '招股', '公开发行', 'IPO'];
    // 抓取页数：每页 50 条，近 2 天约 460+ 条
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
        },
      });
    }
    return urls;
  }

  async parseArticle(responseText, url) {
    const articles = [];
    try {
      const data = JSON.parse(responseText);
      const groups = data?.data;
      if (!Array.isArray(groups)) {
        console.warn(`[${this.name}] 返回数据格式异常`);
        return articles;
      }

      // 展平：data[] 按公司分组，取 announList[]
      const flat = [];
      for (const g of groups) {
        for (const a of (g.announList || [])) {
          flat.push({ ...a, secCode: g.secCode, secName: g.secName });
        }
      }
      console.log(`[${this.name}] 接口共返回 ${flat.length} 条公告`);

      const seen = new Set();
      for (const item of flat) {
        const stockName = item.secName || '';
        const stockCode = item.secCode || '';
        const titleText = item.title || '';
        const bigCategoryId = String(item.bigCategoryId || '');
        const bigCategoryName = item.bigCategoryName || '';

        const isGuangdong = this.keywords.some(kw => stockName.includes(kw))
          || (Array.isArray(this.stockCodeWhitelist) && this.stockCodeWhitelist.includes(stockCode));
        if (!isGuangdong) continue;

        // IPO 主题过滤：白名单公司全量输出，其余要求类别命中或标题命中
        const inWhitelist = Array.isArray(this.stockCodeWhitelist) && this.stockCodeWhitelist.includes(stockCode);
        const catHit = (this.categoryWhitelist || []).some(c => bigCategoryId.startsWith(c));
        const kwHit = (this.ipoKeywords || []).some(k => titleText.includes(k));
        if (!inWhitelist && !catHit && !kwHit) continue;

        const key = `${stockCode}_${titleText}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const pubDate = (item.publishTime || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
        const title = `${stockName} (${stockCode})`;
        const excerpt = `深交所公告 | ${titleText} | ${bigCategoryName || ''} | 日期: ${pubDate}`;
        const detailUrl = item.attachPath
          ? `https://disc.static.szse.cn${item.attachPath}`
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
  return new SZSEAPICrawler();
}

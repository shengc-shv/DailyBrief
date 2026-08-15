import { BaseCrawler } from '../base-crawler.mjs';

const BSE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// 北交所官网反爬要点（已实测，2026-08）：
// 1. 必须先 GET 一次公告页拿 C3VK Cookie（5 分钟有效），否则接口返回空数据；
// 2. 公告列表走 /disclosureInfoController/initDisclosureList.do（POST，纯 JSON 响应）；
// 3. needFields / xxfcbj 必须用数组形式序列化（key 带 []），否则接口拒绝/返回空；
// 4. siteId=6 & flag=0 & isNewThree=1 是必填参数。
// 因此本爬虫在 parseArticle 内部自包含「预热拿 Cookie → 请求接口」两步，
// 不依赖框架是否串行共享 Cookie。

export class BSEAPICrawler extends BaseCrawler {
  constructor() {
    super({
      name: '北交所IPO公告',
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州',
                 '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江',
                 '清远', '潮州', '揭阳', '云浮'],
      timeout: 15000,
    });
    // 重要：北交所公告接口只返回「股票简称」（如"创远信科"），不含注册地/全称，
    // 因此按城市关键词匹配会漏检（广东企业简称通常不带城市名）。
    // 建议在下方维护一份「广东北交所上市公司代码白名单」配合使用：
    this.stockCodeWhitelist = [];
    // 例：this.stockCodeWhitelist = ['920126', '920211'];
  }

  async getUrls() {
    // 触发条目的 URL 仅作占位；实际请求在 parseArticle 内部完成
    return [{
      url: 'https://www.bse.cn/disclosure/announcement.html',
      method: 'GET',
      headers: { 'User-Agent': BSE_UA },
    }];
  }

  async fetchAnnouncements(page = 0) {
    // 1) 预热：拿 C3VK Cookie（302 循环，redirect: 'manual' 只取 Set-Cookie 头）
    const warmRes = await fetch('https://www.bse.cn/disclosure/announcement.html', {
      headers: { 'User-Agent': BSE_UA },
      redirect: 'manual',
    });
    const cookie = (warmRes.headers.get('set-cookie') || '').split(';')[0];
    if (!cookie) {
      console.warn(`[${this.name}] 未取得北交所 Cookie，接口可能返回空数据`);
    }

    // 2) 公告列表接口
    const body = new URLSearchParams({
      siteId: '6',
      flag: '0',
      page: String(page),
      companyCd: '',
      isNewThree: '1',
      keyword: '',
      'xxfcbj[]': '2',
      sortfield: 'publish_date',
      sorttype: 'desc',
    });
    // 数组参数：needFields[] 逐项 append
    for (const f of ['companyCd', 'companyName', 'disclosureTitle',
                     'disclosurePostTitle', 'destFilePath', 'publishDate',
                     'fileExt', 'xxzrlx']) {
      body.append('needFields[]', f);
    }

    const res = await fetch('https://www.bse.cn/disclosureInfoController/initDisclosureList.do', {
      method: 'POST',
      headers: {
        'User-Agent': BSE_UA,
        'Cookie': cookie,
        'Referer': 'https://www.bse.cn/disclosure/announcement.html',
        'Origin': 'https://www.bse.cn',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: body.toString(),
    });
    const text = await res.text();
    if (!text.trimStart().startsWith('{')) {
      console.warn(`[${this.name}] 接口返回非 JSON（可能是反爬拦截）`);
      return [];
    }
    const data = JSON.parse(text);
    const content = data?.data?.content;
    if (!Array.isArray(content)) {
      console.warn(`[${this.name}] 返回数据格式异常`);
      return [];
    }
    return content.flatMap(g => Array.isArray(g.disclosures) ? g.disclosures : []);
  }

  async parseArticle(responseText, url) {
    const articles = [];
    try {
      const list = await this.fetchAnnouncements(0);
      console.log(`[${this.name}] 接口共返回 ${list.length} 条公告`);

      const seen = new Set();
      for (const item of list) {
        const stockName = item.companyName || '';
        const stockCode = item.companyCd || '';
        // 双通道过滤：简称含城市关键词 或 代码命中白名单
        const isGuangdong = this.keywords.some(kw => stockName.includes(kw))
          || (Array.isArray(this.stockCodeWhitelist) && this.stockCodeWhitelist.includes(stockCode));
        if (!isGuangdong) continue;
        const key = `${stockCode}_${stockName}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const title = `${stockName} (${stockCode})`;
        const excerpt = `北交所公告 | ${item.disclosureTitle || ''} | 日期: ${item.publishDate || ''}`;
        // 公告标题链接指向 PDF 直链（与官网表格一致）
        const detailUrl = `https://www.bse.cn${item.destFilePath || ''}`;
        const pubDate = (item.publishDate || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1]
          || new Date().toISOString().slice(0, 10);

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
  return new BSEAPICrawler();
}

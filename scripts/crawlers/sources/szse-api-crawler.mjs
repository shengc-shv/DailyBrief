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
      timeout: 30000,  // 增加到 30 秒
    });
    this.stockCodeWhitelist = [];
    this.categoryWhitelist = ['0102'];
    this.ipoKeywords = ['发行', '上市', '招股', '公开发行', 'IPO'];
    this.pages = 1;  // 只抓 1 页，减少超时风险
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

  // ⭐ 重写 run 方法，增加重试和更详细的错误处理
  async run() {
    console.log(`[${this.name}] 开始抓取...`);
    const items = await this.getUrls();
    let total = 0;

    for (const item of items) {
      const targetUrl = typeof item === 'string' ? item : item.url;
      const method = item.method || 'GET';
      const headers = item.headers || { 'User-Agent': this.userAgent };

      // 重试机制：最多尝试 2 次
      let lastError = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[${this.name}] 请求 (尝试 ${attempt}/2): ${targetUrl}`);
          
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
            console.warn(`[${this.name}] ${targetUrl} 返回 ${resp.status}，${attempt < 2 ? '重试中...' : '跳过'}`);
            if (attempt < 2) {
              await new Promise(r => setTimeout(r, 2000 * attempt));
              continue;
            }
            break;
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
          break; // 成功，跳出重试循环

        } catch (err) {
          lastError = err;
          console.warn(`[${this.name}] 尝试 ${attempt}/2 失败: ${err.message}`);
          if (attempt < 2) {
            const delay = 3000 * attempt;
            console.log(`[${this.name}] 等待 ${delay}ms 后重试...`);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }

      if (lastError) {
        console.warn(`[${this.name}] ${targetUrl} 最终失败: ${lastError.message}`);
      }

      await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
    }

    console.log(`[${this.name}] 完成，共 ${this.results.length} 条`);
    return this.results;
  }

  // parseArticle 保持不变
  async parseArticle(responseText, url) {
    const articles = [];
    try {
      const data = JSON.parse(responseText);
      const groups = data?.data;
      if (!Array.isArray(groups)) {
        console.warn(`[${this.name}] 返回数据格式异常`);
        return articles;
      }

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

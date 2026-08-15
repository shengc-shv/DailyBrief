import { BaseCrawler } from '../base-crawler.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const SZSE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export class SZSEAPICrawler extends BaseCrawler {
  constructor() {
    super({
      name: '深交所IPO公告',
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州',
                 '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江',
                 '清远', '潮州', '揭阳', '云浮'],
      timeout: 30000,
    });
    this.stockCodeWhitelist = [];
    this.categoryWhitelist = ['0102'];
    this.ipoKeywords = ['发行', '上市', '招股', '公开发行', 'IPO'];
    this.pages = 1;
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
          'Cache-Control': 'no-cache',
        },
      });
    }
    return urls;
  }

  // ⭐ 使用 curl 替代 fetch
  async run() {
    console.log(`[${this.name}] 开始抓取...`);
    const items = await this.getUrls();
    let total = 0;

    for (const item of items) {
      const targetUrl = typeof item === 'string' ? item : item.url;
      const headers = item.headers || { 'User-Agent': this.userAgent };

      try {
        // 构建 curl 命令
        const headerArgs = [];
        for (const [key, value] of Object.entries(headers)) {
          headerArgs.push(`-H "${key}: ${value}"`);
        }

        const curlCmd = `curl -s -L --max-time 30 ${headerArgs.join(' ')} "${targetUrl}"`;
        console.log(`[${this.name}] 执行 curl 请求...`);

        const { stdout, stderr } = await execAsync(curlCmd);

        if (stderr && !stderr.includes('Warning')) {
          console.warn(`[${this.name}] curl 警告: ${stderr}`);
        }

        // 检查是否返回了有效的 JSON
        const trimmed = stdout.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          console.warn(`[${this.name}] 返回非 JSON 数据，可能是反爬拦截`);
          continue;
        }

        const articles = await this.parseArticle(trimmed, targetUrl);

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

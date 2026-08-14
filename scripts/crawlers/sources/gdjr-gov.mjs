import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 广东省地方金融监督管理局 - 动态通知
 * 网站: https://gdjr.gd.gov.cn
 */
export class GdjrgovCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '广东省金融局',
      keywords: ['上市', 'IPO', '辅导', '资本市场', '金融', '企业'],
    });
  }

  async getUrls() {
    // 动态通知栏目 - 具体 URL 需根据实际网站调整
    return [
      'https://gdjr.gd.gov.cn/gdjr/zwgk/zwdt/zxdt/index.html',
      // 可增加更多页面
    ];
  }

  async parseArticle(html, url) {
    // 使用正则或简单字符串解析（避免引入 cheerio）
    const articles = [];
    
    // 示例：匹配 <li><a href="...">标题</a></li> 模式
    const liRegex = /<li[^>]*>.*?<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>.*?<\/li>/gis;
    let match;
    while ((match = liRegex.exec(html)) !== null) {
      const link = match[1];
      const title = match[2].trim();
      // 只保留包含关键词的
      if (title && title.length > 5) {
        articles.push({
          title: title,
          url: link.startsWith('http') ? link : `https://gdjr.gd.gov.cn${link}`,
          excerpt: '',
          publishedAt: new Date().toISOString(),
        });
      }
    }
    
    return articles;
  }
}

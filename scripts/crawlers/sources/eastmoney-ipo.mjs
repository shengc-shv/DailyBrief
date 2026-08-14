import { BaseCrawler } from '../base-crawler.mjs';

/**
 * 东方财富 - IPO辅导备案信息爬虫（API版）
 * 数据来源: https://datacenter-web.eastmoney.com/api/data/v1/get
 * 
 * 直接调用东方财富官方API，返回结构化JSON数据
 * 比解析HTML稳定100倍
 */
export class EastMoneyIPOCrawler extends BaseCrawler {
  constructor() {
    super({
      name: '东方财富IPO辅导',
      // 广东地区关键词（用于二次过滤）
      keywords: ['广东', '广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州', 
                 '江门', '汕头', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江', 
                 '清远', '潮州', '揭阳', '云浮'],
      timeout: 15000,
    });
  }

  /**
   * 直接调用东方财富API
   */
  async getUrls() {
    const baseUrl = 'https://datacenter-web.eastmoney.com/api/data/v1/get';
    const params = new URLSearchParams({
      reportName: 'RPT_IPO_TUTRECORD',
      columns: 'TUTOR_OBJECT,ORG_CODE,TUTOR_ORG_CODE,TUTOR_ORG,TUTOR_PROCESS_STATE,REPORT_TYPE,DISPATCH_ORG,REPORT_TITLE,RECORD_DATE',
      sortColumns: 'RECORD_DATE,TUTOR_OBJECT',
      sortTypes: '-1,-1',
      source: 'WEB',
      client: 'WEB',
      pageNumber: '1',
      pageSize: '100',  // 每页100条，共54页，但第一页已包含最新数据
    });
    
    // 只抓取第一页（最新100条），足够覆盖近期的辅导备案信息
    return [`${baseUrl}?${params.toString()}`];
  }

  /**
   * 解析API返回的JSON数据
   */
  async parseArticle(responseText, url) {
    const articles = [];

    try {
      const data = JSON.parse(responseText);
      
      // 检查数据结构
      if (!data.result || !data.result.data || !Array.isArray(data.result.data)) {
        console.warn(`[${this.name}] API返回数据格式异常`);
        return articles;
      }

      const list = data.result.data;
      console.log(`[${this.name}] API共返回 ${list.length} 条辅导备案记录`);

      for (const item of list) {
        const companyName = item.TUTOR_OBJECT || '';
        const tutorOrg = item.TUTOR_ORG || '';
        const status = item.TUTOR_PROCESS_STATE || '';
        const reportType = item.REPORT_TYPE || '';
        const dispatchOrg = item.DISPATCH_ORG || '';  // 派出证监局
        const reportTitle = item.REPORT_TITLE || '';
        const recordDate = item.RECORD_DATE || '';

        // 提取公司代码（用于构造详情链接）
        const orgCode = item.ORG_CODE || '';

        // 筛选广东地区企业（通过派出机构判断）
        const isGuangdong = /广东|深圳/.test(dispatchOrg);
        
        if (!isGuangdong) continue;

        // 构建标题
        let title = companyName;
        if (status) title += ` (${status})`;
        if (dispatchOrg) title += ` [${dispatchOrg}]`;

        // 构建摘要
        let excerpt = `IPO辅导备案`;
        if (tutorOrg) excerpt += ` | 辅导机构: ${tutorOrg}`;
        if (recordDate) excerpt += ` | 备案时间: ${recordDate}`;
        if (status) excerpt += ` | 状态: ${status}`;
        if (reportType) excerpt += ` | 报告: ${reportType}`;

        // 构造详情链接（东方财富的详情页）
        const detailUrl = orgCode 
          ? `https://data.eastmoney.com/xg/ipo/fd/${orgCode}.html`
          : url;

        // 解析日期
        let pubDate = recordDate;
        if (pubDate) {
          const dateMatch = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            pubDate = dateMatch[1];
          }
        } else {
          pubDate = new Date().toISOString().slice(0, 10);
        }

        articles.push({
          title: title,
          url: detailUrl,
          excerpt: excerpt,
          publishedAt: pubDate,
        });
      }

      console.log(`[${this.name}] 匹配到 ${articles.length} 家广东辅导企业`);

    } catch (err) {
      console.error(`[${this.name}] 解析API失败:`, err.message);
    }

    return articles;
  }
}

export function createCrawler() {
  return new EastMoneyIPOCrawler();
}

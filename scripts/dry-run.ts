import "./_env";

import fs from "node:fs";
import path from "node:path";

import { sources } from "../lib/sources/registry";
import { fetchSource } from "../lib/sources/dispatch";
import type { ArticleInput } from "../lib/ai/pipeline";

// Source-fetch sanity check only — does NOT call the LLM. For the full
// ingest → digest → write-to-disk pipeline use `npm run daily` instead.
async function main() {
  console.log("Fetching from sources…\n");
  const articles: ArticleInput[] = [];

  // ----- 加载本地爬虫数据（广东IPO）-----
  const dataPath = path.resolve(process.cwd(), 'data/crawled-articles.json');
  if (fs.existsSync(dataPath)) {
    try {
      const raw = fs.readFileSync(dataPath, 'utf8');
      const items = JSON.parse(raw);
      let count = 0;
      for (const item of items) {
        const exists = articles.some(a => a.url === item.url);
        if (exists) continue;
        articles.push({
          sourceId: 'gd-local-scraper',
          source: '广东本地爬虫',
          title: item.title || '无标题',
          url: item.url || '',
          excerpt: item.excerpt || '',
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
          category: 'gd-ipo',
          summary: item.summary || '',
        });
        count++;
      }
      console.log(`  ✅ 加载爬虫数据 ${count} 条（跳过 ${items.length - count} 条重复）`);
    } catch (err) {
      console.warn(`  ⚠️ 加载爬虫数据失败: ${err.message}`);
    }
  } else {
    console.log(`  ℹ️ 爬虫数据文件不存在: ${dataPath}`);
  }

  const enabled = sources.filter((s) => s.enabled !== false);
  for (const source of enabled) {
    try {
      const items = await fetchSource(source);
      console.log(`  ${source.id.padEnd(20)} ${items.length}`);
      articles.push(...items.map((it) => ({ ...it, source: source.name })));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ${source.id.padEnd(20)} FAILED — ${msg}`);
    }
  }

  console.log(`\nTotal articles: ${articles.length}`);
  console.log("\nTop 10 articles:");
  articles.slice(0, 10).forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.category}] ${a.title}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

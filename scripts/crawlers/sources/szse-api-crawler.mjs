async run() {
  console.log(`[${this.name}] 开始抓取...`);
  const items = await this.getUrls();
  let total = 0;

  for (const item of items) {
    const targetUrl = typeof item === 'string' ? item : item.url;
    const headers = item.headers || { 'User-Agent': this.userAgent };

    try {
      const headerArgs = [];
      for (const [key, value] of Object.entries(headers)) {
        headerArgs.push(`-H "${key}: ${value}"`);
      }

      // 添加 -k 忽略 SSL，添加 -v 输出详细信息
      const curlCmd = `curl -s -L -k --max-time 30 ${headerArgs.join(' ')} "${targetUrl}"`;
      console.log(`[${this.name}] 执行: ${curlCmd}`);

      const { stdout, stderr } = await execAsync(curlCmd);

      if (stderr) {
        console.log(`[${this.name}] curl 详细信息:\n${stderr}`);
      }

      const trimmed = stdout.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        console.warn(`[${this.name}] 返回非 JSON 数据（前200字符）: ${trimmed.slice(0, 200)}`);
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
      console.error(`[${this.name}] ${targetUrl} 抓取失败: ${err.message}`);
      if (err.stderr) console.error(`[${this.name}] stderr:`, err.stderr);
      if (err.stdout) console.error(`[${this.name}] stdout:`, err.stdout.slice(0, 500));
    }

    await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
  }

  console.log(`[${this.name}] 完成，共 ${this.results.length} 条`);
  return this.results;
}

// node build-docs.mjs openapi.yaml dist/redoc-static.html
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';

const [, , inputPath, outputPath = 'redoc-static.html'] = process.argv;

if (!inputPath) {
  console.error('Usage: node build-docs.mjs <openapi.(yaml|json)> [output.html]');
  process.exit(1);
}

// 1) 读取 + bundle（把 $ref 合并成一个文档，避免运行时再发请求）
const raw = await fs.readFile(inputPath, 'utf8');
const spec =
  inputPath.endsWith('.yaml') || inputPath.endsWith('.yml') ? YAML.load(raw) : JSON.parse(raw);

// 这里用 “bundle” 而不是 “dereference”，保持循环引用安全且输出紧凑
const bundled = await SwaggerParser.bundle(spec);

// 2) 取到 redoc 的浏览器版 UMD 包（不走 CDN，完全离线）
const redocUmdPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'node_modules',
  'redoc',
  'bundles',
  'redoc.standalone.js',
);
const redocUmd = await fs.readFile(redocUmdPath, 'utf8');

// 3) 拼 HTML（把 spec 内嵌到 window 变量里，页面加载后直接 init）
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>API Reference</title>
<style>html,body,#redoc{height:100%;margin:0}</style>
</head>
<body>
  <div id="redoc"></div>
  <script>window.__REDOC_SPEC__ = ${JSON.stringify(bundled)};</script>
  <script>
${redocUmd}
  </script>
  <script>
    // 可在此处传 Redoc 配置项（主题、隐藏某些面板等）
    // 参考官方文档的 options 列表
    Redoc.init(window.__REDOC_SPEC__, {
      scrollYOffset: 60,
      expandResponses: '200,201',
      hideDownloadButton: false
    }, document.getElementById('redoc'));
  </script>
</body>
</html>`;

await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await fs.writeFile(outputPath, html, 'utf8');
console.log('✔ Generated:', outputPath);

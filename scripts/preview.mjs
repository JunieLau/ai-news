import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

export function resolvePreviewPath(distDir, base, urlPath) {
  const dist = path.resolve(distDir);
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  let pathname = urlPath;
  try {
    pathname = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return { status: 404, file: path.join(dist, "404.html") };
  }
  if (pathname !== normalizedBase && !pathname.startsWith(`${normalizedBase}/`)) {
    return { status: 404, file: path.join(dist, "404.html") };
  }
  let rel = pathname.slice(normalizedBase.length);
  if (!rel || rel === "/") rel = "/index.html";
  else if (rel.endsWith("/")) rel = `${rel}index.html`;
  const file = path.resolve(dist, `.${rel}`);
  if (file !== dist && !file.startsWith(dist + path.sep)) {
    return { status: 404, file: path.join(dist, "404.html") };
  }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return { status: 200, file };
  return { status: 404, file: path.join(dist, "404.html") };
}

function main() {
  const dist = path.join(root, "dist");
  const base = process.env.BASE_PATH || "/ai-news";
  const port = Number(process.env.PORT || 4173);
  if (!fs.existsSync(path.join(dist, "index.html"))) {
    console.error("还没有 dist/index.html。先运行 npm run build。");
    process.exitCode = 1;
    return;
  }
  const server = http.createServer((req, res) => {
    const hit = resolvePreviewPath(dist, base, req.url || "/");
    const file = hit.file;
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    const ext = path.extname(file);
    res.writeHead(hit.status, { "content-type": TYPES[ext] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`http://127.0.0.1:${port}${base}/`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

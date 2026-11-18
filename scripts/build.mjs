import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadIssues, streamIssues } from "./lib.mjs";
import {
  buildManifest,
  buildSearchIndex,
  renderEmptyStream,
  renderIssuePage,
  renderNotFound,
  renderSearchPage,
} from "./render.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function parseArgs(argv) {
  const args = { content: path.join(root, "content"), out: path.join(root, "dist"), base: "/ai-news" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--content") args.content = path.resolve(argv[++i]);
    else if (token === "--out") args.out = path.resolve(argv[++i]);
    else if (token === "--base") args.base = argv[++i];
    else if (token === "--help") args.help = true;
    else throw new Error(`未知参数 ${token}`);
  }
  return args;
}

function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

export function buildSite({ contentDir, outDir, base = "/ai-news" }) {
  const { issues, errors } = loadIssues(contentDir);
  if (errors.length) {
    const error = new Error(errors.map((item) => item.message).join("\n"));
    error.errors = errors;
    throw error;
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const morning = streamIssues(issues, "morning");
  const evening = streamIssues(issues, "evening");
  const streams = { morning, evening };

  if (morning[0]) {
    writeFile(path.join(outDir, "index.html"), renderIssuePage({
      issue: morning[0],
      stream: morning,
      base,
      role: "home",
    }));
  } else {
    writeFile(path.join(outDir, "index.html"), renderEmptyStream({ edition: "morning", base }));
  }

  for (const edition of ["morning", "evening"]) {
    const stream = streams[edition];
    const latestFile = path.join(outDir, edition, "index.html");
    if (stream[0]) {
      writeFile(latestFile, renderIssuePage({
        issue: stream[0],
        stream,
        base,
        role: "latest",
      }));
    } else {
      writeFile(latestFile, renderEmptyStream({ edition, base }));
    }
    for (const issue of stream) {
      writeFile(
        path.join(outDir, edition, issue.issueDate, "index.html"),
        renderIssuePage({ issue, stream, base, role: "issue" }),
      );
    }
  }

  writeFile(path.join(outDir, "search", "index.html"), renderSearchPage({ base }));
  writeFile(path.join(outDir, "404.html"), renderNotFound({ base }));
  writeFile(path.join(outDir, "search-index.json"), `${JSON.stringify(buildSearchIndex(issues, base))}\n`);
  const manifest = buildManifest(issues, base);
  writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const urls = [""];
  for (const edition of ["morning", "evening"]) {
    urls.push(`${edition}/`);
    for (const issue of streams[edition]) urls.push(`${edition}/${issue.issueDate}/`);
  }
  urls.push("search/");
  const body = urls.map((rel) => {
    const loc = rel ? `${base.replace(/\/$/, "")}/${rel}` : `${base.replace(/\/$/, "")}/`;
    return `  <url><loc>${loc}</loc></url>`;
  }).join("\n");
  writeFile(path.join(outDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);

  const mediaSrc = path.join(contentDir, "media");
  if (fs.existsSync(mediaSrc)) {
    fs.cpSync(mediaSrc, path.join(outDir, "media"), { recursive: true });
  }
  fs.mkdirSync(path.join(outDir, "assets", "fonts"), { recursive: true });
  fs.copyFileSync(path.join(root, "src", "styles.css"), path.join(outDir, "assets", "styles.css"));
  fs.copyFileSync(path.join(root, "src", "search.js"), path.join(outDir, "assets", "search.js"));
  fs.copyFileSync(path.join(root, "src", "favicon.svg"), path.join(outDir, "favicon.svg"));
  fs.cpSync(path.join(root, "src", "fonts"), path.join(outDir, "assets", "fonts"), { recursive: true });
  writeFile(path.join(outDir, ".nojekyll"), "");
  return manifest;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("node scripts/build.mjs [--content content] [--out dist] [--base /ai-news]");
    return;
  }
  try {
    const manifest = buildSite({ contentDir: args.content, outDir: args.out, base: args.base });
    const morning = manifest.streams.morning.latest || "（无）";
    const evening = manifest.streams.evening.latest || "（无）";
    console.log(`built ${args.out}`);
    console.log(`home morning ${morning}`);
    console.log(`evening ${evening}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

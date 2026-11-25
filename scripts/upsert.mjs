import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { issueFileStem, issueSequence, validateIssue } from "./lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function parseArgs(argv) {
  const args = { content: path.join(root, "content"), replace: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--file") args.file = path.resolve(argv[++i]);
    else if (token === "--content") args.content = path.resolve(argv[++i]);
    else if (token === "--replace") args.replace = true;
    else if (token === "--help") args.help = true;
    else throw new Error(`未知参数 ${token}`);
  }
  return args;
}

export function upsertIssueFromFile(file, { contentDir, replace = false } = {}) {
  const raw = fs.readFileSync(file, "utf8");
  let issue;
  try {
    issue = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errors: [{ code: "json", message: error.message }] };
  }
  const errors = validateIssue(issue, {
    mediaDir: path.join(contentDir, "media"),
    file,
    folderDate: issue.issueDate,
    fileEdition: issue.edition,
    fileSequence: issueSequence(issue),
  });
  if (errors.length) return { ok: false, errors };
  const dest = path.join(contentDir, "issues", issue.issueDate, `${issueFileStem(issue)}.json`);
  if (fs.existsSync(dest) && !replace) {
    return { ok: false, errors: [{ code: "exists", message: `已存在 ${dest}。追加新日期即可；要改同一期请显式加 --replace` }] };
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${JSON.stringify(issue, null, 2)}\n`);
  return { ok: true, dest, issueDate: issue.issueDate, edition: issue.edition };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) {
    console.log("node scripts/upsert.mjs --file <issue.json> [--content content] [--replace]");
    if (!args.file) process.exitCode = args.help ? 0 : 1;
    return;
  }
  const result = upsertIssueFromFile(args.file, { contentDir: args.content, replace: args.replace });
  if (!result.ok) {
    for (const error of result.errors) console.error(`${error.code}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`wrote ${result.dest}`);
  console.log("下一期：npm test && npm run build");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

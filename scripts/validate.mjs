import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadIssues } from "./lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function validateContent(contentDir) {
  return loadIssues(contentDir);
}

function main() {
  const contentDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "content");
  const { issues, errors } = validateContent(contentDir);
  if (errors.length) {
    for (const error of errors) console.error(`${error.code}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok ${issues.length} issues`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

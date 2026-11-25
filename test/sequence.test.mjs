import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildSite } from "../scripts/build.mjs";
import { issueKey, loadIssues, validateIssue } from "../scripts/lib.mjs";
import { fixtureIssue } from "./helpers.mjs";

const repo = path.resolve(import.meta.dirname, "..");

function secondIssue({ date, edition, headline, sequence = 2 }) {
  const issue = fixtureIssue({ date, edition, headline });
  issue.sequence = sequence;
  issue.stories[0].id = `${date}-${sequence}-${edition}-01`;
  issue.stories[0].sources[0].url = `https://example.com/${edition}-${date}-${sequence}`;
  return issue;
}

function write(dir, issue, stem) {
  const folder = path.join(dir, "issues", issue.issueDate);
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${stem}.json`);
  fs.writeFileSync(file, `${JSON.stringify(issue, null, 2)}\n`);
  return file;
}

const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("a second same-day morning issue gets its own -2 address and leaves the first untouched", () => {
  const content = fs.mkdtempSync(path.join(os.tmpdir(), "ai-news-seq-"));
  write(content, fixtureIssue({ date: "2026-11-24", edition: "morning", headline: "夹具：二十四日早报" }), "morning");
  const first = write(content, fixtureIssue({ date: "2026-11-25", edition: "morning", headline: "夹具：二十五日第一期" }), "morning");
  write(content, fixtureIssue({ date: "2026-11-25", edition: "evening", headline: "夹具：二十五日晚报" }), "evening");
  const before = sha(first);

  const incoming = path.join(content, "incoming.json");
  fs.writeFileSync(incoming, `${JSON.stringify(secondIssue({ date: "2026-11-25", edition: "morning", headline: "夹具：二十五日第二期" }))}\n`);
  const added = spawnSync(process.execPath, [path.join(repo, "scripts", "upsert.mjs"), "--file", incoming, "--content", content], { encoding: "utf8" });
  assert.equal(added.status, 0, added.stderr);
  assert.equal(sha(first), before);
  assert.equal(fs.existsSync(path.join(content, "issues", "2026-11-25", "morning-2.json")), true);

  const again = spawnSync(process.execPath, [path.join(repo, "scripts", "upsert.mjs"), "--file", incoming, "--content", content], { encoding: "utf8" });
  assert.notEqual(again.status, 0);
  assert.match(again.stderr, /exists/);

  const out = fs.mkdtempSync(path.join(os.tmpdir(), "ai-news-seq-out-"));
  const manifest = buildSite({ contentDir: content, outDir: out, base: "/ai-news" });
  assert.deepEqual(manifest.streams.morning.dates, ["2026-11-25-2", "2026-11-25", "2026-11-24"]);
  assert.equal(manifest.home.issueDate, "2026-11-25-2");
  assert.equal(manifest.streams.evening.latest, "2026-11-25");

  const second = fs.readFileSync(path.join(out, "morning", "2026-11-25-2", "index.html"), "utf8");
  const original = fs.readFileSync(path.join(out, "morning", "2026-11-25", "index.html"), "utf8");
  const home = fs.readFileSync(path.join(out, "index.html"), "utf8");
  assert.match(second, /夹具：二十五日第二期/);
  assert.match(second, /data-issue-date="2026-11-25-2"/);
  assert.match(second, /2026年11月25日 星期三 · 25-2/);
  assert.doesNotMatch(second, /返回最新一期/);
  assert.match(original, /夹具：二十五日第一期/);
  assert.doesNotMatch(original, /夹具：二十五日第二期/);
  assert.match(original, /返回最新一期/);
  assert.match(original, /href="\/ai-news\/morning\/2026-11-25-2\/"/);
  assert.match(home, /夹具：二十五日第二期/);

  const index = JSON.parse(fs.readFileSync(path.join(out, "search-index.json"), "utf8"));
  const hit = index.find((item) => item.id === "2026-11-25-2-morning-01");
  assert.equal(hit.issueHref, "/ai-news/morning/2026-11-25-2/#s-2026-11-25-2-morning-01");
  assert.equal(hit.issueDate, "2026-11-25");
  assert.match(fs.readFileSync(path.join(out, "sitemap.xml"), "utf8"), /\/ai-news\/morning\/2026-11-25-2\//);
});

test("sequence must match the file name, the id prefix, and stay between 2 and 9", () => {
  const ok = secondIssue({ date: "2026-11-25", edition: "morning", headline: "夹具：第二期" });
  assert.equal(issueKey(ok), "2026-11-25-2");
  assert.deepEqual(validateIssue(ok, { folderDate: "2026-11-25", fileEdition: "morning", fileSequence: 2 }), []);

  const wrongFile = validateIssue(ok, { folderDate: "2026-11-25", fileEdition: "morning", fileSequence: 1 });
  assert.ok(wrongFile.some((e) => e.code === "file_sequence"));

  const oldIds = structuredClone(ok);
  oldIds.stories[0].id = "2026-11-25-morning-01";
  assert.ok(validateIssue(oldIds).some((e) => e.code === "story_id"));

  for (const bad of [1, 10, 2.5, "2"]) {
    const issue = structuredClone(ok);
    issue.sequence = bad;
    assert.ok(validateIssue(issue).some((e) => e.code === "sequence"), `sequence ${bad} should fail`);
  }

  const content = fs.mkdtempSync(path.join(os.tmpdir(), "ai-news-seq-bad-"));
  write(content, ok, "morning-3");
  write(content, fixtureIssue({ date: "2026-11-25", edition: "morning", headline: "夹具：第一期" }), "morning-1");
  const { errors } = loadIssues(content);
  assert.ok(errors.some((e) => e.code === "file_sequence"));
  assert.ok(errors.some((e) => e.code === "file_edition"));
});

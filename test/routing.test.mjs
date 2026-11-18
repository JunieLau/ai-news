import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildSite } from "../scripts/build.mjs";
import { resolvePreviewPath } from "../scripts/preview.mjs";
import { fixtureIssue } from "./helpers.mjs";

const repo = path.resolve(import.meta.dirname, "..");

function writeIssue(dir, issue) {
  const folder = path.join(dir, "issues", issue.issueDate);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, `${issue.edition}.json`), `${JSON.stringify(issue, null, 2)}\n`);
}

function seedStreams(dir) {
  writeIssue(dir, fixtureIssue({ date: "2026-11-16", edition: "morning", headline: "夹具：早报旧日期十六日" }));
  writeIssue(dir, fixtureIssue({ date: "2026-11-18", edition: "morning", headline: "夹具：早报新日期十八日" }));
  writeIssue(dir, fixtureIssue({ date: "2026-11-15", edition: "evening", headline: "夹具：晚报旧日期十五日" }));
  writeIssue(dir, fixtureIssue({ date: "2026-11-19", edition: "evening", headline: "夹具：晚报新日期十九日" }));
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

test("each stream opens its own newest issue date, and home stays on morning", () => {
  const content = fs.mkdtempSync(path.join(os.tmpdir(), "ai-news-content-"));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "ai-news-out-"));
  seedStreams(content);
  const manifest = buildSite({ contentDir: content, outDir: out, base: "/ai-news" });

  assert.equal(manifest.home.edition, "morning");
  assert.equal(manifest.home.issueDate, "2026-11-18");
  assert.deepEqual(manifest.streams.morning.dates, ["2026-11-18", "2026-11-16"]);
  assert.deepEqual(manifest.streams.evening.dates, ["2026-11-19", "2026-11-15"]);

  const home = read(path.join(out, "index.html"));
  const morning = read(path.join(out, "morning", "index.html"));
  const evening = read(path.join(out, "evening", "index.html"));
  const oldMorning = read(path.join(out, "morning", "2026-11-16", "index.html"));
  const currentMorning = read(path.join(out, "morning", "2026-11-18", "index.html"));
  const oldEvening = read(path.join(out, "evening", "2026-11-15", "index.html"));

  assert.match(home, /data-page-role="home"/);
  assert.match(home, /data-edition="morning"/);
  assert.match(home, /data-issue-date="2026-11-18"/);
  assert.match(home, /夹具：早报新日期十八日/);
  assert.doesNotMatch(home, /夹具：晚报新日期十九日/);
  assert.doesNotMatch(home, /返回最新一期/);
  assert.doesNotMatch(home, /<script/);
  assert.doesNotMatch(home, /localStorage/);

  assert.match(morning, /data-page-role="latest"/);
  assert.match(morning, /data-issue-date="2026-11-18"/);
  assert.match(morning, /夹具：早报新日期十八日/);
  assert.match(evening, /data-page-role="latest"/);
  assert.match(evening, /data-edition="evening"/);
  assert.match(evening, /data-issue-date="2026-11-19"/);
  assert.match(evening, /夹具：晚报新日期十九日/);
  assert.doesNotMatch(evening, /夹具：早报新日期十八日/);

  assert.match(oldMorning, /data-page-role="issue"/);
  assert.match(oldMorning, /data-issue-date="2026-11-16"/);
  assert.match(oldMorning, /data-latest="false"/);
  assert.match(oldMorning, /夹具：早报旧日期十六日/);
  assert.doesNotMatch(oldMorning, /夹具：早报新日期十八日/);
  assert.match(oldMorning, /href="\/ai-news\/morning\/"/);
  assert.match(oldMorning, /返回最新一期/);
  assert.match(oldMorning, /href="\/ai-news\/morning\/2026-11-18\/"/);
  assert.doesNotMatch(oldMorning, /http-equiv="refresh"/);
  assert.doesNotMatch(oldMorning, /location\s*=/);
  assert.doesNotMatch(oldMorning, /<script/);

  assert.match(currentMorning, /data-issue-date="2026-11-18"/);
  assert.doesNotMatch(currentMorning, /这是本流最新一期/);
  assert.doesNotMatch(currentMorning, /返回最新一期/);
  assert.match(oldEvening, /返回最新一期/);
  assert.match(oldEvening, /href="\/ai-news\/evening\/"/);
  assert.match(oldEvening, /夹具：晚报旧日期十五日/);
  assert.doesNotMatch(oldEvening, /夹具：晚报新日期十九日/);

  const morningDates = [...morning.matchAll(/data-archive-date="(\d{4}-\d{2}-\d{2})"/g)].map((item) => item[1]);
  const eveningDates = [...evening.matchAll(/data-archive-date="(\d{4}-\d{2}-\d{2})"/g)].map((item) => item[1]);
  assert.deepEqual(morningDates, ["2026-11-18", "2026-11-16"]);
  assert.deepEqual(eveningDates, ["2026-11-19", "2026-11-15"]);
  assert.match(morning, /href="\/ai-news\/evening\/"/);
  assert.match(evening, /href="\/ai-news\/morning\/"/);

  const historical = resolvePreviewPath(out, "/ai-news", "/ai-news/morning/2026-11-16/");
  assert.equal(historical.status, 200);
  assert.match(read(historical.file), /夹具：早报旧日期十六日/);
  const missing = resolvePreviewPath(out, "/ai-news", "/ai-news/morning/2026-11-17/");
  assert.equal(missing.status, 404);
  assert.match(read(missing.file), /没有这一期/);
  const escape = resolvePreviewPath(out, "/ai-news", "/ai-news/../package.json");
  assert.equal(escape.status, 404);
});

test("upsert appends a new date and leaves earlier issues untouched", () => {
  const content = fs.mkdtempSync(path.join(os.tmpdir(), "ai-news-upsert-"));
  seedStreams(content);
  const kept = path.join(content, "issues", "2026-11-18", "morning.json");
  const evening = path.join(content, "issues", "2026-11-19", "evening.json");
  const beforeKept = crypto.createHash("sha256").update(fs.readFileSync(kept)).digest("hex");
  const beforeEvening = crypto.createHash("sha256").update(fs.readFileSync(evening)).digest("hex");
  const incoming = path.join(content, "incoming.json");
  fs.writeFileSync(incoming, `${JSON.stringify(fixtureIssue({
    date: "2026-11-20",
    edition: "morning",
    headline: "夹具：早报再新一日",
  }))}\n`);

  const refused = spawnSync(process.execPath, [
    path.join(repo, "scripts", "upsert.mjs"),
    "--file", kept,
    "--content", content,
  ], { encoding: "utf8" });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /exists/);
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(kept)).digest("hex"), beforeKept);

  const added = spawnSync(process.execPath, [
    path.join(repo, "scripts", "upsert.mjs"),
    "--file", incoming,
    "--content", content,
  ], { encoding: "utf8" });
  assert.equal(added.status, 0, added.stderr);
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(kept)).digest("hex"), beforeKept);
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(evening)).digest("hex"), beforeEvening);
  assert.equal(fs.existsSync(path.join(content, "issues", "2026-11-20", "morning.json")), true);
  assert.equal(fs.existsSync(path.join(content, "issues", "2026-11-20", "evening.json")), false);

  const out = fs.mkdtempSync(path.join(os.tmpdir(), "ai-news-upsert-out-"));
  const manifest = buildSite({ contentDir: content, outDir: out, base: "/ai-news" });
  assert.deepEqual(manifest.streams.morning.dates, ["2026-11-20", "2026-11-18", "2026-11-16"]);
  assert.equal(manifest.home.issueDate, "2026-11-20");
  assert.equal(manifest.streams.evening.latest, "2026-11-19");
  const archived = read(path.join(out, "morning", "2026-11-18", "index.html"));
  assert.match(archived, /夹具：早报新日期十八日/);
  assert.match(archived, /返回最新一期/);
  assert.doesNotMatch(archived, /夹具：早报再新一日/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { validateCorpus, validateIssue } from "../scripts/lib.mjs";
import { filterStories } from "../src/search.js";
import { fixtureIssue } from "./helpers.mjs";

test("validator rejects impossible dates, bad urls, and fake image credit", () => {
  const badDate = fixtureIssue({ date: "2026-11-18", edition: "morning", headline: "夹具" });
  badDate.issueDate = "2026-11-31";
  badDate.stories[0].id = "2026-11-31-morning-01";
  const dateErrors = validateIssue(badDate, { folderDate: "2026-11-31", fileEdition: "morning" });
  assert.ok(dateErrors.some((error) => error.code === "issue_date"));

  const badUrl = fixtureIssue({ date: "2026-11-18", edition: "morning", headline: "夹具" });
  badUrl.stories[0].sources[0].url = "javascript:alert(1)";
  const urlErrors = validateIssue(badUrl, { folderDate: "2026-11-18", fileEdition: "morning" });
  assert.ok(urlErrors.some((error) => error.code === "source_url"));

  const fakeCredit = fixtureIssue({ date: "2026-11-18", edition: "morning", headline: "夹具" });
  fakeCredit.stories[0].image.credit = "摄影师张三";
  const creditErrors = validateIssue(fakeCredit, { folderDate: "2026-11-18", fileEdition: "morning" });
  assert.ok(creditErrors.some((error) => error.code === "image_gap"));

  const first = fixtureIssue({ date: "2026-11-18", edition: "morning", headline: "甲" });
  const second = fixtureIssue({ date: "2026-11-18", edition: "evening", headline: "乙" });
  second.stories[0].id = first.stories[0].id;
  const dupes = validateCorpus([first, second]);
  assert.ok(dupes.some((error) => error.code === "duplicate_id"));
});

test("search filters across editions without inventing rows", () => {
  const items = [
    { id: "a", edition: "morning", issueDate: "2026-11-18", text: "黄仁勋 董事会" },
    { id: "b", edition: "evening", issueDate: "2026-11-18", text: "Miracle 即将推出" },
    { id: "c", edition: "morning", issueDate: "2026-11-16", text: "更早的夹具" },
  ];
  assert.deepEqual(filterStories(items, { query: "黄仁勋" }).map((item) => item.id), ["a"]);
  assert.deepEqual(filterStories(items, { query: "黄仁勋", edition: "evening" }).map((item) => item.id), []);
  assert.deepEqual(filterStories(items, { query: "", edition: "morning", date: "2026-11-16" }).map((item) => item.id), ["c"]);
  assert.equal(filterStories(items, { query: "不存在的词" }).length, 0);
});

import {
  EDITIONS,
  escapeHtml,
  formatChineseDate,
  hostname,
  joinBase,
  orderedSources,
  primarySource,
  shanghaiClock,
  storiesInOrder,
  tierLabel,
  weekdayName,
} from "./lib.mjs";

function safeHref(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`refusing non-http href: ${url}`);
  }
  return escapeHtml(url);
}

function externalLink(url, label, extraClass = "") {
  const cls = extraClass ? ` class="${extraClass}"` : "";
  return `<a${cls} href="${safeHref(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}<span class="sr-only">（原文，新窗口）</span></a>`;
}

function imageBlock(story, base) {
  const primary = primarySource(story);
  const image = story.image;
  if (image.status === "archived") {
    const src = joinBase(base, `media/${image.file}`);
    return `<a class="frame" href="${safeHref(image.sourcePage)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(src)}" alt="${escapeHtml(image.alt)}"></a>`;
  }
  return `<a class="frame type-fallback" href="${safeHref(primary.url)}" target="_blank" rel="noopener noreferrer"><span class="fallback-en">${escapeHtml(story.kickerEn)}</span><span class="gap-label">无存档图片</span></a>`;
}

function teaser(story, base, { lead = false } = {}) {
  const primary = primarySource(story);
  const number = String(story.rank).padStart(2, "0");
  const provenance = story.image.status === "archived"
    ? `<p class="credit">${escapeHtml(story.image.credit)}</p>`
    : `<p class="credit gap-note">${escapeHtml(story.image.gapReason)}</p>`;
  return `<article class="teaser${lead ? " teaser-lead" : ""}">
    ${imageBlock(story, base)}
    <p class="kicker"><span class="num">${number}</span><span class="en">${escapeHtml(story.kickerEn)}</span><span class="meta">${escapeHtml(story.region)} · ${tierLabel(story.tier)}</span></p>
    <h2>${externalLink(primary.url, story.headline, "headline")}</h2>
    ${lead ? `<p class="standfirst">${escapeHtml(story.standfirst)}</p><p class="why"><span class="label">为何重要</span>${escapeHtml(story.whyItMatters)}</p>${provenance}` : ""}
    <p class="jump"><a href="#s-${escapeHtml(story.id)}">读本期摘要</a></p>
  </article>`;
}

function storyArticle(story, issue, base) {
  const primary = primarySource(story);
  const number = String(story.rank).padStart(2, "0");
  const updated = shanghaiClock(issue.updatedAt);
  const published = story.publishedAt ? shanghaiClock(story.publishedAt) : null;
  const paragraphs = story.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const caveats = story.caveats.length
    ? `<div class="caveats"><p class="label">需留意</p><ul>${story.caveats.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`
    : "";
  const figures = story.figures.length
    ? `<div class="figures"><p class="label">关键数字</p><ul>${story.figures.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`
    : "";
  const sources = orderedSources(story).map((source) => {
    const prefix = source.role === "primary" ? "主要 · " : "";
    return `<li>${externalLink(source.url, `${prefix}${source.name}`, "source")}<span class="domain">${escapeHtml(hostname(source.url))}</span></li>`;
  }).join("");
  const publishedLine = published
    ? `${formatChineseDate(published.date)} ${published.time}`
    : "没有单一钟点";
  const credit = story.image.status === "archived"
    ? `<p class="credit">${escapeHtml(story.image.credit)}</p>`
    : `<p class="credit gap-note">${escapeHtml(story.image.gapReason)}</p>`;

  return `<article class="story" id="s-${escapeHtml(story.id)}" data-story-id="${escapeHtml(story.id)}">
    <div class="story-media">${imageBlock(story, base)}</div>
    <div class="story-copy">
      <p class="kicker"><span class="num">${number}</span><span class="en">${escapeHtml(story.kickerEn)}</span><span class="meta">${escapeHtml(story.region)} · ${tierLabel(story.tier)}</span></p>
      <h3>${externalLink(primary.url, story.headline, "headline")}</h3>
      <p class="standfirst">${escapeHtml(story.standfirst)}</p>
      <div class="prose">${paragraphs}</div>
      <p class="why"><span class="label">为何重要</span>${escapeHtml(story.whyItMatters)}</p>
      ${figures}
      ${caveats}
      <dl class="times">
        <div><dt>来源发布时间</dt><dd>${escapeHtml(publishedLine)}<span class="tz">亚洲/上海</span></dd></div>
        <div><dt>本报日期</dt><dd>${escapeHtml(formatChineseDate(issue.issueDate))}</dd></div>
        <div><dt>本报更新</dt><dd>${escapeHtml(formatChineseDate(updated.date))} ${escapeHtml(updated.time)}<span class="tz">亚洲/上海</span></dd></div>
      </dl>
      <p class="time-note">${escapeHtml(story.publishedAtNote)}</p>
      <ul class="sources">${sources}</ul>
      ${credit}
    </div>
  </article>`;
}

function archiveList(stream, currentDate, base) {
  return stream.map((issue) => {
    const href = joinBase(base, `${issue.edition}/${issue.issueDate}/`);
    const label = `${formatChineseDate(issue.issueDate)} ${weekdayName(issue.issueDate)}`;
    const mark = issue.issueDate === currentDate ? "在读" : "打开这一期";
    return `<li data-archive-date="${escapeHtml(issue.issueDate)}"><a href="${escapeHtml(href)}">${escapeHtml(label)}</a><span class="mark">${mark}</span></li>`;
  }).join("");
}

function pageShell({
  base,
  title,
  description,
  canonical,
  role,
  edition = "",
  issueDate = "",
  latest = false,
  streamLatest = "",
  dateline = "",
  body,
  script = "",
}) {
  const morningHref = joinBase(base, "morning/");
  const eveningHref = joinBase(base, "evening/");
  const searchHref = joinBase(base, "search/");
  const homeHref = joinBase(base, "");
  const current = (id) => (edition === id ? ` aria-current="page"` : "");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" href="${escapeHtml(joinBase(base, "favicon.svg"))}" type="image/svg+xml">
  <link rel="stylesheet" href="${escapeHtml(joinBase(base, "assets/styles.css"))}">
</head>
<body data-page-role="${escapeHtml(role)}" data-edition="${escapeHtml(edition)}" data-issue-date="${escapeHtml(issueDate)}" data-latest="${latest ? "true" : "false"}" data-stream-latest="${escapeHtml(streamLatest)}">
  <a class="skip" href="#main">进入正文</a>
  <div class="sheet">
    <header class="top">
      <div class="masthead">
        <a class="masthead-link" href="${escapeHtml(homeHref)}" aria-label="AI NEWS">
          <span class="masthead-name">AI NEWS</span>
        </a>
        <p class="masthead-sub">${body.stack}</p>
      </div>
      <div class="nav-wrap">
        <nav class="nav" aria-label="版面">
          <a href="${escapeHtml(morningHref)}"${current("morning")}>早报</a>
          <a href="${escapeHtml(eveningHref)}"${current("evening")}>晚报</a>
          <a href="${escapeHtml(searchHref)}"${role === "search" ? ` aria-current="page"` : ""}>检索</a>
          <span class="nav-gap"></span>
          <span class="dateline">${dateline}</span>
        </nav>
      </div>
    </header>
    <main id="main">
      ${body.main}
    </main>
    <footer class="colophon">
      <p class="en">AI NEWS</p>
      <p>早报看综合，晚报看电影与视频。两条线各自按日期出报：新的一期成为这一流的最新，旧的一期留在历史目录里。</p>
      <p>本报日期是这一期的日期。每条的来源发布时间另计。时间都按亚洲/上海。</p>
      <p>配图来自原文页面公开的 og:image 或官方缩略图。存不下来、或原图对不上这条新闻时，用文字版位，不配假照片，也不编署名。</p>
      <p>标题、图片和来源都链到原始页面。本报不放视频，也不自动播放。</p>
    </footer>
  </div>
  ${script}
</body>
</html>
`;
}

export function renderIssuePage({ issue, stream, base, role }) {
  const meta = EDITIONS[issue.edition];
  const latestDate = stream[0]?.issueDate || "";
  const isLatest = issue.issueDate === latestDate;
  const stories = storiesInOrder(issue);
  const lead = stories[0];
  const side = stories.slice(1, 5);
  const left = side.filter((_, index) => index % 2 === 0);
  const right = side.filter((_, index) => index % 2 === 1);
  const updated = shanghaiClock(issue.updatedAt);
  const dateLine = `${formatChineseDate(issue.issueDate)} ${weekdayName(issue.issueDate)}`;
  const returnHref = joinBase(base, `${issue.edition}/`);
  const datedHref = joinBase(base, `${issue.edition}/${issue.issueDate}/`);
  const canonical = role === "home"
    ? joinBase(base, "")
    : role === "latest"
      ? returnHref
      : datedHref;
  let statusLine = "";
  if (!isLatest) {
    statusLine = `<p class="return"><a href="${escapeHtml(returnHref)}">返回最新一期</a><span>你在读 ${escapeHtml(dateLine)} 的历史期。这个地址不会改去后来的新报纸。</span></p>`;
  } else if (role === "issue") {
    statusLine = `<p class="return">这是本流最新一期。<span>直接打开的是 ${escapeHtml(dateLine)}，不会被脚本改去别的日期。</span></p>`;
  } else if (role === "home") {
    statusLine = `<p class="return">首页打开早报流里日期最新的一期。<span>现在是 ${escapeHtml(dateLine)}。</span></p>`;
  } else {
    statusLine = `<p class="return">这一页是${meta.nav}流里日期最新的一期。<span>现在是 ${escapeHtml(dateLine)}。</span></p>`;
  }
  const alone = stream.length === 1
    ? `<p class="archive-note">本站这一流目前只收入这一日。更早的报纸不会在这里编造；以后的新日期会按从新到旧接在上面。</p>`
    : `<p class="archive-note">只列本流已经收入的期刊，从新到旧。点开的是那一天自己的地址。</p>`;
  const stack = meta.stack.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
  const main = `<p class="identity"><span>${escapeHtml(dateLine)}</span><span>亚洲/上海</span><span>本报更新 ${escapeHtml(updated.time)}</span><span>常规档期 ${escapeHtml(issue.slot)}</span></p>
      ${statusLine}
      <p class="slot-note">${escapeHtml(issue.slotNote)}</p>
      <p class="editors"><span class="label">编者按</span>${escapeHtml(issue.editorsNote)}</p>
      <section class="front" aria-label="头版">
        <div class="col col-lead">${teaser(lead, base, { lead: true })}</div>
        <div class="col col-left">${left.map((story) => teaser(story, base)).join("")}</div>
        <div class="col col-right">${right.map((story) => teaser(story, base)).join("")}</div>
      </section>
      <h2 class="section-title"><span>本期条目</span><span class="en">BY HEAT</span></h2>
      <div class="stories">${stories.map((story) => storyArticle(story, issue, base)).join("")}</div>
      <section class="archive" aria-labelledby="archive-title">
        <h2 id="archive-title" class="section-title"><span>历史目录</span><span class="en">ARCHIVE</span></h2>
        ${alone}
        <ol>${archiveList(stream, issue.issueDate, base)}</ol>
      </section>`;
  return pageShell({
    base,
    title: `${meta.nav} · ${meta.title} · ${dateLine}`,
    description: issue.editorsNote.replace(/\s+/g, " ").slice(0, 140),
    canonical,
    role,
    edition: issue.edition,
    issueDate: issue.issueDate,
    latest: isLatest,
    streamLatest: latestDate,
    dateline: escapeHtml(dateLine),
    body: { stack, main },
    script: "",
  });
}

export function renderEmptyStream({ edition, base }) {
  const meta = EDITIONS[edition];
  const stack = meta.stack.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
  const main = `<p class="return">这一流还没有期刊。</p><p class="editors">新的一期放进对应日期目录后，这里会打开那一流自己的最新日期。</p>`;
  return pageShell({
    base,
    title: `${meta.nav} · ${meta.title}`,
    description: `${meta.nav}还没有期刊。`,
    canonical: joinBase(base, `${edition}/`),
    role: "latest",
    edition,
    issueDate: "",
    latest: false,
    streamLatest: "",
    dateline: "尚未出报",
    body: { stack, main },
  });
}

export function renderSearchPage({ base }) {
  const stack = ["检索", "全文", "上海"].map((line) => `<span>${escapeHtml(line)}</span>`).join("");
  const indexHref = joinBase(base, "search-index.json");
  const main = `<h2 class="section-title"><span>检索</span><span class="en">SEARCH</span></h2>
      <form class="search-form" action="${escapeHtml(joinBase(base, "search/"))}" role="search">
        <label class="search-label" for="q">在已收入的早报和晚报里找</label>
        <input id="q" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="人名、公司、型号">
        <div class="filters">
          <fieldset>
            <legend>版面</legend>
            <label><input type="radio" name="edition" value="all" checked> 全部</label>
            <label><input type="radio" name="edition" value="morning"> 早报</label>
            <label><input type="radio" name="edition" value="evening"> 晚报</label>
          </fieldset>
          <label class="date-filter">日期
            <select id="date" name="date"><option value="all">全部日期</option></select>
          </label>
        </div>
      </form>
      <p id="search-count" class="search-count" aria-live="polite"></p>
      <ol id="search-results" class="search-results"></ol>
      <noscript><p class="editors">检索需要浏览器脚本。各期仍可从早报、晚报页面的历史目录进入。</p></noscript>`;
  const script = `<script type="module" src="${escapeHtml(joinBase(base, "assets/search.js"))}" data-index="${escapeHtml(indexHref)}"></script>`;
  return pageShell({
    base,
    title: "检索 · AI NEWS",
    description: "在已收入的 AI NEWS 早报和晚报里检索。",
    canonical: joinBase(base, "search/"),
    role: "search",
    edition: "",
    issueDate: "",
    latest: false,
    streamLatest: "",
    dateline: "已收入的期刊",
    body: { stack, main },
    script,
  });
}

export function renderNotFound({ base }) {
  const stack = ["AI NEWS", "没有这一期", "上海"].map((line) => `<span>${escapeHtml(line)}</span>`).join("");
  const main = `<p class="return">这个地址没有对应的期刊。</p>
      <p class="editors"><a href="${escapeHtml(joinBase(base, "morning/"))}">去最新早报</a> · <a href="${escapeHtml(joinBase(base, "evening/"))}">去最新晚报</a> · <a href="${escapeHtml(joinBase(base, "search/"))}">检索</a></p>`;
  return pageShell({
    base,
    title: "没有这一期 · AI NEWS",
    description: "这个地址没有对应的 AI NEWS 期刊。",
    canonical: joinBase(base, "404.html"),
    role: "missing",
    dateline: "目录之外",
    body: { stack, main },
  });
}

export function buildSearchIndex(issues, base) {
  const items = [];
  for (const issue of issues) {
    const meta = EDITIONS[issue.edition];
    for (const story of storiesInOrder(issue)) {
      const text = [
        issue.issueDate,
        meta.nav,
        meta.title,
        story.kickerEn,
        story.region,
        tierLabel(story.tier),
        story.headline,
        story.standfirst,
        ...story.paragraphs,
        story.whyItMatters,
        ...story.caveats,
        ...story.figures,
        story.publishedAtNote,
        ...story.sources.map((source) => `${source.name} ${source.url}`),
      ].join("\n");
      items.push({
        id: story.id,
        issueDate: issue.issueDate,
        edition: issue.edition,
        editionLabel: meta.nav,
        rank: story.rank,
        tier: story.tier,
        tierLabel: tierLabel(story.tier),
        kickerEn: story.kickerEn,
        headline: story.headline,
        standfirst: story.standfirst,
        text,
        issueHref: `${joinBase(base, `${issue.edition}/${issue.issueDate}/`)}#s-${story.id}`,
        sources: orderedSources(story).map((source) => ({
          name: source.name,
          url: source.url,
          role: source.role,
        })),
      });
    }
  }
  items.sort((a, b) => {
    if (a.issueDate !== b.issueDate) return a.issueDate < b.issueDate ? 1 : -1;
    if (a.edition !== b.edition) return a.edition === "morning" ? -1 : 1;
    return a.rank - b.rank;
  });
  return items;
}

export function buildManifest(issues, base) {
  const streams = {};
  for (const edition of Object.keys(EDITIONS)) {
    const dated = issues
      .filter((issue) => issue.edition === edition)
      .map((issue) => issue.issueDate)
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    streams[edition] = {
      latest: dated[0] || null,
      dates: dated,
    };
  }
  return {
    base,
    home: streams.morning.latest
      ? { edition: "morning", issueDate: streams.morning.latest }
      : null,
    streams,
  };
}

import {
  EDITIONS,
  escapeHtml,
  formatChineseDate,
  hostname,
  compareIssuesDesc,
  issueKey,
  issueLabel,
  issueSequence,
  joinBase,
  orderedSources,
  primarySource,
  shanghaiClock,
  storiesInOrder,
  tierLabel,
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

function asSentence(text) {
  return String(text).trim().replace(/[。；;\s]+$/u, "");
}

function firstSentence(text) {
  const clean = String(text).trim();
  const cut = clean.indexOf("。");
  return cut === -1 ? asSentence(clean) : clean.slice(0, cut);
}

function joinSentences(items) {
  const parts = items.map(asSentence).filter(Boolean);
  return parts.length ? `${parts.join("。")}。` : "";
}

function teaser(story, base, lead = false) {
  const primary = primarySource(story);
  const number = String(story.rank).padStart(2, "0");
  return `<article class="teaser${lead ? " teaser-lead" : ""}">
    ${imageBlock(story, base)}
    <p class="kicker"><span class="num">${number}</span><span class="en">${escapeHtml(story.kickerEn)}</span><span class="meta">${escapeHtml(story.region)} · ${tierLabel(story.tier)}</span></p>
    <h2>${externalLink(primary.url, story.headline, "headline")}</h2>
  </article>`;
}

function storyArticle(story, issue, base) {
  const primary = primarySource(story);
  const number = String(story.rank).padStart(2, "0");
  const published = story.publishedAt ? shanghaiClock(story.publishedAt) : null;
  const paragraphs = story.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const figureText = joinSentences(story.figures);
  const caveatText = joinSentences(story.caveats);
  const figures = figureText
    ? `<section class="block"><h4>关键数字</h4><p>${escapeHtml(figureText)}</p></section>`
    : "";
  const caveats = caveatText
    ? `<section class="block"><h4>需注意</h4><p>${escapeHtml(caveatText)}</p></section>`
    : "";
  const sources = orderedSources(story).map((source) => {
    const prefix = source.role === "primary" ? "主要 · " : "";
    return `<li>${externalLink(source.url, `${prefix}${source.name}`, "source")}<span class="domain">${escapeHtml(hostname(source.url))}</span></li>`;
  }).join("");
  const when = published
    ? `<p class="when">来源 ${escapeHtml(formatChineseDate(published.date))} ${escapeHtml(published.time)}</p>`
    : "";
  const credit = story.image.status === "archived"
    ? `<p class="credit">图片来自${escapeHtml((story.sources.find((source) => source.url === story.image.sourcePage) || primary).name)}。</p>`
    : `<p class="credit gap-note">${escapeHtml(firstSentence(story.image.gapReason))}。</p>`;

  return `<article class="story" id="s-${escapeHtml(story.id)}" data-story-id="${escapeHtml(story.id)}">
    <div class="story-main">
      <p class="kicker"><span class="num">${number}</span><span class="en">${escapeHtml(story.kickerEn)}</span><span class="meta">${escapeHtml(story.region)} · ${tierLabel(story.tier)}</span></p>
      <h3>${externalLink(primary.url, story.headline, "headline")}</h3>
      <div class="prose">${paragraphs}</div>
      <section class="block"><h4>为何重要</h4><p>${escapeHtml(story.whyItMatters)}</p></section>
      ${figures}
      ${caveats}
    </div>
    <figure class="story-figure">${imageBlock(story, base)}</figure>
    <aside class="story-side">
      ${when}
      <ul class="sources">${sources}</ul>
      ${credit}
    </aside>
  </article>`;
}

function archiveList(stream, currentKey, base) {
  return stream.map((issue) => {
    const key = issueKey(issue);
    const href = joinBase(base, `${issue.edition}/${key}/`);
    const label = issueLabel(issue);
    const mark = key === currentKey ? "在读" : "打开这一期";
    return `<li data-archive-date="${escapeHtml(key)}"><a href="${escapeHtml(href)}">${escapeHtml(label)}</a><span class="mark">${mark}</span></li>`;
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
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="utf-8">
  <script>document.documentElement.setAttribute("data-theme",(()=>{try{var q=new URLSearchParams(location.search).get("theme");if(q==="light"||q==="dark")return q;var t=sessionStorage.getItem("ai-news-theme");if(t==="light"||t==="dark")return t;}catch(e){}return "dark";})());</script>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#000000">
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
        <div class="masthead-side">
          <div class="theme-switch" role="group" aria-label="配色">
            <button type="button" data-theme-set="light" aria-label="浅色模式" aria-pressed="false">☀</button>
            <button type="button" data-theme-set="dark" aria-label="深色模式" aria-pressed="true">☾</button>
          </div>
          <p class="masthead-sub">${body.stack}</p>
        </div>
      </div>
      <div class="nav-wrap">
        <nav class="nav" aria-label="版面">
          <a href="${escapeHtml(morningHref)}"${current("morning")}>${escapeHtml(EDITIONS.morning.nav)}</a>
          <a href="${escapeHtml(eveningHref)}"${current("evening")}>${escapeHtml(EDITIONS.evening.nav)}</a>
          <a href="${escapeHtml(searchHref)}"${role === "search" ? ` aria-current="page"` : ""}>检索</a>
          <span class="nav-gap"></span>
          <span class="dateline">${dateline}</span>
        </nav>
      </div>
    </header>
    <main id="main">
      ${body.main}
    </main>
  </div>
  <script src="${escapeHtml(joinBase(base, "assets/theme.js"))}"></script>
  ${script}
</body>
</html>
`;
}

function sendShortlist(issue, stories) {
  if (issue.showSendShortlist !== true) return "";
  const recommended = stories.filter((story) => story.tier === "send");
  if (!recommended.length) return "";
  const items = recommended.map((story) => `<li value="${story.rank}"><a href="#s-${escapeHtml(story.id)}">${String(story.rank).padStart(2, "0")} · ${escapeHtml(story.headline)}</a></li>`).join("");
  return `
      <section class="archive" aria-labelledby="send-shortlist-title">
        <h2 id="send-shortlist-title" class="section-title"><span>建议发送</span><span class="en">EDITOR’S PICKS</span></h2>
        <ol>${items}</ol>
      </section>`;
}

export function renderIssuePage({ issue, stream, base, role }) {
  const meta = EDITIONS[issue.edition];
  const latestDate = stream[0] ? issueKey(stream[0]) : "";
  const currentKey = issueKey(issue);
  const isLatest = currentKey === latestDate;
  const stories = storiesInOrder(issue);
  const lead = stories[0];
  const side = stories.slice(1, 5);
  const left = side.filter((_, index) => index % 2 === 0);
  const right = side.filter((_, index) => index % 2 === 1);
  const dateLine = issueLabel(issue);
  const returnHref = joinBase(base, `${issue.edition}/`);
  const datedHref = joinBase(base, `${issue.edition}/${currentKey}/`);
  const canonical = role === "home"
    ? joinBase(base, "")
    : role === "latest"
      ? returnHref
      : datedHref;
  const statusLine = isLatest
    ? ""
    : `<p class="return"><a href="${escapeHtml(returnHref)}">返回最新一期</a></p>`;
  const stack = `<span class="stream-name">${escapeHtml(meta.nav)}</span><span>${meta.nav === "电影晚报" ? "电影与视频" : "综合"}</span><span>亚洲/上海</span><span>${escapeHtml(issue.issueDate.replaceAll("-", ".") + (issueSequence(issue) > 1 ? `-${issueSequence(issue)}` : ""))}</span>`;
  const main = `${statusLine}
      <section class="front" aria-label="头版">
        <div class="col col-lead">${teaser(lead, base, true)}</div>
        <div class="col col-left">${left.map((story) => teaser(story, base)).join("")}</div>
        <div class="col col-right">${right.map((story) => teaser(story, base)).join("")}</div>
      </section>
      <h2 class="section-title"><span>本期条目</span><span class="en">BY HEAT</span></h2>
      <div class="stories">${stories.map((story) => storyArticle(story, issue, base)).join("")}</div>${sendShortlist(issue, stories)}
      <section class="archive" aria-labelledby="archive-title">
        <h2 id="archive-title" class="section-title"><span>历史目录</span><span class="en">ARCHIVE</span></h2>
        <ol>${archiveList(stream, currentKey, base)}</ol>
      </section>`;
  return pageShell({
    base,
    title: `${meta.nav} · ${dateLine} · AI NEWS`,
    description: issue.editorsNote.replace(/\s+/g, " ").slice(0, 140),
    canonical,
    role,
    edition: issue.edition,
    issueDate: currentKey,
    latest: isLatest,
    streamLatest: latestDate,
    dateline: escapeHtml(dateLine),
    body: { stack, main },
    script: "",
  });
}

export function renderEmptyStream({ edition, base }) {
  const meta = EDITIONS[edition];
  const stack = `<span class="stream-name">${escapeHtml(meta.nav)}</span><span>上海</span>`;
  const main = `<p class="return">这一流还没有期刊。</p><p class="editors">新的一期放进对应日期目录后，这里会打开那一流自己的最新日期。</p>`;
  return pageShell({
    base,
    title: `${meta.nav} · AI NEWS`,
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
        <label class="search-label" for="q">在已收入的新闻早报和电影晚报里找</label>
        <input id="q" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="人名、公司、型号">
        <div class="filters">
          <fieldset>
            <legend>版面</legend>
            <label><input type="radio" name="edition" value="all" checked> 全部</label>
            <label><input type="radio" name="edition" value="morning"> 新闻早报</label>
            <label><input type="radio" name="edition" value="evening"> 电影晚报</label>
          </fieldset>
          <label class="date-filter">日期
            <select id="date" name="date"><option value="all">全部日期</option></select>
          </label>
        </div>
      </form>
      <p id="search-count" class="search-count" aria-live="polite"></p>
      <ol id="search-results" class="search-results"></ol>
      <noscript><p class="editors">检索需要浏览器脚本。各期仍可从新闻早报、电影晚报页面的历史目录进入。</p></noscript>`;
  const script = `<script type="module" src="${escapeHtml(joinBase(base, "assets/search.js"))}" data-index="${escapeHtml(indexHref)}"></script>`;
  return pageShell({
    base,
    title: "检索 · AI NEWS",
    description: "在已收入的新闻早报和电影晚报里检索。",
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
      <p class="editors"><a href="${escapeHtml(joinBase(base, "morning/"))}">去最新新闻早报</a> · <a href="${escapeHtml(joinBase(base, "evening/"))}">去最新电影晚报</a> · <a href="${escapeHtml(joinBase(base, "search/"))}">检索</a></p>`;
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
        issueKey: issueKey(issue),
        sequence: issueSequence(issue),
        edition: issue.edition,
        editionLabel: meta.nav,
        rank: story.rank,
        tier: story.tier,
        tierLabel: tierLabel(story.tier),
        kickerEn: story.kickerEn,
        headline: story.headline,
        standfirst: story.standfirst,
        text,
        issueHref: `${joinBase(base, `${issue.edition}/${issueKey(issue)}/`)}#s-${story.id}`,
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
    if (a.sequence !== b.sequence) return b.sequence - a.sequence;
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
      .sort(compareIssuesDesc)
      .map((issue) => issueKey(issue));
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

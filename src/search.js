export function filterStories(items, { query = "", edition = "all", date = "all" } = {}) {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    if (edition !== "all" && item.edition !== edition) return false;
    if (date !== "all" && item.issueDate !== date) return false;
    if (!needle) return true;
    return item.text.toLowerCase().includes(needle);
  });
}

function editionName(value) {
  if (value === "morning") return "新闻早报";
  if (value === "evening") return "电影晚报";
  return "全部";
}

function resultItem(item) {
  const primary = item.sources.find((source) => source.role === "primary") || item.sources[0];
  const sources = item.sources.map((source) => {
    const prefix = source.role === "primary" ? "主要 · " : "";
    return `<li><a class="source" href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">${escapeText(prefix + source.name)}</a></li>`;
  }).join("");
  return `<li>
    <p class="kicker"><span class="num">${String(item.rank).padStart(2, "0")}</span><span class="en">${escapeText(item.kickerEn)}</span><span class="meta">${escapeText(item.issueKey || item.issueDate)} · ${escapeText(item.editionLabel)} · ${escapeText(item.tierLabel)}</span></p>
    <h3><a class="headline" href="${escapeAttr(primary.url)}" target="_blank" rel="noopener noreferrer">${escapeText(item.headline)}</a></h3>
    <p class="standfirst">${escapeText(item.standfirst)}</p>
    <p class="jump"><a href="${escapeAttr(item.issueHref)}">本期位置</a></p>
    <ul class="sources">${sources}</ul>
  </li>`;
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function readParams(url) {
  return {
    query: url.searchParams.get("q") || "",
    edition: url.searchParams.get("edition") || "all",
    date: url.searchParams.get("date") || "all",
  };
}

export function bootSearch(document, items, location, history) {
  const input = document.querySelector("#q");
  const dateSelect = document.querySelector("#date");
  const count = document.querySelector("#search-count");
  const list = document.querySelector("#search-results");
  const radios = [...document.querySelectorAll('input[name="edition"]')];
  const dates = [...new Set(items.map((item) => item.issueDate))].sort((a, b) => (a < b ? 1 : -1));
  for (const date of dates) {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = date;
    dateSelect.append(option);
  }

  const initial = readParams(new URL(location.href));
  input.value = initial.query;
  if (["all", "morning", "evening"].includes(initial.edition)) {
    const radio = radios.find((item) => item.value === initial.edition);
    if (radio) radio.checked = true;
  }
  if (initial.date === "all" || dates.includes(initial.date)) dateSelect.value = initial.date;

  function current() {
    return {
      query: input.value,
      edition: radios.find((item) => item.checked)?.value || "all",
      date: dateSelect.value || "all",
    };
  }

  function render() {
    const state = current();
    const found = filterStories(items, state);
    count.textContent = `${found.length} 条 · ${editionName(state.edition)}${state.date === "all" ? "" : ` · ${state.date}`}`;
    list.innerHTML = found.length
      ? found.map(resultItem).join("")
      : `<li class="empty">没有相符的条目。已收入的报纸都在这个索引里，没有另外编造结果。</li>`;
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.edition !== "all") params.set("edition", state.edition);
    if (state.date !== "all") params.set("date", state.date);
    const next = `${location.pathname}${params.toString() ? `?${params}` : ""}`;
    if (`${location.pathname}${location.search}` !== next) {
      history.replaceState(null, "", next);
    }
  }

  input.addEventListener("input", render);
  dateSelect.addEventListener("change", render);
  for (const radio of radios) radio.addEventListener("change", render);
  render();
}

if (typeof document !== "undefined") {
  const script = document.querySelector("script[data-index]");
  const indexUrl = script?.getAttribute("data-index");
  if (indexUrl) {
    fetch(indexUrl)
      .then((response) => response.json())
      .then((items) => bootSearch(document, items, window.location, window.history))
      .catch(() => {
        const count = document.querySelector("#search-count");
        if (count) count.textContent = "索引没有载入。";
      });
  }
}

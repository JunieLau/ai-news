import fs from "node:fs";
import path from "node:path";

export const EDITIONS = {
  morning: {
    id: "morning",
    nav: "新闻早报",
    title: "AI新闻速报",
    stack: ["新闻早报", "上海"],
    slot: "10:00",
  },
  evening: {
    id: "evening",
    nav: "电影晚报",
    title: "AI电影与视频速报",
    stack: ["电影晚报", "上海"],
    slot: "20:00",
  },
};

const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const IMAGE_FILE = /^\d{4}-\d{2}-\d{2}\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpg|jpeg|png|webp)$/;
const KICKER = /^[A-Za-z0-9][A-Za-z0-9 .&+-]{0,32}$/;

export function joinBase(base, rel) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(rel || "").replace(/^\/+/, "");
  if (!b) return `/${p}`;
  return p ? `${b}/${p}` : `${b}/`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isHttpUrl(value) {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function hostname(value) {
  return new URL(value).hostname.replace(/^www\./, "");
}

export function isIsoStamp(value) {
  if (typeof value !== "string" || !ISO_STAMP.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function shanghaiClock(iso) {
  const dt = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(dt).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function formatChineseDate(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export function weekdayName(isoDate) {
  const dt = new Date(`${isoDate}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
    timeZone: "Asia/Shanghai",
  }).format(dt);
}

function err(code, message) {
  return { code, message };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateIssue(issue, options = {}) {
  const errors = [];
  const where = options.file ? `${options.file}: ` : "";
  if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
    return [err("issue_type", `${where}期刊必须是对象`)];
  }

  if (!isValidDate(issue.issueDate)) {
    errors.push(err("issue_date", `${where}issueDate 必须是真实的 YYYY-MM-DD`));
  }
  if (options.folderDate && issue.issueDate !== options.folderDate) {
    errors.push(err("folder_date", `${where}目录日期 ${options.folderDate} 与 issueDate ${issue.issueDate} 不一致`));
  }
  if (!EDITIONS[issue.edition]) {
    errors.push(err("edition", `${where}edition 只能是 morning 或 evening`));
  }
  if (options.fileEdition && issue.edition !== options.fileEdition) {
    errors.push(err("file_edition", `${where}文件名 ${options.fileEdition} 与 edition ${issue.edition} 不一致`));
  }
  if (issue.timezone !== "Asia/Shanghai") {
    errors.push(err("timezone", `${where}timezone 必须是 Asia/Shanghai`));
  }
  if (!isIsoStamp(issue.updatedAt)) {
    errors.push(err("updated_at", `${where}updatedAt 必须是带时区的 ISO 时间`));
  }
  if (!isIsoStamp(issue.retrievedThrough)) {
    errors.push(err("retrieved_through", `${where}retrievedThrough 必须是带时区的 ISO 时间`));
  }
  const editionMeta = EDITIONS[issue.edition];
  if (editionMeta && issue.slot !== editionMeta.slot) {
    errors.push(err("slot", `${where}${issue.edition} 的 slot 必须是 ${editionMeta?.slot}`));
  }
  if (!isNonEmptyString(issue.slotNote)) {
    errors.push(err("slot_note", `${where}slotNote 不能为空`));
  }
  if (editionMeta && issue.title !== editionMeta.title) {
    errors.push(err("title", `${where}title 必须是「${editionMeta.title}」`));
  }
  if (!isNonEmptyString(issue.editorsNote) || issue.editorsNote.trim().length < 8) {
    errors.push(err("editors_note", `${where}editorsNote 太短`));
  }
  if (issue.showSendShortlist !== undefined && typeof issue.showSendShortlist !== "boolean") {
    errors.push(err("show_send_shortlist", `${where}showSendShortlist 必须是布尔值`));
  }
  if (!Array.isArray(issue.stories) || issue.stories.length < 1) {
    errors.push(err("stories", `${where}stories 至少要有一条`));
    return errors;
  }

  const ranks = new Set();
  const ids = new Set();
  issue.stories.forEach((story, index) => {
    const at = `${where}stories[${index}]`;
    if (!story || typeof story !== "object") {
      errors.push(err("story_type", `${at} 必须是对象`));
      return;
    }
    const expectedId = isValidDate(issue.issueDate) && EDITIONS[issue.edition] && Number.isInteger(story.rank)
      ? `${issue.issueDate}-${issue.edition}-${String(story.rank).padStart(2, "0")}`
      : null;
    if (!isNonEmptyString(story.id) || (expectedId && story.id !== expectedId)) {
      errors.push(err("story_id", `${at} id 必须是 ${expectedId || "日期-版次-序号"}`));
    } else if (ids.has(story.id)) {
      errors.push(err("story_id", `${at} id 重复：${story.id}`));
    } else {
      ids.add(story.id);
    }
    if (!Number.isInteger(story.rank) || story.rank < 1) {
      errors.push(err("rank", `${at} rank 必须是从 1 开始的整数`));
    } else if (ranks.has(story.rank)) {
      errors.push(err("rank", `${at} rank 重复：${story.rank}`));
    } else {
      ranks.add(story.rank);
    }
    if (story.tier !== "send" && story.tier !== "alternate") {
      errors.push(err("tier", `${at} tier 只能是 send 或 alternate`));
    }
    if (story.region !== "海外" && story.region !== "国内") {
      errors.push(err("region", `${at} region 只能是 海外 或 国内`));
    }
    if (typeof story.kickerEn !== "string" || !KICKER.test(story.kickerEn)) {
      errors.push(err("kicker", `${at} kickerEn 需要是短的英文标识`));
    }
    if (!isNonEmptyString(story.headline) || story.headline.trim().length < 4) {
      errors.push(err("headline", `${at} headline 不能为空`));
    }
    if (!isNonEmptyString(story.standfirst)) {
      errors.push(err("standfirst", `${at} standfirst 不能为空`));
    }
    if (!Array.isArray(story.paragraphs) || story.paragraphs.length < 1 || story.paragraphs.some((p) => !isNonEmptyString(p))) {
      errors.push(err("paragraphs", `${at} paragraphs 至少一段读者正文`));
    }
    if (!isNonEmptyString(story.whyItMatters)) {
      errors.push(err("why", `${at} whyItMatters 不能为空`));
    }
    if (!Array.isArray(story.caveats) || story.caveats.some((item) => !isNonEmptyString(item))) {
      errors.push(err("caveats", `${at} caveats 必须是字符串数组`));
    }
    if (!Array.isArray(story.figures) || story.figures.some((item) => !isNonEmptyString(item))) {
      errors.push(err("figures", `${at} figures 必须是字符串数组`));
    }
    if (story.publishedAt !== null && !isIsoStamp(story.publishedAt)) {
      errors.push(err("published_at", `${at} publishedAt 必须是 ISO 时间或 null`));
    }
    if (!isNonEmptyString(story.publishedAtNote)) {
      errors.push(err("published_at_note", `${at} publishedAtNote 不能为空`));
    }
    if (!Array.isArray(story.sources) || story.sources.length < 1) {
      errors.push(err("sources", `${at} 至少要有一个 http(s) 原文链接`));
    } else {
      const seenUrl = new Set();
      let primary = 0;
      story.sources.forEach((source, sourceIndex) => {
        const label = `${at}.sources[${sourceIndex}]`;
        if (!source || typeof source !== "object") {
          errors.push(err("source", `${label} 必须是对象`));
          return;
        }
        if (!isNonEmptyString(source.name)) {
          errors.push(err("source_name", `${label} 缺少名称`));
        }
        if (!isHttpUrl(source.url)) {
          errors.push(err("source_url", `${label} url 必须是 http 或 https`));
        } else if (seenUrl.has(source.url)) {
          errors.push(err("source_url", `${label} url 在本条内重复`));
        } else {
          seenUrl.add(source.url);
        }
        if (source.role === "primary") primary += 1;
        else if (source.role !== "secondary") {
          errors.push(err("source_role", `${label} role 只能是 primary 或 secondary`));
        }
      });
      if (primary !== 1) {
        errors.push(err("source_primary", `${at} 必须且只能有一个 primary 来源`));
      }
    }

    const image = story.image;
    if (!image || typeof image !== "object") {
      errors.push(err("image", `${at} image 不能为空`));
      return;
    }
    if (image.status === "archived") {
      if (typeof image.file !== "string" || !IMAGE_FILE.test(image.file)) {
        errors.push(err("image_file", `${at} 存档图片路径不合法`));
      } else if (options.mediaDir) {
        const root = path.resolve(options.mediaDir);
        const abs = path.resolve(root, image.file);
        if (abs !== root && !abs.startsWith(root + path.sep)) {
          errors.push(err("image_file", `${at} 图片路径越出媒体目录`));
        } else if (!fs.existsSync(abs)) {
          errors.push(err("image_missing", `${at} 找不到图片 ${image.file}`));
        }
      }
      if (!isNonEmptyString(image.alt)) errors.push(err("image_alt", `${at} 存档图片需要 alt`));
      if (!isNonEmptyString(image.credit)) errors.push(err("image_credit", `${at} 存档图片需要 credit`));
      if (!isHttpUrl(image.sourcePage)) errors.push(err("image_source", `${at} sourcePage 必须是原文页 URL`));
      if (!isHttpUrl(image.retrievedFrom)) errors.push(err("image_retrieved", `${at} retrievedFrom 必须是图片 URL`));
      if (!isIsoStamp(image.retrievedAt)) errors.push(err("image_retrieved_at", `${at} retrievedAt 必须是 ISO 时间`));
      if (isHttpUrl(image.sourcePage) && Array.isArray(story.sources)) {
        const listed = story.sources.some((source) => source && source.url === image.sourcePage);
        if (!listed) errors.push(err("image_source", `${at} 图片所在页面必须同时列在 sources 里`));
      }
      if (isNonEmptyString(image.gapReason)) {
        errors.push(err("image_gap", `${at} 已存档的图片不要再写 gapReason`));
      }
    } else if (image.status === "gap") {
      if (!isNonEmptyString(image.gapReason) || image.gapReason.trim().length < 8) {
        errors.push(err("image_gap", `${at} 缺图必须写明 gapReason`));
      }
      if (isNonEmptyString(image.file) || isNonEmptyString(image.credit) || isNonEmptyString(image.retrievedFrom)) {
        errors.push(err("image_gap", `${at} 缺图不能填写文件、署名或图片地址`));
      }
    } else {
      errors.push(err("image_status", `${at} image.status 只能是 archived 或 gap`));
    }
  });

  if (issue.stories.length) {
    const numericRanks = issue.stories.map((story) => story.rank).filter((rank) => Number.isInteger(rank));
    for (let rank = 1; rank <= issue.stories.length; rank += 1) {
      if (!numericRanks.includes(rank)) {
        errors.push(err("rank_sequence", `${where}rank 必须是连续的 1 到 ${issue.stories.length}`));
        break;
      }
    }
  }
  return errors;
}

export function validateCorpus(issues) {
  const errors = [];
  const seen = new Map();
  for (const issue of issues) {
    for (const story of issue.stories || []) {
      if (!story?.id) continue;
      if (seen.has(story.id)) {
        errors.push(err("duplicate_id", `id 重复：${story.id}`));
      } else {
        seen.set(story.id, true);
      }
    }
  }
  return errors;
}

export function loadIssues(contentDir) {
  const root = path.join(contentDir, "issues");
  const issues = [];
  const errors = [];
  if (!fs.existsSync(root)) {
    return { issues, errors: [err("no_content", `缺少目录 ${root}`)] };
  }
  for (const folderDate of fs.readdirSync(root).sort()) {
    const folder = path.join(root, folderDate);
    if (!fs.statSync(folder).isDirectory()) continue;
    for (const name of fs.readdirSync(folder).sort()) {
      if (!name.endsWith(".json")) continue;
      const fileEdition = name.slice(0, -5);
      const file = path.join(folder, name);
      let issue;
      try {
        issue = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (error) {
        errors.push(err("json", `${file}: ${error.message}`));
        continue;
      }
      if (fileEdition !== "morning" && fileEdition !== "evening") {
        errors.push(err("file_edition", `${file} 文件名必须是 morning.json 或 evening.json`));
      }
      errors.push(...validateIssue(issue, {
        mediaDir: path.join(contentDir, "media"),
        file,
        folderDate,
        fileEdition,
      }));
      if (issue && typeof issue === "object") issues.push(issue);
    }
  }
  errors.push(...validateCorpus(issues));
  return { issues, errors };
}

export function compareDateDesc(a, b) {
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

export function storiesInOrder(issue) {
  return [...issue.stories].sort((a, b) => a.rank - b.rank);
}

export function streamIssues(issues, edition) {
  return issues
    .filter((issue) => issue.edition === edition)
    .sort((a, b) => compareDateDesc(a.issueDate, b.issueDate));
}

export function tierLabel(tier) {
  return tier === "alternate" ? "备选" : "主推";
}

export function primarySource(story) {
  return story.sources.find((source) => source.role === "primary") || story.sources[0];
}

export function orderedSources(story) {
  return [
    ...story.sources.filter((source) => source.role === "primary"),
    ...story.sources.filter((source) => source.role !== "primary"),
  ];
}

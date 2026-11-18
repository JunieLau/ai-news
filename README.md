# AI NEWS

中文人工智能报纸。早报是综合新闻，晚报是电影与视频。两条线分开地址、分开最新一期、分开历史目录。站点是静态页，给 GitHub Pages 的项目路径 `/ai-news/` 用。

本期种子只有 **2026-11-18**。早报 10 条，晚报 6 条。晚报没有凑满 10 条，也不另编新闻。更早的日期没有被造出来；测试夹具只活在 `test/` 里，不会进站点。

## 地址

下面都相对于站点根。项目页上的实际路径前面还有 `/ai-news`。

| 路径 | 打开什么 |
| --- | --- |
| `/` | 早报流里 `issueDate` 最新的一期。不写死 11 月 18 日。晚报即使日期更晚，首页仍是早报。 |
| `/morning/` | 早报流自己的最新一期 |
| `/evening/` | 晚报流自己的最新一期 |
| `/morning/YYYY-MM-DD/` | 这一天的早报。以后有了更新的早报，这个地址仍是这一天。 |
| `/evening/YYYY-MM-DD/` | 这一天的晚报 |
| `/search/` | 在已经收入的期刊里检索 |
| `/search/?q=词&edition=morning&date=2026-11-18` | 可分享的检索。不使用 localStorage。 |

导航里的「早报」「晚报」始终链到该流的最新一期。历史页上的「返回最新一期」也是这条地址。历史目录里的每一个日期都链到 `/morning/YYYY-MM-DD/` 或 `/evening/YYYY-MM-DD/`，不会被改写成后来的新报纸。

每个地址都是真实的 `index.html`。刷新深链不会落到单页应用的 404。没有对应文件时用站点里的 `404.html`。

## 每天怎么发

常规档期是上海时间 **10:00 早报**、**20:00 晚报**。浏览器里没有定时任务，也不会自己去抓新闻。编辑把当期文件交进仓库，合并到 `main` 之后，GitHub Actions 才发布。

11 月 18 日这一期是补更，`updatedAt` 为 `2026-11-18T22:40:00+08:00`。`slot` 仍写档期 `10:00` / `20:00`，`slotNote` 写明它不是整点发出的。不要把截稿时间改成 10:00 或 20:00。

追加一天：

1. 图片放到 `content/media/YYYY-MM-DD/`。文件名用小写字母、数字和连字符，扩展名 `jpg`、`png` 或 `webp`。
2. 写成一份期刊 JSON。
3. 入库，且不覆盖别的日期：

```bash
node scripts/upsert.mjs --file incoming/2026-11-19-morning.json
```

同一天要改稿才加 `--replace`。没有这个参数时，已存在的那一天会拒绝写入。其他日期的文件不会被删、也不会被改。

4. 检查并生成页面。历史目录、首页和两流的「最新」都由全部期刊重新算，按日期从新到旧：

```bash
npm test
npm run build
npm run preview
```

5. 提交 `content/issues/YYYY-MM-DD/` 和对应的 `content/media/YYYY-MM-DD/`。不要提交 `dist/`。
6. 合并进 `main`。`.github/workflows/pages.yml` 会测试、构建，并把 `dist/` 部署到 GitHub Pages。

本地预览是 `http://127.0.0.1:4173/ai-news/`。

## 文件

```
content/issues/YYYY-MM-DD/morning.json
content/issues/YYYY-MM-DD/evening.json
content/media/YYYY-MM-DD/<图片文件>
```

一个日期目录里最多两个文件：`morning.json`、`evening.json`。目录名必须等于里面的 `issueDate`。文件名必须等于 `edition`。

构建还会写出 `dist/manifest.json`。`streams.morning.dates` 和 `streams.evening.dates` 都是从新到旧。`home` 永远指向早报流的最新日期；早报还没有期刊时是 `null`。

## 期刊字段

```json
{
  "issueDate": "2026-11-18",
  "edition": "morning",
  "timezone": "Asia/Shanghai",
  "updatedAt": "2026-11-18T22:40:00+08:00",
  "retrievedThrough": "2026-11-18T22:40:00+08:00",
  "slot": "10:00",
  "slotNote": "这一期若不是档期整点发出，在这里说明。",
  "title": "AI新闻速报",
  "editorsNote": "给读者的编者按。",
  "stories": []
}
```

- `edition` 只能是 `morning` 或 `evening`。
- `timezone` 必须是 `Asia/Shanghai`。
- `slot`：早报必须是 `10:00`，晚报必须是 `20:00`。这是档期，不是 `updatedAt`。
- `title`：文件里早报仍必须是 `AI新闻速报`，晚报仍必须是 `AI电影与视频速报`。页面导航和标题显示为「新闻早报」「电影晚报」。
- `updatedAt` 和 `retrievedThrough` 是带时区的 ISO 时间，和 `issueDate` 分开。
- `issueDate` 必须是真实日历日，例如拒绝 `2026-11-31`。

### 条目

```json
{
  "id": "2026-11-18-morning-01",
  "rank": 1,
  "tier": "send",
  "region": "海外",
  "kickerEn": "NVIDIA",
  "headline": "读者标题",
  "standfirst": "一句导语",
  "paragraphs": ["读者正文"],
  "whyItMatters": "为何重要",
  "caveats": ["读的时候要留下的界限"],
  "figures": ["关键数字，可为空数组"],
  "publishedAt": "2026-11-17T23:58:00+08:00",
  "publishedAtNote": "来源时间怎么来的。没有单一钟点时 publishedAt 用 null，说明仍要写。",
  "sources": [
    { "name": "来源名", "url": "https://example.com/story", "role": "primary" }
  ],
  "image": {
    "status": "archived",
    "file": "2026-11-18/morning-01.jpg",
    "alt": "画面里实际是什么，避免把旧图说成现场",
    "credit": "这张图来自哪一页的 og:image 或官方缩略图",
    "sourcePage": "https://example.com/story",
    "retrievedFrom": "https://cdn.example.com/image.jpg",
    "retrievedAt": "2026-11-18T16:45:00Z"
  }
}
```

- `id` 必须是 `{issueDate}-{edition}-{两位 rank}`，全站唯一。
- `rank` 从 1 连续排到最后。页面按这个顺序当热度。
- `tier`：`send` 显示「主推」，`alternate` 显示「备选」。
- `region` 只能是 `海外` 或 `国内`。
- `sources` 至少一个。必须正好有一个 `primary`，其余是 `secondary`。`url` 只能是 `http` 或 `https`。
- 标题、图片和来源都链到这些原文。`publishedAt` 是来源发布时间，不是本报日期。页面上只在有钟点时写一行「来源」时间。`publishedAtNote`、`editorsNote`、`slotNote` 留在文件里，不在版面上展开。
- `figures` 和 `caveats` 在版面上各收成一段，不拆成条目。

### 图片

`status` 为 `archived` 时：`file` 必须在 `content/media/` 下，`sourcePage` 必须同时出现在该条的 `sources` 里，并写上 `credit`、`alt`、`retrievedFrom`、`retrievedAt`。

`status` 为 `gap` 时只写 `gapReason`。不能填文件、署名或图片地址。页面用文字版位，标明「无存档图片」，不配假照片。

只收原文页面的公开 `og:image`，或官方帖的缩略图。原页打不开、只有通用标识、或画面和这条新闻对不上时，记成 `gap`，不要换一张库存图或生成图。本报不放视频，也不自动播放。

11 月 18 日早报里有两条缺图：

- `2026-11-18-morning-06`：商务部页面没有存下配图；CNBC 的画面和临时最终规则对不上。
- `2026-11-18-morning-08`：官方博客和 Ars 的图都是品牌标识，不是这次开关的界面。

## 命令

```bash
npm test          # 校验期刊、路由、检索、追加日期
npm run validate  # 只校验 content/
npm run build     # 写出 dist/，默认 base 为 /ai-news
npm run preview   # 127.0.0.1:4173/ai-news/
node scripts/build.mjs --content content --out dist --base /ai-news
node scripts/upsert.mjs --file <issue.json> [--content content] [--replace]
```

构建会复制字体、样式、图片，并生成各期 HTML、`search-index.json`、`manifest.json`、`sitemap.xml` 和 `.nojekyll`。

## 测试覆盖的回归

`test/routing.test.mjs` 用夹具造了四期，不进入 `content/`：

- 早报最新是 2026-11-18，另有 2026-11-16
- 晚报最新是 2026-11-19，另有 2026-11-15

断言：首页是早报 11 月 18 日，而不是全局更晚的晚报 11 月 19 日；`/morning/` 和 `/evening/` 各取各的最新；旧地址仍显示旧标题，并有「返回最新一期」；最新一天的固定地址不会出现这句，也不会用刷新跳走；追加 11 月 20 日早报后，旧文件的内容不变，目录变成从新到旧。

## 部署

仓库：`JunieLau/ai-news`。

工作流：

- `.github/workflows/ci.yml`：拉取请求和 `main` 上跑测试和构建。
- `.github/workflows/pages.yml`：只在 `main` 上部署到 GitHub Pages。

本次查看时，仓库的 Pages 没有打开（`has_pages` 为 false，Pages API 返回 404）。工作流本身不会替任何人修改仓库设置或域名。合并之后，需要在这个仓库把 Pages 的构建来源设为 GitHub Actions。预期地址是 `https://junielau.github.io/ai-news/`。在那之前，没有已核实的线上地址。

字体是 SIL Open Font License 的 Big Shoulders Display 和 Noto Serif SC，许可文本在 `src/fonts/`。

export function fixtureIssue({ date, edition, headline, rank = 1 }) {
  const slot = edition === "morning" ? "10:00" : "20:00";
  const title = edition === "morning" ? "AI新闻速报" : "AI电影与视频速报";
  return {
    issueDate: date,
    edition,
    timezone: "Asia/Shanghai",
    updatedAt: `${date}T${slot}:00+08:00`,
    retrievedThrough: `${date}T${slot}:00+08:00`,
    slot,
    slotNote: "测试夹具，不是新闻。",
    title,
    editorsNote: "测试夹具，不是新闻。用来检查日期，不可当作报道。",
    stories: [
      {
        id: `${date}-${edition}-${String(rank).padStart(2, "0")}`,
        rank,
        tier: "send",
        region: "海外",
        kickerEn: "FIXTURE",
        headline,
        standfirst: "测试夹具导语。",
        paragraphs: ["测试夹具正文，不可当作新闻。"],
        whyItMatters: "用来验证最新一期和历史地址。",
        caveats: ["这不是真实报道。"],
        figures: [],
        publishedAt: null,
        publishedAtNote: "夹具没有来源钟点。",
        sources: [{ name: "夹具", url: `https://example.com/${edition}-${date}`, role: "primary" }],
        image: { status: "gap", alt: "", gapReason: "测试夹具不配图片。" },
      },
    ],
  };
}

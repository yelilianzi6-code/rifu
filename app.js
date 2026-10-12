const DAY_ORDER = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const STATUS_LABEL = { onair: "连载中", upcoming: "待播", ended: "已完结" };

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function badge(status) {
  const label = STATUS_LABEL[status] || status;
  return `<span class="badge ${status}">${label}</span>`;
}

function showMetaHtml(show) {
  const parts = [];
  if (show.platform) parts.push(escapeHtml(show.platform));
  if (show.time_note) parts.push(escapeHtml(show.time_note));
  if (show.episode_total) parts.push(`全 ${show.episode_total} 话`);
  return parts.join(" · ");
}

function renderShowRow(show) {
  const time = show.air_time ? `<span class="show-time">${escapeHtml(show.air_time)}</span>` : "";
  return `
    <div class="show-row">
      <span class="show-name">${escapeHtml(show.name)}</span>
      ${time}
      <span class="show-meta">${showMetaHtml(show)}</span>
    </div>`;
}

function renderSchedule(onair) {
  const byDay = {};
  DAY_ORDER.forEach((d) => (byDay[d] = []));
  onair.forEach((s) => {
    const d = s.air_day;
    if (byDay[d]) byDay[d].push(s);
  });
  return DAY_ORDER.map((d) => {
    const shows = byDay[d] || [];
    const body = shows.length
      ? shows.map(renderShowRow).join("")
      : `<div class="day-empty">今天没有更新</div>`;
    return `<div class="day-group"><div class="day-label">${d}</div>${body}</div>`;
  }).join("");
}

function renderCards(shows) {
  if (!shows.length) return `<div class="card"><span class="show-meta">暂无</span></div>`;
  return shows.map((s) => `
    <div class="card">
      <span class="show-name">${escapeHtml(s.name)}${badge(s.status)}</span>
      <span class="show-meta">${showMetaHtml(s)}${s.air_day ? ` · ${escapeHtml(s.air_day)} ${escapeHtml(s.air_time || "")}` : ""}</span>
    </div>`).join("");
}

function renderNews(news) {
  if (!news.length) return `<div class="card"><span class="show-meta">暂无资讯</span></div>`;
  const sorted = [...news].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return sorted.map((n) => `
    <div class="news-item">
      <div class="news-head">
        <span class="news-title">${escapeHtml(n.title)}</span>
        <span class="news-date">${escapeHtml(n.date)}</span>
      </div>
      ${n.detail ? `<div class="news-detail">${escapeHtml(n.detail)}</div>` : ""}
      ${n.source ? `<a href="${escapeHtml(n.source)}" target="_blank" rel="noopener">查看来源 ↗</a>` : ""}
    </div>`).join("");
}

function render(data) {
  const shows = data.shows || [];
  const onair = shows.filter((s) => s.status === "onair");
  const upcoming = shows.filter((s) => s.status === "upcoming");
  const ended = shows.filter((s) => s.status === "ended");

  document.getElementById("schedule").innerHTML = renderSchedule(onair);
  document.getElementById("upcoming").innerHTML = renderCards(upcoming);
  document.getElementById("ended").innerHTML = renderCards(ended);
  document.getElementById("news").innerHTML = renderNews(data.news || []);

  if (data.updated_at) {
    document.getElementById("updated-at").textContent =
      "数据更新时间：" + data.updated_at;
  }
}

fetch("data.json")
  .then((r) => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  })
  .then(render)
  .catch((err) => {
    document.getElementById("schedule").innerHTML =
      `<div class="card"><span class="show-meta">数据加载失败：${escapeHtml(err.message)}</span></div>`;
  });

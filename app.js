const DAY_ORDER = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const STATUS_LABEL = { onair: "连载中", upcoming: "待播", ended: "已完结" };
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

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

// ---- 评分板块 ----
function starsHtml(rating) {
  const n = Math.max(0, Math.min(7, Number(rating) || 0));
  return `<span class="stars">${"★".repeat(n)}<span class="stars-off">${"☆".repeat(7 - n)}</span></span>`;
}

function posterUrl(r) {
  if (!r.poster) return "";
  return /^https?:\/\//.test(r.poster) ? r.poster : TMDB_IMG + r.poster;
}

function renderReviews(reviews) {
  const sorted = [...reviews].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const grid = document.getElementById("reviews");
  if (!sorted.length) {
    grid.innerHTML = `<div class="card"><span class="show-meta">暂无评分</span></div>`;
    return;
  }
  grid.innerHTML = sorted.map((r, i) => {
    const img = posterUrl(r);
    const posterHtml = img
      ? `<img class="review-poster" src="${escapeHtml(img)}" alt="${escapeHtml(r.name)}" loading="lazy" />`
      : `<div class="review-poster placeholder">${escapeHtml(r.name.charAt(0))}</div>`;
    return `
      <button class="review-card" data-idx="${i}">
        ${posterHtml}
        <div class="review-name">${escapeHtml(r.name)}</div>
        ${starsHtml(r.rating)}
      </button>`;
  }).join("");

  grid.querySelectorAll(".review-card").forEach((btn) => {
    btn.addEventListener("click", () => openModal(sorted[Number(btn.dataset.idx)]));
  });
}

let modalEl = null;

function openModal(r) {
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.className = "modal-overlay";
    modalEl.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" aria-label="关闭">×</button>
        <div class="modal-body"></div>
      </div>`;
    document.body.appendChild(modalEl);
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl || e.target.closest(".modal-close")) closeModal();
    });
  }

  const img = posterUrl(r);
  const meta = [];
  if (r.jp_name) meta.push(`日文名：${escapeHtml(r.jp_name)}`);
  if (r.year) meta.push(`播出：${escapeHtml(r.year)}`);
  if (r.cast) meta.push(`主演：${escapeHtml(r.cast)}`);
  const metaHtml = meta.length ? `<div class="modal-meta">${meta.join("<br>")}</div>` : "";

  modalEl.querySelector(".modal-body").innerHTML = `
    ${img ? `<img class="modal-poster" src="${escapeHtml(img)}" alt="">` : ""}
    <h3 class="modal-title">${escapeHtml(r.name)}</h3>
    <div class="modal-stars">${starsHtml(r.rating)}</div>
    <div class="modal-tags">${(r.tags || []).map((t) => escapeHtml(t)).join(" · ")}</div>
    ${metaHtml}
    <p class="modal-review">${escapeHtml(r.review || "")}</p>`;
  modalEl.classList.add("open");
}

function closeModal() {
  if (modalEl) modalEl.classList.remove("open");
}

// ---- 加载 ----
fetch("data.json")
  .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then(render)
  .catch((err) => {
    document.getElementById("schedule").innerHTML =
      `<div class="card"><span class="show-meta">数据加载失败：${escapeHtml(err.message)}</span></div>`;
  });

fetch("reviews.json")
  .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then((d) => renderReviews(d.reviews || []))
  .catch((err) => {
    document.getElementById("reviews").innerHTML =
      `<div class="card"><span class="show-meta">评分加载失败：${escapeHtml(err.message)}</span></div>`;
  });

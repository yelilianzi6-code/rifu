const DAY_ORDER = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const STATUS_LABEL = { onair: "连载中", upcoming: "待播", ended: "已完结" };
const TYPE_LABEL = { tv: "剧集", movie: "电影" };
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function posterUrl(p) {
  if (!p) return "";
  return /^https?:\/\//.test(p) ? p : TMDB_IMG + p;
}

function badge(status) {
  const label = STATUS_LABEL[status] || status;
  return `<span class="badge ${status}">${label}</span>`;
}

function typeBadge(type) {
  const label = TYPE_LABEL[type] || "";
  return label ? `<span class="badge typed">${label}</span>` : "";
}

// ---- 顶部导航 ----
function renderNav() {
  const links = [
    ["index.html", "首页"],
    ["schedule.html", "每周更新"],
    ["upcoming.html", "待播"],
    ["reviews.html", "我的评分"],
    ["watchlist.html", "我的待看"],
  ];
  const page = document.body.dataset.page;
  const nav = document.getElementById("topnav");
  if (!nav) return;
  nav.innerHTML = `
    <div class="nav-inner">
      <a class="brand" href="index.html">日腐直通车</a>
      <div class="nav-links">
        ${links.map(([href, label]) => {
          const active = (page === "home" && href === "index.html") || href === page + ".html";
          return `<a href="${href}" class="${active ? "active" : ""}">${label}</a>`;
        }).join("")}
      </div>
    </div>`;
}

// ---- 首页轮播 ----
function renderCarousel(shows) {
  const el = document.getElementById("carousel");
  if (!el) return;
  // 正在更新的剧(onair) + 待上映/即将上映的电影
  const items = (shows || []).filter(
    (s) => s.status === "onair" || (s.type === "movie" && s.status === "upcoming")
  );
  if (!items.length) {
    el.innerHTML = `<div class="card"><span class="show-meta">暂无轮播内容</span></div>`;
    return;
  }
  const sorted = [...items].sort((a, b) => {
    const ka = a.type === "movie" ? 0 : 1; // 电影优先放在轮播里
    return ka - kb;
  });
  el.innerHTML = `
    <div class="carousel-track">
      ${sorted.map((s, i) => {
        const img = posterUrl(s.poster);
        const target = s.type === "movie" ? "upcoming.html" : "schedule.html";
        return `
        <a class="carousel-slide ${i === 0 ? "active" : ""}" href="${target}">
          ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(s.name)}" />` : ""}
          <div class="carousel-caption">
            <div class="carousel-title">${escapeHtml(s.name)}${typeBadge(s.type)}</div>
            <div class="carousel-sub">${escapeHtml(s.time_note || s.platform || "")}</div>
          </div>
        </a>`;
      }).join("")}
    </div>
    <div class="carousel-dots">
      ${sorted.map((_, i) => `<button class="dot ${i === 0 ? "active" : ""}" data-i="${i}" aria-label="第${i + 1}张"></button>`).join("")}
    </div>`;
  autoCarousel(sorted.length);
}

function autoCarousel(count) {
  if (count <= 1) return;
  let cur = 0;
  const slides = () => document.querySelectorAll(".carousel-slide");
  const dots = () => document.querySelectorAll(".carousel-dots .dot");
  const go = (i) => {
    cur = (i + count) % count;
    slides().forEach((s, k) => s.classList.toggle("active", k === cur));
    dots().forEach((d, k) => d.classList.toggle("active", k === cur));
  };
  document.querySelectorAll(".carousel-dots .dot").forEach((d) => {
    d.addEventListener("click", () => go(Number(d.dataset.i)));
  });
  let timer = setInterval(() => go(cur + 1), 4000);
  const el = document.getElementById("carousel");
  el.addEventListener("mouseenter", () => clearInterval(timer));
  el.addEventListener("mouseleave", () => { timer = setInterval(() => go(cur + 1), 4000); });
}

// ---- 日程表 ----
function renderShowRow(show) {
  const time = show.air_time ? `<span class="show-time">${escapeHtml(show.air_time)}</span>` : "";
  return `
    <div class="show-row">
      <span class="show-name">${escapeHtml(show.name)}${typeBadge(show.type)}</span>
      ${time}
      <span class="show-meta">${showMetaHtml(show)}</span>
    </div>`;
}

function showMetaHtml(show) {
  const parts = [];
  if (show.platform) parts.push(escapeHtml(show.platform));
  if (show.time_note) parts.push(escapeHtml(show.time_note));
  if (show.episode_total) parts.push(`全 ${show.episode_total} 话`);
  return parts.join(" · ");
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

// ---- 待播(剧 + 电影) ----
function renderUpcoming(shows) {
  if (!shows.length) return `<div class="card"><span class="show-meta">暂无定档</span></div>`;
  // 电影(上映日期)在前，剧(开播日期)在后
  const movies = shows.filter((s) => s.type === "movie");
  const tvs = shows.filter((s) => s.type !== "movie");
  const card = (s) => {
    const img = posterUrl(s.poster);
    return `
      <div class="upcoming-card">
        ${img ? `<img class="upcoming-poster" src="${escapeHtml(img)}" alt="${escapeHtml(s.name)}" loading="lazy" />`
             : `<div class="upcoming-poster placeholder">${escapeHtml(s.name.charAt(0))}</div>`}
        <div class="upcoming-info">
          <div class="show-name">${escapeHtml(s.name)}${typeBadge(s.type)}${badge(s.status)}</div>
          <div class="show-meta">${showMetaHtml(s)}</div>
          ${s.air_day ? `<div class="show-meta">${escapeHtml(s.air_day)} ${escapeHtml(s.air_time || "")}</div>` : ""}
          ${s.release_date ? `<div class="show-meta">上映：${escapeHtml(s.release_date)}</div>` : ""}
        </div>
      </div>`;
  };
  return [...movies, ...tvs].map(card).join("");
}

// ---- 评分墙 ----
function starsHtml(rating) {
  const n = Math.max(0, Math.min(7, Number(rating) || 0));
  return `<span class="stars">${"★".repeat(n)}<span class="stars-off">${"☆".repeat(7 - n)}</span></span>`;
}

function renderReviews(reviews) {
  const sorted = [...reviews].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const grid = document.getElementById("reviews");
  if (!grid) return;
  if (!sorted.length) {
    grid.innerHTML = `<div class="card"><span class="show-meta">暂无评分</span></div>`;
    return;
  }
  grid.innerHTML = sorted.map((r, i) => {
    const img = posterUrl(r.poster);
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
    btn.addEventListener("click", () => openModal(sorted[Number(btn.dataset.idx)], "review"));
  });
}

// ---- 待看墙(按首播日期倒序,最新在上) ----
function renderWatchlist(list) {
  const sorted = [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const grid = document.getElementById("watchlist");
  if (!grid) return;
  if (!sorted.length) {
    grid.innerHTML = `<div class="card"><span class="show-meta">暂无待看</span></div>`;
    return;
  }
  grid.innerHTML = sorted.map((r, i) => {
    const img = posterUrl(r.poster);
    const posterHtml = img
      ? `<img class="review-poster" src="${escapeHtml(img)}" alt="${escapeHtml(r.name)}" loading="lazy" />`
      : `<div class="review-poster placeholder">${escapeHtml(r.name.charAt(0))}</div>`;
    return `
      <button class="review-card" data-idx="${i}">
        ${posterHtml}
        <div class="review-name">${escapeHtml(r.name)}</div>
        <div class="review-year">${escapeHtml(r.year || "")}</div>
      </button>`;
  }).join("");
  grid.querySelectorAll(".review-card").forEach((btn) => {
    btn.addEventListener("click", () => openModal(sorted[Number(btn.dataset.idx)], "watchlist"));
  });
}

// ---- 弹窗 ----
let modalEl = null;

function openModal(item, mode) {
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

  const img = posterUrl(item.poster);
  const meta = [];
  if (item.jp_name) meta.push(`日文名：${escapeHtml(item.jp_name)}`);
  if (item.year) meta.push(`播出：${escapeHtml(item.year)}`);
  if (item.cast) meta.push(`主演：${escapeHtml(item.cast)}`);
  if (item.type) meta.push(`类型：${escapeHtml(TYPE_LABEL[item.type] || item.type)}`);
  const metaHtml = meta.length ? `<div class="modal-meta">${meta.join("<br>")}</div>` : "";

  const stars = mode === "review" ? `<div class="modal-stars">${starsHtml(item.rating)}</div>` : "";
  const tags = mode === "review" && item.tags
    ? `<div class="modal-tags">${(item.tags || []).map((t) => escapeHtml(t)).join(" · ")}</div>` : "";
  const review = mode === "review" && item.review
    ? `<p class="modal-review">${escapeHtml(item.review || "")}</p>` : "";

  modalEl.querySelector(".modal-body").innerHTML = `
    ${img ? `<img class="modal-poster" src="${escapeHtml(img)}" alt="">` : ""}
    <h3 class="modal-title">${escapeHtml(item.name)}</h3>
    ${stars}
    ${tags}
    ${metaHtml}
    ${review}`;
  modalEl.classList.add("open");
}

function closeModal() {
  if (modalEl) modalEl.classList.remove("open");
}

// ---- 加载 ----
function loadJSON(path, onOk) {
  fetch(path)
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(onOk)
    .catch((err) => {
      const el = document.getElementById("content");
      if (el) el.innerHTML = `<div class="card"><span class="show-meta">数据加载失败：${escapeHtml(err.message)}</span></div>`;
    });
}

document.addEventListener("DOMContentLoaded", () => {
  renderNav();
  const page = document.body.dataset.page;
  if (page === "home") {
    loadJSON("data.json", (d) => renderCarousel(d.shows || []));
  } else if (page === "schedule") {
    loadJSON("data.json", (d) => {
      const onair = (d.shows || []).filter((s) => s.status === "onair");
      document.getElementById("schedule").innerHTML = renderSchedule(onair);
      if (d.updated_at) document.getElementById("updated-at").textContent = "数据更新时间：" + d.updated_at;
    });
  } else if (page === "upcoming") {
    loadJSON("data.json", (d) => {
      const upcoming = (d.shows || []).filter((s) => s.status === "upcoming");
      document.getElementById("upcoming").innerHTML = renderUpcoming(upcoming);
    });
  } else if (page === "reviews") {
    loadJSON("reviews.json", (d) => renderReviews(d.reviews || []));
  } else if (page === "watchlist") {
    loadJSON("watchlist.json", (d) => renderWatchlist(d.watchlist || []));
  }
});

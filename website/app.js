/* 설정(config.js)을 읽어 화면을 그리는 스크립트 — 내용 수정은 config.js에서 하세요 */
(function () {
  // 관리자 화면에서 고친 설정(미리보기)이 있으면 그것을 사용 — 이 브라우저에만 적용됨
  window.SITE_CONFIG_FILE = window.SITE_CONFIG;
  try {
    const o = localStorage.getItem("kj_config_override");
    // 최상위 항목 단위로 덮어써서, 설정 파일에 새로 생긴 항목은 그대로 살림
    if (o) {
      // config.js와 같아진 영역은 미리보기에서 빼서, 파일을 고친 내용이 가려지지 않게 함
      const ov = JSON.parse(o), file = window.SITE_CONFIG;
      Object.keys(ov).forEach((k) => { if (JSON.stringify(ov[k]) === JSON.stringify(file[k])) delete ov[k]; });
      if (Object.keys(ov).length) {
        localStorage.setItem("kj_config_override", JSON.stringify(ov));
        window.SITE_CONFIG = { ...file, ...ov };
        window.SITE_CONFIG_OVERRIDDEN = true;
      } else localStorage.removeItem("kj_config_override");
    }
  } catch (e) {}
  const C = window.SITE_CONFIG;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const br = (s) => esc(s).replace(/\n/g, "<br />");
  const list = (arr, fn) => (arr || []).map(fn).join("");
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const head = (title, lead) =>
    `<div class="section__head"><h2 class="section__title">${esc(title)}</h2>${lead ? `<p class="section__lead">${esc(lead)}</p>` : ""}</div>`;

  /* ---------- 헤더 ---------- */
  document.title = `${C.site.title} | ${C.site.university} ${C.site.department}`;
  $("#brand-title").textContent = C.site.title;
  $("#brand-sub").textContent = `${C.site.university} ${C.site.department}`;
  $("#nav").innerHTML = list(C.nav, (n) => `<a href="#${esc(n.id)}" data-id="${esc(n.id)}">${esc(n.label)}</a>`);

  /* ---------- 첫 화면 ---------- */
  const h = C.hero;
  $("#home").innerHTML = `
    <div class="hero__inner">
      <span class="pill"><i class="pill__dot"></i>${esc(h.badge)}</span>
      <p class="hero__meta">${esc(C.site.university)} ${esc(C.site.department)}</p>
      <h1 class="hero__title">${br(h.title)}</h1>
      <p class="hero__ja">${esc(C.site.titleJa)}</p>
      <p class="hero__subtitle">${esc(h.subtitle)}</p>
      <p class="hero__sub">${esc(h.description)}</p>
      <div class="hero__btns">
        ${list(h.buttons, (b) => `<a class="btn ${b.primary ? "btn--primary" : "btn--ghost"}" href="${esc(b.href)}"${/^https?:/.test(b.href) ? ' target="_blank" rel="noopener"' : ""}>${esc(b.label)}</a>`)}
      </div>
    </div>
    <div class="container">
      <dl class="facts card">
        ${list(h.facts, (f) => `
          <div class="fact">
            <span class="fact__icon">${esc(f.icon)}</span>
            <div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>
          </div>`)}
      </dl>
    </div>`;

  /* ---------- 숫자 강조 카드 ---------- */
  $("#stats").innerHTML = `<div class="container"><div class="stats">
    ${list(C.stats, (s) => `
      <div class="card stat">
        <div class="stat__num"><span class="count" data-to="${Number(s.value) || 0}">0</span><small>${esc(s.suffix)}</small></div>
        <div class="stat__label">${esc(s.label)}</div>
      </div>`)}
  </div></div>`;

  /* ---------- 프로그램 소개 + 슬라이드 ---------- */
  const a = C.about;
  $("#about").innerHTML = `<div class="container">${head(a.title, a.lead)}
    <div class="slider">
      <button class="slider__btn slider__btn--prev" aria-label="이전">‹</button>
      <div class="slider__track" tabindex="0">
        ${list(a.slides, (c, i) => `
          <article class="card slide">
            <span class="slide__no">${String(i + 1).padStart(2, "0")}</span>
            <div class="card__icon">${esc(c.icon)}</div>
            <h3>${esc(c.title)}</h3>
            <p>${esc(c.text)}</p>
          </article>`)}
      </div>
      <button class="slider__btn slider__btn--next" aria-label="다음">›</button>
    </div>
    <div class="slider__dots"></div></div>`;

  /* ---------- 날짜 도우미 ---------- */
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const pad = (n) => String(n).padStart(2, "0");
  const parseDay = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
  const parseDateTime = (s) => {
    const [d, t = "23:59"] = String(s).trim().split(/[ T]+/);
    const [hh, mm] = t.split(":").map(Number);
    const x = parseDay(d); x.setHours(hh || 0, mm || 0, 0, 0); return x;
  };
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtDate = (d) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.(${DAYS[d.getDay()]})`;
  const fmtShort = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일(${DAYS[d.getDay()]})`;
  const fmtDue = (d) => `${fmtShort(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a, b) => keyOf(a) === keyOf(b);

  /* ---------- 수업 일정 계산 ----------
   * 1주차 = 개강일(startDate)이 들어 있는 주. 매주 days(예: 월·수)에 수업.
   * 개강일 이전 요일과 holidays(휴강일)은 수업에서 빠지고, 주차 내용은 밀리지 않음.
   * 특정 주의 수업일을 바꾸려면 그 주에 dates: ["2026-10-06", "2026-10-07"]처럼 적음. */
  const cu = C.curriculum;
  const holidays = {};
  (cu.holidays || []).forEach((h) => (holidays[h.date] = h.label));
  const classDays = (cu.days || ["화"]).map((d) => DAYS.indexOf(String(d).charAt(0))).filter((n) => n >= 0).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const daysLabel = classDays.map((n) => DAYS[n]).join("·");
  const weeks = [], sessions = [];
  {
    const start = parseDay(cu.startDate);
    const monday = new Date(start); monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    cu.weeks.forEach((w, i) => {
      const wkMon = new Date(monday); wkMon.setDate(monday.getDate() + i * 7);
      const all = w.dates
        ? w.dates.map(parseDay)
        : classDays.map((n) => { const d = new Date(wkMon); d.setDate(wkMon.getDate() + ((n + 6) % 7)); return d; });
      const valid = all.filter((d) => d >= start);
      const ses = valid.filter((d) => !holidays[keyOf(d)]);
      const off = valid.filter((d) => holidays[keyOf(d)]).map((d) => ({ date: d, label: holidays[keyOf(d)] }));
      const date = ses[0] || valid[0] || wkMon;
      const wk = {
        ...w, no: i + 1, label: w.week || `${i + 1}주`, date, key: keyOf(date), off,
        time: w.time || cu.time, location: w.location || cu.location,
        due: w.assignment && w.assignment.due ? parseDateTime(w.assignment.due) : null,
      };
      wk.sessions = ses.map((d) => ({ week: wk, date: d, key: keyOf(d), day: DAYS[d.getDay()], label: `${wk.label} ${DAYS[d.getDay()]}` }));
      wk.last = ses[ses.length - 1] || date;
      weeks.push(wk);
      sessions.push(...wk.sessions);
    });
  }
  const byDate = {}, dueByDate = {};
  weeks.forEach((w) => {
    w.sessions.forEach((s) => (byDate[s.key] = w));
    if (w.due) (dueByDate[keyOf(w.due)] = dueByDate[keyOf(w.due)] || []).push(w);
  });
  const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const nextSession = (from = today0()) => sessions.find((s) => s.date >= from);
  const nextWeek = () => { const s = nextSession(); return s && s.week; };
  // "9/7(월)·9/9(수)" / 긴 형식 "2026. 9. 7.(월) · 9. 9.(수)"
  const md = (d) => `${d.getMonth() + 1}/${d.getDate()}(${DAYS[d.getDay()]})`;
  const sessShort = (w) => (w.sessions.length ? w.sessions.map((s) => md(s.date)).join("·") : `${md(w.date)} 휴강`);
  const sessLong = (w) => w.sessions.length
    ? w.sessions.map((s, i) => (i === 0 ? fmtDate(s.date) : `${s.date.getMonth() + 1}. ${s.date.getDate()}.(${s.day})`)).join(" · ")
    : "이번 주는 수업이 없습니다";

  /* ---------- 수업 자료 (파일 또는 링크) ---------- */
  const MR = C.materialsRoom || {};
  const MAT_TYPES = {
    slide: { label: "슬라이드", icon: "📊" }, doc: { label: "문서", icon: "📄" }, pdf: { label: "PDF", icon: "📕" },
    sheet: { label: "표", icon: "📈" }, folder: { label: "폴더", icon: "📁" }, video: { label: "영상", icon: "🎬" },
    link: { label: "링크", icon: "🔗" }, file: { label: "파일", icon: "📎" },
  };
  // Google Drive / Docs 주소 → { id, kind, view, thumb }  (드라이브 주소가 아니면 null)
  const parseDrive = (url) => {
    const u = String(url || "").trim();
    if (!/^https:\/\/(drive|docs)\.google\.com\//.test(u)) return null;
    const m = u.match(/\/(?:file|presentation|document|spreadsheets|forms)\/d\/([\w-]{10,})/) || u.match(/\/folders\/([\w-]{10,})/) || u.match(/[?&]id=([\w-]{10,})/);
    if (!m) return null;
    const id = m[1];
    const kind = /\/presentation\//.test(u) ? "presentation" : /\/document\//.test(u) ? "document" : /\/spreadsheets\//.test(u) ? "spreadsheets"
      : /\/forms\//.test(u) ? "forms" : /\/folders\//.test(u) ? "folder" : "file";
    const view = kind === "file" ? `https://drive.google.com/file/d/${id}/view` : kind === "folder" ? `https://drive.google.com/drive/folders/${id}` : u;
    return { id, kind, view, thumb: kind === "folder" ? "" : `https://drive.google.com/thumbnail?id=${id}&sz=w800` };
  };
  const extOf = (s) => (String(s || "").match(/\.([a-z0-9]{2,5})$/i) || [])[1] || "";
  const typeFromExt = (ext) => {
    ext = ext.toLowerCase();
    return /^(pptx?|key)$/.test(ext) ? "slide" : /^(docx?|hwpx?|txt)$/.test(ext) ? "doc" : ext === "pdf" ? "pdf"
      : /^(xlsx?|csv)$/.test(ext) ? "sheet" : /^(mp4|mov|webm)$/.test(ext) ? "video" : "";
  };
  const matType = (m) => {
    if (m.type && MAT_TYPES[m.type]) return m.type;
    if (m.file) return typeFromExt(extOf(m.file)) || "file";
    const d = parseDrive(m.url);
    if (d) return { presentation: "slide", document: "doc", spreadsheets: "sheet", folder: "folder" }[d.kind] || typeFromExt(extOf(m.title)) || "file";
    return "link";
  };
  const matHref = (m) => (m.file ? (MR.base || "materials/") + encodeURIComponent(m.file) : (parseDrive(m.url) || {}).view || m.url || "#");
  const matExt = (m) => (m.file ? extOf(m.file).toUpperCase() : parseDrive(m.url) ? "Google Drive" : "LINK");
  // 관리자 모드에서만 보이는 수정·삭제 버튼 (동작은 admin.js) — data는 어떤 항목인지 알려 주는 속성
  const admTools = (kind, data, cls = "") => {
    const attrs = Object.keys(data).map((k) => ` data-${k}="${esc(data[k])}"`).join("");
    return `<span class="adm-tools ${cls}">
      <button type="button" class="adm-btn" data-adm="${kind}-edit"${attrs}>✏️ 수정</button>
      <button type="button" class="adm-btn adm-btn--del" data-adm="${kind}-del"${attrs}>🗑 삭제</button></span>`;
  };
  const matItem = (m) => {
    const t = matType(m), T = MAT_TYPES[t];
    const attrs = m.file ? ` download="${esc(m.file)}"` : ` target="_blank" rel="noopener"`;
    return `<li data-type="${t}" data-text="${esc(String(m.title + " " + (m.file || "")).toLowerCase())}"><a class="mat mat--${t}" href="${esc(matHref(m))}"${attrs}>
      <span class="mat__icon" aria-hidden="true">${T.icon}</span>
      <span class="mat__title">${esc(m.title)}${m.isNew ? ` <em class="mat__new">NEW</em>` : ""}</span>
      <span class="mat__meta">${esc(matExt(m))}${m.size ? ` · ${esc(m.size)}` : ""}</span>
      <span class="mat__go" aria-hidden="true">${m.file ? "↓" : "↗"}</span>
    </a>${admTools("mat", m._src === "lib" ? { src: "lib", id: m.id } : { src: "cfg", wk: m._wk, i: m._i }, "adm-tools--mat")}</li>`;
  };
  // 관리자가 Google Drive 주소로 등록한 자료 (participate.js가 불러와 채움) — 주차 번호별
  const extraMats = {};
  // _src: 설정 파일(cfg, 주차·순서로 찾음) / Drive 등록(lib, id로 찾음) — 관리자 수정·삭제용
  const matsOf = (w) => [
    ...(w.materials || []).map((m, i) => ({ ...m, _src: "cfg", _wk: w.no, _i: i })),
    ...(extraMats[w.no] || []).map((m) => ({ ...m, _src: "lib" })),
  ];
  const weekMatsHtml = (w) => { const all = matsOf(w); return all.length ? `<h4>수업 자료</h4><ul class="mats">${list(all, matItem)}</ul>` : ""; };

  /* ---------- 커리큘럼 아코디언 ---------- */
  const submitBtn = (w) => {
    const a = w.assignment;
    // submitUrl이 없으면 사이트의 '수강생 공간'에서 제출
    if (!a.submitUrl) return `<a class="btn btn--sm btn--primary js-submit js-goto-upload" href="#myclass" data-hw="${w.no}">과제 제출하기</a>`;
    return `<a class="btn btn--sm btn--primary js-submit" href="${esc(a.submitUrl)}" target="_blank" rel="noopener">과제 제출하기 ↗</a>`;
  };
  const weekItem = (w) => `
    <li class="card wk${w.assignment ? " wk--hw" : ""}" id="week-${w.no}" data-key="${w.key}">
      <button class="wk__head" aria-expanded="false" aria-controls="week-panel-${w.no}">
        <span class="wk__num">${esc(w.label)}</span>
        <span class="wk__title">
          <strong>${esc(w.title)}</strong>
          <small>${sessShort(w)} · ${esc(w.desc)}</small>
        </span>
        <span class="wk__badges">
          <span class="wk__status"></span>
          ${w.assignment ? `<span class="chip chip--hw">📝 과제</span>` : ""}
        </span>
        <span class="wk__chev" aria-hidden="true"></span>
      </button>
      ${admTools("week", { i: w.no - 1 }, "adm-tools--wk")}
      <div class="wk__panel" id="week-panel-${w.no}" role="region">
        <div class="wk__inner"><div class="wk__body">
          <ul class="wk__meta">
            <li><span>📅</span>${sessLong(w)}</li>
            ${list(w.off, (o) => `<li class="wk__off"><span>🌸</span>${fmtShort(o.date)} 휴강 · ${esc(o.label)}</li>`)}
            <li><span>⏰</span>${esc(w.time)}</li>
            <li><span>📍</span>${esc(w.location)}</li>
          </ul>
          <div class="wk__cols">
            <div>
              <h4>학습 내용</h4>
              <ul class="notes">${list(w.content, (c) => `<li>${esc(c)}</li>`)}</ul>
              <div class="tags">${list(w.tags, (t) => `<span class="tag">${esc(t)}</span>`)}</div>
            </div>
            <div>
              <div class="wk-mats" data-week="${w.no}">${weekMatsHtml(w)}</div>
              <h4>참고 영상</h4>
              ${w.videos && w.videos.length
                ? `<ul class="videos">${list(w.videos, (v) => `<li><a href="${esc(v.url)}" target="_blank" rel="noopener"><span class="videos__play">▶</span>${esc(v.title)}</a></li>`)}</ul>`
                : `<p class="muted">이번 주는 참고 영상이 없습니다.</p>`}
            </div>
          </div>
          ${w.assignment ? `
            <div class="hw">
              <div class="hw__top">
                <h4>📝 ${esc(w.assignment.title)}</h4>
                <span class="countdown" data-due="${w.due.getTime()}"></span>
              </div>
              <p>${esc(w.assignment.desc)}</p>
              <div class="hw__foot">
                <span class="hw__due">마감 <b>${fmtDue(w.due)}</b></span>
                ${submitBtn(w)}
              </div>
            </div>` : ""}
        </div></div>
      </div>
    </li>`;

  $("#curriculum").innerHTML = `<div class="container">${head(cu.title, cu.lead)}
    <div class="wk-toolbar">
      <span class="wk-toolbar__info">총 ${weeks.length}주 · 매주 ${daysLabel} · ${esc(cu.time)}</span>
      <button class="btn btn--sm btn--ghost js-toggle-all">모두 펼치기</button>
    </div>
    <ol class="wk-list">${list(weeks, weekItem)}</ol>

    <div class="cal-wrap">
      <h3 class="sub-title">🗓️ 월간 수업 달력</h3>
      <div class="cal-grid">
        <div class="card cal">
          <div class="cal__head">
            <button class="cal__nav js-cal-prev" aria-label="이전 달">‹</button>
            <strong class="cal__month"></strong>
            <button class="cal__nav js-cal-next" aria-label="다음 달">›</button>
          </div>
          <div class="cal__week">${DAYS.map((d) => `<span>${d}</span>`).join("")}</div>
          <div class="cal__days"></div>
          <div class="cal__legend">
            <span><i class="lg lg--class"></i>수업</span>
            <span><i class="lg lg--due"></i>과제 마감</span>
            <span><i class="lg lg--off"></i>휴강</span>
            <button class="cal__today js-cal-today">오늘</button>
          </div>
        </div>
        <div class="card cal-detail" aria-live="polite"></div>
      </div>
    </div></div>`;

  /* ---------- 수강 안내 ---------- */
  const e = C.enroll;
  $("#enroll").innerHTML = `<div class="container">${head(e.title)}
    <div class="grid grid--2">
      <article class="card">
        <h3 class="card__title">📋 기본 정보</h3>
        <dl class="info">
          ${list(e.info, (i) => `<div><dt>${esc(i.label)}</dt><dd>${esc(i.value)}</dd></div>`)}
        </dl>
      </article>
      <article class="card">
        <h3 class="card__title">📊 평가 방법</h3>
        <ul class="bars">
          ${list(e.grading, (g) => `
            <li>
              <div class="bars__label"><span>${esc(g.item)}</span><b>${esc(g.percent)}%</b></div>
              <div class="bars__track"><span style="width:${Number(g.percent) || 0}%"></span></div>
            </li>`)}
        </ul>
        <h3 class="card__title card__title--sm">📝 유의 사항</h3>
        <ul class="notes">${list(e.notes, (n) => `<li>${esc(n)}</li>`)}</ul>
      </article>
    </div></div>`;

  /* ---------- AI 도구 ---------- */
  const t = C.tools;
  $("#tools").innerHTML = `<div class="container">${head(t.title, t.lead)}
    <div class="grid grid--3">
      ${list(t.items, (it) => `
        <article class="card tool">
          <div class="tool__icon">${esc(it.icon)}</div>
          <div><h3>${esc(it.name)}</h3><p>${esc(it.use)}</p></div>
        </article>`)}
    </div></div>`;

  /* ---------- 준비물 ---------- */
  const pr = C.prepare;
  $("#prepare").innerHTML = `<div class="container">${head(pr.title, pr.lead)}
    <div class="grid grid--4">
      ${list(pr.items, (it) => `
        <article class="card card--feature">
          <div class="card__icon">${esc(it.icon)}</div>
          <h3>${esc(it.title)}</h3>
          <p>${esc(it.text)}</p>
        </article>`)}
    </div></div>`;

  /* ---------- FAQ ---------- */
  const f = C.faq;
  $("#faq").innerHTML = `<div class="container container--narrow">${head(f.title)}
    <div class="faq">
      ${list(f.items, (it) => `
        <details class="card faq__item">
          <summary><span class="faq__q">Q</span>${esc(it.q)}</summary>
          <p><span class="faq__a">A</span>${esc(it.a)}</p>
        </details>`)}
    </div></div>`;

  /* ---------- 강의 인포그래픽 ---------- */
  const IG = C.infographic;
  if (IG && $("#infographic")) {
    // 색각 이상 시뮬레이션(OKLab ΔE)과 대비 검사를 통과한 4색 — 순서 고정, 단계 순서대로 사용
    const PAL = ["#d6457c", "#2f7fd0", "#ad780c", "#5b3fb0"];
    const phases = (IG.phases || []).slice(0, 4).map((p, i) => {
      const [a, b] = String(p.weeks || "").split(/[-~–]/).map((x) => parseInt(x, 10));
      return { ...p, from: a || 1, to: b || a || 1, color: PAL[i] };
    });
    const phaseOf = (no) => phases.find((p) => no >= p.from && no <= p.to);
    const hwWeeks = weeks.filter((w) => w.assignment);
    const ns = nextSession(), nowNo = ns ? ns.week.no : null;
    const t0 = today0();

    // 주제 비중: 주차 태그를 주 단위로 센다 (topicGroups에 묶인 태그는 한 주제로)
    const groupOf = {};
    Object.entries(IG.topicGroups || {}).forEach(([g, tags]) => tags.forEach((t) => (groupOf[t] = g)));
    const tagCount = {};
    weeks.forEach((w) => new Set((w.tags || []).map((t) => groupOf[t] || t)).forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)));
    const topics = Object.entries(tagCount).sort((x, y) => y[1] - x[1]);
    const maxTopic = Math.max(1, ...topics.map((t) => t[1]));

    // 평가 비율 도넛 (세그먼트 사이 2px 간격)
    const grading = (C.enroll && C.enroll.grading) || [];
    const gTotal = grading.reduce((s, g) => s + (Number(g.percent) || 0), 0) || 1;
    const R = 60, CIRC = 2 * Math.PI * R;
    let acc = 0;
    const donut = grading.map((g, i) => {
      const len = (Number(g.percent) || 0) / gTotal * CIRC;
      const seg = `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${PAL[i % PAL.length]}" stroke-width="24"
        stroke-dasharray="${Math.max(0, len - 2)} ${CIRC - Math.max(0, len - 2)}" stroke-dashoffset="${-acc}"
        transform="rotate(-90 80 80)" class="ig-seg"><title>${esc(g.item)} ${esc(g.percent)}%</title></circle>`;
      acc += len;
      return seg;
    }).join("");

    const weekTitle = (w) => `${w.label} · ${w.sessions.map((s) => `${s.date.getMonth() + 1}/${s.date.getDate()}(${s.day})`).join("·") || "휴강"} · ${w.title}${w.assignment ? " · 과제" : ""}`;
    const sesCount = (p) => sessions.filter((s) => s.week.no >= p.from && s.week.no <= p.to).length;
    const hwIn = (p) => hwWeeks.filter((w) => w.no >= p.from && w.no <= p.to).length;

    $("#infographic").innerHTML = `<div class="container">${head(IG.title, IG.lead)}
      <div class="ig">
        <div class="ig-nums">
          ${[[weeks.length, "주", "강의 기간"], [sessions.length, "회", `수업 (매주 ${daysLabel})`], [hwWeeks.length, "개", "과제"], [((C.tools && C.tools.items) || []).length, "개", "실습 AI 도구"]]
            .map(([n, u, l]) => `<div class="card ig-num"><b>${n}<small>${u}</small></b><span>${esc(l)}</span></div>`).join("")}
        </div>

        <section class="card ig-flow" aria-label="15주 흐름">
          <div class="ig-flow__head">
            <h3>${weeks.length}주 흐름</h3>
            <span class="ig-key"><i class="ig-key__hw"></i>과제 있는 주${nowNo ? `<i class="ig-key__now"></i>다음 수업` : ""}</span>
          </div>
          <div class="ig-strip" style="--n:${weeks.length}">
            <div class="ig-bands" aria-hidden="true">
              ${list(phases, (p) => `<span style="grid-column:${p.from} / ${p.to + 1};--c:${p.color}">${esc(p.name)}</span>`)}
            </div>
            <ol class="ig-weeks">
              ${list(weeks, (w) => {
                const p = phaseOf(w.no);
                const cls = ["ig-wk", w.assignment ? "is-hw" : "", w.no === nowNo ? "is-now" : "", w.last < t0 ? "is-past" : ""].filter(Boolean).join(" ");
                return `<li class="${cls}" style="--c:${p ? p.color : "#b9aec4"}" title="${esc(weekTitle(w))}"><span>${w.no}</span></li>`;
              })}
            </ol>
          </div>
          <div class="ig-phases">
            ${list(phases, (p) => `
              <article class="ig-phase" style="--c:${p.color}">
                <span class="ig-phase__sw" aria-hidden="true"></span>
                <div>
                  <h4>${esc(p.name)}</h4>
                  <p class="ig-phase__meta">${p.from === p.to ? `${p.from}주` : `${p.from}–${p.to}주`} · 수업 ${sesCount(p)}회${hwIn(p) ? ` · 과제 ${hwIn(p)}개` : ""}</p>
                  <p>${esc(p.text)}</p>
                </div>
              </article>`)}
          </div>
        </section>

        <div class="ig-charts">
          <section class="card ig-chart" aria-label="주제 비중">
            <h3>주제 비중 <small>주차 태그 기준</small></h3>
            <ul class="ig-bars">
              ${list(topics, ([t, n]) => `
                <li title="${esc(t)}: ${n}개 주차">
                  <span class="ig-bars__label">${esc(t)}</span>
                  <span class="ig-bars__track"><span style="width:${(n / maxTopic) * 100}%"></span></span>
                  <span class="ig-bars__val">${n}주</span>
                </li>`)}
            </ul>
          </section>
          <section class="card ig-chart" aria-label="평가 비율">
            <h3>평가 비율</h3>
            <div class="ig-donut">
              <svg viewBox="0 0 160 160" role="img" aria-label="평가 비율 도넛 차트">
                <circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--pink-100)" stroke-width="24" />
                ${donut}
                <text x="80" y="76" text-anchor="middle" class="ig-donut__big">${gTotal}%</text>
                <text x="80" y="96" text-anchor="middle" class="ig-donut__small">${grading.length}개 영역</text>
              </svg>
              <ul class="ig-legend">
                ${list(grading, (g, i) => `<li><i style="background:${PAL[i % PAL.length]}"></i><span>${esc(g.item)}</span><b>${esc(g.percent)}%</b></li>`)}
              </ul>
            </div>
          </section>
        </div>

        ${IG.outcomes && IG.outcomes.length ? `
        <section class="card ig-out" aria-label="학습 성과">
          <h3>이 강의를 마치면</h3>
          <ul>${list(IG.outcomes, (o) => `<li><span aria-hidden="true">✓</span>${esc(o)}</li>`)}</ul>
        </section>` : ""}
      </div></div>`;
  }

  /* ---------- 교수자 푸터 ---------- */
  const p = C.instructor;
  const avatar = p.photo
    ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}" />`
    : `<span>${esc((p.name || "?").trim().charAt(0))}</span>`;
  $("#instructor").innerHTML = `
    <div class="container footer__inner">
      <div class="profile">
        <div class="profile__avatar">${avatar}</div>
        <div class="profile__body">
          <p class="footer__eyebrow">교수자 소개</p>
          <h3>${esc(p.name)} ${p.nameJa ? `<small>${esc(p.nameJa)}</small>` : ""}</h3>
          <p class="profile__pos">${esc(p.position)}</p>
          <p class="profile__bio">${br(p.bio)}</p>
          <div class="tags">${list(p.fields, (x) => `<span class="tag">${esc(x)}</span>`)}</div>
        </div>
      </div>
      <ul class="contacts">
        ${list(p.contacts, (c) => `
          <li><span class="contacts__icon">${esc(c.icon)}</span>
            <div><small>${esc(c.label)}</small>${
              /@/.test(c.value) ? `<a href="mailto:${esc(c.value)}">${esc(c.value)}</a>` : `<span>${esc(c.value)}</span>`
            }</div></li>`)}
      </ul>
    </div>
    <p class="footer__copy">${esc(p.copyright)}</p>`;

  /* ---------- 수업 자료실 ---------- */
  const roomEl = $("#materials");
  let renderRoom = () => {};
  if (roomEl) {
    let mrType = "", mrQ = "";
    renderRoom = () => {
      const withMats = weeks.filter((w) => matsOf(w).length);
      const noMats = weeks.filter((w) => !matsOf(w).length).map((w) => w.no);
      const allMats = withMats.flatMap(matsOf);
      const typeCount = {};
      allMats.forEach((m) => (typeCount[matType(m)] = (typeCount[matType(m)] || 0) + 1));
      if (mrType && !typeCount[mrType]) mrType = "";
      const nxW = nextWeek();
      roomEl.innerHTML = `<div class="container">${head(MR.title || "수업 자료실", MR.lead)}
        <div class="mr-tools">
          <div class="mr-filters" role="group" aria-label="자료 종류">
            <button class="${mrType ? "" : "is-on"}" data-type="">전체 <b>${allMats.length}</b></button>
            ${Object.keys(MAT_TYPES).filter((t) => typeCount[t]).map((t) => `<button class="${mrType === t ? "is-on" : ""}" data-type="${t}">${MAT_TYPES[t].label} <b>${typeCount[t]}</b></button>`).join("")}
          </div>
          <input class="mr-search" type="search" placeholder="자료 검색 (예: 읽기, 話す)" aria-label="자료 검색" value="${esc(mrQ)}" />
        </div>
        <div class="mr-grid">
          ${list(withMats, (w) => {
            const isNext = nxW && nxW.no === w.no, past = w.last < today0();
            return `<article class="card mr-week${isNext ? " is-next" : ""}${past ? " is-past" : ""}" data-text="${esc((w.label + " " + w.title + " " + w.desc).toLowerCase())}">
              <header class="mr-week__head">
                <span class="wk__num">${esc(w.label)}</span>
                <div class="mr-week__title"><h3>${esc(w.title)}</h3><small>${sessShort(w)}</small></div>
                ${isNext ? `<span class="chip chip--today">다음 수업</span>` : ""}
              </header>
              <ul class="mats">${list(matsOf(w), matItem)}</ul>
              <button class="link-btn js-open-week" data-no="${w.no}">${esc(w.label)} 수업 내용 보기 →</button>
            </article>`;
          })}
        </div>
        <p class="mr-empty" hidden>찾는 자료가 없습니다. 다른 낱말로 검색해 보세요.</p>
        ${noMats.length ? `<p class="mr-note">자료가 아직 없는 주: ${noMats.join("·")}주 — 수업 중에 배포하거나 추후 올립니다.</p>` : ""}
      </div>`;
      applyFilter();
    };
    const applyFilter = () => {
      let shown = 0;
      roomEl.querySelectorAll(".mr-week").forEach((card) => {
        const weekHit = !mrQ || card.dataset.text.includes(mrQ);
        let n = 0;
        card.querySelectorAll(".mats li").forEach((li) => {
          const ok = (!mrType || li.dataset.type === mrType) && (weekHit || li.dataset.text.includes(mrQ));
          li.hidden = !ok; if (ok) n++;
        });
        card.hidden = !n; shown += n;
      });
      roomEl.querySelector(".mr-empty").hidden = shown > 0;
    };
    roomEl.addEventListener("click", (e) => {
      const ow = e.target.closest(".js-open-week");
      if (ow) { openWeek(Number(ow.dataset.no)); return; }
      const b = e.target.closest(".mr-filters button"); if (!b) return;
      mrType = b.dataset.type;
      roomEl.querySelectorAll(".mr-filters button").forEach((x) => x.classList.toggle("is-on", x === b));
      applyFilter();
    });
    roomEl.addEventListener("input", (e) => { if (e.target.matches(".mr-search")) { mrQ = e.target.value.trim().toLowerCase(); applyFilter(); } });
    renderRoom();
  }
  // 관리자가 등록한 자료를 받아 커리큘럼·자료실에 반영
  const setExtraMaterials = (items) => {
    Object.keys(extraMats).forEach((k) => delete extraMats[k]);
    const recent = Date.now() - 7 * 864e5;
    (items || []).forEach((m) => {
      const no = Number(m.week);
      if (!weeks.some((w) => w.no === no) || !m.title || !m.url) return;
      (extraMats[no] = extraMats[no] || []).push({ ...m, isNew: m.date && parseDay(m.date).getTime() >= recent });
    });
    document.querySelectorAll(".wk-mats").forEach((el) => {
      const w = weeks.find((x) => x.no === Number(el.dataset.week));
      if (w) el.innerHTML = weekMatsHtml(w);
    });
    renderRoom();
  };

  /* ---------- 아코디언 동작 ---------- */
  const wkItems = [...document.querySelectorAll(".wk")];
  const toggleAllBtn = $(".js-toggle-all");
  const setOpen = (li, open) => {
    li.classList.toggle("is-open", open);
    li.querySelector(".wk__head").setAttribute("aria-expanded", String(open));
  };
  const syncToggleAll = () => {
    toggleAllBtn.textContent = wkItems.every((li) => li.classList.contains("is-open")) ? "모두 접기" : "모두 펼치기";
  };
  $(".wk-list").addEventListener("click", (ev) => {
    const btn = ev.target.closest(".wk__head");
    if (!btn) return;
    const li = btn.closest(".wk");
    setOpen(li, !li.classList.contains("is-open"));
    syncToggleAll();
  });
  toggleAllBtn.addEventListener("click", () => {
    const open = !wkItems.every((li) => li.classList.contains("is-open"));
    wkItems.forEach((li) => setOpen(li, open));
    syncToggleAll();
  });
  const openWeek = (no) => {
    const li = document.getElementById(`week-${no}`);
    if (!li) return;
    setOpen(li, true); syncToggleAll();
    li.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
    li.classList.add("is-flash"); setTimeout(() => li.classList.remove("is-flash"), 1600);
  };

  /* ---------- 지난/오늘/다음 수업 표시 + 마감 카운트다운 ---------- */
  const updateTimes = () => {
    const now = new Date(), t0 = today0(), nx = nextWeek();
    wkItems.forEach((li, i) => {
      const w = weeks[i], s = li.querySelector(".wk__status");
      const todayS = w.sessions.find((x) => sameDay(x.date, now));
      const past = w.last < t0;
      let txt = "", cls = "";
      if (todayS) { txt = `오늘(${todayS.day}) 수업`; cls = "chip--today"; }
      else if (nx && nx.no === w.no) { txt = "다음 수업"; cls = "chip--next"; }
      else if (past) { txt = "지난 수업"; cls = "chip--past"; }
      s.className = `wk__status${txt ? ` chip ${cls}` : ""}`;
      s.textContent = txt;
      li.classList.toggle("wk--past", past);
    });
    document.querySelectorAll(".countdown").forEach((el) => {
      const diff = Number(el.dataset.due) - now.getTime();
      const hw = el.closest(".hw");
      let txt, cls;
      if (diff <= 0) { txt = "마감됨"; cls = "is-closed"; }
      else {
        const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5), m = Math.floor((diff % 36e5) / 6e4);
        txt = d >= 1 ? `D-${d} · ${d}일 ${h}시간 남음` : `⏳ ${h}시간 ${m}분 남음`;
        cls = d < 1 ? "is-urgent" : d < 3 ? "is-soon" : "";
      }
      el.textContent = txt;
      el.className = `countdown ${cls}`;
      if (diff <= 0 && hw) {
        hw.classList.add("hw--closed");
        const b = hw.querySelector(".js-submit");
        const late = C.myclass && C.myclass.upload && C.myclass.upload.allowLate;
        if (b && b.classList.contains("js-goto-upload") && late) b.textContent = "지각 제출하기";
        else if (b) b.outerHTML = `<span class="btn btn--sm btn--disabled" aria-disabled="true">제출 마감</span>`;
      }
    });
  };
  updateTimes();
  setInterval(updateTimes, 30000);

  /* ---------- 월간 달력 ---------- */
  const calDays = $(".cal__days"), calMonth = $(".cal__month"), calDetail = $(".cal-detail");
  const startPick = nextSession() || sessions[sessions.length - 1];
  let selected = startPick ? new Date(startPick.date) : today0();
  let view = new Date(selected.getFullYear(), selected.getMonth(), 1);

  const renderCal = () => {
    calMonth.textContent = `${view.getFullYear()}년 ${view.getMonth() + 1}월`;
    const first = new Date(view);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const last = new Date(view.getFullYear(), view.getMonth() + 1, 0);
    const cells = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;
    const t0 = today0();
    let html = "";
    for (let i = 0; i < cells; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = keyOf(d), w = byDate[k], dues = dueByDate[k], off = holidays[k];
      const cls = ["cal__day"];
      if (d.getMonth() !== view.getMonth()) cls.push("is-other");
      if (d.getDay() === 0) cls.push("is-sun");
      if (d.getDay() === 6) cls.push("is-sat");
      if (w) cls.push("is-class");
      if (off) cls.push("is-off");
      if (sameDay(d, t0)) cls.push("is-today");
      if (sameDay(d, selected)) cls.push("is-selected");
      const label = [fmtShort(d), w ? `${w.label} 수업` : "", dues ? "과제 마감" : "", off || ""].filter(Boolean).join(", ");
      html += `<button class="${cls.join(" ")}" data-key="${k}" aria-label="${esc(label)}">
        <span class="cal__n">${d.getDate()}</span>
        ${w ? `<span class="cal__tag">${esc(w.label)}</span>` : ""}
        ${off ? `<span class="cal__tag cal__tag--off">휴강</span>` : ""}
        ${dues ? `<i class="cal__dot" title="과제 마감"></i>` : ""}
      </button>`;
    }
    calDays.innerHTML = html;
  };

  const renderDetail = () => {
    const k = keyOf(selected), w = byDate[k], dues = dueByDate[k], off = holidays[k];
    let html = `<p class="cal-detail__date">${fmtDate(selected)}</p>`;
    if (w) {
      html += `
        <span class="chip chip--next">${esc(w.label)} ${esc(DAYS[selected.getDay()])}요일 수업</span>
        <h3 class="cal-detail__title">${esc(w.title)}</h3>
        <ul class="wk__meta wk__meta--stack">
          <li><span>📅</span>이번 주 수업 ${sessShort(w)}</li>
          <li><span>⏰</span>${esc(w.time)}</li>
          <li><span>📍</span>${esc(w.location)}</li>
        </ul>
        <h4>학습 내용</h4>
        <ul class="notes">${list(w.content, (c) => `<li>${esc(c)}</li>`)}</ul>
        ${w.assignment ? `<p class="cal-detail__hw">📝 과제: <b>${esc(w.assignment.title)}</b><br /><small>마감 ${fmtDue(w.due)}</small></p>` : ""}
        <button class="btn btn--sm btn--primary js-open-week" data-no="${w.no}">커리큘럼에서 자세히 보기</button>`;
    } else if (off) {
      html += `<div class="cal-detail__empty"><span>🌸</span><p><b>${esc(off)}</b><br />이 날은 수업이 없습니다.</p></div>`;
    } else if (!dues) {
      const nx = sessions.find((x) => x.date > selected);
      html += `<div class="cal-detail__empty"><span>☕</span><p>이 날은 수업이 없습니다.${
        nx ? `<br /><small>다음 수업: ${fmtShort(nx.date)} · ${esc(nx.week.title)}</small>` : ""}</p></div>`;
    }
    if (dues) {
      html += list(dues, (d) => `
        <div class="cal-detail__due">
          <b>⏰ 과제 마감 ${pad(d.due.getHours())}:${pad(d.due.getMinutes())}</b>
          <p>${esc(d.assignment.title)} <small>(${esc(d.label)})</small></p>
          <button class="link-btn js-open-week" data-no="${d.no}">과제 보러 가기 →</button>
        </div>`);
    }
    calDetail.innerHTML = html;
  };

  calDays.addEventListener("click", (ev) => {
    const b = ev.target.closest(".cal__day");
    if (!b) return;
    selected = parseDay(b.dataset.key);
    if (selected.getMonth() !== view.getMonth()) view = new Date(selected.getFullYear(), selected.getMonth(), 1);
    renderCal(); renderDetail();
  });
  $(".js-cal-prev").addEventListener("click", () => { view.setMonth(view.getMonth() - 1); renderCal(); });
  $(".js-cal-next").addEventListener("click", () => { view.setMonth(view.getMonth() + 1); renderCal(); });
  $(".js-cal-today").addEventListener("click", () => {
    selected = today0(); view = new Date(selected.getFullYear(), selected.getMonth(), 1);
    renderCal(); renderDetail();
  });
  calDetail.addEventListener("click", (ev) => {
    const b = ev.target.closest(".js-open-week");
    if (b) openWeek(Number(b.dataset.no));
  });
  renderCal(); renderDetail();

  /* ---------- 모바일 메뉴 ---------- */
  const header = $(".header");
  const toggle = $(".menu-toggle");
  const closeMenu = () => { header.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); };
  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $("#nav").addEventListener("click", (ev) => { if (ev.target.closest("a")) closeMenu(); });

  /* ---------- 스크롤: 헤더 그림자 · 맨 위로 버튼 ---------- */
  const toTop = $(".to-top");
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 10);
    toTop.classList.toggle("is-visible", y > 500);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* ---------- 현재 위치 메뉴 강조 ---------- */
  const links = document.querySelectorAll("#nav a");
  const setActive = (id) => links.forEach((l) => l.classList.toggle("is-active", l.dataset.id === id));
  // 맨 아래(푸터)에 닿으면 마지막 메뉴를 강조
  const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  const io = new IntersectionObserver((entries) => {
    if (atBottom()) return setActive(C.nav[C.nav.length - 1].id);
    entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); });
  }, { rootMargin: "-45% 0px -50% 0px" });
  C.nav.forEach((n) => { const s = document.getElementById(n.id); if (s) io.observe(s); });
  window.addEventListener("scroll", () => { if (atBottom()) setActive(C.nav[C.nav.length - 1].id); }, { passive: true });

  /* ---------- 숫자 카운트 애니메이션 ---------- */
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const counters = document.querySelectorAll(".count");
  const runCount = (el) => {
    const to = Number(el.dataset.to);
    if (reduce) { el.textContent = to; return; }
    const start = performance.now(), dur = 1400;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { runCount(en.target); cio.unobserve(en.target); } });
  }, { threshold: 0.6 });
  counters.forEach((c) => cio.observe(c));

  /* ---------- 장점 슬라이드 ---------- */
  const track = $(".slider__track");
  const slides = track.querySelectorAll(".slide");
  const dotsBox = $(".slider__dots");
  const prev = $(".slider__btn--prev"), next = $(".slider__btn--next");
  const perView = () => Math.max(1, Math.round(track.clientWidth / slides[0].offsetWidth));
  const pages = () => Math.max(1, slides.length - perView() + 1);
  const current = () => Math.round(track.scrollLeft / (slides[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0)));
  const go = (i) => {
    const n = (i + pages()) % pages();
    track.scrollTo({ left: slides[n].offsetLeft - slides[0].offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };
  const renderDots = () => {
    dotsBox.innerHTML = Array.from({ length: pages() }, (_, i) => `<button aria-label="${i + 1}번째 슬라이드" data-i="${i}"></button>`).join("");
    updateDots();
  };
  const updateDots = () => {
    const c = Math.min(current(), pages() - 1);
    dotsBox.querySelectorAll("button").forEach((d, i) => d.classList.toggle("is-active", i === c));
  };
  prev.addEventListener("click", () => go(current() - 1));
  next.addEventListener("click", () => go(current() + 1));
  dotsBox.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (b) go(Number(b.dataset.i)); });
  track.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowLeft") { ev.preventDefault(); go(current() - 1); }
    if (ev.key === "ArrowRight") { ev.preventDefault(); go(current() + 1); }
  });
  let scrollT;
  track.addEventListener("scroll", () => { clearTimeout(scrollT); scrollT = setTimeout(updateDots, 80); }, { passive: true });
  window.addEventListener("resize", renderDots);
  renderDots();

  // 자동 넘김 (마우스를 올리거나 터치하면 잠시 멈춤)
  let paused = false;
  const slider = $(".slider");
  ["mouseenter", "touchstart", "focusin"].forEach((ev) => slider.addEventListener(ev, () => (paused = true), { passive: true }));
  ["mouseleave", "focusout"].forEach((ev) => slider.addEventListener(ev, () => (paused = false)));
  if (!reduce) setInterval(() => { if (!paused && !document.hidden) go(current() + 1); }, 5000);

  /* ---------- participate.js에서 함께 쓰는 도구 ---------- */
  window.SITE = { C, $, esc, br, list, head, admTools, weeks, sessions, nextSession, daysLabel, holidays, parseDrive, setExtraMaterials, MAT_TYPES, keyOf, parseDay, parseDateTime, fmtDate, fmtShort, fmtDue, sameDay, today0, reduceMotion };

  /* ---------- 벚꽃잎 ---------- */
  if (!reduce) {
    const box = $(".petals");
    const count = window.innerWidth < 640 ? 8 : 16;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("i");
      el.style.left = Math.random() * 100 + "vw";
      el.style.animationDuration = 10 + Math.random() * 10 + "s";
      el.style.animationDelay = -Math.random() * 20 + "s";
      el.style.setProperty("--s", (0.6 + Math.random() * 0.7).toFixed(2));
      box.appendChild(el);
    }
  }
})();

/* 수강생 참여 기능: 실시간 투표 · 수강 신청서 · 로그인/출석/과제 제출 · 안내 팝업 · 첫 방문 폭죽
 * 내용 수정은 config.js에서 하세요. */
(function () {
  const S = window.SITE;
  const { C, $, esc, list, head, weeks, sessions, keyOf, fmtDate, fmtShort, fmtDue, sameDay, today0, reduceMotion } = S;
  const pad = (n) => String(n).padStart(2, "0");

  /* =========================================================
   *  저장소 도우미 (브라우저 저장이 막혀 있어도 사이트는 동작)
   * ========================================================= */
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const clientId = store.get("kj_client", null) || (() => { const id = uid(); store.set("kj_client", id); return id; })();
  const nowStr = () => { const d = new Date(); return `${keyOf(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  /* =========================================================
   *  API: backend.url이 있으면 Google Apps Script, 없으면 체험 모드
   * ========================================================= */
  const B = C.backend || {};
  const REMOTE = !!(B.url && B.url.trim());
  let session = store.get("kj_session", null);

  // 수업 시간 "15:00 ~ 16:15" → 그날 수업(session)의 출석 가능 시작/끝 Date
  const classWindow = (ses) => {
    const m = String(ses.week.time || "").match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/);
    const s = new Date(ses.date), e = new Date(ses.date);
    if (m) { s.setHours(+m[1], +m[2], 0, 0); e.setHours(+m[3], +m[4], 0, 0); } else { s.setHours(0, 0, 0, 0); e.setHours(23, 59, 0, 0); }
    s.setMinutes(s.getMinutes() - ((C.myclass.attendance || {}).openBeforeMinutes || 0));
    return { start: s, end: e };
  };
  const todaysSession = () => sessions.find((s) => sameDay(s.date, new Date()));

  const demo = {
    db() { return { votes: {}, applications: [], attendance: [], submissions: [], students: [], notices: [], materials: [], portfolio: [], ...store.get("kj_demo_db", {}) }; },
    save(db) { store.set("kj_demo_db", db); },
    me() { if (!session) throw new Error("로그인이 필요합니다."); return session; },
    "poll.get"() {
      const db = this.db(), counts = {};
      C.poll.options.forEach((o) => (counts[o.id] = 0));
      Object.values(db.votes).forEach((v) => { if (v in counts) counts[v]++; });
      return { counts, mine: db.votes[clientId] || null };
    },
    "poll.vote"({ option }) { const db = this.db(); db.votes[clientId] = option; this.save(db); return this["poll.get"](); },
    "apply.submit"({ form }) {
      const db = this.db();
      if (db.applications.some((a) => a.sid === form.sid)) throw new Error("이미 신청서를 제출한 학번입니다.");
      db.applications.push({ ...form, submittedAt: nowStr() }); this.save(db); return { ok: true };
    },
    "auth.login"({ id, code }) {
      // 관리자 화면에서 등록한 명단 + 체험용 테스트 계정
      const accounts = [...this.db().students, ...(C.myclass.demoAccounts || [])];
      const acc = accounts.find((a) => String(a.id) === id && String(a.code) === String(code));
      if (!acc) throw new Error("학번 또는 인증코드가 올바르지 않습니다.");
      return { token: uid(), id: acc.id, name: acc.name };
    },
    "attendance.list"() { const me = this.me(); return this.db().attendance.filter((a) => a.id === me.id); },
    "attendance.check"({ code }) {
      const me = this.me(), ts = todaysSession(), now = new Date();
      if (!ts) throw new Error("오늘은 수업일이 아닙니다.");
      const win = classWindow(ts);
      if (now < win.start || now > win.end) throw new Error("지금은 출석 가능 시간이 아닙니다.");
      const att = C.myclass.attendance || {};
      if (att.requireCode && String(code || "").trim().toUpperCase() !== String(att.demoCode || "").toUpperCase()) throw new Error("출석 코드가 올바르지 않습니다.");
      const db = this.db();
      if (db.attendance.some((a) => a.id === me.id && a.date === keyOf(now))) throw new Error("이미 출석했습니다.");
      const rec = { id: me.id, name: me.name, date: keyOf(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}` };
      db.attendance.push(rec); this.save(db); return rec;
    },
    "submit.upload"(p) {
      const me = this.me(), db = this.db();
      // 체험 모드는 파일 자체가 아니라 파일 정보만 기록합니다
      const rec = { id: me.id, name: me.name, hw: p.hw, hwTitle: p.hwTitle, fileName: p.name, size: p.size, late: p.late, at: nowStr(), url: "" };
      db.submissions.push(rec); this.save(db); return rec;
    },
    "submit.list"() { const me = this.me(); return this.db().submissions.filter((s) => s.id === me.id); },
    "notices.list"() { return this.db().notices; },
    "library.list"() { const db = this.db(); return { materials: db.materials, portfolio: db.portfolio }; },
    "admin.library.add"({ kind, item }) {
      const db = this.db(), key = kind === "portfolio" ? "portfolio" : "materials";
      const rec = { id: uid(), date: keyOf(new Date()), ...item };
      db[key].push(rec); this.save(db); return rec;
    },
    "admin.library.update"({ kind, id, item }) {
      const db = this.db(), key = kind === "portfolio" ? "portfolio" : "materials";
      const rec = db[key].find((x) => x.id === id);
      if (!rec) throw new Error("항목을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.");
      Object.assign(rec, item, { id: rec.id, date: rec.date }); this.save(db); return rec;
    },
    "admin.library.delete"({ kind, id }) {
      const db = this.db(), key = kind === "portfolio" ? "portfolio" : "materials";
      db[key] = db[key].filter((x) => x.id !== id); this.save(db); return { ok: true };
    },

    /* --- 관리자용 (체험 모드: 이 브라우저의 데이터) --- */
    "admin.login"() { return { adminToken: "demo" }; },
    "admin.data"() {
      const db = this.db();
      return { students: db.students, applications: db.applications, attendance: db.attendance, submissions: db.submissions, votes: this["poll.get"]().counts, notices: db.notices };
    },
    "admin.students.save"({ students }) { const db = this.db(); db.students = students; this.save(db); return { count: students.length }; },
    "admin.notice.add"({ notice }) {
      const db = this.db();
      const n = { id: uid(), date: keyOf(new Date()), ...notice };
      db.notices.push(n); this.save(db); return n;
    },
    "admin.notice.delete"({ id }) { const db = this.db(); db.notices = db.notices.filter((n) => n.id !== id); this.save(db); return { ok: true }; },
  };

  const api = async (action, payload = {}) => {
    if (!REMOTE) {
      await new Promise((r) => setTimeout(r, 250)); // 실제 전송처럼 잠깐 대기
      return demo[action](payload);
    }
    const res = await fetch(B.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // 사전 요청(CORS preflight) 없이 전송
      body: JSON.stringify({ action, clientId, token: session && session.token, ...payload }),
    });
    const j = await res.json();
    if (!j.ok) {
      if (/로그인/.test(j.error || "")) setSession(null);
      throw new Error(j.error || "요청을 처리하지 못했습니다.");
    }
    return j.data;
  };

  /* =========================================================
   *  공용 UI: 토스트 · 모달
   * ========================================================= */
  const toastBox = document.createElement("div");
  toastBox.className = "toasts"; toastBox.setAttribute("aria-live", "polite");
  document.body.appendChild(toastBox);
  const toast = (msg, type = "ok") => {
    const el = document.createElement("div");
    el.className = `toast toast--${type}`; el.textContent = msg;
    toastBox.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-in"));
    setTimeout(() => { el.classList.remove("is-in"); setTimeout(() => el.remove(), 300); }, 3200);
  };

  let lastFocus = null;
  const openModal = (html, cls = "") => {
    closeModal();
    lastFocus = document.activeElement;
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = `<div class="modal__backdrop" data-close></div>
      <div class="modal__box ${cls}" role="dialog" aria-modal="true">
        <button class="modal__x" data-close aria-label="닫기">×</button>${html}</div>`;
    document.body.appendChild(wrap);
    document.body.classList.add("no-scroll");
    requestAnimationFrame(() => wrap.classList.add("is-in"));
    wrap.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
    const f = wrap.querySelector(".modal__box a, .modal__box button:not(.modal__x), .modal__box input");
    (f || wrap.querySelector(".modal__x")).focus();
    return wrap;
  };
  function closeModal() {
    const m = document.querySelector(".modal");
    if (!m) return;
    m.classList.remove("is-in");
    document.body.classList.remove("no-scroll");
    setTimeout(() => m.remove(), 250);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  const modeNote = REMOTE ? "" : `<p class="demo-note">🧪 체험 모드 — 입력한 내용은 이 브라우저에만 저장됩니다.</p>`;

  /* =========================================================
   *  0) 공지사항 (설정 파일의 공지 + 관리자가 올린 공지)
   * ========================================================= */
  const noticeBox = $("#notice");
  const renderNotices = (extra) => {
    const all = [...(C.notices || []), ...(extra || [])]
      .filter((n) => n && n.title)
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.date).localeCompare(String(a.date)));
    noticeBox.hidden = !all.length;
    if (!all.length) return;
    const SHOW = 3;
    noticeBox.innerHTML = `<div class="container container--narrow">
      <div class="card notice">
        <div class="notice__head"><h2>📢 공지사항</h2><span class="chip chip--next">${all.length}건</span></div>
        <ul class="notice__list">
          ${list(all, (n, i) => `
            <li${i >= SHOW ? " hidden" : ""}>
              <details>
                <summary>${n.pinned ? `<span class="chip chip--today">중요</span>` : ""}<b>${esc(n.title)}</b><small>${esc(n.date || "")}</small></summary>
                <p>${S.br(n.text || "")}</p>
              </details>
            </li>`)}
        </ul>
        ${all.length > SHOW ? `<button class="link-btn notice__more">공지 ${all.length - SHOW}건 더 보기 ↓</button>` : ""}
      </div></div>`;
    const more = noticeBox.querySelector(".notice__more");
    if (more) more.addEventListener("click", () => { noticeBox.querySelectorAll("li[hidden]").forEach((li) => (li.hidden = false)); more.remove(); });
    const first = noticeBox.querySelector("details");
    if (first) first.open = true;
  };
  const loadNotices = () => api("notices.list").then(renderNotices).catch(() => renderNotices([]));
  renderNotices([]);
  loadNotices();

  /* =========================================================
   *  0-2) 자료실 추가 자료 · 학생 포트폴리오 (Google Drive 링크)
   * ========================================================= */
  const PF = C.portfolio || {};
  const pfBox = $("#portfolio");
  let pfCat = "";
  const renderPortfolio = (extra) => {
    if (!pfBox) return;
    // _src: 설정 파일(cfg, 순서로 찾음) / Drive 등록(lib, id로 찾음) — 관리자 수정·삭제용
    const items = [...(PF.items || []).map((x, i) => ({ ...x, _src: "cfg", _i: i })), ...(extra || []).map((x) => ({ ...x, _src: "lib" }))]
      .filter((x) => x && x.title && x.url)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const cats = [...new Set(items.map((x) => x.category).filter(Boolean))];
    if (pfCat && !cats.includes(pfCat)) pfCat = "";
    const card = (x) => {
      const d = S.parseDrive(x.url);
      const href = d ? d.view : x.url;
      const thumb = d && d.thumb && x.thumb !== false ? d.thumb : "";
      return `<article class="card pf-card" data-cat="${esc(x.category || "")}">
        <a class="pf-card__media" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${esc(x.title)} 원본 보기">
          <span class="pf-card__ph" aria-hidden="true">${esc((x.category || "작품").slice(0, 2))}</span>
          ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />` : ""}
        </a>
        <div class="pf-card__body">
          ${x.category ? `<span class="chip chip--next">${esc(x.category)}</span>` : ""}
          <h3>${esc(x.title)}</h3>
          <p class="pf-card__by">${esc(x.author || "")}${x.term ? ` · ${esc(x.term)}` : ""}</p>
          ${x.desc ? `<p class="pf-card__desc">${esc(x.desc)}</p>` : ""}
          <a class="btn btn--sm btn--ghost" href="${esc(href)}" target="_blank" rel="noopener">작품 보기 ↗</a>
          ${S.admTools("pf", x._src === "lib" ? { src: "lib", id: x.id } : { src: "cfg", i: x._i }, "adm-tools--pf")}
        </div>
      </article>`;
    };
    pfBox.innerHTML = `<div class="container">${head(PF.title || "학생 포트폴리오", PF.lead)}
      ${items.length ? `
        ${cats.length > 1 ? `<div class="mr-filters pf-filters" role="group" aria-label="분류">
          <button class="${pfCat ? "" : "is-on"}" data-cat="">전체 <b>${items.length}</b></button>
          ${cats.map((c) => `<button class="${pfCat === c ? "is-on" : ""}" data-cat="${esc(c)}">${esc(c)} <b>${items.filter((x) => x.category === c).length}</b></button>`).join("")}
        </div>` : ""}
        <div class="pf-grid">${list(items, card)}</div>`
      : `<div class="card pf-empty"><span aria-hidden="true">🏆</span><div><h3>우수 과제물을 준비하고 있습니다</h3><p>모의수업, 교수학습과정안, 직접 만든 교재 가운데 공개 동의를 받은 작품을 이곳에 소개합니다.</p></div></div>`}
    </div>`;
    pfBox.querySelectorAll(".pf-card").forEach((c) => (c.hidden = !!pfCat && c.dataset.cat !== pfCat));
  };
  if (pfBox) pfBox.addEventListener("click", (e) => {
    const b = e.target.closest(".pf-filters button"); if (!b) return;
    pfCat = b.dataset.cat;
    pfBox.querySelectorAll(".pf-filters button").forEach((x) => x.classList.toggle("is-on", x === b));
    pfBox.querySelectorAll(".pf-card").forEach((c) => (c.hidden = !!pfCat && c.dataset.cat !== pfCat));
  });
  const loadLibrary = () => api("library.list").then((d) => {
    S.setExtraMaterials((d && d.materials) || []);
    renderPortfolio((d && d.portfolio) || []);
  }).catch(() => renderPortfolio([]));
  renderPortfolio([]);
  loadLibrary();

  /* =========================================================
   *  1) 실시간 투표
   * ========================================================= */
  const P = C.poll;
  $("#poll").innerHTML = `<div class="container container--narrow">${head(P.title, P.lead)}
    <div class="card poll">
      <div class="poll__top">
        <h3>${esc(P.question)}</h3>
        <span class="live"><i></i>LIVE</span>
      </div>
      <ul class="poll__list">
        ${list(P.options, (o) => `
          <li>
            <button class="poll__opt" data-id="${esc(o.id)}" aria-pressed="false">
              <span class="poll__label"><span class="poll__icon">${esc(o.icon)}</span>${esc(o.label)}<em class="poll__mine">내 선택</em></span>
              <span class="poll__val"><b>0</b>%<small>(0표)</small></span>
              <span class="poll__bar"><span></span></span>
            </button>
          </li>`)}
      </ul>
      <div class="poll__foot"><span class="poll__total">총 0명 참여</span><span class="poll__updated"></span></div>
      ${modeNote}
    </div></div>`;

  const renderPoll = (d) => {
    const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...Object.values(d.counts));
    document.querySelectorAll(".poll__opt").forEach((btn) => {
      const n = d.counts[btn.dataset.id] || 0, pct = total ? Math.round((n / total) * 100) : 0;
      btn.querySelector(".poll__val b").textContent = pct;
      btn.querySelector(".poll__val small").textContent = `(${n}표)`;
      btn.querySelector(".poll__bar span").style.width = (total ? (n / total) * 100 : 0) + "%";
      btn.classList.toggle("is-top", n === max && n > 0);
      const mine = d.mine === btn.dataset.id;
      btn.classList.toggle("is-mine", mine);
      btn.setAttribute("aria-pressed", String(mine));
    });
    $(".poll").classList.toggle("has-voted", !!d.mine);
    $(".poll__total").textContent = `총 ${total}명 참여`;
    const t = new Date();
    $(".poll__updated").textContent = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())} 기준`;
  };
  const loadPoll = () => api("poll.get").then(renderPoll).catch(() => {});
  $(".poll__list").addEventListener("click", async (e) => {
    const btn = e.target.closest(".poll__opt");
    if (!btn || btn.disabled) return;
    if (btn.classList.contains("is-mine")) return;
    document.querySelectorAll(".poll__opt").forEach((b) => (b.disabled = true));
    try {
      const d = await api("poll.vote", { option: btn.dataset.id });
      renderPoll(d);
      toast("투표가 반영되었습니다 🗳️");
    } catch (err) { toast(err.message, "err"); }
    document.querySelectorAll(".poll__opt").forEach((b) => (b.disabled = false));
  });
  loadPoll();
  // 실시간 갱신: 원격은 주기적으로, 체험 모드는 다른 탭의 변경을 즉시 반영
  setInterval(() => { if (!document.hidden) loadPoll(); }, Math.max(3, B.pollRefreshSeconds || 10) * 1000);
  window.addEventListener("storage", (e) => { if (e.key === "kj_demo_db") loadPoll(); });

  /* =========================================================
   *  2) 수강 신청서
   * ========================================================= */
  const A = C.apply;
  const fieldHtml = (f) => {
    const id = `ap-${f.name}`, req = f.required ? `<span class="req">*</span>` : "";
    const hint = f.hint ? `<small class="field__hint">${esc(f.hint)}</small>` : "";
    const err = `<small class="field__err" id="${id}-err"></small>`;
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
    const full = ["textarea", "radio", "checkbox", "consent"].includes(f.type) ? " field--full" : "";
    if (f.type === "select")
      return `<div class="field${full}" data-field="${f.name}"><label for="${id}">${esc(f.label)}${req}</label>
        <select id="${id}" name="${f.name}" aria-describedby="${id}-err"><option value="">선택하세요</option>${list(f.options, (o) => `<option>${esc(o)}</option>`)}</select>${hint}${err}</div>`;
    if (f.type === "radio" || f.type === "checkbox")
      return `<fieldset class="field${full}" data-field="${f.name}"><legend>${esc(f.label)}${req}</legend>
        <div class="choices">${list(f.options, (o) => `<label class="choice"><input type="${f.type}" name="${f.name}" value="${esc(o)}" /><span>${esc(o)}</span></label>`)}</div>${hint}${err}</fieldset>`;
    if (f.type === "textarea")
      return `<div class="field${full}" data-field="${f.name}"><label for="${id}">${esc(f.label)}${req}</label>
        <textarea id="${id}" name="${f.name}" rows="4"${ph} aria-describedby="${id}-err"></textarea>
        <small class="field__hint"><span class="js-len" data-for="${f.name}">0</span>자${f.minLength ? ` / 최소 ${f.minLength}자` : ""}</small>${err}</div>`;
    if (f.type === "consent")
      return `<div class="field${full}" data-field="${f.name}"><label class="choice choice--consent"><input type="checkbox" name="${f.name}" value="동의" /><span>${esc(f.label)}${req}</span></label>${err}</div>`;
    return `<div class="field${full}" data-field="${f.name}"><label for="${id}">${esc(f.label)}${req}</label>
      <input id="${id}" name="${f.name}" type="${f.type === "email" || f.type === "tel" ? f.type : "text"}"${ph} aria-describedby="${id}-err" autocomplete="off" />${hint}${err}</div>`;
  };
  $("#apply").innerHTML = `<div class="container container--narrow">${head(A.title, A.lead)}
    <form class="card apply" novalidate>
      <div class="apply__alert" role="alert" hidden></div>
      <div class="apply__grid">${list(A.fields, fieldHtml)}</div>
      <div class="apply__foot">
        ${modeNote}
        <button type="submit" class="btn btn--primary">신청서 제출하기</button>
      </div>
    </form></div>`;

  const form = $(".apply");
  const readForm = () => {
    const data = {};
    A.fields.forEach((f) => {
      if (f.type === "checkbox") data[f.name] = [...form.querySelectorAll(`[name="${f.name}"]:checked`)].map((x) => x.value).join(", ");
      else if (f.type === "radio") { const c = form.querySelector(`[name="${f.name}"]:checked`); data[f.name] = c ? c.value : ""; }
      else if (f.type === "consent") data[f.name] = form.querySelector(`[name="${f.name}"]`).checked ? "동의" : "";
      else data[f.name] = form.querySelector(`[name="${f.name}"]`).value.trim();
    });
    return data;
  };
  const checkField = (f, v) => {
    if (f.required && !v) return f.type === "consent" ? "동의가 필요합니다." : f.type === "select" || f.type === "radio" ? "항목을 선택해 주세요." : "필수 입력 항목입니다.";
    if (!v) return "";
    if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "이메일 형식이 올바르지 않습니다.";
    if (f.pattern && !new RegExp(f.pattern).test(v)) return `형식을 확인해 주세요${f.hint ? ` (${f.hint})` : ""}.`;
    if (f.minLength && v.length < f.minLength) return `${f.minLength}자 이상 입력해 주세요. (현재 ${v.length}자)`;
    return "";
  };
  const showFieldError = (name, msg) => {
    const box = form.querySelector(`[data-field="${name}"]`);
    box.classList.toggle("is-error", !!msg);
    box.querySelector(".field__err").textContent = msg;
  };
  const validate = () => {
    const data = readForm(), problems = [];
    A.fields.forEach((f) => {
      const msg = checkField(f, data[f.name]);
      showFieldError(f.name, msg);
      if (msg) problems.push({ f, msg });
    });
    return { data, problems };
  };
  const alertBox = $(".apply__alert");
  form.addEventListener("input", (e) => {
    const name = e.target.name;
    const f = A.fields.find((x) => x.name === name);
    if (e.target.tagName === "TEXTAREA") { const c = form.querySelector(`.js-len[data-for="${name}"]`); if (c) c.textContent = e.target.value.trim().length; }
    if (f && form.querySelector(`[data-field="${name}"]`).classList.contains("is-error")) showFieldError(name, checkField(f, readForm()[name]));
    if (!alertBox.hidden && !form.querySelector(".is-error")) alertBox.hidden = true;
  });
  form.addEventListener("focusout", (e) => {
    const f = A.fields.find((x) => x.name === e.target.name);
    if (f && !["radio", "checkbox", "consent"].includes(f.type) && e.target.value) showFieldError(f.name, checkField(f, readForm()[f.name]));
  });
  alertBox.addEventListener("click", (e) => {
    const a = e.target.closest("[data-goto]");
    if (!a) return;
    const el = form.querySelector(`[data-field="${a.dataset.goto}"] input, [data-field="${a.dataset.goto}"] select, [data-field="${a.dataset.goto}"] textarea`);
    if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" }); }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { data, problems } = validate();
    if (problems.length) {
      alertBox.hidden = false;
      alertBox.innerHTML = `<b>⚠️ ${problems.length}개 항목을 확인해 주세요.</b>
        <ul>${list(problems, (p) => `<li><button type="button" class="link-btn" data-goto="${p.f.name}">${esc(p.f.short || p.f.label)}</button> — ${esc(p.msg)}</li>`)}</ul>`;
      alertBox.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
      return;
    }
    alertBox.hidden = true;
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true; btn.textContent = "제출 중…";
    try {
      await api("apply.submit", { form: data });
      form.reset();
      form.querySelectorAll(".js-len").forEach((c) => (c.textContent = "0"));
      openModal(`<div class="done"><div class="done__icon">🌸</div><h3>${esc(A.successTitle)}</h3>
        <p>${esc(data.name)}님(${esc(data.sid)}), ${esc(A.successText)}</p>
        <button class="btn btn--primary" data-close>확인</button></div>`, "modal__box--sm");
      fireworks(2);
    } catch (err) {
      alertBox.hidden = false;
      alertBox.innerHTML = `<b>⚠️ ${esc(err.message)}</b>`;
    }
    btn.disabled = false; btn.textContent = "신청서 제출하기";
  });

  /* =========================================================
   *  3) 수강생 공간: 로그인 · 출석 · 과제 제출
   * ========================================================= */
  const M = C.myclass, U = M.upload || {};
  const hwWeeks = weeks.filter((w) => w.assignment);
  const box = $("#myclass");
  box.innerHTML = `<div class="container">${head(M.title, M.lead)}<div class="mc"></div></div>`;
  const mc = box.querySelector(".mc");
  let preselectHw = null;

  function setSession(s) {
    session = s;
    if (s) store.set("kj_session", s); else store.del("kj_session");
    renderMyClass();
  }

  const renderLogin = () => {
    const demoHint = !REMOTE && M.demoAccounts && M.demoAccounts[0]
      ? `<p class="demo-note">🧪 체험 모드 테스트 계정 — 학번 <b>${esc(M.demoAccounts[0].id)}</b> / 인증코드 <b>${esc(M.demoAccounts[0].code)}</b></p>` : "";
    mc.innerHTML = `
      <div class="mc-login card">
        <div class="mc-login__art"><span>🔐</span><h3>수강생 로그인</h3><p>출석 체크와 과제 제출은 로그인 후 이용할 수 있습니다. 인증코드는 첫 수업에서 개별 안내합니다.</p></div>
        <form class="mc-login__form" novalidate>
          <div class="field"><label for="lg-id">학번</label><input id="lg-id" name="id" inputmode="numeric" autocomplete="username" placeholder="학번 10자리" /></div>
          <div class="field"><label for="lg-code">인증코드</label><input id="lg-code" name="code" type="password" autocomplete="current-password" placeholder="개인 인증코드" /></div>
          <p class="mc-login__err" role="alert"></p>
          <button class="btn btn--primary" type="submit">로그인</button>
          ${demoHint}
        </form>
      </div>`;
    const f = mc.querySelector(".mc-login__form");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = f.querySelector("[name=id]").value.trim(), code = f.querySelector("[name=code]").value.trim(), err = f.querySelector(".mc-login__err");
      if (!id || !code) { err.textContent = !id ? "학번을 입력해 주세요." : "인증코드를 입력해 주세요."; return; }
      const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "확인 중…";
      try {
        const s = await api("auth.login", { id, code });
        setSession(s);
        toast(`${s.name}님, 환영합니다! 🌸`);
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = "로그인"; }
    });
  };

  const hwOption = (w) => {
    const closed = w.due < new Date();
    const dis = closed && !U.allowLate ? " disabled" : "";
    return `<option value="${w.no}"${dis}>${esc(w.label)} · ${esc(w.assignment.title)} (${closed ? (U.allowLate ? "마감 · 지각 제출" : "마감") : `~${fmtDue(w.due)}`})</option>`;
  };

  const renderDashboard = async () => {
    const ts = todaysSession();
    mc.innerHTML = `
      <div class="mc-bar card">
        <div class="mc-bar__who"><span class="mc-avatar">${esc((session.name || "?").charAt(0))}</span>
          <div><b>${esc(session.name)}</b>님<small>${esc(session.id)}</small></div></div>
        <button class="btn btn--sm btn--ghost js-logout">로그아웃</button>
      </div>
      <div class="mc-grid">
        <section class="card mc-att">
          <h3 class="card__title">✅ 출석 체크</h3>
          <div class="mc-att__today"></div>
          <div class="mc-att__rate"></div>
          <ol class="att-grid"></ol>
          <div class="att-legend"><span><i class="att-dot att--ok"></i>출석</span><span><i class="att-dot att--miss"></i>미출석</span><span><i class="att-dot att--todo"></i>예정</span></div>
        </section>
        <section class="card mc-up">
          <h3 class="card__title">📤 과제 제출</h3>
          <form class="up" novalidate>
            <div class="field"><label for="up-hw">과제 선택</label>
              <select id="up-hw" name="hw"><option value="">과제를 선택하세요</option>${list(hwWeeks, hwOption)}</select></div>
            <label class="drop" tabindex="0">
              <input type="file" name="file" accept="${esc((U.accept || []).join(","))}" hidden />
              <span class="drop__icon">📎</span>
              <span class="drop__text"><b>파일을 끌어다 놓거나 클릭해서 선택</b><small>${esc((U.accept || []).join(" "))} · 최대 ${U.maxMB || 10}MB</small></span>
            </label>
            <div class="up__file" hidden></div>
            <p class="up__err" role="alert"></p>
            <div class="up__progress" hidden><span></span></div>
            <button class="btn btn--primary" type="submit">제출하기</button>
          </form>
          <h4 class="mc-sub">내 제출 내역</h4>
          <div class="sub-list"><p class="muted">불러오는 중…</p></div>
        </section>
      </div>
      ${modeNote}`;

    mc.querySelector(".js-logout").addEventListener("click", () => { setSession(null); toast("로그아웃되었습니다."); });

    /* --- 출석 --- */
    const renderAtt = (records) => {
      // 출석은 수업 1회(session) 단위 — 주 2회 수업이면 주마다 2칸
      const done = new Set(records.map((r) => r.date));
      const t0 = today0(), now = new Date();
      const past = sessions.filter((s) => s.date < t0 || (sameDay(s.date, now) && done.has(s.key)));
      const attended = past.filter((s) => done.has(s.key)).length;
      const rate = past.length ? Math.round((attended / past.length) * 100) : 0;
      mc.querySelector(".mc-att__rate").innerHTML = `
        <div class="rate"><div class="rate__bar"><span style="width:${rate}%"></span></div>
        <span>출석률 <b>${rate}%</b> <small>(${attended}/${past.length}회)</small></span></div>`;
      mc.querySelector(".att-grid").innerHTML = list(sessions, (s) => {
        const ok = done.has(s.key), future = s.date > t0 || (sameDay(s.date, now) && !ok);
        const cls = ok ? "att--ok" : future ? "att--todo" : "att--miss";
        const st = ok ? "출석" : future ? "예정" : "미출석";
        return `<li class="att ${cls}" title="${esc(s.label)} ${fmtShort(s.date)} · ${st}"><b>${esc(s.label)}</b><small>${s.date.getMonth() + 1}/${s.date.getDate()}</small></li>`;
      });
      const today = mc.querySelector(".mc-att__today");
      if (!ts) {
        const nx = sessions.find((s) => s.date > now);
        today.innerHTML = `<div class="att-today att-today--off"><span>☕</span><p>오늘은 수업일이 아닙니다.${nx ? `<br /><small>다음 수업 ${fmtShort(nx.date)} ${esc(nx.week.time)}</small>` : ""}</p></div>`;
        return;
      }
      if (done.has(ts.key)) {
        const r = records.find((x) => x.date === ts.key);
        today.innerHTML = `<div class="att-today att-today--ok"><span>🎉</span><p><b>${esc(ts.label)}요일 출석 완료</b><br /><small>${esc(r.time)} 체크</small></p></div>`;
        return;
      }
      const win = classWindow(ts), open = now >= win.start && now <= win.end;
      const codeInput = (M.attendance || {}).requireCode ? `<input name="code" placeholder="출석 코드" autocomplete="off" aria-label="출석 코드" />` : "";
      today.innerHTML = `<form class="att-today att-today--open">
        <p><b>오늘은 ${esc(ts.label)}요일 수업일</b><br /><small>${open ? "지금 출석할 수 있습니다." : now < win.start ? `${pad(win.start.getHours())}:${pad(win.start.getMinutes())}부터 출석할 수 있습니다.` : "출석 가능 시간이 지났습니다."}</small></p>
        <div class="att-today__row">${codeInput}<button class="btn btn--sm btn--primary" ${open ? "" : "disabled"}>출석하기</button></div>
        <p class="up__err" role="alert"></p></form>`;
      const af = today.querySelector("form");
      af.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = af.querySelector(".up__err");
        if ((M.attendance || {}).requireCode && !af.code.value.trim()) { err.textContent = "출석 코드를 입력해 주세요."; return; }
        try {
          await api("attendance.check", { code: af.code ? af.code.value : "" });
          toast("출석이 확인되었습니다 ✅");
          renderAtt(await api("attendance.list"));
        } catch (ex) { err.textContent = ex.message; }
      });
    };

    /* --- 과제 제출 --- */
    const up = mc.querySelector(".up"), fileInput = up.querySelector("input[type=file]"), drop = up.querySelector(".drop");
    const fileBox = up.querySelector(".up__file"), upErr = up.querySelector(".up__err");
    let picked = null;
    const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + "MB" : Math.max(1, Math.round(b / 1024)) + "KB");
    const pick = (file) => {
      upErr.textContent = "";
      if (!file) return;
      const ext = "." + file.name.split(".").pop().toLowerCase();
      if (U.accept && U.accept.length && !U.accept.includes(ext)) { upErr.textContent = `허용되지 않는 파일 형식입니다. (${ext})`; return; }
      if (file.size > (U.maxMB || 10) * 1048576) { upErr.textContent = `파일이 너무 큽니다. 최대 ${U.maxMB || 10}MB까지 제출할 수 있습니다.`; return; }
      picked = file;
      fileBox.hidden = false;
      fileBox.innerHTML = `<span>📄</span><b>${esc(file.name)}</b><small>${fmtSize(file.size)}</small><button type="button" class="link-btn js-unpick" aria-label="파일 취소">✕</button>`;
    };
    fileBox.addEventListener("click", (e) => { if (e.target.closest(".js-unpick")) { picked = null; fileInput.value = ""; fileBox.hidden = true; } });
    fileInput.addEventListener("change", () => pick(fileInput.files[0]));
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-over"); }));
    drop.addEventListener("drop", (e) => pick(e.dataTransfer.files[0]));
    if (preselectHw) { up.hw.value = String(preselectHw); preselectHw = null; }

    const renderSubs = (subs) => {
      const el = mc.querySelector(".sub-list");
      if (!subs.length) { el.innerHTML = `<p class="muted">아직 제출한 과제가 없습니다.</p>`; return; }
      el.innerHTML = `<ul class="subs">${list(subs.slice().reverse(), (s) => `
        <li><div><b>${esc(s.hwTitle)}</b><small>${esc(s.fileName)} · ${esc(s.at)}</small></div>
        <span class="chip ${s.late ? "chip--hw" : "chip--next"}">${s.late ? "지각 제출" : "제출 완료"}</span>
        ${s.url ? `<a class="link-btn" href="${esc(s.url)}" target="_blank" rel="noopener">열기</a>` : ""}</li>`)}</ul>`;
    };

    up.addEventListener("submit", async (e) => {
      e.preventDefault();
      upErr.textContent = "";
      const no = Number(up.hw.value), w = weeks.find((x) => x.no === no);
      if (!w) { upErr.textContent = "제출할 과제를 선택해 주세요."; return; }
      if (!picked) { upErr.textContent = "제출할 파일을 선택해 주세요."; return; }
      const late = w.due < new Date();
      if (late && !U.allowLate) { upErr.textContent = "마감된 과제입니다."; return; }
      const btn = up.querySelector("[type=submit]"), bar = up.querySelector(".up__progress");
      btn.disabled = true; btn.textContent = "업로드 중…"; bar.hidden = false;
      try {
        const payload = { hw: w.no, hwTitle: w.assignment.title, name: picked.name, type: picked.type || "application/octet-stream", size: picked.size, late };
        if (REMOTE) {
          payload.data = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result).split(",")[1]);
            r.onerror = () => rej(new Error("파일을 읽지 못했습니다."));
            r.readAsDataURL(picked);
          });
        }
        await api("submit.upload", payload);
        toast(late ? "지각 제출로 접수되었습니다." : "과제가 제출되었습니다 📤");
        picked = null; fileInput.value = ""; fileBox.hidden = true; up.hw.value = "";
        renderSubs(await api("submit.list"));
      } catch (ex) { upErr.textContent = ex.message; }
      btn.disabled = false; btn.textContent = "제출하기"; bar.hidden = true;
    });

    try {
      const [att, subs] = await Promise.all([api("attendance.list"), api("submit.list")]);
      renderAtt(att); renderSubs(subs);
    } catch (ex) { toast(ex.message, "err"); }
  };

  function renderMyClass() { if (session) renderDashboard(); else renderLogin(); }
  renderMyClass();

  // 커리큘럼의 '과제 제출하기' 버튼 → 수강생 공간의 해당 과제 선택
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".js-goto-upload");
    if (!a) return;
    preselectHw = Number(a.dataset.hw);
    const sel = document.getElementById("up-hw");
    if (sel) { sel.value = String(preselectHw); preselectHw = null; }
    if (!session) setTimeout(() => toast("로그인 후 과제를 제출할 수 있습니다.", "info"), 400);
  });

  /* =========================================================
   *  4) 폭죽 효과
   * ========================================================= */
  function fireworks(bursts = 5) {
    if (reduceMotion()) return;
    const cv = document.createElement("canvas");
    cv.className = "fx";
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
    const colors = ["#f39bbd", "#e5779f", "#cdb8f0", "#9b7fd4", "#ffd36e", "#ffffff"];
    const parts = [], rockets = [];
    for (let i = 0; i < bursts; i++) {
      rockets.push({ x: W * (0.2 + Math.random() * 0.6), y: H, ty: H * (0.18 + Math.random() * 0.3), delay: i * 260, vy: -H / 55 });
    }
    const explode = (x, y) => {
      const c = colors[Math.floor(Math.random() * colors.length)], n = 60;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n, sp = (2 + Math.random() * 3.5) * dpr;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c: Math.random() < 0.3 ? colors[Math.floor(Math.random() * colors.length)] : c, r: (1.6 + Math.random() * 1.8) * dpr, petal: Math.random() < 0.25 });
      }
    };
    const t0 = performance.now();
    const frame = (t) => {
      const el = t - t0;
      ctx.clearRect(0, 0, W, H);
      rockets.forEach((r) => {
        if (r.done || el < r.delay) return;
        r.y += r.vy;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(r.x, r.y, 2.4 * dpr, 0, 7); ctx.fill();
        if (r.y <= r.ty) { r.done = true; explode(r.x, r.y); }
      });
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.05 * dpr; p.vx *= 0.985; p.vy *= 0.985; p.life -= 0.012;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        if (p.petal) ctx.ellipse(p.x, p.y, p.r * 1.8, p.r, el / 300 + i, 0, 7); else ctx.arc(p.x, p.y, p.r, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (el < 6000 && (parts.length || rockets.some((r) => !r.done))) requestAnimationFrame(frame);
      else cv.remove();
    };
    requestAnimationFrame(frame);
  }

  /* =========================================================
   *  5) 첫 방문 환영 + 수강 신청 안내 팝업
   * ========================================================= */
  const firstVisit = !store.get("kj_visited", false);
  store.set("kj_visited", true);
  if (firstVisit && C.celebrateFirstVisit) {
    setTimeout(() => { fireworks(5); toast("처음 오셨군요! 환영합니다 🎉"); }, 700);
  }

  /* admin.js에서 함께 쓰는 도구 */
  window.PARTICIPATE = { api, demo, store, toast, openModal, closeModal, REMOTE, loadNotices, loadPoll, loadLibrary, fireworks, uid };

  const PU = C.popup || {};
  const hideKey = "kj_popup_hide_until";
  const hiddenToday = () => store.get(hideKey, "") === keyOf(new Date());
  if (PU.enabled && !hiddenToday()) {
    setTimeout(() => {
      if (document.querySelector(".modal")) return;
      const m = openModal(`
        <div class="promo">
          <div class="promo__art"><span>🌸</span></div>
          <span class="pill"><i class="pill__dot"></i>${esc(PU.badge)}</span>
          <h3>${esc(PU.title)}</h3>
          <p>${esc(PU.text)}</p>
          <ul>${list(PU.points, (p) => `<li>${esc(p)}</li>`)}</ul>
          <a class="btn btn--primary js-promo-go" href="${esc(PU.button.href)}">${esc(PU.button.label)}</a>
        </div>
        <div class="promo__foot">
          <label><input type="checkbox" class="js-hide-today" /> 오늘 하루 보지 않기</label>
          <button class="link-btn js-promo-close">닫기</button>
        </div>`, "modal__box--promo");
      const close = () => {
        if (m.querySelector(".js-hide-today").checked) store.set(hideKey, keyOf(new Date()));
        closeModal();
      };
      m.querySelector(".js-promo-close").addEventListener("click", close);
      m.querySelector(".js-promo-go").addEventListener("click", close);
      m.querySelectorAll("[data-close]").forEach((x) => x.addEventListener("click", () => {
        if (m.querySelector(".js-hide-today").checked) store.set(hideKey, keyOf(new Date()));
      }));
    }, (PU.delaySeconds || 2.5) * 1000);
  }
})();

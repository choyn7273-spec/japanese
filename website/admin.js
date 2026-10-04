/* 관리자 모드: 자물쇠 아이콘 → 비밀번호 → 사이트 편집 · 명단 · 공지 · 출석/과제/신청 내역 · 설정 파일
 * 비밀번호는 config.js에 "salt + 비밀번호"의 SHA-256 값으로만 저장됩니다. */
(function () {
  const S = window.SITE, P = window.PARTICIPATE;
  const { C, esc, list, weeks, sessions, keyOf, fmtShort } = S;
  const { api, toast, REMOTE } = P;
  const FILE_CONFIG = window.SITE_CONFIG_FILE || C;

  /* =========================================================
   *  SHA-256 (브라우저 기본 기능, 없으면 직접 계산)
   * ========================================================= */
  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    if (window.crypto && crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest("SHA-256", bytes);
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch (e) {}
    }
    return sha256Fallback(bytes);
  }
  function sha256Fallback(bytes) {
    const K = [], H = [];
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
    for (let n = 2, c = 0; c < 64; n++) {
      if ([...Array(n).keys()].slice(2).some((d) => n % d === 0)) continue;
      if (c < 8) H[c] = frac(Math.sqrt(n));
      K[c++] = frac(Math.cbrt(n));
    }
    const l = bytes.length, withPad = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    withPad.set(bytes); withPad[l] = 0x80;
    const dv = new DataView(withPad.buffer);
    dv.setUint32(withPad.length - 4, l * 8);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < withPad.length; o += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) | 0));
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  const randomHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

  /* =========================================================
   *  공용 도우미
   * ========================================================= */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const today = () => keyOf(new Date());
  const ss = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  // 엑셀에서 바로 열리는 CSV (한글 깨짐 방지 BOM, 수식 주입 방지)
  const toCSV = (rows) => "﻿" + rows.map((r) => r.map((c) => {
    let s = c == null ? "" : String(c);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\r\n");
  const download = (name, text, type = "text/csv;charset=utf-8") => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // head와 rows의 칸은 HTML로 들어가므로, 부르는 쪽에서 esc()로 처리한 값만 넘김
  const table = (head, rows, empty = "아직 데이터가 없습니다.") => rows.length
    ? `<div class="ad-table"><table><thead><tr>${list(head, (h) => `<th>${h}</th>`)}</tr></thead>
        <tbody>${list(rows, (r) => `<tr>${list(r, (c) => `<td>${c}</td>`)}</tr>`)}</tbody></table></div>`
    : `<p class="ad-empty">${esc(empty)}</p>`;

  /* =========================================================
   *  로그인
   * ========================================================= */
  const lockBtn = document.querySelector(".admin-btn");
  let admin = ss.get("kj_admin"); // { adminToken }
  // is-admin: 커리큘럼·자료실·포트폴리오의 수정/삭제 버튼을 보이게 함
  const markLock = () => { lockBtn.classList.toggle("is-on", !!admin); document.body.classList.toggle("is-admin", !!admin); };
  markLock();

  lockBtn.addEventListener("click", () => (admin ? openPanel() : openLogin()));

  function openLogin() {
    const m = P.openModal(`
      <form class="ad-login">
        <div class="ad-login__icon">🔐</div>
        <h3>관리자 로그인</h3>
        <p>관리자 비밀번호를 입력하세요.</p>
        <input type="password" name="pw" autocomplete="current-password" placeholder="비밀번호" aria-label="관리자 비밀번호" />
        <p class="ad-login__err" role="alert"></p>
        <button class="btn btn--primary" type="submit">들어가기</button>
      </form>`, "modal__box--sm");
    const f = m.querySelector("form"), err = f.querySelector(".ad-login__err"), input = f.querySelector("input");
    input.focus();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const lockUntil = Number(ss.get("kj_admin_lock") || 0);
      if (Date.now() < lockUntil) { err.textContent = `잠시 후 다시 시도하세요. (${Math.ceil((lockUntil - Date.now()) / 1000)}초)`; return; }
      const pw = input.value;
      if (!pw) { err.textContent = "비밀번호를 입력해 주세요."; return; }
      const btn = f.querySelector("button"); btn.disabled = true;
      const ok = (await sha256((C.admin || {}).salt + pw)) === (C.admin || {}).passwordHash;
      if (!ok) {
        const fails = (ss.get("kj_admin_fail") || 0) + 1;
        ss.set("kj_admin_fail", fails);
        if (fails >= 5) { ss.set("kj_admin_lock", Date.now() + 30000); ss.set("kj_admin_fail", 0); err.textContent = "5회 틀려 30초 동안 잠깁니다."; }
        else err.textContent = `비밀번호가 올바르지 않습니다. (${fails}/5)`;
        input.select(); btn.disabled = false; return;
      }
      try {
        const r = await api("admin.login", { password: pw });
        admin = { adminToken: r.adminToken };
        ss.set("kj_admin", admin); ss.set("kj_admin_fail", 0);
        markLock(); P.closeModal();
        toast("관리자 모드로 들어왔습니다 🔓");
        setTimeout(openPanel, 260);
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    });
  }

  function logout() {
    admin = null; ss.del("kj_admin"); ss.del("kj_admin_tab"); markLock(); closePanel();
    toast("관리자 모드에서 나왔습니다.");
  }

  /* =========================================================
   *  관리자 패널
   * ========================================================= */
  const TABS = [
    ["dash", "📊", "대시보드"], ["edit", "✏️", "사이트 편집"], ["students", "👥", "수강생 명단"], ["notice", "📢", "공지사항"],
    ["library", "📚", "자료 등록"], ["portfolio", "🏆", "포트폴리오"],
    ["att", "✅", "출석"], ["hw", "📤", "과제"], ["apply", "📝", "수강 신청"], ["file", "💾", "설정 파일"],
  ];
  let panel = null, data = null, tab = "dash";

  function openPanel(startTab) {
    if (!admin) return openLogin();
    tab = startTab || ss.get("kj_admin_tab") || "dash";
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "admin";
      panel.innerHTML = `
        <div class="admin__box" role="dialog" aria-modal="true" aria-label="관리자 화면">
          <header class="admin__head">
            <div><b>🔐 관리자 모드</b><span class="chip ${REMOTE ? "chip--today" : "chip--hw"}">${REMOTE ? "운영 모드 · Google 시트" : "체험 모드 · 이 브라우저"}</span></div>
            <div class="admin__actions">
              <button class="btn btn--sm btn--ghost js-ad-refresh">새로고침</button>
              <button class="btn btn--sm btn--ghost js-ad-logout">로그아웃</button>
              <button class="admin__x js-ad-close" aria-label="관리자 화면 닫기">×</button>
            </div>
          </header>
          <nav class="admin__tabs" role="tablist">${list(TABS, ([id, ic, label]) => `<button role="tab" data-tab="${id}"><span>${ic}</span>${label}</button>`)}</nav>
          <div class="admin__body"></div>
        </div>`;
      document.body.appendChild(panel);
      panel.querySelector(".admin__tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab); });
      panel.querySelector(".js-ad-close").addEventListener("click", closePanel);
      panel.querySelector(".js-ad-logout").addEventListener("click", logout);
      panel.querySelector(".js-ad-refresh").addEventListener("click", () => loadData().then(() => show(tab)));
    }
    document.body.classList.add("no-scroll");
    requestAnimationFrame(() => panel.classList.add("is-in"));
    loadData().then(() => show(tab));
  }
  function closePanel() {
    if (!panel) return;
    panel.classList.remove("is-in");
    document.body.classList.remove("no-scroll");
    ss.del("kj_admin_tab");
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel && panel.classList.contains("is-in") && !document.querySelector(".modal")) closePanel();
  });

  async function loadData() {
    try { data = await api("admin.data", { adminToken: admin.adminToken }); }
    catch (ex) {
      toast(ex.message, "err");
      if (/관리자/.test(ex.message)) logout();
      data = data || { students: [], applications: [], attendance: [], submissions: [], votes: {}, notices: [] };
    }
  }

  const body = () => panel.querySelector(".admin__body");
  function show(t) {
    tab = t; ss.set("kj_admin_tab", t);
    panel.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    body().scrollTop = 0;
    ({ dash, edit, students, notice, library, portfolio, att, hw, apply, file })[t]();
  }

  /* ---------- 대시보드 ---------- */
  function dash() {
    const d = data, now = new Date();
    const todayAtt = d.attendance.filter((a) => a.date === today()).length;
    const totalVotes = Object.values(d.votes || {}).reduce((a, b) => a + b, 0);
    const tiles = [
      ["📝", "수강 신청", d.applications.length, "apply"], ["👥", "등록 학생", d.students.length, "students"],
      ["✅", "오늘 출석", todayAtt, "att"], ["📤", "과제 제출", d.submissions.length, "hw"],
      ["🗳️", "투표 참여", totalVotes, null], ["📢", "올린 공지", d.notices.length, "notice"],
    ];
    const ns = S.nextSession();
    const next = ns && { ...ns.week, date: ns.date };
    body().innerHTML = `
      ${window.SITE_CONFIG_OVERRIDDEN ? `<div class="ad-warn">✏️ 이 브라우저에는 <b>저장하지 않은 사이트 편집 내용</b>이 미리보기로 적용되어 있습니다. 수강생에게 보이게 하려면 <button class="link-btn" data-go="file">설정 파일</button>에서 config.js를 내려받아 교체하세요.</div>` : ""}
      <div class="ad-tiles">${list(tiles, ([ic, label, n, go]) => `
        <button class="ad-tile" ${go ? `data-go="${go}"` : "disabled"}><span>${ic}</span><b>${n}</b><small>${label}</small></button>`)}</div>
      <div class="ad-cols">
        <section class="ad-card"><h4>🗓️ 다음 수업</h4>${next
          ? `<p><b>${esc(next.label)} · ${esc(next.title)}</b><br />${fmtShort(next.date)} ${esc(next.time)} · ${esc(next.location)}</p>`
          : `<p>남은 수업이 없습니다.</p>`}</section>
        <section class="ad-card"><h4>🗳️ 투표 결과</h4>${list(C.poll.options, (o) => {
          const n = (d.votes || {})[o.id] || 0, pct = totalVotes ? Math.round((n / totalVotes) * 100) : 0;
          return `<div class="ad-bar"><span>${esc(o.icon)} ${esc(o.label)}</span><i><em style="width:${pct}%"></em></i><b>${n}</b></div>`;
        })}</section>
      </div>
      ${REMOTE ? "" : `<p class="demo-note">🧪 체험 모드에서는 이 브라우저에서 입력된 데이터만 보입니다. 모든 수강생의 데이터를 모으려면 안내서의 「실제 운영 모드」를 설정하세요.</p>`}`;
    body().querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));
  }

  /* ---------- 사이트 편집 (설정 항목을 화면에서 바로 수정) ---------- */
  const SECTION_LABELS = {
    site: "기본 정보", nav: "상단 메뉴", hero: "첫 화면", stats: "숫자 카드", notices: "공지사항(설정 파일)", about: "프로그램 소개·슬라이드",
    poll: "실시간 투표", curriculum: "커리큘럼·일정", enroll: "수강 안내", apply: "수강 신청서", myclass: "수강생 공간",
    tools: "AI 도구", prepare: "수강 준비물", faq: "FAQ", infographic: "강의 인포그래픽",
    materialsRoom: "수업 자료실", portfolio: "학생 포트폴리오", instructor: "교수자(푸터)", popup: "안내 팝업",
    celebrateFirstVisit: "첫 방문 폭죽", backend: "데이터 저장(운영 모드 주소)",
  };
  const FIELD_LABELS = {
    title: "제목", titleJa: "일본어 제목", subtitle: "부제", description: "설명", lead: "안내 문구", badge: "배지", label: "이름", value: "값",
    icon: "아이콘", text: "내용", desc: "설명", href: "링크", primary: "강조 버튼", buttons: "버튼", facts: "한눈에 보기", suffix: "단위",
    slides: "슬라이드", weeks: "주차", week: "주차 표시", tags: "태그", content: "학습 내용", videos: "참고 영상", url: "주소",
    assignment: "과제", due: "마감 (YYYY-MM-DD HH:MM)", submitUrl: "제출 링크", startDate: "첫 수업일 (YYYY-MM-DD)", time: "수업 시간",
    location: "강의실", holidays: "휴강일", date: "날짜 (YYYY-MM-DD)", info: "기본 정보", grading: "평가 방법", item: "항목", percent: "비율(%)",
    notes: "유의 사항", items: "항목", q: "질문", a: "답변", name: "이름", nameJa: "일본어 이름", position: "소속", photo: "사진 경로",
    bio: "소개", fields: "항목", contacts: "연락처", copyright: "저작권 문구", question: "질문", options: "선택지", id: "ID",
    university: "대학", department: "학과", enabled: "사용", delaySeconds: "표시까지 걸리는 시간(초)", points: "요점", button: "버튼",
    pinned: "중요 표시", use: "활용", required: "필수", placeholder: "입력 예시", type: "형식", pattern: "형식 검사(정규식)", hint: "도움말",
    minLength: "최소 글자 수", short: "짧은 이름", successTitle: "완료 제목", successText: "완료 문구", demoAccounts: "체험 계정", code: "코드",
    attendance: "출석", requireCode: "출석 코드 필요", demoCode: "체험 모드 출석 코드", openBeforeMinutes: "수업 몇 분 전부터 출석",
    phases: "단계", outcomes: "학습 성과", topicGroups: "주제 묶음",
    materials: "수업 자료", file: "파일 이름", size: "크기", base: "자료 폴더", categories: "분류", author: "학생", term: "학기", thumb: "미리보기 표시", days: "수업 요일", dates: "수업일 직접 지정",
    upload: "과제 업로드", maxMB: "최대 용량(MB)", accept: "허용 확장자", allowLate: "지각 제출 허용", pollRefreshSeconds: "투표 새로고침(초)",
  };
  let draft = null, section = "site";

  const getAt = (o, path) => path.reduce((x, k) => (x == null ? x : x[k]), o);
  const setAt = (o, path, v) => { const last = path[path.length - 1]; getAt(o, path.slice(0, -1))[last] = v; };
  const blankLike = (v) => {
    if (Array.isArray(v)) return [];
    if (v && typeof v === "object") { const o = {}; Object.keys(v).forEach((k) => (o[k] = blankLike(v[k]))); return o; }
    return typeof v === "number" ? 0 : typeof v === "boolean" ? false : "";
  };
  const labelOf = (k) => (typeof k === "number" ? `#${k + 1}` : FIELD_LABELS[k] || SECTION_LABELS[k] || k);
  const summaryOf = (v) => {
    if (v == null || typeof v !== "object") return "";
    const s = v.title || v.label || v.name || v.q || v.item || v.week || v.date || Object.values(v).find((x) => typeof x === "string" && x);
    return s ? String(s).slice(0, 40) : "";
  };

  function nodeHtml(v, path) {
    const p = esc(JSON.stringify(path)), key = path[path.length - 1];
    if (Array.isArray(v)) {
      const items = list(v, (item, i) => {
        const ip = [...path, i];
        const tools = `<span class="ae-tools">
          <button type="button" data-act="up" data-path="${esc(JSON.stringify(ip))}" ${i === 0 ? "disabled" : ""} aria-label="위로">↑</button>
          <button type="button" data-act="down" data-path="${esc(JSON.stringify(ip))}" ${i === v.length - 1 ? "disabled" : ""} aria-label="아래로">↓</button>
          <button type="button" data-act="del" data-path="${esc(JSON.stringify(ip))}" aria-label="삭제">✕</button></span>`;
        if (item && typeof item === "object" && !Array.isArray(item))
          return `<details class="ae-item"><summary><span class="ae-no">${i + 1}</span><span class="ae-sum">${esc(summaryOf(item))}</span>${tools}</summary>
            <div class="ae-fields">${list(Object.keys(item), (k) => nodeHtml(item[k], [...ip, k]))}</div></details>`;
        return `<div class="ae-item ae-item--flat">${nodeHtml(item, ip)}${tools}</div>`;
      });
      return `<div class="ae-arr"><div class="ae-label">${esc(labelOf(key))} <small>${v.length}개</small></div>
        <div class="ae-list">${items}</div>
        <button type="button" class="ae-add" data-act="add" data-path="${p}">+ 항목 추가</button></div>`;
    }
    if (v && typeof v === "object") {
      return `<fieldset class="ae-obj"><legend>${esc(labelOf(key))}</legend>${list(Object.keys(v), (k) => nodeHtml(v[k], [...path, k]))}</fieldset>`;
    }
    const lab = typeof key === "number" ? "" : `<span>${esc(labelOf(key))}</span>`;
    if (typeof v === "boolean")
      return `<label class="ae-field ae-field--bool"><input type="checkbox" data-path="${p}" data-type="bool" ${v ? "checked" : ""} />${lab || "사용"}</label>`;
    if (typeof v === "number")
      return `<label class="ae-field">${lab}<input type="number" data-path="${p}" data-type="num" value="${v}" /></label>`;
    const s = String(v == null ? "" : v);
    if (s.length > 60 || s.includes("\n") || ["text", "bio", "desc", "description", "a", "lead", "subtitle"].includes(key))
      return `<label class="ae-field">${lab}<textarea data-path="${p}" rows="${Math.min(6, Math.max(2, Math.ceil(s.length / 60)))}">${esc(s)}</textarea></label>`;
    return `<label class="ae-field">${lab}<input type="text" data-path="${p}" value="${esc(s)}" /></label>`;
  }

  function edit() {
    if (!draft) draft = clone(C);
    const keys = Object.keys(SECTION_LABELS).filter((k) => k in draft);
    if (!keys.includes(section)) section = keys[0];
    body().innerHTML = `
      <div class="ad-edit-top">
        <label class="ae-field ae-field--inline"><span>편집할 영역</span>
          <select class="js-sec">${list(keys, (k) => `<option value="${k}" ${k === section ? "selected" : ""}>${esc(SECTION_LABELS[k])}</option>`)}</select></label>
        <div class="ad-edit-btns">
          <button class="btn btn--sm btn--ghost js-revert">이 영역 되돌리기</button>
          <button class="btn btn--sm btn--primary js-apply">미리보기에 적용</button>
        </div>
      </div>
      <p class="ad-hint">고친 내용은 「미리보기에 적용」을 누르면 이 브라우저에서 바로 확인할 수 있습니다. 수강생에게 보이게 하려면 「설정 파일」 탭에서 config.js를 내려받아 원래 파일과 바꾸세요.</p>
      <div class="ae">${nodeHtml(draft[section], [section])}</div>`;
    const ae = body().querySelector(".ae");
    body().querySelector(".js-sec").addEventListener("change", (e) => { section = e.target.value; edit(); });
    body().querySelector(".js-revert").addEventListener("click", () => {
      draft[section] = clone(C[section]); edit(); toast("이 영역을 원래대로 되돌렸습니다.", "info");
    });
    body().querySelector(".js-apply").addEventListener("click", () => applyOverride(draft, "edit"));
    ae.addEventListener("input", (e) => {
      const el = e.target; if (!el.dataset.path) return;
      const path = JSON.parse(el.dataset.path);
      const v = el.dataset.type === "bool" ? el.checked : el.dataset.type === "num" ? Number(el.value) : el.value;
      setAt(draft, path, v);
      if (el.closest(".ae-item") && el.closest("details")) {
        const det = el.closest("details"), item = getAt(draft, JSON.parse(det.querySelector("[data-act=del]").dataset.path));
        det.querySelector(".ae-sum").textContent = summaryOf(item);
      }
    });
    ae.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      e.preventDefault();
      const path = JSON.parse(b.dataset.path), act = b.dataset.act;
      const open = [...ae.querySelectorAll("details[open]")].map((d) => d.querySelector("[data-act=del]").dataset.path);
      if (act === "add") {
        const arr = getAt(draft, path);
        arr.push(arr.length ? blankLike(arr[arr.length - 1]) : "");
        open.push(JSON.stringify([...path, arr.length - 1]));
      } else {
        const arr = getAt(draft, path.slice(0, -1)), i = path[path.length - 1];
        if (act === "del") {
          if (!confirm("이 항목을 삭제할까요?")) return;
          arr.splice(i, 1);
        }
        if (act === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        if (act === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
      }
      const y = body().scrollTop;
      ae.innerHTML = nodeHtml(draft[section], [section]);
      ae.querySelectorAll("details").forEach((d) => { if (open.includes(d.querySelector("[data-act=del]").dataset.path)) d.open = true; });
      body().scrollTop = y;
    });
  }

  // reopenTab이 없으면 관리자 화면을 다시 열지 않고, anchor(요소 id)가 있으면 새로고침 뒤 그 위치로 이동
  function applyOverride(cfg, reopenTab, anchor) {
    // config.js와 달라진 영역만 저장 — 나중에 config.js를 고쳐도 나머지 영역은 파일 내용이 그대로 보이게
    const diff = {};
    Object.keys(cfg).forEach((k) => { if (JSON.stringify(cfg[k]) !== JSON.stringify(FILE_CONFIG[k])) diff[k] = cfg[k]; });
    try {
      if (Object.keys(diff).length) localStorage.setItem("kj_config_override", JSON.stringify(diff));
      else localStorage.removeItem("kj_config_override");
    }
    catch (e) { toast("브라우저 저장소를 쓸 수 없어 적용하지 못했습니다.", "err"); return; }
    if (reopenTab) { ss.set("kj_admin_tab", reopenTab); ss.set("kj_admin_reopen", true); }
    if (anchor) ss.set("kj_admin_anchor", anchor);
    location.reload();
  }

  /* ---------- 수강생 명단 ---------- */
  let roster = null, rosterDirty = false;
  function students() {
    if (!roster) roster = clone(data.students || []);
    const genCode = () => String(Math.floor(100000 + Math.random() * 900000));
    body().innerHTML = `
      <div class="ad-row">
        <h3 class="ad-title">👥 수강생 명단 <small>${roster.length}명</small></h3>
        <div class="ad-edit-btns">
          <button class="btn btn--sm btn--ghost js-st-csv">명단 내려받기(.csv)</button>
          <button class="btn btn--sm btn--primary js-st-save" ${rosterDirty ? "" : "disabled"}>명단 저장</button>
        </div>
      </div>
      ${rosterDirty ? `<div class="ad-warn">저장하지 않은 변경이 있습니다. 「명단 저장」을 눌러야 학생이 로그인할 수 있습니다.</div>` : ""}
      <div class="ad-cols">
        <form class="ad-card js-st-add">
          <h4>한 명 추가</h4>
          <label class="ae-field"><span>학번</span><input name="id" inputmode="numeric" placeholder="2023123456" /></label>
          <label class="ae-field"><span>이름</span><input name="name" placeholder="홍길동" /></label>
          <label class="ae-field"><span>인증코드 <small>(비우면 자동 생성)</small></span><input name="code" placeholder="6자리 숫자" /></label>
          <p class="up__err js-st-err"></p>
          <button class="btn btn--sm btn--primary">추가</button>
        </form>
        <div class="ad-card">
          <h4>엑셀에서 한꺼번에 붙여넣기</h4>
          <p class="ad-hint">엑셀에서 <b>학번 · 이름 · (인증코드)</b> 열을 복사해 붙여넣으세요. 이미 있는 학번은 이름·코드가 바뀝니다.</p>
          <textarea class="js-st-bulk" rows="6" placeholder="2023123456	홍길동	482913&#10;2023123457	김하나"></textarea>
          <button class="btn btn--sm btn--ghost js-st-bulk-add">명단에 반영</button>
        </div>
      </div>
      ${table(["학번", "이름", "인증코드", ""], roster.map((s, i) => [esc(s.id), esc(s.name), `<code>${esc(s.code)}</code>`, `<button class="link-btn js-st-del" data-i="${i}">삭제</button>`]), "등록된 학생이 없습니다.")}`;
    const markDirty = () => { rosterDirty = true; students(); };
    const upsert = (id, name, code) => {
      const ex = roster.find((s) => String(s.id) === id);
      if (ex) { ex.name = name || ex.name; if (code) ex.code = code; }
      else roster.push({ id, name, code: code || genCode() });
    };
    body().querySelector(".js-st-add").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target, id = f.querySelector("[name=id]").value.trim(), name = f.querySelector("[name=name]").value.trim(), code = f.querySelector("[name=code]").value.trim();
      const err = f.querySelector(".js-st-err");
      if (!/^\d{5,12}$/.test(id)) { err.textContent = "학번을 숫자로 입력해 주세요."; return; }
      if (!name) { err.textContent = "이름을 입력해 주세요."; return; }
      upsert(id, name, code); markDirty();
    });
    body().querySelector(".js-st-bulk-add").addEventListener("click", () => {
      const lines = body().querySelector(".js-st-bulk").value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let n = 0;
      lines.forEach((l) => {
        const [id, name, code] = l.split(/\t|,|\s{2,}|\s/).map((x) => (x || "").trim());
        if (/^\d{5,12}$/.test(id) && name) { upsert(id, name, code); n++; }
      });
      if (!n) { toast("반영할 줄이 없습니다. 학번과 이름이 있는지 확인하세요.", "err"); return; }
      toast(`${n}명을 명단에 반영했습니다. 「명단 저장」을 눌러 주세요.`, "info");
      markDirty();
    });
    body().querySelectorAll(".js-st-del").forEach((b) => b.addEventListener("click", () => {
      const s = roster[Number(b.dataset.i)];
      if (confirm(`${s.name}(${s.id}) 학생을 명단에서 뺄까요?`)) { roster.splice(Number(b.dataset.i), 1); markDirty(); }
    }));
    body().querySelector(".js-st-save").addEventListener("click", async () => {
      try {
        await api("admin.students.save", { adminToken: admin.adminToken, students: roster });
        rosterDirty = false; data.students = clone(roster);
        toast(`명단 ${roster.length}명을 저장했습니다.`); students();
      } catch (ex) { toast(ex.message, "err"); }
    });
    body().querySelector(".js-st-csv").addEventListener("click", () =>
      download(`수강생명단_${today()}.csv`, toCSV([["학번", "이름", "인증코드"], ...roster.map((s) => [s.id, s.name, s.code])])));
  }

  /* ---------- 공지사항 ---------- */
  function notice() {
    const fileNotices = C.notices || [];
    body().innerHTML = `
      <h3 class="ad-title">📢 공지사항</h3>
      <form class="ad-card js-nt-add">
        <h4>새 공지 올리기</h4>
        <label class="ae-field"><span>제목</span><input name="title" maxlength="80" /></label>
        <label class="ae-field"><span>내용</span><textarea name="text" rows="4" maxlength="2000"></textarea></label>
        <label class="ae-field ae-field--bool"><input type="checkbox" name="pinned" /> 중요 공지로 맨 위에 고정</label>
        <p class="up__err js-nt-err"></p>
        <button class="btn btn--sm btn--primary">공지 올리기</button>
      </form>
      <h4 class="mc-sub">올린 공지 ${data.notices.length}건</h4>
      ${table(["날짜", "제목", "중요", ""], data.notices.slice().reverse().map((n) => [esc(n.date), esc(n.title), n.pinned ? "★" : "", `<button class="link-btn js-nt-del" data-id="${esc(n.id)}">삭제</button>`]), "올린 공지가 없습니다.")}
      <h4 class="mc-sub">설정 파일에 들어 있는 공지 ${fileNotices.length}건</h4>
      <p class="ad-hint">이 공지는 「사이트 편집 → 공지사항(설정 파일)」에서 고칠 수 있습니다.</p>
      ${table(["날짜", "제목"], fileNotices.map((n) => [esc(n.date), esc(n.title)]), "없음")}`;
    body().querySelector(".js-nt-add").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, title = f.querySelector("[name=title]").value.trim(), text = f.querySelector("[name=text]").value.trim();
      if (!title || !text) { f.querySelector(".js-nt-err").textContent = "제목과 내용을 모두 입력해 주세요."; return; }
      try {
        const n = await api("admin.notice.add", { adminToken: admin.adminToken, notice: { title, text, pinned: f.querySelector("[name=pinned]").checked } });
        data.notices.push(n); P.loadNotices(); toast("공지를 올렸습니다 📢"); notice();
      } catch (ex) { toast(ex.message, "err"); }
    });
    body().querySelectorAll(".js-nt-del").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("이 공지를 삭제할까요?")) return;
      try {
        await api("admin.notice.delete", { adminToken: admin.adminToken, id: b.dataset.id });
        data.notices = data.notices.filter((n) => n.id !== b.dataset.id); P.loadNotices(); toast("공지를 삭제했습니다."); notice();
      } catch (ex) { toast(ex.message, "err"); }
    }));
  }

  /* ---------- 자료 등록 · 포트폴리오 (Google Drive 링크) ---------- */
  let lib = null;
  const loadLib = async () => {
    try { lib = await api("library.list"); } catch (ex) { toast(ex.message, "err"); }
    lib = { materials: [], portfolio: [], ...(lib || {}) };
  };
  const driveField = (id) => `
    <label class="ae-field"><span>Google Drive 주소</span><input id="${id}" name="url" type="url" placeholder="https://drive.google.com/file/d/…/view" /></label>
    <p class="ad-hint">드라이브에서 <b>공유 → 일반 액세스: 링크가 있는 모든 사용자(뷰어)</b>로 바꾼 뒤 <b>링크 복사</b>한 주소를 붙여넣으세요. 파일·폴더·Google 문서/슬라이드/시트 모두 됩니다.</p>`;
  const checkDrive = (url) => {
    const d = S.parseDrive(url);
    if (!url) return "Google Drive 주소를 붙여넣어 주세요.";
    if (!d) return "Google Drive(drive.google.com 또는 docs.google.com) 주소가 아닙니다.";
    return "";
  };
  const addLib = async (kind, item, done) => {
    try {
      await api("admin.library.add", { adminToken: admin.adminToken, kind, item });
      await loadLib(); P.loadLibrary(); toast(kind === "portfolio" ? "포트폴리오에 올렸습니다 🏆" : "자료를 올렸습니다 📚"); done();
    } catch (ex) { toast(ex.message, "err"); }
  };
  const delLib = async (kind, id) => {
    if (!confirm("삭제할까요? (드라이브의 원본 파일은 지워지지 않습니다)")) return;
    try {
      await api("admin.library.delete", { adminToken: admin.adminToken, kind, id });
      await loadLib(); P.loadLibrary(); toast("삭제했습니다.");
      if (panel && panel.classList.contains("is-in")) show(tab);
    } catch (ex) { toast(ex.message, "err"); }
  };
  const openLink = (url) => { const d = S.parseDrive(url); return `<a href="${esc(d ? d.view : url)}" target="_blank" rel="noopener">열기 ↗</a>`; };

  async function library() {
    body().innerHTML = `<p class="ad-empty">불러오는 중…</p>`;
    await loadLib();
    const T = S.MAT_TYPES;
    const fileMats = weeks.flatMap((w) => (w.materials || []).map((m) => [w, m]));
    body().innerHTML = `
      <h3 class="ad-title">📚 자료 등록 <small>Google Drive 링크로 자료실·커리큘럼에 올립니다</small></h3>
      <form class="ad-card js-lib-add">
        <div class="ad-cols">
          <label class="ae-field"><span>주차</span><select name="week">${list(weeks, (w) => `<option value="${w.no}">${esc(w.label)} · ${esc(w.title)}</option>`)}</select></label>
          <label class="ae-field"><span>종류</span><select name="type"><option value="">자동으로 알아내기</option>${Object.keys(T).filter((t) => t !== "file").map((t) => `<option value="${t}">${T[t].icon} ${T[t].label}</option>`).join("")}</select></label>
        </div>
        <label class="ae-field"><span>자료 이름</span><input name="title" maxlength="80" placeholder="예) 강의 슬라이드: 읽기 지도 1" /></label>
        ${driveField("lib-url")}
        <p class="up__err js-lib-err"></p>
        <button class="btn btn--sm btn--primary">자료 올리기</button>
      </form>
      <h4 class="mc-sub">Drive로 올린 자료 ${lib.materials.length}개</h4>
      ${table(["주차", "자료 이름", "종류", "올린 날", "", ""], lib.materials.slice().sort((a, b) => a.week - b.week).map((m) => {
        const w = weeks.find((x) => x.no === Number(m.week));
        const t = m.type && T[m.type] ? T[m.type] : null;
        return [esc(w ? w.label : m.week + "주"), esc(m.title), t ? `${t.icon} ${t.label}` : "자동", esc(m.date || ""), openLink(m.url), `<button class="link-btn js-lib-del" data-id="${esc(m.id)}">삭제</button>`];
      }), "아직 Drive로 올린 자료가 없습니다.")}
      <h4 class="mc-sub">사이트 폴더에 들어 있는 자료 ${fileMats.length}개</h4>
      <p class="ad-hint">website/materials/ 폴더의 파일입니다. 바꾸려면 「사이트 편집 → 커리큘럼·일정 → 주차 → materials」에서 고치세요.</p>
      ${table(["주차", "자료 이름", "파일"], fileMats.map(([w, m]) => [esc(w.label), esc(m.title), esc(m.file || m.url || "")]), "없음")}`;
    const f = body().querySelector(".js-lib-add");
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = (n) => f.querySelector(`[name=${n}]`).value.trim();
      const err = f.querySelector(".js-lib-err");
      if (!v("title")) { err.textContent = "자료 이름을 입력해 주세요."; return; }
      const bad = checkDrive(v("url")); if (bad) { err.textContent = bad; return; }
      addLib("material", { week: Number(v("week")), title: v("title"), url: v("url"), type: v("type") }, () => library());
    });
    body().querySelectorAll(".js-lib-del").forEach((b) => b.addEventListener("click", () => delLib("material", b.dataset.id)));
  }

  async function portfolio() {
    body().innerHTML = `<p class="ad-empty">불러오는 중…</p>`;
    await loadLib();
    const cats = (C.portfolio && C.portfolio.categories) || [];
    const term = `${new Date().getFullYear()}-${new Date().getMonth() < 6 ? 1 : 2}학기`;
    body().innerHTML = `
      <h3 class="ad-title">🏆 포트폴리오 <small>학생 우수 과제물을 Google Drive 링크로 소개합니다</small></h3>
      <form class="ad-card js-pf-add">
        <label class="ae-field"><span>작품 제목</span><input name="title" maxlength="80" placeholder="예) AI 롤플레이를 활용한 依頼 표현 수업" /></label>
        <div class="ad-cols">
          <label class="ae-field"><span>학생 이름 (표시용)</span><input name="author" maxlength="30" placeholder="예) 김○○ / 3조" /></label>
          <label class="ae-field"><span>학기</span><input name="term" maxlength="20" value="${esc(term)}" /></label>
          <label class="ae-field"><span>분류</span><select name="category">${list(cats, (c) => `<option>${esc(c)}</option>`)}<option>기타</option></select></label>
        </div>
        <label class="ae-field"><span>소개 (선택)</span><textarea name="desc" rows="3" maxlength="300" placeholder="작품의 특징이나 좋았던 점을 2~3문장으로"></textarea></label>
        ${driveField("pf-url")}
        <label class="ae-field ae-field--bool"><input type="checkbox" name="thumb" checked /> 드라이브 미리보기 이미지를 카드에 표시</label>
        <label class="ae-field ae-field--bool"><input type="checkbox" name="consent" /> 학생에게 작품 공개 동의를 받았습니다</label>
        <p class="up__err js-pf-err"></p>
        <button class="btn btn--sm btn--primary">포트폴리오에 올리기</button>
      </form>
      <h4 class="mc-sub">올린 작품 ${lib.portfolio.length}개</h4>
      ${table(["분류", "제목", "학생", "학기", "올린 날", "", ""], lib.portfolio.slice().reverse().map((x) => [esc(x.category || ""), esc(x.title), esc(x.author || ""), esc(x.term || ""), esc(x.date || ""), openLink(x.url), `<button class="link-btn js-pf-del" data-id="${esc(x.id)}">삭제</button>`]), "아직 올린 작품이 없습니다.")}`;
    const f = body().querySelector(".js-pf-add");
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = (n) => f.querySelector(`[name=${n}]`).value.trim();
      const err = f.querySelector(".js-pf-err");
      if (!v("title")) { err.textContent = "작품 제목을 입력해 주세요."; return; }
      const bad = checkDrive(v("url")); if (bad) { err.textContent = bad; return; }
      if (!f.querySelector("[name=consent]").checked) { err.textContent = "학생의 공개 동의를 받은 작품만 올릴 수 있습니다."; return; }
      addLib("portfolio", { title: v("title"), author: v("author"), term: v("term"), category: v("category"), desc: v("desc"), url: v("url"), thumb: f.querySelector("[name=thumb]").checked }, () => portfolio());
    });
    body().querySelectorAll(".js-pf-del").forEach((b) => b.addEventListener("click", () => delLib("portfolio", b.dataset.id)));
  }

  /* ---------- 출석 현황 ---------- */
  const people = () => {
    const map = new Map();
    (data.students || []).forEach((s) => map.set(String(s.id), s.name));
    [...data.attendance, ...data.submissions].forEach((r) => { if (!map.has(String(r.id))) map.set(String(r.id), r.name || ""); });
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.id.localeCompare(b.id));
  };
  function attMatrix() {
    const t0 = S.today0(), rec = new Map();
    data.attendance.forEach((a) => rec.set(`${a.id}|${a.date}`, a.time));
    const past = sessions.filter((s) => s.date <= new Date());
    return people().map((p) => {
      const cells = sessions.map((s) => rec.has(`${p.id}|${s.key}`) ? { s: "O", t: rec.get(`${p.id}|${s.key}`) } : s.date < t0 ? { s: "X" } : { s: "" });
      const n = cells.filter((c) => c.s === "O").length;
      return { ...p, cells, n, rate: past.length ? Math.round((n / past.length) * 100) : 0 };
    });
  }
  function att() {
    const rows = attMatrix();
    body().innerHTML = `
      <div class="ad-row">
        <h3 class="ad-title">✅ 출석 현황 <small>${rows.length}명</small></h3>
        <button class="btn btn--sm btn--primary js-att-csv">엑셀로 내려받기(.csv)</button>
      </div>
      <p class="ad-hint">O 출석 · X 결석 · 빈칸 예정. ${REMOTE ? "출석 코드는 스프레드시트의 「출석코드」 시트에서 수업일마다 입력합니다." : `체험 모드 출석 코드: <code>${esc((C.myclass.attendance || {}).demoCode || "")}</code>`}</p>
      ${table(["학번", "이름", ...sessions.map((s) => `${esc(s.label)}<br><small>${s.date.getMonth() + 1}/${s.date.getDate()}</small>`), "출석", "출석률"],
        rows.map((r) => [esc(r.id), esc(r.name), ...r.cells.map((c) => c.s === "O" ? `<span class="ad-o" title="${esc(c.t)}">O</span>` : c.s === "X" ? `<span class="ad-x">X</span>` : ""), r.n, `${r.rate}%`]),
        "명단이나 출석 기록이 없습니다.")}`;
    body().querySelector(".js-att-csv").addEventListener("click", () => download(`출석현황_${today()}.csv`, toCSV([
      ["학번", "이름", ...sessions.map((s) => `${s.label}(${s.date.getMonth() + 1}/${s.date.getDate()})`), "출석 수", "출석률(%)"],
      ...rows.map((r) => [r.id, r.name, ...r.cells.map((c) => c.s), r.n, r.rate]),
    ])));
  }

  /* ---------- 과제 제출 ---------- */
  let hwFilter = "";
  function hw() {
    const hwWeeks = weeks.filter((w) => w.assignment);
    const subs = data.submissions.filter((s) => !hwFilter || String(s.hw) === hwFilter).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
    let missing = "";
    if (hwFilter) {
      const done = new Set(subs.map((s) => String(s.id)));
      const miss = (data.students || []).filter((s) => !done.has(String(s.id)));
      missing = `<div class="ad-card"><h4>미제출 ${miss.length}명</h4><p>${miss.length ? list(miss, (s) => `<span class="tag">${esc(s.name)} ${esc(s.id)}</span> `) : "모두 제출했습니다 🎉"}</p></div>`;
    }
    body().innerHTML = `
      <div class="ad-row">
        <h3 class="ad-title">📤 과제 제출 <small>${subs.length}건</small></h3>
        <div class="ad-edit-btns">
          <select class="js-hw-filter" aria-label="과제 선택"><option value="">전체 과제</option>${list(hwWeeks, (w) => `<option value="${w.no}" ${String(w.no) === hwFilter ? "selected" : ""}>${esc(w.label)} · ${esc(w.assignment.title)}</option>`)}</select>
          <button class="btn btn--sm btn--primary js-hw-csv">엑셀로 내려받기(.csv)</button>
        </div>
      </div>
      ${missing}
      ${table(["제출 시각", "학번", "이름", "과제", "파일", "상태"], subs.map((s) => [esc(s.at), esc(s.id), esc(s.name || ""), esc(s.hwTitle),
        s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.fileName)}</a>` : esc(s.fileName), s.late ? `<span class="chip chip--hw">지각</span>` : `<span class="chip chip--next">정상</span>`]),
        "제출된 과제가 없습니다.")}
      ${REMOTE ? "" : `<p class="demo-note">🧪 체험 모드에서는 파일 이름만 기록됩니다. 운영 모드에서는 파일이 Google 드라이브에 저장되고 여기서 바로 열 수 있습니다.</p>`}`;
    body().querySelector(".js-hw-filter").addEventListener("change", (e) => { hwFilter = e.target.value; hw(); });
    body().querySelector(".js-hw-csv").addEventListener("click", () => download(`과제제출_${today()}.csv`, toCSV([
      ["제출 시각", "학번", "이름", "주차", "과제", "파일명", "파일 링크", "지각"],
      ...subs.map((s) => [s.at, s.id, s.name || "", s.hw, s.hwTitle, s.fileName, s.url || "", s.late ? "지각" : ""]),
    ])));
  }

  /* ---------- 수강 신청 내역 ---------- */
  function apply() {
    const fields = C.apply.fields;
    const apps = data.applications.slice().reverse();
    const at = (a) => a.submittedAt || a["제출시각"] || "";
    body().innerHTML = `
      <div class="ad-row">
        <h3 class="ad-title">📝 수강 신청 내역 <small>${apps.length}건</small></h3>
        <button class="btn btn--sm btn--primary js-ap-csv">엑셀로 내려받기(.csv)</button>
      </div>
      ${table(["제출 시각", ...fields.map((f) => esc(f.short || f.label))], apps.map((a) => [esc(at(a)), ...fields.map((f) => esc(a[f.name] || ""))]), "접수된 신청서가 없습니다.")}`;
    body().querySelector(".js-ap-csv").addEventListener("click", () => download(`수강신청_${today()}.csv`, toCSV([
      ["제출 시각", ...fields.map((f) => f.short || f.label)],
      ...apps.map((a) => [at(a), ...fields.map((f) => a[f.name] || "")]),
    ])));
  }

  /* ---------- 설정 파일 ---------- */
  const configText = (cfg) => `/* =========================================================
 *  사이트 설정 파일 — 관리자 화면에서 ${today()}에 저장
 *  이 파일로 website/config.js 를 바꾸면 모든 방문자에게 적용됩니다.
 * ========================================================= */
window.SITE_CONFIG = ${JSON.stringify(cfg, null, 2)};
`;
  const parseConfig = (text) => {
    const t = text.replace(/^﻿/, "").trim();
    if (t.startsWith("{")) return JSON.parse(t);
    // config.js 형식: 별도 함수 안에서 실행해 SITE_CONFIG 값만 꺼냄 (본인이 고른 파일만 불러오세요)
    const fake = {};
    new Function("window", t)(fake);
    if (!fake.SITE_CONFIG) throw new Error("SITE_CONFIG를 찾을 수 없습니다.");
    return fake.SITE_CONFIG;
  };

  function file() {
    body().innerHTML = `
      <h3 class="ad-title">💾 설정 파일</h3>
      <div class="ad-state ${window.SITE_CONFIG_OVERRIDDEN ? "is-on" : ""}">
        ${window.SITE_CONFIG_OVERRIDDEN
          ? `✏️ 지금 이 브라우저는 <b>관리자가 고친 설정(미리보기)</b>을 보여 주고 있습니다. 다른 사람에게는 아직 원래 config.js 내용이 보입니다.`
          : `✅ 지금 화면은 <b>config.js 파일 그대로</b>입니다.`}
      </div>
      <div class="ad-cols">
        <section class="ad-card">
          <h4>① 파일로 저장</h4>
          <p class="ad-hint">현재 설정(미리보기 포함)을 <b>config.js</b>로 내려받습니다. 이 파일로 <code>website/config.js</code>를 바꾸고 다시 배포하면 모두에게 적용됩니다. JSON 백업도 받을 수 있습니다.</p>
          <div class="ad-edit-btns"><button class="btn btn--sm btn--primary js-f-js">config.js 내려받기</button><button class="btn btn--sm btn--ghost js-f-json">JSON 백업</button></div>
        </section>
        <section class="ad-card">
          <h4>② 파일에서 불러오기</h4>
          <p class="ad-hint">저장해 둔 config.js 또는 JSON 백업을 불러와 미리보기로 적용합니다.</p>
          <label class="btn btn--sm btn--ghost ad-file">파일 선택…<input type="file" accept=".js,.json,application/json,text/javascript" class="js-f-load" hidden /></label>
        </section>
        <section class="ad-card">
          <h4>③ 미리보기 해제</h4>
          <p class="ad-hint">이 브라우저의 미리보기 설정을 지우고 config.js 파일 내용으로 돌아갑니다.</p>
          <button class="btn btn--sm btn--ghost js-f-reset" ${window.SITE_CONFIG_OVERRIDDEN ? "" : "disabled"}>config.js 상태로 되돌리기</button>
        </section>
        <form class="ad-card js-f-pw">
          <h4>④ 관리자 비밀번호 변경</h4>
          <label class="ae-field"><span>현재 비밀번호</span><input type="password" name="cur" autocomplete="current-password" /></label>
          <label class="ae-field"><span>새 비밀번호 (8자 이상)</span><input type="password" name="pw1" autocomplete="new-password" /></label>
          <label class="ae-field"><span>새 비밀번호 확인</span><input type="password" name="pw2" autocomplete="new-password" /></label>
          <p class="up__err js-pw-err"></p>
          <button class="btn btn--sm btn--primary">비밀번호 바꾸기</button>
          <p class="ad-hint">바꾼 뒤 ①에서 config.js를 내려받아 교체해야 다른 기기에도 적용됩니다.${REMOTE ? " 운영 모드의 데이터 비밀번호는 Apps Script의 setAdminPassword로 따로 바꿉니다." : ""}</p>
        </form>
      </div>`;
    const current = () => clone(draft || C);
    body().querySelector(".js-f-js").addEventListener("click", () => download("config.js", configText(current()), "text/javascript;charset=utf-8"));
    body().querySelector(".js-f-json").addEventListener("click", () => download(`site-config_${today()}.json`, JSON.stringify(current(), null, 2), "application/json"));
    body().querySelector(".js-f-load").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const cfg = parseConfig(await f.text());
        if (!cfg.site || !cfg.nav) throw new Error("사이트 설정 파일이 아닌 것 같습니다.");
        if (!confirm(`「${f.name}」 설정을 미리보기로 적용할까요?`)) return;
        applyOverride(cfg, "file");
      } catch (ex) { toast(`불러오지 못했습니다: ${ex.message}`, "err"); }
    });
    body().querySelector(".js-f-reset").addEventListener("click", () => {
      if (!confirm("미리보기 설정을 지우고 config.js 내용으로 돌아갈까요? (내려받지 않은 편집 내용은 사라집니다)")) return;
      try { localStorage.removeItem("kj_config_override"); } catch (e) {}
      ss.set("kj_admin_tab", "file"); ss.set("kj_admin_reopen", true); location.reload();
    });
    body().querySelector(".js-f-pw").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, err = f.querySelector(".js-pw-err");
      const cur = f.querySelector("[name=cur]").value, p1 = f.querySelector("[name=pw1]").value, p2 = f.querySelector("[name=pw2]").value;
      if ((await sha256(C.admin.salt + cur)) !== C.admin.passwordHash) { err.textContent = "현재 비밀번호가 올바르지 않습니다."; return; }
      if (p1.length < 8) { err.textContent = "새 비밀번호는 8자 이상이어야 합니다."; return; }
      if (p1 !== p2) { err.textContent = "새 비밀번호가 서로 다릅니다."; return; }
      const salt = randomHex(8);
      const cfg = current();
      cfg.admin = { salt, passwordHash: await sha256(salt + p1) };
      toast("비밀번호를 바꿨습니다. config.js를 내려받아 교체하세요.");
      applyOverride(cfg, "file");
    });
  }

  /* =========================================================
   *  화면 위 수정·삭제 버튼 (커리큘럼 주차 · 수업 자료 · 포트폴리오)
   *  - 설정 파일 항목: 미리보기로 적용 → 「설정 파일」에서 config.js를 내려받아 교체해야 모두에게 보임
   *  - Drive로 올린 항목: 바로 저장 (체험 모드는 이 브라우저, 운영 모드는 Google 시트)
   * ========================================================= */
  const CFG_NOTE = "설정 파일(config.js)에 들어 있는 항목입니다. 저장하면 이 브라우저에 미리보기로 적용되고, 수강생에게 보이게 하려면 관리자 화면 → 「설정 파일」에서 config.js를 내려받아 교체하세요.";
  const LIB_NOTE = `관리자 화면에서 Google Drive 주소로 올린 항목입니다. 저장하면 ${REMOTE ? "모든 방문자에게" : "이 브라우저(체험 모드)에"} 바로 반영됩니다.`;
  const lines = (s) => String(s || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const anchorOf = (btn) => (btn.closest(".wk") || btn.closest("section[id]") || {}).id || "";

  // fields: [{ name, label, hint, type: text|url|textarea|select|check, value, options: [[값, 표시]], placeholder, rows }]
  // onSave(values)가 문자열을 돌려주면 오류로 표시
  function formModal(title, note, fields, onSave) {
    const fieldHtml = (f) => {
      const v = f.value == null ? "" : f.value, ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
      if (f.type === "check") return `<label class="ae-field ae-field--bool"><input type="checkbox" name="${f.name}" ${v ? "checked" : ""} /> ${esc(f.label)}</label>`;
      const ctl = f.type === "textarea" ? `<textarea name="${f.name}" rows="${f.rows || 3}"${ph}>${esc(v)}</textarea>`
        : f.type === "select" ? `<select name="${f.name}">${list(f.options, ([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? "selected" : ""}>${esc(ol)}</option>`)}</select>`
        : `<input name="${f.name}" type="${f.type || "text"}" value="${esc(v)}"${ph} />`;
      return `<label class="ae-field"><span>${esc(f.label)}${f.hint ? ` <small>${esc(f.hint)}</small>` : ""}</span>${ctl}</label>`;
    };
    const m = P.openModal(`<form class="adm-form" novalidate>
        <h3>✏️ ${esc(title)}</h3>
        <p class="ad-hint">${esc(note)}</p>
        <div class="adm-form__fields">${list(fields, fieldHtml)}</div>
        <p class="up__err adm-form__err" role="alert"></p>
        <div class="adm-form__btns"><button type="button" class="btn btn--sm btn--ghost" data-close>취소</button><button class="btn btn--sm btn--primary">저장</button></div>
      </form>`, "modal__box--form");
    const f = m.querySelector("form"), err = f.querySelector(".adm-form__err"), btn = f.querySelector(".btn--primary");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = {};
      fields.forEach((x) => { const el = f.querySelector(`[name="${x.name}"]`); v[x.name] = x.type === "check" ? el.checked : el.value.trim(); });
      btn.disabled = true; err.textContent = "";
      try { const msg = await onSave(v); if (msg) { err.textContent = msg; btn.disabled = false; } }
      catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    });
  }

  // 설정 파일 항목 고치기: 현재 설정을 복사해 고친 뒤 미리보기로 적용하고, 새로고침 뒤 같은 위치로 돌아옴
  const saveCfg = (mutate, anchor, msg) => {
    const cfg = clone(C); mutate(cfg);
    ss.set("kj_admin_msg", msg);
    applyOverride(cfg, null, anchor || "top");
  };
  const findLib = async (kind, id) => { await loadLib(); return (kind === "portfolio" ? lib.portfolio : lib.materials).find((x) => String(x.id) === String(id)); };
  const updLib = async (kind, id, item) => {
    await api("admin.library.update", { adminToken: admin.adminToken, kind, id, item });
    await loadLib(); P.loadLibrary(); P.closeModal(); toast("고쳤습니다 ✏️");
    if (panel && panel.classList.contains("is-in")) show(tab);
  };
  const notFound = () => toast("항목을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.", "err");
  const weekOpts = () => weeks.map((w) => [w.no, `${w.label} · ${w.title}`]);
  const typeOpts = () => [["", "자동으로 알아내기"], ...Object.keys(S.MAT_TYPES).filter((t) => t !== "file").map((t) => [t, `${S.MAT_TYPES[t].icon} ${S.MAT_TYPES[t].label}`])];
  const isUrl = (u) => /^https?:\/\//.test(u);

  /* ---------- 커리큘럼 주차 ---------- */
  function editWeek(i) {
    const w = C.curriculum.weeks[i]; if (!w) return notFound();
    const a = w.assignment || {}, no = i + 1, label = w.week || `${no}주`;
    formModal(`${label} 수정`, CFG_NOTE, [
      { name: "week", label: "주차 표시", hint: "(비우면 자동)", value: w.week || "", placeholder: `${no}주` },
      { name: "title", label: "제목", value: w.title },
      { name: "desc", label: "한 줄 설명", value: w.desc },
      { name: "tags", label: "태그", hint: "(쉼표로 구분)", value: (w.tags || []).join(", ") },
      { name: "content", label: "학습 내용", hint: "(한 줄에 하나)", type: "textarea", rows: 4, value: (w.content || []).join("\n") },
      { name: "videos", label: "참고 영상", hint: "(한 줄에 「제목 | 주소」)", type: "textarea", rows: 3, value: (w.videos || []).map((x) => `${x.title} | ${x.url}`).join("\n") },
      { name: "time", label: "수업 시간", hint: "(비우면 기본값)", value: w.time || "", placeholder: C.curriculum.time },
      { name: "location", label: "강의실", hint: "(비우면 기본값)", value: w.location || "", placeholder: C.curriculum.location },
      { name: "hw", label: "이 주에 과제가 있음", type: "check", value: !!w.assignment },
      { name: "hwTitle", label: "과제 제목", value: a.title || "" },
      { name: "hwDesc", label: "과제 설명", type: "textarea", value: a.desc || "" },
      { name: "hwDue", label: "과제 마감", hint: "(YYYY-MM-DD HH:MM)", value: a.due || "", placeholder: "2026-10-18 23:59" },
      { name: "hwUrl", label: "제출 링크", hint: "(비우면 사이트의 수강생 공간에서 제출)", type: "url", value: a.submitUrl || "" },
    ], (v) => {
      if (!v.title) return "제목을 입력해 주세요.";
      const videos = [];
      for (const l of lines(v.videos)) {
        const k = l.indexOf("|"), t = k < 0 ? "" : l.slice(0, k).trim(), u = (k < 0 ? l : l.slice(k + 1)).trim();
        if (!isUrl(u)) return `참고 영상 주소가 올바르지 않습니다: ${l}`;
        videos.push({ title: t || "참고 영상", url: u });
      }
      if (v.hw) {
        if (!v.hwTitle) return "과제 제목을 입력해 주세요.";
        if (!/^\d{4}-\d{2}-\d{2}( \d{1,2}:\d{2})?$/.test(v.hwDue)) return "과제 마감은 2026-10-18 23:59 형식으로 적어 주세요.";
        if (v.hwUrl && !isUrl(v.hwUrl)) return "제출 링크는 http:// 또는 https://로 시작해야 합니다.";
      }
      saveCfg((cfg) => {
        const nw = cfg.curriculum.weeks[i];
        const opt = (k, val) => { if (val) nw[k] = val; else delete nw[k]; };
        opt("week", v.week); nw.title = v.title; nw.desc = v.desc;
        nw.tags = v.tags.split(/[,，、]/).map((x) => x.trim()).filter(Boolean);
        nw.content = lines(v.content); nw.videos = videos;
        opt("time", v.time); opt("location", v.location);
        if (v.hw) nw.assignment = { ...(nw.assignment || {}), title: v.hwTitle, desc: v.hwDesc, due: v.hwDue, submitUrl: v.hwUrl };
        else delete nw.assignment;
      }, `week-${no}`, `「${v.week || label}」 주차를 고쳤습니다.`);
    });
  }
  function delWeek(i) {
    const w = C.curriculum.weeks[i]; if (!w) return notFound();
    const label = w.week || `${i + 1}주`;
    if (!confirm(`「${label} · ${w.title}」 주차를 커리큘럼에서 삭제할까요?\n\n· 뒤의 주차가 한 주씩 앞당겨지고 수업 날짜도 다시 계산됩니다.\n· 이 주의 수업 자료(설정 파일)도 함께 빠집니다.\n· Drive로 올린 자료는 주차 번호로 연결되어 있어 다른 주에 붙을 수 있으니 「자료 등록」에서 확인하세요.`)) return;
    saveCfg((cfg) => cfg.curriculum.weeks.splice(i, 1), "curriculum", `「${label} · ${w.title}」 주차를 삭제했습니다.`);
  }

  /* ---------- 수업 자료 (커리큘럼 안 · 자료실) ---------- */
  async function editMat(d, btn) {
    if (d.src === "lib") {
      const m = await findLib("material", d.id); if (!m) return notFound();
      return formModal("자료 수정", LIB_NOTE, [
        { name: "week", label: "주차", type: "select", options: weekOpts(), value: m.week },
        { name: "title", label: "자료 이름", value: m.title },
        { name: "type", label: "종류", type: "select", options: typeOpts(), value: m.type || "" },
        { name: "url", label: "Google Drive 주소", type: "url", value: m.url },
      ], (v) => {
        if (!v.title) return "자료 이름을 입력해 주세요.";
        const bad = checkDrive(v.url); if (bad) return bad;
        return updLib("material", m.id, { week: Number(v.week), title: v.title, type: v.type, url: v.url });
      });
    }
    const wi = Number(d.wk) - 1, mi = Number(d.i), m = ((C.curriculum.weeks[wi] || {}).materials || [])[mi];
    if (!m) return notFound();
    formModal("자료 수정", CFG_NOTE, [
      { name: "week", label: "주차", type: "select", options: weekOpts(), value: wi + 1 },
      { name: "title", label: "자료 이름", value: m.title },
      { name: "type", label: "종류", type: "select", options: typeOpts(), value: m.type || "" },
      { name: "file", label: "파일 이름", hint: "(website/materials 폴더 안)", value: m.file || "", placeholder: "w03-ai.pptx" },
      { name: "url", label: "또는 링크 주소", hint: "(파일 대신 링크일 때)", type: "url", value: m.url || "" },
      { name: "size", label: "크기", hint: "(표시용, 선택)", value: m.size || "", placeholder: "120KB" },
    ], (v) => {
      if (!v.title) return "자료 이름을 입력해 주세요.";
      if (!v.file && !v.url) return "파일 이름이나 링크 주소 중 하나를 적어 주세요.";
      if (!v.file && !isUrl(v.url)) return "링크 주소는 http:// 또는 https://로 시작해야 합니다.";
      const to = Number(v.week) - 1;
      saveCfg((cfg) => {
        const src = cfg.curriculum.weeks[wi].materials;
        const nm = { ...src[mi], title: v.title };
        ["type", "file", "url", "size"].forEach((k) => { if (v[k]) nm[k] = v[k]; else delete nm[k]; });
        if (v.file) delete nm.url; // 파일이 있으면 파일이 우선
        if (to === wi) src[mi] = nm;
        else { src.splice(mi, 1); const dst = cfg.curriculum.weeks[to]; (dst.materials = dst.materials || []).push(nm); }
      }, anchorOf(btn), `「${v.title}」 자료를 고쳤습니다.`);
    });
  }
  function delMat(d, btn) {
    if (d.src === "lib") return delLib("material", d.id);
    const wi = Number(d.wk) - 1, mi = Number(d.i), m = ((C.curriculum.weeks[wi] || {}).materials || [])[mi];
    if (!m) return notFound();
    if (!confirm(`「${m.title}」 자료를 삭제할까요?\n(website/materials 폴더의 파일 자체는 지워지지 않습니다)`)) return;
    saveCfg((cfg) => cfg.curriculum.weeks[wi].materials.splice(mi, 1), anchorOf(btn), `「${m.title}」 자료를 삭제했습니다.`);
  }

  /* ---------- 학생 포트폴리오 ---------- */
  const pfFields = (x, drive) => {
    const cats = [...((C.portfolio || {}).categories || []), "기타"];
    if (x.category && !cats.includes(x.category)) cats.unshift(x.category);
    return [
      { name: "title", label: "작품 제목", value: x.title },
      { name: "author", label: "학생 이름 (표시용)", value: x.author || "", placeholder: "김○○ / 3조" },
      { name: "term", label: "학기", value: x.term || "" },
      { name: "category", label: "분류", type: "select", options: [["", "(분류 없음)"], ...cats.map((c) => [c, c])], value: x.category || "" },
      { name: "desc", label: "소개", type: "textarea", value: x.desc || "" },
      { name: "url", label: drive ? "Google Drive 주소" : "작품 주소", type: "url", value: x.url },
      { name: "thumb", label: "드라이브 미리보기 이미지를 카드에 표시", type: "check", value: x.thumb !== false },
    ];
  };
  async function editPf(d) {
    if (d.src === "lib") {
      const x = await findLib("portfolio", d.id); if (!x) return notFound();
      return formModal("포트폴리오 수정", LIB_NOTE, pfFields(x, true), (v) => {
        if (!v.title) return "작품 제목을 입력해 주세요.";
        const bad = checkDrive(v.url); if (bad) return bad;
        return updLib("portfolio", x.id, v);
      });
    }
    const i = Number(d.i), x = ((C.portfolio || {}).items || [])[i]; if (!x) return notFound();
    formModal("포트폴리오 수정", CFG_NOTE, pfFields(x, false), (v) => {
      if (!v.title) return "작품 제목을 입력해 주세요.";
      if (!isUrl(v.url)) return "작품 주소는 http:// 또는 https://로 시작해야 합니다.";
      saveCfg((cfg) => {
        const it = cfg.portfolio.items[i];
        Object.assign(it, v);
        if (v.thumb) delete it.thumb; // 기본값(표시)이면 설정 파일에 남기지 않음
      }, "portfolio", `「${v.title}」 작품을 고쳤습니다.`);
    });
  }
  function delPf(d) {
    if (d.src === "lib") return delLib("portfolio", d.id);
    const i = Number(d.i), x = ((C.portfolio || {}).items || [])[i]; if (!x) return notFound();
    if (!confirm(`「${x.title}」 작품을 포트폴리오에서 삭제할까요?`)) return;
    saveCfg((cfg) => cfg.portfolio.items.splice(i, 1), "portfolio", `「${x.title}」 작품을 삭제했습니다.`);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-adm]"); if (!b) return;
    e.preventDefault();
    if (!admin) return;
    const d = b.dataset;
    ({
      "week-edit": () => editWeek(Number(d.i)), "week-del": () => delWeek(Number(d.i)),
      "mat-edit": () => editMat(d, b), "mat-del": () => delMat(d, b),
      "pf-edit": () => editPf(d), "pf-del": () => delPf(d),
    })[d.adm]();
  });

  // 화면에서 고친 뒤 새로고침되면 고친 곳으로 돌아가 알려 줌
  const backTo = ss.get("kj_admin_anchor");
  if (backTo) {
    const msg = ss.get("kj_admin_msg");
    ss.del("kj_admin_anchor"); ss.del("kj_admin_msg");
    setTimeout(() => {
      const el = document.getElementById(backTo);
      if (el) {
        el.scrollIntoView({ block: "start" });
        if (el.classList.contains("wk") && !el.classList.contains("is-open")) el.querySelector(".wk__head").click();
      }
      toast(`${msg || "고쳤습니다."} 수강생에게 보이게 하려면 「설정 파일」에서 config.js를 내려받아 교체하세요.`, "info");
    }, 200);
  }

  // 미리보기 적용 후 새로고침되면 관리자 화면을 다시 열어 줌
  if (admin && ss.get("kj_admin_reopen")) {
    ss.del("kj_admin_reopen");
    setTimeout(() => { openPanel(); if (window.SITE_CONFIG_OVERRIDDEN) toast("미리보기에 적용했습니다. 화면에서 확인해 보세요.", "info"); }, 150);
  }
  // 미리보기 중임을 관리자에게만 알림
  if (window.SITE_CONFIG_OVERRIDDEN) {
    const bar = document.createElement("div");
    bar.className = "preview-bar";
    bar.innerHTML = `✏️ 관리자 미리보기 중 — 이 브라우저에만 보입니다 <button class="link-btn">관리</button>`;
    bar.querySelector("button").addEventListener("click", () => openPanel("file"));
    document.body.appendChild(bar);
  }
})();

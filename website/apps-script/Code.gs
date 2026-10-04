/**
 * 일본어교과교재연구및지도법 강의 사이트 — Google Apps Script 백엔드
 * 사용법은 같은 폴더의 「설정방법.md」를 보세요.
 *
 * 스프레드시트 시트 구성 (setup() 실행 시 자동 생성)
 *  - 투표        : clientId | 선택지 | 시각
 *  - 수강신청    : 제출시각 | (신청서 항목들…)
 *  - 학생명단    : 학번 | 이름 | 인증코드          ← 교수자가 입력
 *  - 출석코드    : 날짜(yyyy-MM-dd) | 코드 | 시작(HH:mm) | 종료(HH:mm)  ← 교수자가 수업마다 입력
 *  - 출석        : 학번 | 이름 | 날짜 | 시각
 *  - 과제제출    : 제출시각 | 학번 | 이름 | 주차 | 과제 | 파일명 | 파일 링크 | 지각
 *  - 공지        : id | 날짜 | 제목 | 내용 | 중요   ← 사이트 관리자 화면에서 올림
 *  - 자료        : id | 날짜 | 주차 | 제목 | Drive 주소 | 종류      ← 관리자 화면 「자료 등록」
 *  - 포트폴리오  : id | 날짜 | 제목 | 학생 | 학기 | 분류 | 소개 | Drive 주소 | 미리보기 ← 「포트폴리오」
 */

const TZ = "Asia/Seoul";
const MAX_MB = 10;
const SESSION_HOURS = 6;

const SHEETS = {
  poll: ["clientId", "선택지", "시각"],
  apply: ["제출시각"],
  students: ["학번", "이름", "인증코드"],
  codes: ["날짜", "코드", "시작", "종료"],
  attendance: ["학번", "이름", "날짜", "시각"],
  submissions: ["제출시각", "학번", "이름", "주차", "과제", "파일명", "파일 링크", "지각"],
  notices: ["id", "날짜", "제목", "내용", "중요"],
  materials: ["id", "날짜", "주차", "제목", "Drive 주소", "종류"],
  portfolio: ["id", "날짜", "제목", "학생", "학기", "분류", "소개", "Drive 주소", "미리보기"],
};
const NAMES = { poll: "투표", apply: "수강신청", students: "학생명단", codes: "출석코드", attendance: "출석", submissions: "과제제출", notices: "공지", materials: "자료", portfolio: "포트폴리오" };

/**
 * 관리자 비밀번호 설정: 아래 따옴표 안에 비밀번호를 넣고 이 함수를 한 번 실행한 뒤,
 * 비밀번호를 다시 지우고 저장하세요. (스크립트 속성에는 SHA-256 값만 저장됩니다)
 */
function setAdminPassword() {
  const PASSWORD = "";
  if (PASSWORD.length < 8) throw new Error("8자 이상의 비밀번호를 PASSWORD에 넣고 실행하세요.");
  PropertiesService.getScriptProperties().setProperty("ADMIN_HASH", sha256_(PASSWORD));
  return "관리자 비밀번호를 설정했습니다. 코드에서 비밀번호를 지우고 저장하세요.";
}

/** 최초 1회 실행: 시트와 과제 저장 폴더를 만듭니다. */
function setup() {
  Object.keys(SHEETS).forEach((k) => sheet_(k));
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("FOLDER_ID")) {
    const folder = DriveApp.createFolder("일본어교과교재연구 — 과제 제출");
    props.setProperty("FOLDER_ID", folder.getId());
  }
  return "설정 완료";
}

function doGet() {
  return json_({ ok: true, data: "강의 사이트 백엔드가 동작 중입니다." });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const fn = HANDLERS[req.action];
    if (!fn) throw new Error("알 수 없는 요청입니다.");
    return json_({ ok: true, data: fn(req) });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

const HANDLERS = {
  /* ---------- 투표 ---------- */
  "poll.get": (req) => pollResult_(req.clientId),
  "poll.vote": (req) => {
    const option = String(req.option || "").slice(0, 50);
    if (!option || !req.clientId) throw new Error("잘못된 투표입니다.");
    withLock_(() => {
      const sh = sheet_("poll"), rows = sh.getDataRange().getValues();
      const idx = rows.findIndex((r, i) => i > 0 && r[0] === req.clientId);
      if (idx > 0) sh.getRange(idx + 1, 2, 1, 2).setValues([[option, now_()]]);
      else sh.appendRow([req.clientId, option, now_()]);
    });
    return pollResult_(req.clientId);
  },

  /* ---------- 수강 신청 ---------- */
  "apply.submit": (req) => {
    const form = req.form || {};
    if (!form.name || !form.sid) throw new Error("이름과 학번은 필수입니다.");
    withLock_(() => {
      const sh = sheet_("apply");
      let headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      const sidCol = headers.indexOf("sid");
      if (sidCol >= 0 && sh.getLastRow() > 1) {
        const sids = sh.getRange(2, sidCol + 1, sh.getLastRow() - 1, 1).getValues().map((r) => String(r[0]));
        if (sids.includes(String(form.sid))) throw new Error("이미 신청서를 제출한 학번입니다.");
      }
      Object.keys(form).forEach((k) => {
        if (!headers.includes(k)) { headers.push(k); sh.getRange(1, headers.length).setValue(k); }
      });
      sh.appendRow(headers.map((h) => (h === "제출시각" ? now_() : String(form[h] == null ? "" : form[h]).slice(0, 2000))));
    });
    return { ok: true };
  },

  /* ---------- 로그인 ---------- */
  "auth.login": (req) => {
    const id = String(req.id || "").trim(), code = String(req.code || "").trim();
    const row = sheet_("students").getDataRange().getValues().slice(1)
      .find((r) => String(r[0]).trim() === id && String(r[2]).trim() === code);
    if (!row) throw new Error("학번 또는 인증코드가 올바르지 않습니다.");
    const token = Utilities.getUuid();
    CacheService.getScriptCache().put("s_" + token, JSON.stringify({ id, name: String(row[1]) }), SESSION_HOURS * 3600);
    return { token, id, name: String(row[1]) };
  },

  /* ---------- 출석 ---------- */
  "attendance.list": (req) => {
    const me = auth_(req);
    return sheet_("attendance").getDataRange().getValues().slice(1)
      .filter((r) => String(r[0]) === me.id)
      .map((r) => ({ id: me.id, date: fmtDate_(r[2]), time: fmtTime_(r[3]) }));
  },
  "attendance.check": (req) => {
    const me = auth_(req);
    const today = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
    const nowHM = Utilities.formatDate(new Date(), TZ, "HH:mm");
    const codeRow = sheet_("codes").getDataRange().getValues().slice(1).find((r) => fmtDate_(r[0]) === today);
    if (!codeRow) throw new Error("오늘은 출석 체크가 열려 있지 않습니다.");
    const start = fmtTime_(codeRow[2]), end = fmtTime_(codeRow[3]);
    if ((start && nowHM < start) || (end && nowHM > end)) throw new Error("지금은 출석 가능 시간이 아닙니다.");
    if (String(codeRow[1]).trim().toUpperCase() !== String(req.code || "").trim().toUpperCase()) throw new Error("출석 코드가 올바르지 않습니다.");
    return withLock_(() => {
      const sh = sheet_("attendance");
      const dup = sh.getDataRange().getValues().slice(1).some((r) => String(r[0]) === me.id && fmtDate_(r[2]) === today);
      if (dup) throw new Error("이미 출석했습니다.");
      sh.appendRow([me.id, me.name, today, nowHM]);
      return { id: me.id, date: today, time: nowHM };
    });
  },

  /* ---------- 과제 제출 ---------- */
  "submit.upload": (req) => {
    const me = auth_(req);
    if (!req.data) throw new Error("파일이 없습니다.");
    const bytes = Utilities.base64Decode(req.data);
    if (bytes.length > MAX_MB * 1024 * 1024) throw new Error(`파일이 너무 큽니다. (최대 ${MAX_MB}MB)`);
    const safeName = String(req.name || "file").replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
    const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("FOLDER_ID"));
    const file = folder.createFile(Utilities.newBlob(bytes, req.type || "application/octet-stream", `${req.hw}주_${me.id}_${me.name}_${safeName}`));
    const at = now_();
    sheet_("submissions").appendRow([at, me.id, me.name, req.hw, String(req.hwTitle || "").slice(0, 100), safeName, file.getUrl(), req.late ? "지각" : ""]);
    return { hw: req.hw, hwTitle: req.hwTitle, fileName: safeName, at, late: !!req.late, url: "" };
  },
  "submit.list": (req) => {
    const me = auth_(req);
    return sheet_("submissions").getDataRange().getValues().slice(1)
      .filter((r) => String(r[1]) === me.id)
      .map((r) => ({ at: fmtDateTime_(r[0]), hw: r[3], hwTitle: r[4], fileName: r[5], late: r[7] === "지각", url: "" }));
  },

  /* ---------- 공지 (누구나 읽기) ---------- */
  "notices.list": () => sheet_("notices").getDataRange().getValues().slice(1)
    .map((r) => ({ id: String(r[0]), date: fmtDate_(r[1]), title: String(r[2]), text: String(r[3]), pinned: r[4] === true || r[4] === "Y" })),

  /* ---------- 자료실 · 포트폴리오 (누구나 읽기) ---------- */
  "library.list": () => ({
    materials: sheet_("materials").getDataRange().getValues().slice(1).filter((r) => r[0] !== "")
      .map((r) => ({ id: String(r[0]), date: fmtDate_(r[1]), week: Number(r[2]), title: String(r[3]), url: String(r[4]), type: String(r[5] || "") })),
    portfolio: sheet_("portfolio").getDataRange().getValues().slice(1).filter((r) => r[0] !== "")
      .map((r) => ({ id: String(r[0]), date: fmtDate_(r[1]), title: String(r[2]), author: String(r[3]), term: String(r[4]), category: String(r[5]), desc: String(r[6]), url: String(r[7]), thumb: r[8] !== "N" })),
  }),
  "admin.library.add": (req) => {
    adminAuth_(req);
    const it = req.item || {}, url = String(it.url || "").trim();
    if (!/^https:\/\/(drive|docs)\.google\.com\//.test(url)) throw new Error("Google Drive 주소만 등록할 수 있습니다.");
    if (!it.title) throw new Error("제목을 입력하세요.");
    const id = Utilities.getUuid(), date = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
    const s = (v, n) => String(v == null ? "" : v).slice(0, n);
    if (req.kind === "portfolio") {
      sheet_("portfolio").appendRow([id, date, s(it.title, 80), s(it.author, 30), s(it.term, 20), s(it.category, 30), s(it.desc, 300), url, it.thumb === false ? "N" : "Y"]);
    } else {
      sheet_("materials").appendRow([id, date, Number(it.week) || 0, s(it.title, 80), url, s(it.type, 10)]);
    }
    return { id, date };
  },
  "admin.library.update": (req) => {
    adminAuth_(req);
    const it = req.item || {}, url = String(it.url || "").trim();
    if (!/^https:\/\/(drive|docs)\.google\.com\//.test(url)) throw new Error("Google Drive 주소만 등록할 수 있습니다.");
    if (!it.title) throw new Error("제목을 입력하세요.");
    const s = (v, n) => String(v == null ? "" : v).slice(0, n);
    const key = req.kind === "portfolio" ? "portfolio" : "materials";
    return withLock_(() => {
      const sh = sheet_(key), rows = sh.getDataRange().getValues();
      const idx = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(req.id));
      if (idx < 1) throw new Error("항목을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.");
      // id(1열)·올린 날(2열)은 그대로 두고 3열부터 덮어씀
      const vals = key === "portfolio"
        ? [s(it.title, 80), s(it.author, 30), s(it.term, 20), s(it.category, 30), s(it.desc, 300), url, it.thumb === false ? "N" : "Y"]
        : [Number(it.week) || 0, s(it.title, 80), url, s(it.type, 10)];
      sh.getRange(idx + 1, 3, 1, vals.length).setValues([vals]);
      return { ok: true };
    });
  },
  "admin.library.delete": (req) => {
    adminAuth_(req);
    const key = req.kind === "portfolio" ? "portfolio" : "materials";
    return withLock_(() => {
      const sh = sheet_(key), rows = sh.getDataRange().getValues();
      const idx = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(req.id));
      if (idx > 0) sh.deleteRow(idx + 1);
      return { ok: true };
    });
  },

  /* ---------- 관리자 ---------- */
  "admin.login": (req) => {
    const hash = PropertiesService.getScriptProperties().getProperty("ADMIN_HASH");
    if (!hash) throw new Error("Apps Script에서 setAdminPassword를 먼저 실행하세요.");
    if (sha256_(String(req.password || "")) !== hash) throw new Error("관리자 비밀번호가 Apps Script 설정과 다릅니다.");
    const adminToken = Utilities.getUuid();
    CacheService.getScriptCache().put("a_" + adminToken, "1", SESSION_HOURS * 3600);
    return { adminToken };
  },
  "admin.data": (req) => {
    adminAuth_(req);
    const rows = (k) => sheet_(k).getDataRange().getValues();
    const ap = rows("apply"), heads = ap[0];
    return {
      students: rows("students").slice(1).filter((r) => r[0] !== "").map((r) => ({ id: String(r[0]), name: String(r[1]), code: String(r[2]) })),
      applications: ap.slice(1).map((r) => { const o = {}; heads.forEach((h, i) => (o[h] = h === "제출시각" ? fmtDateTime_(r[i]) : String(r[i]))); return o; }),
      attendance: rows("attendance").slice(1).map((r) => ({ id: String(r[0]), name: String(r[1]), date: fmtDate_(r[2]), time: fmtTime_(r[3]) })),
      submissions: rows("submissions").slice(1).map((r) => ({ at: fmtDateTime_(r[0]), id: String(r[1]), name: String(r[2]), hw: r[3], hwTitle: String(r[4]), fileName: String(r[5]), url: String(r[6]), late: r[7] === "지각" })),
      votes: pollResult_("").counts,
      notices: HANDLERS["notices.list"](),
    };
  },
  "admin.students.save": (req) => {
    adminAuth_(req);
    const list = (req.students || []).map((s) => [String(s.id), String(s.name), String(s.code)]);
    return withLock_(() => {
      const sh = sheet_("students");
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
      if (list.length) sh.getRange(2, 1, list.length, 3).setNumberFormat("@").setValues(list);
      return { count: list.length };
    });
  },
  "admin.notice.add": (req) => {
    adminAuth_(req);
    const n = req.notice || {};
    const row = { id: Utilities.getUuid(), date: Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"), title: String(n.title || "").slice(0, 80), text: String(n.text || "").slice(0, 2000), pinned: !!n.pinned };
    if (!row.title || !row.text) throw new Error("제목과 내용을 입력하세요.");
    sheet_("notices").appendRow([row.id, row.date, row.title, row.text, row.pinned ? "Y" : ""]);
    return row;
  },
  "admin.notice.delete": (req) => {
    adminAuth_(req);
    return withLock_(() => {
      const sh = sheet_("notices"), rows = sh.getDataRange().getValues();
      const idx = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(req.id));
      if (idx > 0) sh.deleteRow(idx + 1);
      return { ok: true };
    });
  },
};

/* ---------- 내부 도우미 ---------- */
function pollResult_(clientId) {
  const counts = {}; let mine = null;
  sheet_("poll").getDataRange().getValues().slice(1).forEach((r) => {
    counts[r[1]] = (counts[r[1]] || 0) + 1;
    if (r[0] === clientId) mine = r[1];
  });
  return { counts, mine };
}
function auth_(req) {
  const raw = req.token && CacheService.getScriptCache().get("s_" + req.token);
  if (!raw) throw new Error("로그인이 필요합니다. 다시 로그인해 주세요.");
  return JSON.parse(raw);
}
function adminAuth_(req) {
  if (!req.adminToken || !CacheService.getScriptCache().get("a_" + req.adminToken)) throw new Error("관리자 로그인이 필요합니다.");
}
function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}
function sheet_(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(NAMES[key]);
  if (!sh) {
    sh = ss.insertSheet(NAMES[key]);
    sh.getRange(1, 1, 1, SHEETS[key].length).setValues([SHEETS[key]]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function now_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm:ss"); }
function fmtDate_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd") : String(v || "").trim(); }
function fmtTime_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, "HH:mm") : String(v || "").trim(); }
function fmtDateTime_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd HH:mm") : String(v || "").slice(0, 16); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

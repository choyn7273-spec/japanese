/* =========================================================
 *  사이트 설정 파일 (이 파일 하나만 고치면 사이트 내용이 바뀝니다)
 *  - 따옴표(" ") 안의 글자만 바꾸면 됩니다.
 *  - 항목을 늘리거나 줄일 때는 { ... }, 단위로 복사/삭제하세요.
 *  - 줄바꿈이 필요하면 문장 안에 \n 을 넣으세요.
 *  - ★표시 항목은 예시 값이니 실제 내용으로 바꿔 주세요.
 * ========================================================= */
window.SITE_CONFIG = {
  /* ---------- 기본 정보 ---------- */
  site: {
    title: "일본어교과교재연구및지도법",
    titleJa: "日本語教科教材研究及び指導法",
    university: "고려대학교",
    department: "일어일문학과",
  },

  /* ---------- 상단 메뉴 (id는 아래 섹션과 연결됩니다) ---------- */
  nav: [
    { id: "about", label: "프로그램 소개" },
    { id: "curriculum", label: "커리큘럼" },
    { id: "materials", label: "자료실" },
    { id: "portfolio", label: "포트폴리오" },
    { id: "enroll", label: "수강 안내" },
    { id: "myclass", label: "수강생 공간" },
    { id: "faq", label: "FAQ" },
    { id: "instructor", label: "교수자" },
  ],

  /* =========================================================
   *  데이터 저장 방식
   *  - url이 비어 있으면 "체험 모드": 투표·신청서·출석·과제가 이 브라우저에만 저장됩니다.
   *  - Google Apps Script 웹앱 주소를 넣으면 "실제 운영 모드":
   *    모든 수강생의 데이터가 교수자의 Google 스프레드시트/드라이브에 모입니다.
   *    설정 방법은 apps-script/설정방법.md 를 참고하세요.
   * ========================================================= */
  backend: {
    url: "", // 예: "https://script.google.com/macros/s/XXXX/exec"
    pollRefreshSeconds: 10, // 투표 결과 자동 새로고침 간격(초)
  },

  /* ---------- 관리자 (오른쪽 위 자물쇠 아이콘) ----------
   * 비밀번호는 그대로 적지 않고 "salt + 비밀번호"의 SHA-256 값만 저장합니다.
   * 비밀번호를 바꾸려면 관리자 화면 → 설정 파일 → 비밀번호 변경을 이용하세요.
   */
  admin: {
    salt: "270f134b98aecd56",
    passwordHash: "70e43f87d8f54d136cb1e205a7c7c8ba3a6c676a50b76576460aedef7f58ca0c",
  },

  /* ---------- 공지사항 (관리자 화면에서 올린 공지도 함께 표시됩니다) ---------- */
  notices: [
    { date: "2026-08-17", title: "2026 하반기 수강 신청 안내", text: "수강 신청서는 이 사이트의 '수강 신청서'에서 작성할 수 있습니다. 첫 수업 전까지 AI 서비스 계정을 미리 만들어 두세요.", pinned: true },
  ],

  /* ---------- 첫 화면 ---------- */
  hero: {
    badge: "2026 하반기 집중 프로그램",
    title: "일본어교과교재연구및지도법",
    subtitle: "AI 기반 데이터 활용능력 배양",
    description:
      "제2언어습득 이론과 4기능(말하기·듣기·읽기·쓰기) 지도법을 바탕으로, 생성형 AI와 데이터 도구를 활용해 일본어 교재를 분석·설계하고 수업을 디자인하는 예비 교사 양성 과정입니다.",
    buttons: [
      // href: 수강 신청 링크가 있으면 "https://..." 로 바꾸세요
      { label: "수강 신청", href: "#apply", primary: true },
      { label: "커리큘럼 보기", href: "#curriculum", primary: false },
    ],
    // 첫 화면 아래 한눈에 보기 (icon: 이모지)
    facts: [
      { icon: "📅", label: "일정", value: "2026. 9. ~ 12. (15주)" },
      { icon: "⏰", label: "시간", value: "매주 월·수 15:00 ~ 16:15" },
      { icon: "💻", label: "수업 방식", value: "대면 강의 + AI 실습" },     // ★
      { icon: "🎓", label: "수강 대상", value: "일본어 교육 관심자" },
    ],
  },

  /* ---------- 숫자 강조 카드 (value는 숫자만, suffix는 단위) ---------- */
  stats: [
    { value: 15, suffix: "주", label: "체계적인 과정" },
    { value: 6, suffix: "개", label: "실습 AI 도구" },
    { value: 10, suffix: "권+", label: "저술·역서" },     // ★
    { value: 20, suffix: "년+", label: "강의 경력" },     // ★
  ],

  /* ---------- 프로그램 소개 + 장점 슬라이드 ---------- */
  about: {
    title: "프로그램 소개",
    lead:
      "‘무엇을, 어떻게 가르칠 것인가’를 이론과 데이터, AI 실습으로 함께 고민합니다. 좌우로 넘겨 이 강의의 장점을 살펴보세요.",
    slides: [
      { icon: "📚", title: "이론에서 실천으로", text: "제2언어습득 연구의 성과를 실제 교실 수업 설계로 연결합니다." },
      { icon: "🤖", title: "AI 실습 중심", text: "생성형 AI로 교재 초안 작성, 문항 생성, 피드백 설계를 직접 해 봅니다." },
      { icon: "📊", title: "데이터 활용능력", text: "학습자 오류·코퍼스·설문 데이터를 정리하고 분석해 수업 개선에 활용합니다." },
      { icon: "🗣️", title: "4기능 지도법", text: "말하기·듣기·읽기·쓰기 기능별 학습 분석과 수업 디자인 방법을 익힙니다." },
      { icon: "🎴", title: "교재 창작", text: "독해 자료, 그림연극(紙芝居) 등 나만의 교재를 만들어 봅니다." },
      { icon: "👩‍🏫", title: "모의수업 피드백", text: "교수학습과정안을 작성하고 모의수업 후 동료·교수자 피드백을 받습니다." },
    ],
  },

  /* ---------- 커리큘럼 (주차별) ---------- */
  /*
   *  ▸ 1주차 = 개강일(startDate)이 들어 있는 주이며, 매주 days의 요일마다 수업이 잡힙니다.
   *    개강일 이전 요일과 holidays(휴강일)는 수업에서 빠지고, 주차 내용은 밀리지 않습니다.
   *    특정 주의 수업일만 바꾸려면 그 주에 dates: ["2026-10-06", "2026-10-07"] 처럼 적으세요.
   *  ▸ materials: 수업 자료. 파일은 website/materials/ 폴더에 넣고 file: "파일명"으로 적거나,
   *    구글 드라이브·LMS 링크면 url: "https://..." 로 적으세요. size는 표시용(선택).
   *  ▸ 주차별로 time / location을 적으면 기본값 대신 그 값이 표시됩니다.
   *  ▸ 과제가 있는 주에만 assignment를 넣으세요.
   *    due: "YYYY-MM-DD HH:MM" (24시간제), submitUrl: 제출 링크(LMS·구글폼 등)
   *  ▸ videos의 url은 지금은 YouTube 검색 결과 링크입니다. 실제 영상 주소로 바꿔 주세요.
   */
  curriculum: {
    title: "커리큘럼",
    lead: "주차를 누르면 일정, 학습 내용, 수업 자료, 참고 영상, 과제를 확인할 수 있습니다.",
    startDate: "2026-09-01", // 개강일 (이날이 들어 있는 주가 1주차)
    days: ["월", "수"], // 수업 요일
    time: "15:00 ~ 16:15", // 기본 수업 시간
    location: "○○관 ○○○호", // 기본 강의실 ★
    holidays: [
      { date: "2026-10-05", label: "개천절 대체공휴일" },
    ],
    weeks: [
      {
        title: "오리엔테이션", desc: "강의 목표, AI 실습 환경 준비, 평가 방법 안내", tags: ["안내"],
        content: ["강의 목표와 15주 진행 방식 소개", "평가 방법과 모의수업 조 편성 안내", "AI 서비스 계정 만들기와 실습 환경 점검"],
        materials: [
          { title: "오리엔테이션 슬라이드", file: "w01-orientation.pptx", size: "107KB" },
        ],
        videos: [],
      },
      {
        title: "수업에 활용할 수 있는 제2언어습득의 성과", desc: "授業に活用できる第二言語習得の成果", tags: ["이론"],
        content: ["インプット・インタラクション・アウトプット 가설", "명시적 지도와 암시적 지도", "교실 수업에 주는 시사점 토론"],
        videos: [{ title: "제2언어습득 이론 개관", url: "https://www.youtube.com/results?search_query=第二言語習得+入門" }],
        materials: [
          { title: "강의 슬라이드: 授業に活用できる第二言語習得の成果", file: "w02-sla.pptx", size: "76KB" },
          { title: "강의 자료 (일본어)", file: "w02-sla-handout.docx", size: "29KB" },
        ],
      },
      {
        title: "생성형 AI와 일본어 교육", desc: "프롬프트 기초와 교육적 활용·한계", tags: ["AI"],
        content: ["생성형 AI의 원리와 한계 (환각, 편향)", "교사를 위한 프롬프트 작성 기초", "AI로 예문·연습문제 만들기 실습"],
        videos: [{ title: "생성형 AI 교육 활용 사례", url: "https://www.youtube.com/results?search_query=생성형+AI+외국어+교육+활용" }],
        assignment: {
          title: "AI 프롬프트 실습 보고서",
          desc: "교과서 1개 단원을 골라 AI로 연습문제 5개를 만들고, 사용한 프롬프트와 수정 과정을 정리해 제출하세요.",
          due: "2026-09-20 23:59",
          submitUrl: "", // ★ 제출 링크
        },
      },
      {
        title: "학습 분석과 디자인 ① 회화 지도", desc: "話すことをどう教えるか — AI 롤플레이 활용", tags: ["말하기", "AI"],
        content: ["회화 능력의 구성 요소 분석", "태스크 중심 회화 활동 설계", "AI 롤플레이 상대를 활용한 말하기 연습"],
        videos: [{ title: "日本語 会話授業 例", url: "https://www.youtube.com/results?search_query=日本語教育+会話+授業" }],
        materials: [
          { title: "강의 슬라이드: 일본어 회화 지도", file: "w04-speaking.pptx", size: "746KB" },
          { title: "강의 자료: 話すことをどう教えるか", file: "w04-speaking-handout.docx", size: "408KB" },
        ],
      },
      {
        title: "학습 분석과 디자인 ② 청해 지도", desc: "聴くことをどう教えるか — 듣기 자료 제작", tags: ["듣기"],
        content: ["청해 과정: 상향식·하향식 처리", "듣기 전·중·후 활동 설계", "TTS·AI로 듣기 자료 만들기"],
        videos: [{ title: "聴解指導の方法", url: "https://www.youtube.com/results?search_query=日本語教育+聴解+指導" }],
        materials: [
          { title: "강의 슬라이드: 청해 지도", file: "w05-listening.pptx", size: "1.2MB" },
          { title: "강의 자료: 聴くことをどう教えるか", file: "w05-listening-handout.docx", size: "1.1MB" },
        ],
      },
      {
        title: "학습 분석과 디자인 ③ 읽기 지도 1", desc: "読むことを教える — 톱다운·보텀업 읽기", tags: ["읽기"],
        content: ["톱다운 읽기와 보텀업 읽기", "스키마 활성화 활동", "독해 자료(アロマオイルの効果) 분석"],
        videos: [{ title: "読解指導 トップダウン", url: "https://www.youtube.com/results?search_query=日本語教育+読解+トップダウン" }],
        materials: [
          { title: "강의 슬라이드: 읽기 지도 1", file: "w06-reading1.pptx", size: "260KB" },
          { title: "강의 자료: 読むことを教える 1", file: "w06-reading1-handout.docx", size: "48KB" },
          { title: "예시: トップダウンの読みの例", file: "w06-topdown-example.docx", size: "363KB" },
        ],
      },
      {
        title: "학습 분석과 디자인 ④ 읽기 지도 2", desc: "AI로 난이도별 독해 자료 만들기", tags: ["읽기", "AI"],
        content: ["학습자 수준에 맞는 텍스트 난이도 조정", "AI로 같은 내용을 수준별로 다시 쓰기", "독해 발문 설계"],
        videos: [],
        materials: [
          { title: "강의 슬라이드: 읽기 지도 2", file: "w07-reading2.pptx", size: "120KB" },
          { title: "강의 자료: 読むことを教える 2", file: "w07-reading2-handout.docx", size: "55KB" },
          { title: "강의 슬라이드: 독해 교재", file: "w07-reading-materials.pptx", size: "108KB" },
          { title: "강의 자료: 독해 교재", file: "w07-reading-materials-handout.docx", size: "53KB" },
        ],
        assignment: {
          title: "수준별 독해 자료 제작",
          desc: "하나의 주제로 초급·중급 두 가지 독해 자료와 발문 3개씩을 만들어 제출하세요.",
          due: "2026-10-18 23:59",
          submitUrl: "",
        },
      },
      {
        title: "중간 점검", desc: "중간 과제 발표 및 피드백", tags: ["평가"],
        content: ["중간 과제 발표 (조별 10분)", "동료 평가와 피드백"],
        videos: [],
        assignment: {
          title: "중간 과제 발표 자료",
          desc: "조별로 1~7주 내용 중 하나를 골라 수업 활동을 설계하고, 발표 당일 수업 전까지 발표 자료(PPT)를 제출하세요.",
          due: "2026-10-19 12:00",
          submitUrl: "",
        },
      },
      {
        title: "학습자 데이터 분석", desc: "오류·설문 데이터 정리와 시각화", tags: ["데이터"],
        content: ["학습자 오류 데이터 수집과 분류", "Google Sheets로 정리·집계하기", "차트로 시각화하고 수업 개선점 찾기"],
        videos: [{ title: "Google Sheets 데이터 시각화 기초", url: "https://www.youtube.com/results?search_query=구글+스프레드시트+차트+만들기" }],
        assignment: {
          title: "데이터 분석 미니 리포트",
          desc: "제공된 오류 데이터를 분석해 차트 2개와 수업 개선 제안을 A4 1장으로 정리하세요.",
          due: "2026-11-01 23:59",
          submitUrl: "",
        },
      },
      {
        title: "학습 분석과 디자인 ⑤ 쓰기 지도", desc: "書くこと — AI 피드백을 활용한 작문 지도", tags: ["쓰기", "AI"],
        content: ["작문 지도의 과정 중심 접근", "AI 피드백의 장단점", "교사 피드백과 AI 피드백 비교 실습"],
        videos: [{ title: "作文指導の方法", url: "https://www.youtube.com/results?search_query=日本語教育+作文+指導" }],
        materials: [
          { title: "강의 슬라이드: 쓰기 지도", file: "w10-writing.pptx", size: "75KB" },
          { title: "강의 슬라이드: 쓰기 지도 (업그레이드판)", file: "w10-writing-upgrade.pptx", size: "95KB" },
          { title: "강의 자료: 書くこと — 作文", file: "w10-writing-handout.docx", size: "32KB" },
        ],
      },
      {
        title: "교재 창작 사례 연구", desc: "그림연극(紙芝居) 창작 과정과 교실 활용", tags: ["교재"],
        content: ["紙芝居「くらべっこ くらべっこ」 창작 사례", "교재 창작 시 고려할 점", "AI 이미지 도구로 장면 구성해 보기"],
        videos: [{ title: "紙芝居の演じ方", url: "https://www.youtube.com/results?search_query=紙芝居+演じ方" }],
      },
      {
        title: "교수학습과정안 작성법", desc: "수업 목표·활동·평가를 담은 과정안 설계", tags: ["실습"],
        content: ["교수학습과정안의 구성 요소", "도입·전개·정리 단계 설계", "평가 계획 세우기"],
        videos: [],
        materials: [
          { title: "교수학습과정안 양식 (Word)", file: "w12-lesson-plan-template.docx", size: "14KB" },
        ],
        assignment: {
          title: "교수학습과정안 초안",
          desc: "모의수업에서 진행할 차시의 교수학습과정안을 학과 양식에 맞춰 작성해 제출하세요.",
          due: "2026-11-22 23:59",
          submitUrl: "",
        },
      },
      {
        title: "모의수업 ①", desc: "1~3조 모의수업 및 피드백", tags: ["실습"],
        content: ["조별 모의수업 (각 20분)", "동료·교수자 피드백"],
        videos: [],
      },
      {
        title: "모의수업 ②", desc: "4~6조 모의수업 및 피드백", tags: ["실습"],
        content: ["조별 모의수업 (각 20분)", "동료·교수자 피드백"],
        videos: [],
      },
      {
        title: "종합 정리", desc: "한 학기 성찰과 기말 과제", tags: ["평가"],
        content: ["한 학기 배운 내용 정리", "모의수업 성찰 공유", "수업 평가"],
        videos: [],
        assignment: {
          title: "기말 성찰 보고서",
          desc: "모의수업 피드백을 반영한 최종 과정안과 성찰 보고서(A4 2장)를 제출하세요.",
          due: "2026-12-13 23:59",
          submitUrl: "",
        },
      },
    ],
  },

  /* ---------- 수업 자료실 ----------
   * 각 주차의 materials를 모아 한곳에서 보여 줍니다. 자료 자체는 위 커리큘럼의 주차별 materials에서 고치세요.
   */
  materialsRoom: {
    title: "수업 자료실",
    lead: "주차별 강의 슬라이드와 자료를 내려받을 수 있습니다. 수업 전에 미리 훑어 오세요.",
    base: "materials/", // 파일이 들어 있는 폴더
    // 관리자 화면 → 자료 등록 탭에서 Google Drive 주소로 자료를 더 올릴 수 있습니다.
  },

  /* ---------- 학생 포트폴리오 (우수 과제물) ----------
   * 관리자 화면 → 포트폴리오 탭에서 Google Drive 주소로 등록합니다.
   * 드라이브 파일은 공유 설정을 「링크가 있는 모든 사용자 - 뷰어」로 해야 썸네일과 보기가 됩니다.
   * 학생 작품은 반드시 본인의 공개 동의를 받은 뒤 올리세요.
   */
  portfolio: {
    title: "학생 포트폴리오",
    lead: "수강생들이 직접 설계하고 만든 우수 과제물입니다. 작품을 눌러 원본을 볼 수 있습니다.",
    categories: ["모의수업", "교수학습과정안", "독해 교재", "그림연극(紙芝居)", "AI 활용 교재", "데이터 분석"],
    items: [], // 설정 파일에 직접 넣을 때: { title, author, term, category, desc, url }
  },

  /* ---------- 수강 안내 ---------- */
  enroll: {
    title: "수강 안내",
    info: [
      { label: "개설 학과", value: "일어일문학과" },
      { label: "학점", value: "3학점" },
      { label: "강의실", value: "○○관 ○○○호" }, // ★
      { label: "신청 방법", value: "학교 수강신청 시스템" }, // ★
    ],
    grading: [
      { item: "출석 및 수업 참여", percent: 20 },
      { item: "AI 실습 과제", percent: 30 },
      { item: "모의수업", percent: 30 },
      { item: "기말 과제", percent: 20 },
    ],
    notes: [
      "일본어 능력은 중급 이상을 권장합니다.",
      "모의수업 일정은 학기 초에 조별로 배정합니다.",
      "수업 자료는 LMS(Blackboard)에 게시됩니다.",
    ],
  },

  /* ---------- 실시간 투표 ---------- */
  poll: {
    title: "실시간 투표",
    question: "가장 먼저 배우고 싶은 주제는 무엇인가요?",
    lead: "한 사람당 한 표이며, 투표 후에도 다른 주제로 바꿀 수 있습니다.",
    options: [
      { id: "speak", icon: "🗣️", label: "AI 롤플레이로 회화 지도하기" },
      { id: "listen", icon: "🎧", label: "AI로 듣기 자료 만들기" },
      { id: "read", icon: "📖", label: "수준별 독해 자료 만들기" },
      { id: "write", icon: "✍️", label: "AI 피드백 작문 지도" },
      { id: "data", icon: "📊", label: "학습자 데이터 분석" },
      { id: "kamishibai", icon: "🎴", label: "그림연극(紙芝居) 교재 만들기" },
    ],
  },

  /* ---------- 수강 신청서 ----------
   * type: text, email, tel, select, radio, checkbox, textarea, consent
   * required: true 이면 필수 항목 / pattern: 형식 검사(정규식) / minLength: 최소 글자 수
   */
  apply: {
    title: "수강 신청서",
    lead: "* 표시는 필수 항목입니다. 제출 후 확인 메일은 교수자가 개별로 보내드립니다.",
    fields: [
      { name: "name", label: "이름", type: "text", required: true, placeholder: "홍길동" },
      { name: "sid", label: "학번", type: "text", required: true, placeholder: "2023123456", pattern: "^\\d{10}$", hint: "숫자 10자리" },
      { name: "major", label: "소속 학과", type: "text", required: true, placeholder: "일어일문학과" },
      { name: "year", label: "학년", type: "select", required: true, options: ["1학년", "2학년", "3학년", "4학년", "기타"] },
      { name: "email", label: "이메일", type: "email", required: true, placeholder: "student@korea.ac.kr" },
      { name: "phone", label: "연락처", type: "tel", required: false, placeholder: "010-0000-0000", pattern: "^01[0-9]-?\\d{3,4}-?\\d{4}$", hint: "선택 · 010-0000-0000" },
      { name: "level", label: "일본어 수준", type: "select", required: true, options: ["초급 (JLPT N4 이하)", "중급 (N3~N2)", "고급 (N1 이상)"] },
      { name: "interests", label: "관심 분야", type: "checkbox", required: false, options: ["회화", "청해", "독해", "작문", "AI 활용", "데이터 분석"] },
      { name: "motive", label: "수강 동기", type: "textarea", required: true, minLength: 20, placeholder: "이 강의를 통해 배우고 싶은 점을 적어 주세요. (20자 이상)" },
      { name: "consent", label: "개인정보 수집·이용(이름, 학번, 연락처 — 수강 관리 목적, 학기 종료 후 파기)에 동의합니다.", type: "consent", required: true, short: "개인정보 동의" },
    ],
    successTitle: "신청이 완료되었습니다 🌸",
    successText: "수강 신청서가 접수되었습니다. 첫 수업에서 만나요!",
  },

  /* ---------- 수강생 공간 (로그인 · 출석 · 과제 제출) ---------- */
  myclass: {
    title: "수강생 공간",
    lead: "학번과 개인 인증코드로 로그인해 출석을 체크하고 과제 파일을 제출하세요.",
    // 체험 모드에서만 쓰는 테스트 계정 (실제 운영 시에는 스프레드시트의 '학생명단'을 사용)
    demoAccounts: [
      { id: "2026000001", name: "체험학생", code: "1234" },
    ],
    attendance: {
      requireCode: true, // 수업 중 교수자가 알려주는 출석 코드 입력 필요
      demoCode: "SAKURA", // 체험 모드용 출석 코드 (실제 운영 시에는 스프레드시트 '출석코드' 시트 사용)
      openBeforeMinutes: 30, // 수업 시작 몇 분 전부터 출석 가능
    },
    upload: {
      maxMB: 10,
      accept: [".pdf", ".docx", ".doc", ".pptx", ".hwp", ".hwpx", ".xlsx", ".zip", ".jpg", ".png"],
      allowLate: true, // 마감 후 제출 허용 (지각 제출로 표시)
    },
  },

  /* ---------- 첫 방문 안내 팝업 ---------- */
  popup: {
    enabled: true,
    delaySeconds: 2.5,
    badge: "2026 하반기 모집 중",
    title: "수강 신청 안내",
    text: "AI와 데이터로 일본어 수업을 설계하는 15주 과정에 함께하세요.",
    points: ["📅 2026. 9. 2. 첫 수업 · 매주 월·수 15:00", "💻 노트북 지참 · AI 실습 중심", "🎓 일본어 교육에 관심 있는 누구나"],
    button: { label: "수강 신청서 작성하기", href: "#apply" },
  },
  celebrateFirstVisit: true, // 첫 방문 폭죽 효과

  /* ---------- 실습 AI 도구 ---------- */
  tools: {
    title: "실습에 쓰는 AI 도구",
    lead: "모두 무료 플랜으로 실습할 수 있으며, 수업에서 계정 설정부터 함께 안내합니다.",
    items: [
      { icon: "💬", name: "ChatGPT", use: "교재 초안·예문 생성, 롤플레이 대화 연습" },
      { icon: "🧠", name: "Claude", use: "긴 자료 요약, 과정안 검토와 피드백" },
      { icon: "✨", name: "Gemini", use: "이미지·자료 기반 수업 아이디어 탐색" },
      { icon: "📒", name: "NotebookLM", use: "수업 자료를 모아 질의응답·요약 노트 만들기" },
      { icon: "🔎", name: "Perplexity", use: "출처가 있는 자료 조사" },
      { icon: "📈", name: "Google Sheets · Colab", use: "학습자 데이터 정리·분석·시각화" },
    ],
  },

  /* ---------- 수강 준비물 ---------- */
  prepare: {
    title: "수강 준비물",
    items: [
      { icon: "💻", title: "노트북", text: "매 수업 AI 실습이 있으니 노트북을 지참해 주세요. (태블릿 가능)" },
      { icon: "🔑", title: "Google 계정", text: "NotebookLM, Sheets, Colab 실습에 사용합니다." },
      { icon: "🤖", title: "AI 서비스 계정", text: "ChatGPT, Claude 등 무료 계정을 미리 만들어 두면 좋습니다." },
      { icon: "📖", title: "일본어 교과서", text: "중·고등학교 일본어 교과서 1권 (교재 분석용)" },
    ],
  },

  /* ---------- FAQ ---------- */
  faq: {
    title: "자주 묻는 질문",
    items: [
      { q: "AI를 한 번도 써 본 적이 없어도 괜찮나요?", a: "네, 계정 만들기와 기본 사용법부터 단계별로 안내합니다. 코딩 지식도 필요하지 않습니다." },
      { q: "유료 AI 서비스를 구독해야 하나요?", a: "아니요. 모든 실습은 무료 플랜으로 진행할 수 있도록 구성했습니다." },
      { q: "누가 수강할 수 있나요?", a: "일본어 교육에 관심 있는 학생이라면 누구나 수강할 수 있으며, 특정 과정 이수자를 우선하지 않습니다." },
      { q: "모의수업은 어떻게 진행되나요?", a: "직접 작성한 교수학습과정안을 바탕으로 15~20분 내외의 수업을 진행하고, 동료와 교수자의 피드백을 받습니다." },
      { q: "수업은 일본어로 진행되나요?", a: "강의는 한국어와 일본어를 함께 사용하며, 일부 자료는 일본어 원문으로 제공됩니다." },
    ],
  },

  /* ---------- 강의 인포그래픽 (FAQ 아래) ----------
   * 주차 수·수업 횟수·과제 수·도구 수·주제 비중·평가 비율은 위의 설정에서 자동 계산됩니다.
   * 여기서는 단계(최대 4개)와 학습 성과만 적으면 됩니다. weeks: "시작-끝" 주차
   */
  infographic: {
    title: "한눈에 보는 강의",
    lead: "15주 과정의 흐름과 비중을 한 장으로 정리했습니다.",
    phases: [
      { name: "기초 다지기", weeks: "1-3", text: "제2언어습득 이론과 생성형 AI 활용의 기초" },
      { name: "4기능 지도법", weeks: "4-10", text: "회화·청해·읽기·쓰기 지도와 학습자 데이터 분석" },
      { name: "교재·수업 설계", weeks: "11-12", text: "紙芝居 교재 창작과 교수학습과정안 작성" },
      { name: "모의수업·성찰", weeks: "13-15", text: "모의수업, 동료·교수자 피드백, 한 학기 성찰" },
    ],
    // 주제 비중 그래프에서 하나로 묶어 셀 태그
    topicGroups: {
      "4기능 지도": ["말하기", "듣기", "읽기", "쓰기"],
    },
    outcomes: [
      "제2언어습득 연구를 근거로 수업 활동을 설명할 수 있다",
      "4기능별 학습 분석에 맞춰 수업을 디자인할 수 있다",
      "생성형 AI와 데이터를 교재 제작과 피드백에 활용할 수 있다",
      "교수학습과정안을 쓰고 모의수업으로 검증할 수 있다",
    ],
  },

  /* ---------- 교수자 (페이지 맨 아래 푸터에 표시) ---------- */
  instructor: {
    name: "조영남 교수",
    nameJa: "",
    position: "고려대학교 일어일문학과",
    photo: "", // 사진 파일 경로 (예: "images/professor.jpg"). 비워두면 이니셜 아이콘 표시
    bio: "일본어교육학과 제2언어습득을 연구하며, 교실에서 바로 쓸 수 있는 지도법과 AI 활용 수업을 함께 고민합니다.", // ★
    fields: ["일본어교육학", "제2언어습득", "AI 활용 교육"],
    contacts: [
      { icon: "✉️", label: "이메일", value: "choyn@korea.ac.kr" },
      { icon: "🏛️", label: "연구실", value: "문과대학 320호" },
    ],
    copyright: "© 2026 고려대학교 일어일문학과 · 일본어교과교재연구및지도법",
  },
};

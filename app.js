/* =========================
   설정값 (추후 기획 확정 시 수정)
   ========================= */
const CONFIG = {
  // 7단계 척도 (0: 가장 왼쪽 = 0점 ~ 6: 가장 오른쪽 = point 비례 최대점)
  LIKERT_STEPS: 7,

  // 1차 / 2차 테스트 라벨 및 안내 문구 (추후 텍스트 변경 시 여기만 수정)
  PHASE_META: {
    1: {
      badge: "1차 테스트",
      leftLabel: "내딸임",
      rightLabel: "내아내임",
      guide: "각 이미지를 보고 해당하는 위치의 원을 선택해 주세요. 애매하면 건너뛰기를 누를 수 있습니다.",
      buttonText: "완료하기",
    },
    2: {
      badge: "2차 테스트",
      leftLabel: "덜익었음",
      rightLabel: "상했음",
      guide: "건너뛴 문항을 다시 확인합니다. 여기서 건너뛰기를 누르면 채점 대상에서 완전히 제외됩니다.",
      buttonText: "결과 보기",
    },
  },

// 구간별 기믹 설정 (각 구간의 범위, 글자, 증가 강도를 개별 수정 가능)
  GIMMICKS: [
    // 기믹 1
    {
      min: 25,
      max: 60,
      prefix: "노",
      repeatChar: "오",
      suffix: "옹ㅋㅋ",
      exponentFactor: 2.5,
    },
    // 기믹 2
    {
      min: 61,
      max: 100,
      prefix: "누오오오오오오",
      repeatChar: "오",
      suffix: "옹ㅋㅋㅋㅋ",
      exponentFactor: 4.0,
    },
  ],

  // 대기화면(보여주기용) 진행 시간 (ms)
  LOADING_DURATION: 2400,

  // 결과 요소 간 시간차 (ms)
  DELAY_BEFORE_DESC: 350,
  DELAY_BEFORE_SCORE: 550,
  DELAY_BEFORE_RETRY: 350,
};

// 결과 구간별 고유 문장 (추후 문구 정리 시 이 배열만 수정)
const RESULT_MESSAGES = [
  { max: 0, title: "극한의 빵파", desc: "거모이 거유즈 짤 올리던게 너구나?" },
  { max: 15, title: "정상성욕", desc: "거유를 좋아하시는군요?" },
  { max: 24, title: "농", desc: "성자라도 되는 줄 알았나." },
  { max: 40, desc: "내가 페도는 아닌데..." },
  { max: 55, desc: "교도소 팬미팅 시간입니다~" },
  { max: 70, desc: "확실히 짙어진 농도가 느껴집니다..." },
  { max: 85, desc: "으헤~ 이런 빈약한 몸을 좋아하는 사람은 글러먹은 인간이라고. 사형이라고." },
  { max: 94, desc: "한국 이대로 괜찮은가..." },
  { max: 99, desc: "유우카야, 갤 꺼라." },
  { max: 100, desc: "범접할 수 없는 어린이 사랑꾼입니다." },
];

// 7단계 원형 크기/색상 매핑 (인덱스 0~6)
const CIRCLE_SPECS = [
  { size: 3, side: "side-left" },
  { size: 2, side: "side-left" },
  { size: 1, side: "side-left" },
  { size: 0, side: "side-center" },
  { size: 1, side: "side-right" },
  { size: 2, side: "side-right" },
  { size: 3, side: "side-right" },
];

/* =========================
   DOM 요소
   ========================= */
const appContainer = document.getElementById("app-container");
const testScreen = document.getElementById("test-screen");
const loadingScreen = document.getElementById("loading-screen");
const resultScreen = document.getElementById("result-screen");

// 테스트 화면 요소
const phaseBadge = document.getElementById("phase-badge");
const phaseGuide = document.getElementById("phase-guide");
const testProgressText = document.getElementById("test-progress-text");
const testMiniFill = document.getElementById("test-mini-fill");
const questionListEl = document.getElementById("question-list");
const testAlertEl = document.getElementById("test-alert");
const submitPhaseBtn = document.getElementById("submit-phase-btn");

// 대기·결과 화면 요소
const progressTrack = document.querySelector(".progress-track");
const progressFill = document.getElementById("progress-fill");
const progressPercent = document.getElementById("progress-percent");
const resultTitle = document.getElementById("result-title");
const resultDesc = document.getElementById("result-desc");
const resultScore = document.getElementById("result-score");
const retryBtn = document.getElementById("retry-btn");

/* =========================
   테스트 상태 관리
   ========================= */
const state = {
  phase: 1,                  // 1: 1차 테스트, 2: 2차 테스트
  allQuestions: [],          // 전체 문항 (랜덤 셔플)
  phaseQuestions: [],        // 현재 라운드에 표시 중인 문항 목록
  phaseResponses: new Map(), // 현재 라운드 응답: id -> 0~6 | "skip"
  finalAnswers: new Map(),   // 확정된 채점 대상 응답: id -> { point, step }
  activeIndex: 0,            // 현재 포커스된 문항 인덱스
};

let currentRunId = 0;

/* =========================
   유틸리티 함수
   ========================= */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value)));

// Fisher-Yates 무작위 셔플
function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function switchScreen(targetScreen) {
  [testScreen, loadingScreen, resultScreen].forEach((screen) => {
    screen.classList.remove("active", "visible");
  });

  appContainer.classList.toggle("test-mode", targetScreen === testScreen);
  targetScreen.classList.add("active");
  requestAnimationFrame(() => {
    targetScreen.classList.add("visible");
  });
}

/* =========================
   0. 테스트 초기화 & 렌더링
   ========================= */
function initTest() {
  currentRunId++; // 진행 중인 결과 애니메이션이 있다면 중단

  const source =
    typeof QUESTIONS !== "undefined" && Array.isArray(QUESTIONS) ? QUESTIONS : [];

  state.allQuestions = shuffleArray(source);
  state.finalAnswers.clear();

  startPhase(1, state.allQuestions);
  switchScreen(testScreen);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startPhase(phaseNumber, questionsForPhase) {
  state.phase = phaseNumber;
  state.phaseQuestions = questionsForPhase;
  state.phaseResponses = new Map();
  state.activeIndex = 0;

  const meta = CONFIG.PHASE_META[phaseNumber];
  phaseBadge.textContent = meta.badge;
  phaseBadge.classList.toggle("phase-2", phaseNumber === 2);
  phaseGuide.textContent = meta.guide;
  submitPhaseBtn.textContent = meta.buttonText;
  testAlertEl.textContent = "";

  renderQuestionList();
  updatePhaseProgress();
}

function renderQuestionList() {
  questionListEl.innerHTML = "";

  if (state.phaseQuestions.length === 0) {
    questionListEl.innerHTML = `
      <div class="question-empty">
        불러온 문항이 없습니다.<br />
        <code>questions.js</code> 파일이 같은 폴더에 있는지 확인해 주세요.
      </div>
    `;
    submitPhaseBtn.disabled = true;
    return;
  }

  submitPhaseBtn.disabled = false;
  const meta = CONFIG.PHASE_META[state.phase];

  state.phaseQuestions.forEach((question, index) => {
    const itemEl = document.createElement("article");
    itemEl.className = "question-item";
    itemEl.dataset.index = String(index);
    itemEl.dataset.id = String(question.id);
    if (index === state.activeIndex) itemEl.classList.add("is-active");

    // 1) 문항 이미지
    const imgWrap = document.createElement("div");
    imgWrap.className = "question-image-wrap";

    const img = document.createElement("img");
    img.className = "question-image";
    img.src = question.image;
    img.alt = `문항 ${index + 1}`;
    img.loading = "lazy";
    imgWrap.appendChild(img);

    // 2) 7단계 리커트 척도 행
    const likertRow = document.createElement("div");
    likertRow.className = "likert-row";

    const leftLabel = document.createElement("span");
    leftLabel.className = "likert-label left";
    leftLabel.textContent = meta.leftLabel;

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "likert-options";
    optionsWrap.setAttribute("role", "radiogroup");
    optionsWrap.setAttribute("aria-label", `문항 ${index + 1} 선택지`);

    CIRCLE_SPECS.forEach((spec, step) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `likert-circle size-${spec.size} ${spec.side}`;
      btn.dataset.step = String(step);
      btn.setAttribute("aria-label", `${step + 1}단계 선택`);
      btn.innerHTML = `
        <svg class="check-icon" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSelectStep(index, question, step);
      });

      optionsWrap.appendChild(btn);
    });

    const rightLabel = document.createElement("span");
    rightLabel.className = "likert-label right";
    rightLabel.textContent = meta.rightLabel;

    likertRow.append(leftLabel, optionsWrap, rightLabel);

    // 3) 오른쪽 아래 건너뛰기 버튼
    const actionsRow = document.createElement("div");
    actionsRow.className = "question-actions";

    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "skip-btn";
    skipBtn.textContent = "건너뛰기";
    skipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleToggleSkip(index, question);
    });

    actionsRow.appendChild(skipBtn);

    // 문항 영역 클릭 시 해당 문항 활성화
    itemEl.addEventListener("click", () => {
      setActiveQuestion(index, false);
    });

    itemEl.append(imgWrap, likertRow, actionsRow);
    questionListEl.appendChild(itemEl);
  });
}

function handleSelectStep(index, question, step) {
  state.phaseResponses.set(question.id, step);
  testAlertEl.textContent = "";

  syncQuestionItemUI(index, question.id);
  updatePhaseProgress();
  focusNextUnanswered(index);
}

function handleToggleSkip(index, question) {
  const current = state.phaseResponses.get(question.id);
  testAlertEl.textContent = "";

  if (current === "skip") {
    state.phaseResponses.delete(question.id);
    syncQuestionItemUI(index, question.id);
    updatePhaseProgress();
    setActiveQuestion(index, false);
  } else {
    state.phaseResponses.set(question.id, "skip");
    syncQuestionItemUI(index, question.id);
    updatePhaseProgress();
    focusNextUnanswered(index);
  }
}

function syncQuestionItemUI(index, questionId) {
  const itemEl = questionListEl.querySelector(`.question-item[data-index="${index}"]`);
  if (!itemEl) return;

  const value = state.phaseResponses.get(questionId);
  const isSkipped = value === "skip";

  itemEl.classList.toggle("is-skipped", isSkipped);

  itemEl.querySelectorAll(".likert-circle").forEach((btn) => {
    const step = Number(btn.dataset.step);
    btn.classList.toggle("selected", !isSkipped && value === step);
  });

  const skipBtn = itemEl.querySelector(".skip-btn");
  if (skipBtn) {
    skipBtn.classList.toggle("active", isSkipped);
    skipBtn.textContent = isSkipped ? "건너뜀" : "건너뛰기";
  }
}

function setActiveQuestion(index, shouldScroll = true) {
  state.activeIndex = index;

  questionListEl.querySelectorAll(".question-item").forEach((el, idx) => {
    el.classList.toggle("is-active", idx === index);
  });

  if (shouldScroll) {
    const target = questionListEl.querySelector(`.question-item[data-index="${index}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

function focusNextUnanswered(fromIndex) {
  const total = state.phaseQuestions.length;

  // 현재 문항 이후에서 미응답 문항 탐색
  for (let i = fromIndex + 1; i < total; i++) {
    if (!state.phaseResponses.has(state.phaseQuestions[i].id)) {
      setActiveQuestion(i, true);
      return;
    }
  }

  // 앞쪽에 남은 미응답 문항이 있는지 탐색
  for (let i = 0; i < fromIndex; i++) {
    if (!state.phaseResponses.has(state.phaseQuestions[i].id)) {
      setActiveQuestion(i, true);
      return;
    }
  }

  // 모든 문항 응답/건너뛰기 완료 시 하단 버튼으로 부드럽게 이동
  setActiveQuestion(-1, false);
  submitPhaseBtn.scrollIntoView({ behavior: "smooth", block: "center" });
}

function updatePhaseProgress() {
  const total = state.phaseQuestions.length;
  const done = state.phaseResponses.size;
  const ratio = total > 0 ? (done / total) * 100 : 0;

  testProgressText.textContent = `${done} / ${total}`;
  testMiniFill.style.width = `${ratio.toFixed(1)}%`;

  // 1차 테스트에서 건너뛴 문항 유무에 따라 하단 버튼 문구 자동 조정
  if (state.phase === 1) {
    const hasSkipped = Array.from(state.phaseResponses.values()).includes("skip");
    submitPhaseBtn.textContent = hasSkipped ? "다음으로" : "결과 보기";
  }
}

/* =========================
   라운드 완료 & 최종 점수 계산
   ========================= */
function handleSubmitPhase() {
  // 미응답 문항 검사
  const unansweredIndex = state.phaseQuestions.findIndex(
    (q) => !state.phaseResponses.has(q.id)
  );

  if (unansweredIndex !== -1) {
    testAlertEl.textContent = "응답하지 않은 문항이 있습니다. 선택하거나 건너뛰기를 눌러 주세요.";
    setActiveQuestion(unansweredIndex, true);
    return;
  }

  if (state.phase === 1) {
    const skippedQuestions = [];

    state.phaseQuestions.forEach((question) => {
      const response = state.phaseResponses.get(question.id);
      if (response === "skip") {
        skippedQuestions.push(question);
      } else {
        state.finalAnswers.set(question.id, {
          point: Number(question.point) || 0,
          step: response,
        });
      }
    });

    // 건너뛴 문항이 있으면 2차 테스트로 이동
    if (skippedQuestions.length > 0) {
      startPhase(2, shuffleArray(skippedQuestions));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // 건너뛴 문항이 없으면 바로 결과 계산
    finishTestAndShowResult();
    return;
  }

  // 2차 테스트 완료: 응답한 문항만 채점에 반영, 건너뛴 문항은 채점 및 이론적 최고점에서 완전 제외
  state.phaseQuestions.forEach((question) => {
    const response = state.phaseResponses.get(question.id);
    if (response !== "skip") {
      state.finalAnswers.set(question.id, {
        point: Number(question.point) || 0,
        step: response,
      });
    }
  });

  finishTestAndShowResult();
}

function calculateFinalPercent() {
  const maxStep = CONFIG.LIKERT_STEPS - 1; // 6
  let currentScore = 0;
  let theoreticalMaxScore = 0;

  state.finalAnswers.forEach(({ point, step }) => {
    if (point <= 0) return;
    currentScore += step * point;
    theoreticalMaxScore += maxStep * point;
  });

  // 모든 문항을 2차까지 건너뛴 경우 0% 처리
  if (theoreticalMaxScore === 0) return 0;

  return clampPercent((currentScore / theoreticalMaxScore) * 100);
}

function finishTestAndShowResult() {
  const percent = calculateFinalPercent();
  window.scrollTo({ top: 0, behavior: "smooth" });
  startResultSequence(percent);
}

submitPhaseBtn.addEventListener("click", handleSubmitPhase);

/* =========================
   결과 텍스트 및 문장 생성 로직
   ========================= */
function buildResultData(percent) {
  const matched =
    RESULT_MESSAGES.find((item) => percent <= item.max) || RESULT_MESSAGES.at(-1);

  const gimmick = CONFIG.GIMMICKS.find(
    (item) => percent >= item.min && percent <= item.max
  );

  // 어떤 기믹 구간에도 해당하지 않는 경우 (기존 기본 텍스트 출력)
  if (!gimmick) {
    return {
      title: matched.title || "연함",
      desc: matched.desc,
    };
  }

  // 해당 기믹 구간 안에서 min -> max에 가까워질수록 repeatChar가 기하급수적으로 증가
  const range = gimmick.max - gimmick.min;
  const ratio = range > 0 ? (percent - gimmick.min) / range : 1;
  const repeatCount = Math.floor(Math.exp(ratio * gimmick.exponentFactor) - 1);

  return {
    title: `${gimmick.prefix}${gimmick.repeatChar.repeat(repeatCount)}${gimmick.suffix}`,
    desc: matched.desc,
  };
}

/* =========================
   1. 대기화면 애니메이션
   ========================= */
function runLoadingAnimation(runId) {
  return new Promise((resolve) => {
    switchScreen(loadingScreen);
    progressFill.style.width = "0%";
    progressPercent.textContent = "0%";
    progressTrack.setAttribute("aria-valuenow", "0");

    const startTime = performance.now();

    function frame(now) {
      if (runId !== currentRunId) return;

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / CONFIG.LOADING_DURATION, 1);

      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const displayPercent = Math.round(eased * 100);
      progressFill.style.width = `${(eased * 100).toFixed(2)}%`;
      progressPercent.textContent = `${displayPercent}%`;
      progressTrack.setAttribute("aria-valuenow", String(displayPercent));

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        setTimeout(() => {
          if (runId === currentRunId) resolve();
        }, 300);
      }
    }

    requestAnimationFrame(frame);
  });
}

/* =========================
   2. 결과화면 순차 연출 (2.1 -> 2.2 -> 2.3 -> 버튼)
   ========================= */
async function renderResultScreen(percent, runId) {
  const { title, desc } = buildResultData(percent);

  resultTitle.innerHTML = "";
  resultTitle.classList.toggle("dense", title.length >= 14);
  resultDesc.textContent = desc;
  resultDesc.classList.remove("show");
  resultScore.textContent = `농도:${percent}%`;
  resultScore.classList.remove("show");
  retryBtn.classList.remove("show");

  switchScreen(resultScreen);
  await wait(250);
  if (runId !== currentRunId) return;

  const chars = Array.from(title);
  for (let i = 0; i < chars.length; i++) {
    if (runId !== currentRunId) return;

    const span = document.createElement("span");
    span.className = "char";
    span.textContent = chars[i];
    resultTitle.appendChild(span);

    const charDelay = chars.length > 10 ? Math.max(28, 95 - i * 3) : 95;
    await wait(charDelay);
  }

  await wait(CONFIG.DELAY_BEFORE_DESC);
  if (runId !== currentRunId) return;
  resultDesc.classList.add("show");

  await wait(CONFIG.DELAY_BEFORE_SCORE);
  if (runId !== currentRunId) return;
  resultScore.classList.add("show");

  await wait(CONFIG.DELAY_BEFORE_RETRY);
  if (runId !== currentRunId) return;
  retryBtn.classList.add("show");
}

async function startResultSequence(rawPercent) {
  const percent = clampPercent(rawPercent);
  const runId = ++currentRunId;

  await runLoadingAnimation(runId);
  if (runId !== currentRunId) return;

  await renderResultScreen(percent, runId);
}

/* =========================
   이벤트 연결 & 초기 실행
   ========================= */
retryBtn.addEventListener("click", initTest);

window.addEventListener("DOMContentLoaded", () => {
  initTest();
});
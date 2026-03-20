const fixtures = [
  {
    id: "mexico-south-africa",
    label: "Mexico vs South Africa",
    shortMeta: "揭幕战",
    stage: "Group Stage",
    meta: "2026-06-11 13:00 UTC-6 · Mexico City · 样例原型数据",
    bestPick: "主胜",
    signal: "中高置信",
    outcomes: [
      { label: "主胜", value: 52 },
      { label: "平", value: 27 },
      { label: "客胜", value: 21 },
    ],
    scores: [
      { score: "2 : 0", probability: "14.6%" },
      { score: "1 : 0", probability: "13.2%" },
      { score: "2 : 1", probability: "10.1%" },
    ],
    goals: [
      { label: "2 球", note: "22.4%" },
      { label: "3 球", note: "19.7%" },
      { label: "大 2.5", note: "54.1%" },
      { label: "双方进球", note: "47.6%" },
    ],
    halftime: [
      { label: "胜 / 胜", note: "26.8%" },
      { label: "平 / 胜", note: "21.4%" },
      { label: "平 / 平", note: "16.2%" },
      { label: "胜 / 平", note: "9.1%" },
    ],
    risks: [
      "揭幕战样本噪声大，主场和开局保守性都可能拉高平局权重。",
      "比分建议更适合展示 Top3，而不是只给单一精确比分。",
      "如果外部赔率与模型差距过大，应单独弹出风险提醒。",
    ],
  },
  {
    id: "brazil-morocco",
    label: "Brazil vs Morocco",
    shortMeta: "强强对话",
    stage: "Group Stage",
    meta: "2026-06-14 20:00 UTC-5 · Miami · 样例原型数据",
    bestPick: "主胜 + 大2.5",
    signal: "中置信",
    outcomes: [
      { label: "主胜", value: 48 },
      { label: "平", value: 28 },
      { label: "客胜", value: 24 },
    ],
    scores: [
      { score: "2 : 1", probability: "12.8%" },
      { score: "1 : 1", probability: "11.7%" },
      { score: "2 : 0", probability: "10.4%" },
    ],
    goals: [
      { label: "2 球", note: "20.8%" },
      { label: "3 球", note: "19.3%" },
      { label: "大 2.5", note: "57.9%" },
      { label: "双方进球", note: "51.8%" },
    ],
    halftime: [
      { label: "平 / 胜", note: "23.2%" },
      { label: "胜 / 胜", note: "22.3%" },
      { label: "平 / 平", note: "15.6%" },
      { label: "负 / 平", note: "7.4%" },
    ],
    risks: [
      "双方高位逼抢会放大比赛节奏，早牌和点球对比分预测影响较大。",
      "这类强队对话更建议强调区间概率，而不是夸大绝对优势。",
      "若阵容临场轮换明显，模型需要在赛前 3 小时刷新一次。",
    ],
  },
  {
    id: "england-croatia",
    label: "England vs Croatia",
    shortMeta: "淘汰赛模板",
    stage: "Knockout",
    meta: "2026-07-03 18:00 UTC-4 · Atlanta · 样例原型数据",
    bestPick: "平局倾向 + 小比分",
    signal: "中置信",
    outcomes: [
      { label: "主胜", value: 39 },
      { label: "平", value: 33 },
      { label: "客胜", value: 28 },
    ],
    scores: [
      { score: "1 : 1", probability: "15.1%" },
      { score: "1 : 0", probability: "10.9%" },
      { score: "0 : 0", probability: "10.4%" },
    ],
    goals: [
      { label: "1 球", note: "18.4%" },
      { label: "2 球", note: "24.7%" },
      { label: "小 2.5", note: "58.6%" },
      { label: "双方进球", note: "44.8%" },
    ],
    halftime: [
      { label: "平 / 平", note: "24.6%" },
      { label: "平 / 胜", note: "17.9%" },
      { label: "胜 / 胜", note: "14.1%" },
      { label: "平 / 负", note: "12.2%" },
    ],
    risks: [
      "淘汰赛进入加时和点球会影响用户对‘比分’口径的理解，需要前端写清结算规则。",
      "半全场玩法类别多，建议和胜平负拆开展示，不要混成一个总推荐。",
      "这类低比分对局更依赖临场名单和防线健康度。",
    ],
  },
];

const elements = {
  switcher: document.getElementById("match-switcher"),
  title: document.getElementById("fixture-title"),
  stage: document.getElementById("fixture-stage"),
  meta: document.getElementById("fixture-meta"),
  bestPick: document.getElementById("best-pick"),
  signal: document.getElementById("signal-strength"),
  outcomeBars: document.getElementById("outcome-bars"),
  scoreGrid: document.getElementById("score-grid"),
  goalsGrid: document.getElementById("goals-grid"),
  halftimeGrid: document.getElementById("halftime-grid"),
  riskList: document.getElementById("risk-list"),
};

function renderSwitcher(activeId) {
  elements.switcher.innerHTML = fixtures
    .map(
      (fixture) => `
        <button class="match-button ${fixture.id === activeId ? "is-active" : ""}" data-id="${fixture.id}">
          ${fixture.label}
          <small>${fixture.shortMeta}</small>
        </button>
      `
    )
    .join("");

  elements.switcher.querySelectorAll(".match-button").forEach((button) => {
    button.addEventListener("click", () => {
      updateFixture(button.dataset.id);
    });
  });
}

function renderOutcomeBars(outcomes) {
  elements.outcomeBars.innerHTML = outcomes
    .map(
      (outcome) => `
        <div class="bar-item">
          <span>${outcome.label}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${outcome.value}%;">
              <span>${outcome.label}</span>
              <strong>${outcome.value}%</strong>
            </div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderTags(container, items) {
  container.innerHTML = items
    .map(
      (item) => `
        <article class="tag">
          <strong>${item.label}</strong>
          <span>${item.note}</span>
        </article>
      `
    )
    .join("");
}

function renderScores(scores) {
  elements.scoreGrid.innerHTML = scores
    .map(
      (item) => `
        <article class="score-chip">
          <strong>${item.score}</strong>
          <span>${item.probability}</span>
        </article>
      `
    )
    .join("");
}

function renderRisks(risks) {
  elements.riskList.innerHTML = risks.map((risk) => `<li>${risk}</li>`).join("");
}

function updateFixture(id) {
  const fixture = fixtures.find((item) => item.id === id) || fixtures[0];

  elements.title.textContent = fixture.label;
  elements.stage.textContent = fixture.stage;
  elements.meta.textContent = fixture.meta;
  elements.bestPick.textContent = fixture.bestPick;
  elements.signal.textContent = fixture.signal;

  renderSwitcher(fixture.id);
  renderOutcomeBars(fixture.outcomes);
  renderScores(fixture.scores);
  renderTags(elements.goalsGrid, fixture.goals);
  renderTags(elements.halftimeGrid, fixture.halftime);
  renderRisks(fixture.risks);
}

function animateMetrics() {
  const metrics = document.querySelectorAll(".metric-number");

  metrics.forEach((metric) => {
    const target = Number(metric.dataset.target);
    const decimals = metric.dataset.target.includes(".") ? metric.dataset.target.split(".")[1].length : 0;
    let frame = 0;
    const totalFrames = 40;

    const timer = setInterval(() => {
      frame += 1;
      const progress = frame / totalFrames;
      const value = target * progress;
      metric.textContent = value.toFixed(decimals) + (target >= 1 ? "%" : "");

      if (frame >= totalFrames) {
        metric.textContent = target.toFixed(decimals) + (target >= 1 ? "%" : "");
        clearInterval(timer);
      }
    }, 26);
  });
}

updateFixture(fixtures[0].id);
animateMetrics();

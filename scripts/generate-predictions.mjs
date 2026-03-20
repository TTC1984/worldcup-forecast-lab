import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const sourceDir = resolve(rootDir, "data", "source");
const outputDir = resolve(rootDir, "data", "generated");

const teams = JSON.parse(readFileSync(resolve(sourceDir, "teams.json"), "utf8"));
const historicalTeams = JSON.parse(readFileSync(resolve(sourceDir, "history-teams.json"), "utf8"));
const prematchSignalPath = existsSync(resolve(sourceDir, "prematch-signals.live.json"))
  ? resolve(sourceDir, "prematch-signals.live.json")
  : resolve(sourceDir, "prematch-signals.json");
const prematchSignalSource = JSON.parse(readFileSync(prematchSignalPath, "utf8"));
const tournamentConfig = JSON.parse(readFileSync(resolve(sourceDir, "tournament.json"), "utf8"));
const groupStageSource = readFileSync(resolve(sourceDir, "worldcup-2026-openfootball-cup.txt"), "utf8");
const finalsSource = readFileSync(resolve(sourceDir, "worldcup-2026-openfootball-cup_finals.txt"), "utf8");
const historicalBacktestSources = [
  {
    season: "2014",
    hostCountry: "Brazil",
    text: readFileSync(resolve(sourceDir, "worldcup-2014-openfootball-cup.txt"), "utf8"),
  },
  {
    season: "2018",
    hostCountry: "Russia",
    text: readFileSync(resolve(sourceDir, "worldcup-2018-openfootball-cup.txt"), "utf8"),
  },
  {
    season: "2022",
    hostCountry: "Qatar",
    text: readFileSync(resolve(sourceDir, "worldcup-2022-openfootball-cup.txt"), "utf8"),
  },
];

const confederationAttackBoost = {
  UEFA: 0.03,
  CONMEBOL: 0.04,
  CONCACAF: 0.01,
  CAF: 0,
  AFC: -0.01,
  OFC: -0.03,
  Intercontinental: -0.02,
};

const confederationDefenseBoost = {
  UEFA: 0.03,
  CONMEBOL: 0.02,
  CONCACAF: 0,
  CAF: 0,
  AFC: -0.01,
  OFC: -0.04,
  Intercontinental: -0.02,
};

const teamMap = new Map([...teams, ...historicalTeams].map((team) => [team.name, normalizeTeam(team)]));
const prematchTeamSignalMap = new Map(Object.entries(prematchSignalSource.teamSignals || {}));
const prematchFixtureSignalMap = new Map(
  (prematchSignalSource.fixtureSignals || []).map((signal) => [createPrematchSignalKey(signal), signal])
);
const buildReferenceTimestamp = resolveBuildReferenceTimestamp();
const buildReferenceMs = Date.parse(buildReferenceTimestamp);

const monthMap = {
  Jan: "01",
  January: "01",
  Feb: "02",
  February: "02",
  Mar: "03",
  March: "03",
  Apr: "04",
  April: "04",
  May: "05",
  Jun: "06",
  June: "06",
  Jul: "07",
  July: "07",
  Aug: "08",
  August: "08",
  Sep: "09",
  September: "09",
  Oct: "10",
  October: "10",
  Nov: "11",
  November: "11",
  Dec: "12",
  December: "12",
};

function normalizeWhitespace(value) {
  return value.replace(/\t/g, " ").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function signed(value, digits = 2) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : ""}${amount.toFixed(digits)}`;
}

function percentage(probability) {
  return `${(probability * 100).toFixed(1)}%`;
}

function roundStagePercentage(value) {
  const rounded = Number(value.toFixed(1));
  return rounded === 0 && value > 0 ? 0.1 : rounded;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function toDateString(monthName, day, year = "2026") {
  return `${year}-${monthMap[monthName]}-${String(day).padStart(2, "0")}`;
}

function createPrematchSignalKey({ date, homeTeam, awayTeam }) {
  return `${date}__${homeTeam}__${awayTeam}`;
}

function resolveBuildReferenceTimestamp() {
  const timestamps = [
    prematchSignalSource.feed?.generatedAt,
    ...Object.values(prematchSignalSource.teamSignals || {}).map((signal) => signal.lastUpdated),
    ...(prematchSignalSource.fixtureSignals || []).map((signal) => signal.lastUpdated),
  ]
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) {
    return "2026-03-20T00:00:00.000Z";
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function getHoursSince(timestamp) {
  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    return prematchSignalSource.defaults.freshnessHours;
  }

  return Math.max(1, Math.round((buildReferenceMs - parsed) / 3600000));
}

function coverageLabel(coverage) {
  if (coverage === "fixture") {
    return "场次级动态";
  }

  if (coverage === "team") {
    return "球队级动态";
  }

  return "基础种子";
}

function marketDirectionLabel(shift) {
  if (shift >= 1.5) {
    return "主队升温";
  }

  if (shift <= -1.5) {
    return "客队升温";
  }

  return "市场平稳";
}

function marketVolatilityLabel(volatility) {
  if (volatility >= 2.8) {
    return "高";
  }

  if (volatility >= 1.8) {
    return "中";
  }

  return "低";
}

function buildPrematchSignal(fixture) {
  const defaults = prematchSignalSource.defaults || {};
  const defaultLineupConfidence = defaults.lineupConfidence || 74;
  const defaultFreshnessHours = defaults.freshnessHours || 18;
  const defaultMarketVolatility = defaults.marketVolatility || 1.2;
  const homeTeamSignal = prematchTeamSignalMap.get(fixture.homeTeam) || {};
  const awayTeamSignal = prematchTeamSignalMap.get(fixture.awayTeam) || {};
  const fixtureSignal = prematchFixtureSignalMap.get(createPrematchSignalKey(fixture)) || {};
  const coverage = fixtureSignal.homeTeam ? "fixture" : Object.keys(homeTeamSignal).length || Object.keys(awayTeamSignal).length ? "team" : "default";
  const homeLineupConfidence = clamp(
    fixtureSignal.homeLineupConfidence ?? homeTeamSignal.lineupConfidence ?? defaultLineupConfidence,
    40,
    95
  );
  const awayLineupConfidence = clamp(
    fixtureSignal.awayLineupConfidence ?? awayTeamSignal.lineupConfidence ?? defaultLineupConfidence,
    40,
    95
  );
  const homeAttackDelta = (homeTeamSignal.attackDelta || 0) + (fixtureSignal.homeAttackDelta || 0);
  const homeDefenseDelta = homeTeamSignal.defenseDelta || 0;
  const awayAttackDelta = (awayTeamSignal.attackDelta || 0) + (fixtureSignal.awayAttackDelta || 0);
  const awayDefenseDelta = awayTeamSignal.defenseDelta || 0;
  const homeLambdaDelta = clamp(homeAttackDelta - awayDefenseDelta + (fixtureSignal.homeLambdaDelta || 0), -0.28, 0.28);
  const awayLambdaDelta = clamp(awayAttackDelta - homeDefenseDelta + (fixtureSignal.awayLambdaDelta || 0), -0.28, 0.28);
  const marketHomeShift =
    fixtureSignal.marketHomeShift ??
    Number((((homeTeamSignal.marketSentiment || 0) - (awayTeamSignal.marketSentiment || 0)) * 4).toFixed(1));
  const marketVolatility = clamp(
    fixtureSignal.marketVolatility ?? Math.abs(marketHomeShift) * 0.45 + defaultMarketVolatility,
    0.8,
    4.2
  );
  const lastUpdated =
    fixtureSignal.lastUpdated || homeTeamSignal.lastUpdated || awayTeamSignal.lastUpdated || prematchSignalSource.feed.generatedAt;
  const freshnessCandidates = [fixtureSignal.lastUpdated, homeTeamSignal.lastUpdated, awayTeamSignal.lastUpdated]
    .filter(Boolean)
    .map((timestamp) => getHoursSince(timestamp));
  const freshnessHours = freshnessCandidates.length > 0 ? Math.max(...freshnessCandidates) : defaultFreshnessHours;
  const alerts = unique([
    ...(fixtureSignal.alerts || []),
    ...(homeTeamSignal.alerts || []).map((alert) => `${fixture.homeTeam}：${alert}`),
    ...(awayTeamSignal.alerts || []).map((alert) => `${fixture.awayTeam}：${alert}`),
  ]).slice(0, 4);
  const sourceLabels = unique([
    ...(defaults.sourceLabels || []),
    ...(homeTeamSignal.sourceLabels || []),
    ...(awayTeamSignal.sourceLabels || []),
    ...(fixtureSignal.sourceLabels || []),
  ]).slice(0, 4);
  const marketDirection = marketDirectionLabel(marketHomeShift);
  const headline =
    fixtureSignal.headline ||
    (coverage === "default"
      ? "当前仅接入基础球队种子，尚未覆盖场次级临场信号。"
      : `${coverageLabel(coverage)}显示 ${marketDirection}，模型会据此微调进球期望与风险提示。`);

  return {
    feedName: prematchSignalSource.feed.name,
    feedMode: prematchSignalSource.feed.mode,
    coverage,
    coverageLabel: coverageLabel(coverage),
    headline,
    lastUpdated,
    freshnessHours,
    sourceLabels,
    alerts:
      alerts.length > 0
        ? alerts
        : ["当前没有额外临场伤停输入，仍建议在赛前 6 小时内刷新一次情报。"],
    homeLineupConfidence: Number(homeLineupConfidence.toFixed(0)),
    awayLineupConfidence: Number(awayLineupConfidence.toFixed(0)),
    marketHomeShift: Number(marketHomeShift.toFixed(1)),
    marketDirection,
    marketVolatility: Number(marketVolatility.toFixed(1)),
    marketVolatilityLabel: marketVolatilityLabel(marketVolatility),
    homeLambdaDelta: Number(homeLambdaDelta.toFixed(2)),
    awayLambdaDelta: Number(awayLambdaDelta.toFixed(2)),
    adjustmentSummary: `${signed(homeLambdaDelta)} / ${signed(awayLambdaDelta)}`,
    pulseTags: [
      { label: `${fixture.homeTeam} 首发确认`, note: `${Number(homeLineupConfidence.toFixed(0))}%` },
      { label: `${fixture.awayTeam} 首发确认`, note: `${Number(awayLineupConfidence.toFixed(0))}%` },
      { label: "市场摆动", note: `${marketDirection} ${signed(marketHomeShift, 1)}pt` },
      { label: "波动等级", note: marketVolatilityLabel(marketVolatility) },
    ],
  };
}

function normalizeTeam(team) {
  const attack =
    team.attack ??
    clamp((team.rating - 1750) / 320 + (confederationAttackBoost[team.confederation] || 0), -0.18, 0.46);
  const defense =
    team.defense ??
    clamp((team.rating - 1760) / 360 + (confederationDefenseBoost[team.confederation] || 0), -0.18, 0.32);

  return {
    ...team,
    attack,
    defense,
    form: team.form || 0,
  };
}

function poisson(lambda, maxGoals = 6) {
  const distribution = [];
  let sum = 0;

  for (let goals = 0; goals <= maxGoals; goals += 1) {
    const probability = Math.exp(-lambda) * Math.pow(lambda, goals) / factorial(goals);
    distribution.push(probability);
    sum += probability;
  }

  distribution[maxGoals] += Math.max(0, 1 - sum);
  return distribution;
}

function factorial(number) {
  if (number <= 1) {
    return 1;
  }

  let result = 1;

  for (let index = 2; index <= number; index += 1) {
    result *= index;
  }

  return result;
}

function outcomeKey(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) {
    return "home";
  }

  if (homeGoals < awayGoals) {
    return "away";
  }

  return "draw";
}

function statusLabel(key) {
  if (key === "home") {
    return "胜";
  }

  if (key === "away") {
    return "负";
  }

  return "平";
}

function createScoreMatrix(homeLambda, awayLambda, maxGoals = 6) {
  const homeDistribution = poisson(homeLambda, maxGoals);
  const awayDistribution = poisson(awayLambda, maxGoals);
  const entries = [];

  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      entries.push({
        homeGoals,
        awayGoals,
        probability: homeDistribution[homeGoals] * awayDistribution[awayGoals],
      });
    }
  }

  return entries;
}

function normalize(items) {
  const total = items.reduce((sum, item) => sum + item.probability, 0);

  return items.map((item) => ({
    ...item,
    probability: total === 0 ? 0 : item.probability / total,
  }));
}

function rankOutcomeConfidence(probabilities) {
  const sorted = [...probabilities].sort((left, right) => right - left);
  const gap = sorted[0] - sorted[1];

  if (sorted[0] >= 0.56 && gap >= 0.15) {
    return "高置信";
  }

  if (sorted[0] >= 0.49 && gap >= 0.1) {
    return "中高置信";
  }

  if (gap >= 0.05) {
    return "中置信";
  }

  return "低置信";
}

function buildHalftimeFulltime(homeLambda, awayLambda) {
  const halftimeMatrix = createScoreMatrix(homeLambda * 0.46, awayLambda * 0.46, 4);
  const secondHalfMatrix = createScoreMatrix(homeLambda * 0.54, awayLambda * 0.54, 4);
  const combinationMap = new Map();

  halftimeMatrix.forEach((halftimeEntry) => {
    secondHalfMatrix.forEach((secondHalfEntry) => {
      const halftime = outcomeKey(halftimeEntry.homeGoals, halftimeEntry.awayGoals);
      const fulltime = outcomeKey(
        halftimeEntry.homeGoals + secondHalfEntry.homeGoals,
        halftimeEntry.awayGoals + secondHalfEntry.awayGoals
      );
      const label = `${statusLabel(halftime)} / ${statusLabel(fulltime)}`;
      const probability = halftimeEntry.probability * secondHalfEntry.probability;
      combinationMap.set(label, (combinationMap.get(label) || 0) + probability);
    });
  });

  return [...combinationMap.entries()]
    .map(([label, probability]) => ({ label, probability }))
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 4)
    .map((item) => ({
      label: item.label,
      note: percentage(item.probability),
    }));
}

function detectVenueCountry(venue) {
  if (venue.includes("Mexico City") || venue.includes("Guadalajara") || venue.includes("Monterrey")) {
    return "Mexico";
  }

  if (venue.includes("Toronto") || venue.includes("Vancouver")) {
    return "Canada";
  }

  return "United States";
}

function parseGroupDefinitions(text) {
  const lines = text.split("\n");
  const groups = new Map();

  lines
    .filter((line) => line.startsWith("Group "))
    .forEach((line) => {
      const [groupLabel, teamsPart] = line.split("|");
      const label = normalizeWhitespace(groupLabel);
      const groupId = label.split(" ")[1];
      const teamsInGroup = teamsPart
        .replace(/\t/g, "  ")
        .trim()
        .split(/\s{2,}/)
        .map((team) => normalizeWhitespace(team));

      groups.set(label, {
        id: groupId,
        label,
        teams: teamsInGroup,
      });
    });

  return groups;
}

function parseGroupFixtures(text, groupDefinitions) {
  const lines = text.split("\n");
  const fixtures = [];
  let currentGroup = null;
  let currentDate = null;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    if (trimmed.startsWith("▪ ") && !trimmed.startsWith("▪ Group ")) {
      currentGroup = null;
      return;
    }

    if (trimmed.startsWith("▪ Group ")) {
      currentGroup = groupDefinitions.get(trimmed.replace("▪ ", ""));
      return;
    }

    const dateMatch = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]+)\s+(\d{1,2})$/);

    if (dateMatch) {
      currentDate = toDateString(dateMatch[1], Number(dateMatch[2]));
      return;
    }

    const normalizedLine = normalizeWhitespace(line);
    const fixtureMatch = normalizedLine.match(/^(\d{1,2}:\d{2}) (UTC[+-]\d) (.+) @ (.+)$/);

    if (fixtureMatch && currentGroup && currentDate) {
      const [, kickoff, utcOffset, matchup, venue] = fixtureMatch;
      const [homeTeam, awayTeam] = matchup.split(/\s+v\s+/);
      const normalizedHomeTeam = normalizeWhitespace(homeTeam);
      const normalizedAwayTeam = normalizeWhitespace(awayTeam);
      const normalizedVenue = normalizeWhitespace(venue);

      fixtures.push({
        id: `${currentGroup.id.toLowerCase()}-${fixtures.filter((item) => item.group === currentGroup.label).length + 1}-${normalizedHomeTeam.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${normalizedAwayTeam.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        stage: "Group Stage",
        group: currentGroup.label,
        groupId: currentGroup.id,
        date: currentDate,
        kickoff,
        utcOffset,
        homeTeam: normalizedHomeTeam,
        awayTeam: normalizedAwayTeam,
        venue: normalizedVenue,
        venueCountry: detectVenueCountry(normalizedVenue),
      });
    }
  });

  return fixtures;
}

function parseHistoricalGroupFixtures(text, season, hostCountry) {
  const groupDefinitions = parseGroupDefinitions(text);
  const lines = text.split("\n");
  const fixtures = [];
  let currentGroup = null;
  let currentDate = null;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    if (trimmed.startsWith("▪ Group ")) {
      currentGroup = groupDefinitions.get(trimmed.replace("▪ ", ""));
      return;
    }

    const dateMatch = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]{3,})\s+(\d{1,2})$/);

    if (dateMatch) {
      currentDate = toDateString(dateMatch[1], Number(dateMatch[2]), season);
      return;
    }

    if (!currentGroup || !currentDate || !line.includes("@")) {
      return;
    }

    const normalizedLine = normalizeWhitespace(line);
    const lineWithoutVenue = normalizedLine.split(" @ ")[0];
    const fixtureLine = lineWithoutVenue.replace(/^\d{1,2}:\d{2}(?:\s+UTC[+-]\d+)?\s+/, "").trim();
    const scoreMatch = fixtureLine.match(/\b(\d+)-(\d+)\b/);

    if (!scoreMatch) {
      return;
    }

    const homeGoals = Number(scoreMatch[1]);
    const awayGoals = Number(scoreMatch[2]);
    const beforeScore = fixtureLine.slice(0, scoreMatch.index).trim();
    const afterScore = fixtureLine
      .slice(scoreMatch.index + scoreMatch[0].length)
      .trim()
      .replace(/^\([^)]*\)\s*/, "")
      .trim();

    const [homeTeam, awayTeam] = beforeScore.includes(" v ")
      ? beforeScore.split(/\s+v\s+/)
      : [beforeScore, afterScore];

    fixtures.push({
      id: `history-${season}-${currentGroup.id.toLowerCase()}-${fixtures.filter((item) => item.group === currentGroup.label).length + 1}-${homeTeam.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${awayTeam.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      season,
      stage: "Group Stage",
      group: currentGroup.label,
      groupId: currentGroup.id,
      date: currentDate,
      kickoff: "Historical",
      utcOffset: "",
      homeTeam: normalizeWhitespace(homeTeam),
      awayTeam: normalizeWhitespace(awayTeam),
      venue: hostCountry,
      venueCountry: hostCountry,
      hostNation: hostCountry,
      actualHomeGoals: homeGoals,
      actualAwayGoals: awayGoals,
    });
  });

  return fixtures;
}

function parseKnockoutFixtures(text) {
  const lines = text.split("\n");
  const fixtures = [];
  let currentStage = null;
  let currentDate = null;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    if (trimmed.startsWith("▪ ")) {
      currentStage = trimmed.replace("▪ ", "");
      return;
    }

    const dateMatch = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]{3,})\s+(\d{1,2})$/);

    if (dateMatch) {
      currentDate = toDateString(dateMatch[1], Number(dateMatch[2]));
      return;
    }

    const normalizedLine = normalizeWhitespace(line);
    const fixtureMatch = normalizedLine.match(/^\((\d+)\) (\d{1,2}:\d{2}) (UTC[+-]\d) (.+) @ (.+)$/);

    if (fixtureMatch && currentStage && currentDate) {
      const [, matchNumber, kickoff, utcOffset, matchup, venue] = fixtureMatch;
      const [homeTeam, awayTeam] = matchup.split(/\s+v\s+/);
      fixtures.push({
        id: `knockout-${matchNumber}`,
        matchNumber: Number(matchNumber),
        stage: currentStage,
        date: currentDate,
        kickoff,
        utcOffset,
        homeTeam: normalizeWhitespace(homeTeam),
        awayTeam: normalizeWhitespace(awayTeam),
        venue: normalizeWhitespace(venue),
      });
      return;
    }

    const unnumberedFixtureMatch = normalizedLine.match(/^(\d{1,2}:\d{2}) (UTC[+-]\d) (.+) @ (.+)$/);

    if (unnumberedFixtureMatch && currentStage && currentDate) {
      const [, kickoff, utcOffset, matchup, venue] = unnumberedFixtureMatch;
      const [homeTeam, awayTeam] = matchup.split(/\s+v\s+/);
      fixtures.push({
        id: `knockout-${fixtures.length + 1}`,
        matchNumber: null,
        stage: currentStage,
        date: currentDate,
        kickoff,
        utcOffset,
        homeTeam: normalizeWhitespace(homeTeam),
        awayTeam: normalizeWhitespace(awayTeam),
        venue: normalizeWhitespace(venue),
      });
    }
  });

  return fixtures;
}

function deriveRiskNotes({
  fixture,
  homeWinProbability,
  drawProbability,
  awayWinProbability,
  over25Probability,
  under25Probability,
  topScoreProbability,
  hostAdvantage,
  prematchSignal,
}) {
  const notes = [];
  const pushNote = (note) => {
    if (!notes.includes(note)) {
      notes.push(note);
    }
  };

  if (fixture.hasPlaceholderTeam) {
    pushNote("本场包含尚未决出的附加赛占位队，实际对阵强度会在资格赛落位后重新计算。");
  }

  if (Math.abs(homeWinProbability - awayWinProbability) <= 0.08 || drawProbability >= 0.3) {
    pushNote("对阵接近，平局与临场名单的影响会明显放大。");
  }

  if (under25Probability >= 0.56) {
    pushNote("模型偏向低比分区间，更适合展示胜平负和小比分组合。");
  } else if (over25Probability >= 0.58) {
    pushNote("比赛节奏偏开放，单点比分离散度较高，建议结合总进球一起看。");
  }

  if (topScoreProbability <= 0.14) {
    pushNote("精确比分命中天然偏低，更适合输出 Top3 覆盖而不是单点承诺。");
  }

  if (hostAdvantage) {
    pushNote("主办国在本国城市作赛时已纳入轻微场地熟悉度加成。");
  }

  if (prematchSignal && prematchSignal.awayLineupConfidence <= 62) {
    pushNote("客队首发确认度偏低，赛前名单一旦明确，赔率和比分分布都可能二次重估。");
  }

  if (prematchSignal && prematchSignal.marketVolatility >= 2.8) {
    pushNote("当前场次的市场摆动偏大，适合在开赛前继续刷新情报，不宜过早固化口径。");
  }

  const fallbackNotes = [
    "当前版本已接入本地赛前情报 seed feed，但仍需替换为真实赔率、伤停和首发数据源。",
    "当前版本仍未纳入自动刷新机制，关键球员缺阵与赔率异动需要后续接正式供应商接口。",
    "当前版本已接入小组出线与冠军概率模拟，但最佳第三名对阵仍采用近似分配。",
  ];

  for (const note of fallbackNotes) {
    if (notes.length >= 3) {
      break;
    }

    pushNote(note);
  }

  return [...new Set(notes)].slice(0, 3);
}

function deriveBestPick({
  homeWinProbability,
  drawProbability,
  awayWinProbability,
  over25Probability,
  under25Probability,
  topScore,
}) {
  const ordered = [
    { label: "主胜", probability: homeWinProbability },
    { label: "平局倾向", probability: drawProbability },
    { label: "客胜", probability: awayWinProbability },
  ].sort((left, right) => right.probability - left.probability);

  if (ordered[0].label !== "平局倾向" && ordered[0].probability >= 0.48 && over25Probability >= 0.56) {
    return `${ordered[0].label} + 大2.5`;
  }

  if (ordered[0].probability >= 0.45) {
    return ordered[0].label;
  }

  if (under25Probability >= 0.58) {
    return "小2.5";
  }

  return `比分关注 ${topScore}`;
}

function buildMatchModel(fixture) {
  const homeTeam = teamMap.get(fixture.homeTeam);
  const awayTeam = teamMap.get(fixture.awayTeam);

  if (!homeTeam || !awayTeam) {
    throw new Error(`Missing team rating seed for fixture: ${fixture.homeTeam} vs ${fixture.awayTeam}`);
  }

  const ratingDelta = (homeTeam.rating - awayTeam.rating) / 400;
  const homeHasHostEdge =
    (fixture.hostNation && homeTeam.country === fixture.hostNation) ||
    (fixture.venueCountry === homeTeam.country && homeTeam.hostNation);
  const awayHasHostEdge =
    (fixture.hostNation && awayTeam.country === fixture.hostNation) ||
    (fixture.venueCountry === awayTeam.country && awayTeam.hostNation);
  const hostAdvantage =
    homeHasHostEdge
      ? 0.16
      : awayHasHostEdge
        ? -0.08
        : 0;

  const homeLambda = clamp(
    1.2 +
      ratingDelta * 0.64 +
      (homeTeam.attack - awayTeam.defense) * 0.7 +
      (homeTeam.form - awayTeam.form) * 0.24 +
      hostAdvantage +
      (fixture.prematchSignal?.homeLambdaDelta || 0),
    0.3,
    3.5
  );
  const awayLambda = clamp(
    1.05 -
      ratingDelta * 0.35 +
      (awayTeam.attack - homeTeam.defense) * 0.68 +
      (awayTeam.form - homeTeam.form) * 0.18 -
      hostAdvantage * 0.35 +
      (fixture.prematchSignal?.awayLambdaDelta || 0),
    0.25,
    3.1
  );

  const matrix = normalize(createScoreMatrix(homeLambda, awayLambda, 6));
  const cumulativeMatrix = [];
  const outcomeTotals = { home: 0, draw: 0, away: 0 };
  const totalGoalsMap = new Map();
  let bothTeamsToScore = 0;
  let cumulativeProbability = 0;

  matrix.forEach((entry) => {
    outcomeTotals[outcomeKey(entry.homeGoals, entry.awayGoals)] += entry.probability;
    const totalGoals = entry.homeGoals + entry.awayGoals;
    totalGoalsMap.set(totalGoals, (totalGoalsMap.get(totalGoals) || 0) + entry.probability);

    if (entry.homeGoals >= 1 && entry.awayGoals >= 1) {
      bothTeamsToScore += entry.probability;
    }

    cumulativeProbability += entry.probability;
    cumulativeMatrix.push({
      homeGoals: entry.homeGoals,
      awayGoals: entry.awayGoals,
      cumulativeProbability,
    });
  });

  return {
    homeTeam,
    awayTeam,
    homeLambda,
    awayLambda,
    hostAdvantage,
    matrix,
    cumulativeMatrix,
    outcomeTotals,
    totalGoalsDistribution: [...totalGoalsMap.entries()]
      .map(([goals, probability]) => ({ goals, probability }))
      .sort((left, right) => right.probability - left.probability),
    bothTeamsToScore,
  };
}

function getTopScoreEntries(matrix, count = 3) {
  return [...matrix].sort((left, right) => right.probability - left.probability).slice(0, count);
}

function getMostLikelyOutcome(outcomeTotals) {
  return Object.entries(outcomeTotals)
    .sort((left, right) => right[1] - left[1])
    .map(([key]) => key)[0];
}

function generateFixturePrediction(fixture) {
  const prematchSignal = buildPrematchSignal(fixture);
  const matchModel = buildMatchModel({
    ...fixture,
    prematchSignal,
  });

  const topScores = getTopScoreEntries(matchModel.matrix)
    .slice(0, 3)
    .map((entry) => ({
      score: `${entry.homeGoals} : ${entry.awayGoals}`,
      probability: percentage(entry.probability),
    }));

  const mostLikelyTotals = matchModel.totalGoalsDistribution.slice(0, 2).map((entry) => ({
    label: `${entry.goals} 球`,
    note: percentage(entry.probability),
  }));

  const over25Probability = matchModel.totalGoalsDistribution
    .filter((entry) => entry.goals >= 3)
    .reduce((sum, entry) => sum + entry.probability, 0);
  const under25Probability = 1 - over25Probability;
  const confidence = rankOutcomeConfidence([
    matchModel.outcomeTotals.home,
    matchModel.outcomeTotals.draw,
    matchModel.outcomeTotals.away,
  ]);
  const bestPick = deriveBestPick({
    homeWinProbability: matchModel.outcomeTotals.home,
    drawProbability: matchModel.outcomeTotals.draw,
    awayWinProbability: matchModel.outcomeTotals.away,
    over25Probability,
    under25Probability,
    topScore: topScores[0].score,
  });

  return {
    ...fixture,
    label: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
    shortMeta: fixture.group,
    meta: `${fixture.group} · ${fixture.date} ${fixture.kickoff} ${fixture.utcOffset} · ${fixture.venue}`,
    bestPick,
    signal: confidence,
    modelDetail: `Baseline xG ${matchModel.homeLambda.toFixed(2)} : ${matchModel.awayLambda.toFixed(2)} · 动态调整 ${prematchSignal.adjustmentSummary}`,
    outcomes: [
      { label: "主胜", value: Number((matchModel.outcomeTotals.home * 100).toFixed(1)) },
      { label: "平", value: Number((matchModel.outcomeTotals.draw * 100).toFixed(1)) },
      { label: "客胜", value: Number((matchModel.outcomeTotals.away * 100).toFixed(1)) },
    ],
    scores: topScores,
    goals: [
      ...mostLikelyTotals,
      {
        label: over25Probability >= under25Probability ? "大 2.5" : "小 2.5",
        note: percentage(Math.max(over25Probability, under25Probability)),
      },
      { label: "双方进球", note: percentage(matchModel.bothTeamsToScore) },
    ],
    halftime: buildHalftimeFulltime(matchModel.homeLambda, matchModel.awayLambda),
    prematch: prematchSignal,
    risks: deriveRiskNotes({
      fixture,
      homeWinProbability: matchModel.outcomeTotals.home,
      drawProbability: matchModel.outcomeTotals.draw,
      awayWinProbability: matchModel.outcomeTotals.away,
      over25Probability,
      under25Probability,
      topScoreProbability: Number(topScores[0].probability.replace("%", "")) / 100,
      hostAdvantage: matchModel.hostAdvantage > 0,
      prematchSignal,
    }),
    _simulation: {
      cumulativeMatrix: matchModel.cumulativeMatrix,
      outcomeTotals: matchModel.outcomeTotals,
      venueCountry: fixture.venueCountry,
    },
  };
}

function stripInternalFixture(prediction) {
  const { _simulation, ...publicPrediction } = prediction;
  return publicPrediction;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleScore(cumulativeMatrix, random) {
  const value = random();

  for (const entry of cumulativeMatrix) {
    if (value <= entry.cumulativeProbability) {
      return entry;
    }
  }

  return cumulativeMatrix[cumulativeMatrix.length - 1];
}

function createGroupTable(group) {
  return new Map(
    group.teams.map((teamName) => [
      teamName,
      {
        groupId: group.id,
        group: group.label,
        team: teamName,
        rating: teamMap.get(teamName)?.rating || 1700,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        gd: 0,
      },
    ])
  );
}

function applyFixtureToGroupTable(table, fixture, sample) {
  const homeRow = table.get(fixture.homeTeam);
  const awayRow = table.get(fixture.awayTeam);

  homeRow.gf += sample.homeGoals;
  homeRow.ga += sample.awayGoals;
  homeRow.gd = homeRow.gf - homeRow.ga;

  awayRow.gf += sample.awayGoals;
  awayRow.ga += sample.homeGoals;
  awayRow.gd = awayRow.gf - awayRow.ga;

  if (sample.homeGoals > sample.awayGoals) {
    homeRow.points += 3;
    homeRow.wins += 1;
    awayRow.losses += 1;
  } else if (sample.homeGoals < sample.awayGoals) {
    awayRow.points += 3;
    awayRow.wins += 1;
    homeRow.losses += 1;
  } else {
    homeRow.points += 1;
    awayRow.points += 1;
    homeRow.draws += 1;
    awayRow.draws += 1;
  }
}

function compareStandings(left, right) {
  return (
    right.points - left.points ||
    right.gd - left.gd ||
    right.gf - left.gf ||
    right.wins - left.wins ||
    right.rating - left.rating ||
    left.team.localeCompare(right.team)
  );
}

function extractThirdPlaceTokens(fixtures) {
  return [...new Set(
    fixtures
      .slice(0, 16)
      .flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam])
      .filter((token) => /^3[A-L](?:\/[A-L])+$/i.test(token))
  )];
}

function assignThirdPlaceSlots(tokens, qualifiedThirdRows) {
  const rankIndex = new Map(qualifiedThirdRows.map((row, index) => [row.groupId, index]));
  const qualifiedGroups = new Set(qualifiedThirdRows.map((row) => row.groupId));
  const tokenOptions = new Map(
    tokens.map((token) => [
      token,
      token
        .slice(1)
        .split("/")
        .filter((groupId) => qualifiedGroups.has(groupId)),
    ])
  );
  const orderedTokens = [...tokens].sort(
    (left, right) => tokenOptions.get(left).length - tokenOptions.get(right).length
  );
  const assignment = {};
  const usedGroups = new Set();

  function backtrack(index) {
    if (index >= orderedTokens.length) {
      return true;
    }

    const token = orderedTokens[index];
    const options = [...tokenOptions.get(token)].sort(
      (left, right) => (rankIndex.get(left) ?? 999) - (rankIndex.get(right) ?? 999)
    );

    for (const option of options) {
      if (usedGroups.has(option)) {
        continue;
      }

      usedGroups.add(option);
      assignment[token] = option;

      if (backtrack(index + 1)) {
        return true;
      }

      usedGroups.delete(option);
      delete assignment[token];
    }

    return false;
  }

  if (!backtrack(0)) {
    throw new Error("Unable to assign best third-place teams into knockout template slots.");
  }

  return assignment;
}

function resolveKnockoutToken(token, context) {
  if (/^W\d+$/.test(token)) {
    return context.winners[token];
  }

  if (/^L\d+$/.test(token)) {
    return context.losers[token];
  }

  if (/^[123][A-L]$/.test(token)) {
    return context.qualifiers[token];
  }

  if (/^3[A-L](?:\/[A-L])+$/.test(token)) {
    const assignedGroup = context.thirdAssignment[token];
    return assignedGroup ? context.qualifiers[`3${assignedGroup}`] : null;
  }

  return token;
}

const knockoutModelCache = new Map();

function simulateKnockoutWinner(homeTeamName, awayTeamName, venueCountry, random) {
  const cacheKey = `${homeTeamName}__${awayTeamName}__${venueCountry}`;

  if (!knockoutModelCache.has(cacheKey)) {
    knockoutModelCache.set(
      cacheKey,
      buildMatchModel({
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        venueCountry,
      })
    );
  }

  const matchModel = knockoutModelCache.get(cacheKey);
  const sample = sampleScore(matchModel.cumulativeMatrix, random);

  if (sample.homeGoals > sample.awayGoals) {
    return { winner: homeTeamName, loser: awayTeamName };
  }

  if (sample.homeGoals < sample.awayGoals) {
    return { winner: awayTeamName, loser: homeTeamName };
  }

  const homeAdvanceProbability =
    (matchModel.outcomeTotals.home + matchModel.outcomeTotals.away) === 0
      ? 0.5
      : matchModel.outcomeTotals.home / (matchModel.outcomeTotals.home + matchModel.outcomeTotals.away);

  return random() < homeAdvanceProbability
    ? { winner: homeTeamName, loser: awayTeamName }
    : { winner: awayTeamName, loser: homeTeamName };
}

function runTournamentSimulation(predictions, groupDefinitions, knockoutFixtures) {
  const iterations = 4000;
  const seed = 20260320;
  const random = createSeededRandom(seed);
  const groupList = [...groupDefinitions.values()];
  const teamStats = new Map();

  groupList.forEach((group) => {
    group.teams.forEach((teamName) => {
      teamStats.set(teamName, {
        team: teamName,
        group: group.label,
        groupId: group.id,
        rating: teamMap.get(teamName)?.rating || 1700,
        positionCounts: [0, 0, 0, 0],
        winGroupCount: 0,
        topTwoCount: 0,
        qualifyCount: 0,
        bestThirdCount: 0,
        reachRoundOf32Count: 0,
        reachRoundOf16Count: 0,
        reachQuarterFinalCount: 0,
        reachSemiFinalCount: 0,
        reachFinalCount: 0,
        championCount: 0,
        totalPoints: 0,
        totalGoalDifference: 0,
      });
    });
  });

  const thirdPlaceTokens = extractThirdPlaceTokens(knockoutFixtures);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const groupTables = new Map(groupList.map((group) => [group.label, createGroupTable(group)]));

    predictions.forEach((prediction) => {
      const score = sampleScore(prediction._simulation.cumulativeMatrix, random);
      applyFixtureToGroupTable(groupTables.get(prediction.group), prediction, score);
    });

    const rankedGroups = groupList.map((group) => ({
      group,
      standings: [...groupTables.get(group.label).values()].sort(compareStandings),
    }));

    const qualifiers = {};
    const thirdPlaceRows = [];

    rankedGroups.forEach(({ group, standings }) => {
      standings.forEach((row, index) => {
        const stat = teamStats.get(row.team);
        stat.positionCounts[index] += 1;
        stat.totalPoints += row.points;
        stat.totalGoalDifference += row.gd;

        if (index === 0) {
          stat.winGroupCount += 1;
        }

        if (index < 2) {
          stat.topTwoCount += 1;
          stat.qualifyCount += 1;
          qualifiers[`${index + 1}${group.id}`] = row.team;
        }

        if (index === 2) {
          thirdPlaceRows.push(row);
        }
      });
    });

    const rankedThirdPlaceRows = [...thirdPlaceRows].sort(compareStandings);
    const qualifiedThirdRows = rankedThirdPlaceRows.slice(0, 8);

    qualifiedThirdRows.forEach((row) => {
      qualifiers[`3${row.groupId}`] = row.team;
      const stat = teamStats.get(row.team);
      stat.bestThirdCount += 1;
      stat.qualifyCount += 1;
    });

    const thirdAssignment = assignThirdPlaceSlots(thirdPlaceTokens, qualifiedThirdRows);
    const winners = {};
    const losers = {};
    const stageReachers = {
      roundOf32: new Set(Object.values(qualifiers)),
      roundOf16: new Set(),
      quarterFinal: new Set(),
      semiFinal: new Set(),
      final: new Set(),
      champion: new Set(),
    };

    knockoutFixtures.forEach((fixture) => {
      const homeTeamName = resolveKnockoutToken(fixture.homeTeam, { qualifiers, thirdAssignment, winners, losers });
      const awayTeamName = resolveKnockoutToken(fixture.awayTeam, { qualifiers, thirdAssignment, winners, losers });

      if (!homeTeamName || !awayTeamName) {
        throw new Error(`Unable to resolve knockout fixture: ${fixture.homeTeam} vs ${fixture.awayTeam}`);
      }

      const outcome = simulateKnockoutWinner(homeTeamName, awayTeamName, detectVenueCountry(fixture.venue), random);

      if (fixture.matchNumber !== null) {
        winners[`W${fixture.matchNumber}`] = outcome.winner;
        losers[`L${fixture.matchNumber}`] = outcome.loser;
      }

      if (fixture.stage === "Round of 32") {
        stageReachers.roundOf16.add(outcome.winner);
      } else if (fixture.stage === "Round of 16") {
        stageReachers.quarterFinal.add(outcome.winner);
      } else if (fixture.stage === "Quarter-final") {
        stageReachers.semiFinal.add(outcome.winner);
      } else if (fixture.stage === "Semi-final") {
        stageReachers.final.add(outcome.winner);
      } else if (fixture.stage === "Final") {
        stageReachers.champion.add(outcome.winner);
      }
    });

    stageReachers.roundOf32.forEach((teamName) => {
      teamStats.get(teamName).reachRoundOf32Count += 1;
    });
    stageReachers.roundOf16.forEach((teamName) => {
      teamStats.get(teamName).reachRoundOf16Count += 1;
    });
    stageReachers.quarterFinal.forEach((teamName) => {
      teamStats.get(teamName).reachQuarterFinalCount += 1;
    });
    stageReachers.semiFinal.forEach((teamName) => {
      teamStats.get(teamName).reachSemiFinalCount += 1;
    });
    stageReachers.final.forEach((teamName) => {
      teamStats.get(teamName).reachFinalCount += 1;
    });
    stageReachers.champion.forEach((teamName) => {
      teamStats.get(teamName).championCount += 1;
    });
  }

  const teamStageProbabilities = [...teamStats.values()].map((stat) => {
    const rawReachRoundOf32 = (stat.reachRoundOf32Count / iterations) * 100;
    const rawReachRoundOf16 = (stat.reachRoundOf16Count / iterations) * 100;
    const rawReachQuarterFinal = (stat.reachQuarterFinalCount / iterations) * 100;
    const rawReachSemiFinal = (stat.reachSemiFinalCount / iterations) * 100;
    const rawReachFinal = (stat.reachFinalCount / iterations) * 100;
    const rawChampion = (stat.championCount / iterations) * 100;
    const championProbability = Number(rawChampion.toFixed(2));
    const reachFinalProbability = Math.max(roundStagePercentage(rawReachFinal), championProbability);
    const reachSemiFinalProbability = Math.max(roundStagePercentage(rawReachSemiFinal), reachFinalProbability);
    const reachQuarterFinalProbability = Math.max(roundStagePercentage(rawReachQuarterFinal), reachSemiFinalProbability);
    const reachRoundOf16Probability = Math.max(roundStagePercentage(rawReachRoundOf16), reachQuarterFinalProbability);
    const reachRoundOf32Probability = Math.max(roundStagePercentage(rawReachRoundOf32), reachRoundOf16Probability);

    return {
      team: stat.team,
      group: stat.group,
      groupId: stat.groupId,
      averagePoints: Number((stat.totalPoints / iterations).toFixed(2)),
      averageGoalDifference: Number((stat.totalGoalDifference / iterations).toFixed(2)),
      positionProbabilities: {
        first: Number(((stat.positionCounts[0] / iterations) * 100).toFixed(1)),
        second: Number(((stat.positionCounts[1] / iterations) * 100).toFixed(1)),
        third: Number(((stat.positionCounts[2] / iterations) * 100).toFixed(1)),
        fourth: Number(((stat.positionCounts[3] / iterations) * 100).toFixed(1)),
      },
      topTwoProbability: Number(((stat.topTwoCount / iterations) * 100).toFixed(1)),
      qualifyProbability: Number(((stat.qualifyCount / iterations) * 100).toFixed(1)),
      bestThirdQualificationProbability: Number(((stat.bestThirdCount / iterations) * 100).toFixed(1)),
      reachRoundOf32Probability,
      reachRoundOf16Probability,
      reachQuarterFinalProbability,
      reachSemiFinalProbability,
      reachFinalProbability,
      championProbability,
    };
  });

  const groupProjections = groupList.map((group) => ({
    id: group.id,
    label: group.label,
    teams: teamStageProbabilities
      .filter((team) => team.groupId === group.id)
      .sort(
        (left, right) =>
          right.qualifyProbability - left.qualifyProbability ||
          right.averagePoints - left.averagePoints ||
          right.championProbability - left.championProbability
      ),
  }));

  const titleContenders = [...teamStageProbabilities]
    .sort(
      (left, right) =>
        right.championProbability - left.championProbability ||
        right.reachFinalProbability - left.reachFinalProbability ||
        right.qualifyProbability - left.qualifyProbability
    )
    .slice(0, 12);

  return {
    iterations,
    seed,
    notes: [
      "小组赛按每场比分分布进行 Monte Carlo 采样，累计积分、净胜球与进球数后排序。",
      "最佳第三名晋级位采用基于允许分组集合的约束匹配近似分配，当前版本尚未编码 FIFA 正式分配矩阵。",
      "淘汰赛若常规时间打平，按非平局胜率比例近似决定加时/点球晋级方。",
    ],
    groupProjections,
    teamStageProbabilities,
    titleContenders,
  };
}

function createBacktestAccumulator() {
  return {
    matchCount: 0,
    outcomeHitCount: 0,
    top3HitCount: 0,
    brierTotal: 0,
    logLossTotal: 0,
    confidenceTotal: 0,
  };
}

function recordBacktestEvaluation(accumulator, evaluation) {
  accumulator.matchCount += 1;
  accumulator.outcomeHitCount += evaluation.outcomeHit ? 1 : 0;
  accumulator.top3HitCount += evaluation.top3Hit ? 1 : 0;
  accumulator.brierTotal += evaluation.brierScore;
  accumulator.logLossTotal += evaluation.logLoss;
  accumulator.confidenceTotal += evaluation.modelConfidence;
}

function finalizeBacktestAccumulator(accumulator) {
  return {
    matchCount: accumulator.matchCount,
    outcomeAccuracy: Number(((accumulator.outcomeHitCount / accumulator.matchCount) * 100).toFixed(1)),
    top3ScoreCoverage: Number(((accumulator.top3HitCount / accumulator.matchCount) * 100).toFixed(1)),
    averageBrier: Number((accumulator.brierTotal / accumulator.matchCount).toFixed(3)),
    averageLogLoss: Number((accumulator.logLossTotal / accumulator.matchCount).toFixed(3)),
    averageConfidence: Number(((accumulator.confidenceTotal / accumulator.matchCount) * 100).toFixed(1)),
  };
}

function createConfidenceBucket(label, min, max = null) {
  return {
    label,
    min,
    max,
    matchCount: 0,
    hitCount: 0,
    confidenceTotal: 0,
  };
}

function runHistoricalBacktest() {
  const overall = createBacktestAccumulator();
  const confidenceBuckets = [
    createConfidenceBucket("< 40%", 0, 0.4),
    createConfidenceBucket("40% - 49.9%", 0.4, 0.5),
    createConfidenceBucket("50% - 59.9%", 0.5, 0.6),
    createConfidenceBucket("60%+", 0.6, null),
  ];
  const surpriseMatches = [];

  const seasonBreakdown = historicalBacktestSources.map(({ season, hostCountry, text }) => {
    const fixtures = parseHistoricalGroupFixtures(text, season, hostCountry);
    const seasonAccumulator = createBacktestAccumulator();

    fixtures.forEach((fixture) => {
      const matchModel = buildMatchModel(fixture);
      const predictedOutcome = getMostLikelyOutcome(matchModel.outcomeTotals);
      const actualOutcome = outcomeKey(fixture.actualHomeGoals, fixture.actualAwayGoals);
      const topScores = getTopScoreEntries(matchModel.matrix);
      const top3Hit = topScores.some(
        (entry) => entry.homeGoals === fixture.actualHomeGoals && entry.awayGoals === fixture.actualAwayGoals
      );
      const modelConfidence = matchModel.outcomeTotals[predictedOutcome];
      const actualOutcomeProbability = clamp(matchModel.outcomeTotals[actualOutcome], 0.001, 1);
      const brierScore =
        ["home", "draw", "away"].reduce(
          (sum, key) => sum + Math.pow(matchModel.outcomeTotals[key] - (key === actualOutcome ? 1 : 0), 2),
          0
        ) / 3;
      const evaluation = {
        outcomeHit: predictedOutcome === actualOutcome,
        top3Hit,
        brierScore,
        logLoss: -Math.log(actualOutcomeProbability),
        modelConfidence,
      };

      recordBacktestEvaluation(overall, evaluation);
      recordBacktestEvaluation(seasonAccumulator, evaluation);

      const bucket = confidenceBuckets.find(
        (item) => modelConfidence >= item.min && (item.max === null || modelConfidence < item.max)
      );

      if (bucket) {
        bucket.matchCount += 1;
        bucket.hitCount += evaluation.outcomeHit ? 1 : 0;
        bucket.confidenceTotal += modelConfidence;
      }

      surpriseMatches.push({
        season,
        fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        actualScore: `${fixture.actualHomeGoals} : ${fixture.actualAwayGoals}`,
        predictedOutcome: statusLabel(predictedOutcome),
        actualOutcome: statusLabel(actualOutcome),
        modelConfidence: Number((modelConfidence * 100).toFixed(1)),
        actualOutcomeProbability: Number((actualOutcomeProbability * 100).toFixed(1)),
        topScore: `${topScores[0].homeGoals} : ${topScores[0].awayGoals}`,
      });
    });

    return {
      season,
      hostCountry,
      ...finalizeBacktestAccumulator(seasonAccumulator),
    };
  });

  return {
    sampleLabel: "2014 / 2018 / 2022 世界杯小组赛",
    matchCount: overall.matchCount,
    metrics: finalizeBacktestAccumulator(overall),
    seasonBreakdown,
    confidenceBuckets: confidenceBuckets.map((bucket) => ({
      label: bucket.label,
      matchCount: bucket.matchCount,
      averageConfidence: Number(
        (bucket.matchCount === 0 ? 0 : (bucket.confidenceTotal / bucket.matchCount) * 100).toFixed(1)
      ),
      actualAccuracy: Number(
        (bucket.matchCount === 0 ? 0 : (bucket.hitCount / bucket.matchCount) * 100).toFixed(1)
      ),
    })),
    surpriseMatches: surpriseMatches
      .sort((left, right) => left.actualOutcomeProbability - right.actualOutcomeProbability)
      .slice(0, 6),
    notes: [
      "首版回测使用 2014、2018、2022 三届世界杯共 144 场小组赛样本，先验证 1X2 与比分覆盖是否具备展示价值。",
      "当前回测仍使用统一的静态球队强度种子向历史回放，不是按当届赛前 Elo 逐年重建，因此更适合作为 MVP 校验而非最终业绩承诺。",
      "Brier 为三分类均值误差，Log Loss 为实际赛果对应概率的对数损失，数值越低越好。",
    ],
  };
}

const groupDefinitions = parseGroupDefinitions(groupStageSource);
const groupFixtures = parseGroupFixtures(groupStageSource, groupDefinitions).map((fixture) => ({
  ...fixture,
  hasPlaceholderTeam:
    teamMap.get(fixture.homeTeam)?.placeholder === true || teamMap.get(fixture.awayTeam)?.placeholder === true,
}));
const knockoutFixtures = parseKnockoutFixtures(finalsSource);
const generatedPredictions = groupFixtures.map(generateFixturePrediction);
const predictions = generatedPredictions.map(stripInternalFixture);
const simulation = runTournamentSimulation(generatedPredictions, groupDefinitions, knockoutFixtures);
const backtest = runHistoricalBacktest();
const prematchCoverageCount = predictions.filter((prediction) => prediction.prematch.coverage !== "default").length;
const prematchFixtureOverrideCount = predictions.filter((prediction) => prediction.prematch.coverage === "fixture").length;

const output = {
  model: {
    name: "Baseline Elo-Poisson 2026 Snapshot",
    version: "v0.7.0",
    generatedAt: buildReferenceTimestamp,
    notes: tournamentConfig.tournament.assumptions,
    sources: tournamentConfig.sources,
  },
  summary: {
    tournamentName: tournamentConfig.tournament.name,
    teamCount: teams.length,
    fixtureCount: predictions.length,
    groupCount: groupDefinitions.size,
    knockoutFixtureCount: knockoutFixtures.length,
    simulationCount: simulation.iterations,
    backtestMatchCount: backtest.matchCount,
    prematchCoverageCount,
    prematchFixtureOverrideCount,
    scopeNote: tournamentConfig.tournament.scopeNote,
  },
  groups: [...groupDefinitions.values()],
  fixtures: predictions,
  knockoutFixtures,
  simulation,
  backtest,
  prematchFeed: {
    ...prematchSignalSource.feed,
    teamSignalCount: prematchTeamSignalMap.size,
    fixtureSignalCount: (prematchSignalSource.fixtureSignals || []).length,
    coverageCount: prematchCoverageCount,
  },
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, "worldcup-forecast.json"), JSON.stringify(output, null, 2));

console.log(
  `Generated ${predictions.length} group-stage predictions, ${knockoutFixtures.length} knockout fixtures, ${simulation.iterations} tournament simulations, ${backtest.matchCount} historical backtest matches, and ${prematchCoverageCount} prematch signal overlays.`
);

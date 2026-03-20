import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const sourceDir = resolve(rootDir, "data", "source");
const outputDir = resolve(rootDir, "data", "generated");

const teams = JSON.parse(readFileSync(resolve(sourceDir, "teams.json"), "utf8"));
const tournamentConfig = JSON.parse(readFileSync(resolve(sourceDir, "tournament.json"), "utf8"));
const groupStageSource = readFileSync(resolve(sourceDir, "worldcup-2026-openfootball-cup.txt"), "utf8");
const finalsSource = readFileSync(resolve(sourceDir, "worldcup-2026-openfootball-cup_finals.txt"), "utf8");

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

const teamMap = new Map(teams.map((team) => [team.name, normalizeTeam(team)]));

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
};

function normalizeWhitespace(value) {
  return value.replace(/\t/g, " ").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function percentage(probability) {
  return `${(probability * 100).toFixed(1)}%`;
}

function toDateString(monthName, day) {
  return `2026-${monthMap[monthName]}-${String(day).padStart(2, "0")}`;
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

  const fallbackNotes = [
    "当前版本尚未接入赔率与伤停流，赛前更新频率仍需继续补强。",
    "当前版本仍未纳入赛前首发与伤停流，关键球员缺阵会显著影响模型输出。",
    "淘汰赛模拟将在下一阶段接入，当前版本先聚焦真实小组赛赛程预测。",
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

function generateFixturePrediction(fixture) {
  const homeTeam = teamMap.get(fixture.homeTeam);
  const awayTeam = teamMap.get(fixture.awayTeam);

  if (!homeTeam || !awayTeam) {
    throw new Error(`Missing team rating seed for fixture: ${fixture.homeTeam} vs ${fixture.awayTeam}`);
  }

  const ratingDelta = (homeTeam.rating - awayTeam.rating) / 400;
  const hostAdvantage =
    fixture.venueCountry === homeTeam.country && homeTeam.hostNation
      ? 0.16
      : fixture.venueCountry === awayTeam.country && awayTeam.hostNation
        ? -0.08
        : 0;

  const homeLambda = clamp(
    1.2 +
      ratingDelta * 0.64 +
      (homeTeam.attack - awayTeam.defense) * 0.7 +
      (homeTeam.form - awayTeam.form) * 0.24 +
      hostAdvantage,
    0.3,
    3.5
  );
  const awayLambda = clamp(
    1.05 -
      ratingDelta * 0.35 +
      (awayTeam.attack - homeTeam.defense) * 0.68 +
      (awayTeam.form - homeTeam.form) * 0.18 -
      hostAdvantage * 0.35,
    0.25,
    3.1
  );

  const matrix = normalize(createScoreMatrix(homeLambda, awayLambda, 6));
  const outcomeTotals = { home: 0, draw: 0, away: 0 };
  const totalGoalsMap = new Map();
  let bothTeamsToScore = 0;

  matrix.forEach((entry) => {
    outcomeTotals[outcomeKey(entry.homeGoals, entry.awayGoals)] += entry.probability;
    const totalGoals = entry.homeGoals + entry.awayGoals;
    totalGoalsMap.set(totalGoals, (totalGoalsMap.get(totalGoals) || 0) + entry.probability);

    if (entry.homeGoals >= 1 && entry.awayGoals >= 1) {
      bothTeamsToScore += entry.probability;
    }
  });

  const topScores = [...matrix]
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 3)
    .map((entry) => ({
      score: `${entry.homeGoals} : ${entry.awayGoals}`,
      probability: percentage(entry.probability),
    }));

  const totalGoalsDistribution = [...totalGoalsMap.entries()]
    .map(([goals, probability]) => ({ goals, probability }))
    .sort((left, right) => right.probability - left.probability);

  const mostLikelyTotals = totalGoalsDistribution.slice(0, 2).map((entry) => ({
    label: `${entry.goals} 球`,
    note: percentage(entry.probability),
  }));

  const over25Probability = totalGoalsDistribution
    .filter((entry) => entry.goals >= 3)
    .reduce((sum, entry) => sum + entry.probability, 0);
  const under25Probability = 1 - over25Probability;
  const confidence = rankOutcomeConfidence([
    outcomeTotals.home,
    outcomeTotals.draw,
    outcomeTotals.away,
  ]);
  const bestPick = deriveBestPick({
    homeWinProbability: outcomeTotals.home,
    drawProbability: outcomeTotals.draw,
    awayWinProbability: outcomeTotals.away,
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
    modelDetail: `Baseline xG ${homeLambda.toFixed(2)} : ${awayLambda.toFixed(2)}`,
    outcomes: [
      { label: "主胜", value: Number((outcomeTotals.home * 100).toFixed(1)) },
      { label: "平", value: Number((outcomeTotals.draw * 100).toFixed(1)) },
      { label: "客胜", value: Number((outcomeTotals.away * 100).toFixed(1)) },
    ],
    scores: topScores,
    goals: [
      ...mostLikelyTotals,
      {
        label: over25Probability >= under25Probability ? "大 2.5" : "小 2.5",
        note: percentage(Math.max(over25Probability, under25Probability)),
      },
      { label: "双方进球", note: percentage(bothTeamsToScore) },
    ],
    halftime: buildHalftimeFulltime(homeLambda, awayLambda),
    risks: deriveRiskNotes({
      fixture,
      homeWinProbability: outcomeTotals.home,
      drawProbability: outcomeTotals.draw,
      awayWinProbability: outcomeTotals.away,
      over25Probability,
      under25Probability,
      topScoreProbability: Number(topScores[0].probability.replace("%", "")) / 100,
      hostAdvantage: hostAdvantage > 0,
    }),
  };
}

const groupDefinitions = parseGroupDefinitions(groupStageSource);
const groupFixtures = parseGroupFixtures(groupStageSource, groupDefinitions).map((fixture) => ({
  ...fixture,
  hasPlaceholderTeam:
    teamMap.get(fixture.homeTeam)?.placeholder === true || teamMap.get(fixture.awayTeam)?.placeholder === true,
}));
const knockoutFixtures = parseKnockoutFixtures(finalsSource);
const predictions = groupFixtures.map(generateFixturePrediction);

const output = {
  model: {
    name: "Baseline Elo-Poisson 2026 Snapshot",
    version: "v0.2.0",
    generatedAt: new Date().toISOString(),
    notes: tournamentConfig.tournament.assumptions,
    sources: tournamentConfig.sources,
  },
  summary: {
    tournamentName: tournamentConfig.tournament.name,
    teamCount: teams.length,
    fixtureCount: predictions.length,
    groupCount: groupDefinitions.size,
    knockoutFixtureCount: knockoutFixtures.length,
    scopeNote: tournamentConfig.tournament.scopeNote,
  },
  groups: [...groupDefinitions.values()],
  fixtures: predictions,
  knockoutFixtures,
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, "worldcup-forecast.json"), JSON.stringify(output, null, 2));

console.log(
  `Generated ${predictions.length} group-stage predictions across ${groupDefinitions.size} groups and ${knockoutFixtures.length} knockout fixtures.`
);

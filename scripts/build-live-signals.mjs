import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  clamp,
  createFixtureKey,
  normalizeTeamToken,
  parseWorldCupFixtures,
  readJson,
  resolveProjectPaths,
  writeJson,
} from "./live-data-utils.mjs";

const { sourceDir, liveDir } = resolveProjectPaths(import.meta.url);

const seedPath = resolve(sourceDir, "prematch-signals.json");
const liveOutputPath = resolve(sourceDir, "prematch-signals.live.json");
const groupStageSource = readFileSync(resolve(sourceDir, "worldcup-2026-openfootball-cup.txt"), "utf8");
const seedFeed = readJson(seedPath);
const sportmonksSnapshot = readJson(resolve(liveDir, "sportmonks-worldcup.json"));
const oddsSnapshot = readJson(resolve(liveDir, "the-odds-api-worldcup.json"));

if (!sportmonksSnapshot && !oddsSnapshot) {
  console.error("没有找到实时快照文件。请先运行 `npm run sync:live:snapshots`。");
  process.exit(1);
}

const localFixtures = parseWorldCupFixtures(groupStageSource);
const localTeams = [...new Set(localFixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]))];
const teamAliasMap = buildTeamAliasMap(localTeams);
const fixtureIndex = buildFixtureIndex(localFixtures, teamAliasMap);
const seedFixtureSignalMap = new Map((seedFeed.fixtureSignals || []).map((signal) => [createFixtureKey(signal), signal]));
const sportmonksFixtureMap = buildSportmonksFixtureMap(sportmonksSnapshot?.data || [], fixtureIndex, teamAliasMap);
const oddsFixtureMap = buildOddsFixtureMap(oddsSnapshot?.data || [], fixtureIndex, teamAliasMap);

const allKeys = [...new Set([...seedFixtureSignalMap.keys(), ...sportmonksFixtureMap.keys(), ...oddsFixtureMap.keys()])].sort();
const fixtureSignals = allKeys
  .map((key) => {
    const fixture = fixtureIndex.byExactKey.get(key);

    if (!fixture) {
      return null;
    }

    return buildMergedFixtureSignal({
      fixture,
      seedSignal: seedFixtureSignalMap.get(key) || null,
      sportmonksSignal: sportmonksFixtureMap.get(key) || null,
      oddsSignal: oddsFixtureMap.get(key) || null,
      defaults: seedFeed.defaults || {},
    });
  })
  .filter(Boolean);

const providerNames = [
  sportmonksSnapshot ? "Sportmonks" : null,
  oddsSnapshot ? "The Odds API" : null,
].filter(Boolean);

const feed = {
  feed: {
    name: providerNames.length > 1 ? "Realtime Prematch Signal Feed" : `${providerNames[0]} Prematch Signal Feed`,
    mode: providerNames.length > 1 ? "hybrid-live" : "live",
    generatedAt: new Date().toISOString(),
    description: `由 ${providerNames.join(" + ")} 的快照生成，保留原有 seed feed 作为兜底，并把赔率、预计首发、伤停和赛前新闻统一映射成前台可消费的赛前信号。`,
  },
  defaults: {
    ...(seedFeed.defaults || {}),
    sourceLabels: unique([...(seedFeed.defaults?.sourceLabels || []), "live sync"]),
  },
  teamSignals: seedFeed.teamSignals || {},
  fixtureSignals,
  sources: {
    sportmonksSnapshot: sportmonksSnapshot
      ? {
          syncedAt: sportmonksSnapshot.syncedAt,
          resultCount: sportmonksSnapshot.resultCount,
        }
      : null,
    oddsSnapshot: oddsSnapshot
      ? {
          syncedAt: oddsSnapshot.syncedAt,
          resultCount: oddsSnapshot.resultCount,
          quota: oddsSnapshot.quota || null,
        }
      : null,
  },
};

writeJson(liveOutputPath, feed);

console.log(
  `Built live prematch feed: ${fixtureSignals.length} fixture signals -> data/source/prematch-signals.live.json`
);

function buildMergedFixtureSignal({ fixture, seedSignal, sportmonksSignal, oddsSignal, defaults }) {
  const sourceLabels = unique([
    ...(seedSignal?.sourceLabels || []),
    ...(sportmonksSignal?.sourceLabels || []),
    ...(oddsSignal?.sourceLabels || []),
  ]);
  const alerts = unique([
    ...(sportmonksSignal?.alerts || []),
    ...(oddsSignal?.alerts || []),
    ...(seedSignal?.alerts || []),
  ]).slice(0, 5);
  const homeLineupConfidence = Number(
    clamp(
      sportmonksSignal?.homeLineupConfidence ?? seedSignal?.homeLineupConfidence ?? defaults.lineupConfidence ?? 74,
      40,
      98
    ).toFixed(0)
  );
  const awayLineupConfidence = Number(
    clamp(
      sportmonksSignal?.awayLineupConfidence ?? seedSignal?.awayLineupConfidence ?? defaults.lineupConfidence ?? 74,
      40,
      98
    ).toFixed(0)
  );
  const baseHomeDelta = seedSignal?.homeLambdaDelta ?? 0;
  const baseAwayDelta = seedSignal?.awayLambdaDelta ?? 0;
  const liveHomeDelta = (sportmonksSignal?.homeLambdaDelta ?? 0) + (oddsSignal?.homeLambdaDelta ?? 0);
  const liveAwayDelta = (sportmonksSignal?.awayLambdaDelta ?? 0) + (oddsSignal?.awayLambdaDelta ?? 0);
  const homeLambdaDelta = Number(clamp(baseHomeDelta * 0.45 + liveHomeDelta, -0.28, 0.28).toFixed(2));
  const awayLambdaDelta = Number(clamp(baseAwayDelta * 0.45 + liveAwayDelta, -0.28, 0.28).toFixed(2));
  const marketHomeShift = Number(
    clamp(oddsSignal?.marketHomeShift ?? seedSignal?.marketHomeShift ?? 0, -10, 10).toFixed(1)
  );
  const marketVolatility = Number(
    clamp(
      oddsSignal?.marketVolatility ?? sportmonksSignal?.marketVolatility ?? seedSignal?.marketVolatility ?? defaults.marketVolatility ?? 1.2,
      0.8,
      4.2
    ).toFixed(1)
  );
  const headline = buildHeadline(fixture, sportmonksSignal, oddsSignal, seedSignal);
  const timestamps = [seedSignal?.lastUpdated, sportmonksSignal?.lastUpdated, oddsSignal?.lastUpdated].filter(Boolean);

  return {
    date: fixture.date,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    lastUpdated: latestTimestamp(timestamps),
    headline,
    homeLambdaDelta,
    awayLambdaDelta,
    marketHomeShift,
    marketVolatility,
    homeLineupConfidence,
    awayLineupConfidence,
    alerts:
      alerts.length > 0
        ? alerts
        : ["当前还没有抓到足够多的临场信号，建议继续保留开赛前刷新一次的习惯。"],
    sourceLabels,
  };
}

function buildFixtureIndex(fixtures, aliasMap) {
  const byExactKey = new Map(fixtures.map((fixture) => [createFixtureKey(fixture), fixture]));
  const byNormalizedKey = new Map(
    fixtures.map((fixture) => [
      createNormalizedFixtureKey(fixture.date, fixture.homeTeam, fixture.awayTeam, aliasMap),
      fixture,
    ])
  );

  return {
    byExactKey,
    byNormalizedKey,
  };
}

function buildSportmonksFixtureMap(rows, fixtureIndex, aliasMap) {
  const result = new Map();

  rows.forEach((row) => {
    const extracted = extractSportmonksFixture(row);

    if (!extracted) {
      return;
    }

    const fixture = fixtureIndex.byNormalizedKey.get(
      createNormalizedFixtureKey(extracted.date, extracted.homeTeam, extracted.awayTeam, aliasMap)
    );

    if (!fixture) {
      return;
    }

    result.set(createFixtureKey(fixture), extracted);
  });

  return result;
}

function buildOddsFixtureMap(rows, fixtureIndex, aliasMap) {
  const result = new Map();

  rows.forEach((row) => {
    const extracted = extractOddsFixture(row);

    if (!extracted) {
      return;
    }

    const fixture = fixtureIndex.byNormalizedKey.get(
      createNormalizedFixtureKey(extracted.date, extracted.homeTeam, extracted.awayTeam, aliasMap)
    );

    if (!fixture) {
      return;
    }

    result.set(createFixtureKey(fixture), extracted);
  });

  return result;
}

function extractSportmonksFixture(row) {
  const participants = Array.isArray(row.participants) ? row.participants : [];
  const homeParticipant =
    participants.find((participant) => resolveParticipantSide(participant) === "home") || participants[0] || null;
  const awayParticipant =
    participants.find((participant) => resolveParticipantSide(participant) === "away") || participants[1] || null;
  const homeTeam = homeParticipant?.name || splitFixtureName(row.name)?.homeTeam;
  const awayTeam = awayParticipant?.name || splitFixtureName(row.name)?.awayTeam;
  const startingAt = row.starting_at || row.startingAt;
  const date = typeof startingAt === "string" ? startingAt.slice(0, 10) : null;

  if (!homeTeam || !awayTeam || !date) {
    return null;
  }

  const homeParticipantId = homeParticipant?.id ?? homeParticipant?.participant_id ?? null;
  const awayParticipantId = awayParticipant?.id ?? awayParticipant?.participant_id ?? null;
  const officialHomeCount = countParticipantRows(row.lineups, homeParticipantId);
  const officialAwayCount = countParticipantRows(row.lineups, awayParticipantId);
  const expectedHomeCount = countParticipantRows(row.expectedLineups, homeParticipantId);
  const expectedAwayCount = countParticipantRows(row.expectedLineups, awayParticipantId);
  const homeSidelinedCount = countParticipantRows(row.sidelined, homeParticipantId);
  const awaySidelinedCount = countParticipantRows(row.sidelined, awayParticipantId);
  const newsCount = Array.isArray(row.prematchNews) ? row.prematchNews.length : 0;

  return {
    date,
    homeTeam,
    awayTeam,
    lastUpdated: latestTimestamp([
      row.last_processed_at,
      row.updated_at,
      row.starting_at,
      ...(Array.isArray(row.prematchNews) ? row.prematchNews.map((item) => item.published_at || item.created_at) : []),
    ]),
    homeLineupConfidence: deriveLineupConfidence(officialHomeCount, expectedHomeCount),
    awayLineupConfidence: deriveLineupConfidence(officialAwayCount, expectedAwayCount),
    homeLambdaDelta: homeSidelinedCount >= 2 ? -0.06 : homeSidelinedCount === 1 ? -0.03 : 0,
    awayLambdaDelta: awaySidelinedCount >= 2 ? -0.06 : awaySidelinedCount === 1 ? -0.03 : 0,
    marketVolatility: clamp(1.1 + newsCount * 0.15 + (officialHomeCount >= 11 || officialAwayCount >= 11 ? 0.4 : 0), 0.8, 3.2),
    sourceLabels: unique([
      "sportmonks fixtures",
      officialHomeCount >= 11 || officialAwayCount >= 11 ? "official lineups" : null,
      expectedHomeCount >= 8 || expectedAwayCount >= 8 ? "expected lineups" : null,
      homeSidelinedCount > 0 || awaySidelinedCount > 0 ? "sidelined" : null,
      newsCount > 0 ? "prematch news" : null,
    ]),
    alerts: unique([
      officialHomeCount >= 11 ? `${homeTeam} 的首发名单已经接近确认。` : null,
      officialAwayCount >= 11 ? `${awayTeam} 的首发名单已经接近确认。` : null,
      expectedHomeCount >= 8 && officialHomeCount < 11 ? `${homeTeam} 的预计首发已经有较完整版本。` : null,
      expectedAwayCount >= 8 && officialAwayCount < 11 ? `${awayTeam} 的预计首发已经有较完整版本。` : null,
      homeSidelinedCount > 0 ? `${homeTeam} 当前抓到 ${homeSidelinedCount} 条伤停或缺阵记录。` : null,
      awaySidelinedCount > 0 ? `${awayTeam} 当前抓到 ${awaySidelinedCount} 条伤停或缺阵记录。` : null,
      newsCount > 0 ? `赛前新闻流里已经出现 ${newsCount} 条相关更新。` : null,
    ]),
  };
}

function extractOddsFixture(row) {
  if (!row || !row.home_team || !row.away_team || !row.commence_time || !Array.isArray(row.bookmakers)) {
    return null;
  }

  const consensus = deriveOddsConsensus(row.bookmakers, row.home_team, row.away_team);

  if (!consensus) {
    return null;
  }

  return {
    date: row.commence_time.slice(0, 10),
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    lastUpdated: latestTimestamp(row.bookmakers.map((bookmaker) => bookmaker.last_update).filter(Boolean)),
    homeLambdaDelta: consensus.totalPoint === null ? consensus.homeBias * 0.2 : consensus.homeBias * 0.22 + consensus.goalBias,
    awayLambdaDelta: consensus.totalPoint === null ? consensus.awayBias * 0.2 : consensus.awayBias * 0.22 + consensus.goalBias,
    marketHomeShift: consensus.marketHomeShift,
    marketVolatility: consensus.marketVolatility,
    sourceLabels: ["the odds api", "market consensus"],
    alerts: unique([
      Math.abs(consensus.marketHomeShift) >= 2.4
        ? `${consensus.marketHomeShift > 0 ? row.home_team : row.away_team} 的市场热度明显更高。`
        : null,
      consensus.totalPoint !== null && consensus.totalPoint >= 2.9 ? "市场更偏向一场进球偏多的比赛。" : null,
      consensus.totalPoint !== null && consensus.totalPoint <= 2.3 ? "市场更偏向一场进球偏少的比赛。" : null,
      consensus.marketVolatility >= 2.6 ? "不同赔率源之间的分歧偏大，临场还值得继续观察。" : null,
    ]),
  };
}

function deriveOddsConsensus(bookmakers, homeTeam, awayTeam) {
  const h2hRows = [];
  const totalRows = [];

  bookmakers.forEach((bookmaker) => {
    (bookmaker.markets || []).forEach((market) => {
      if (market.key === "h2h" && Array.isArray(market.outcomes)) {
        const probabilities = normalizeImpliedProbabilities(market.outcomes);

        if (probabilities) {
          h2hRows.push(probabilities);
        }
      }

      if (market.key === "totals" && Array.isArray(market.outcomes)) {
        const point = market.outcomes.find((outcome) => typeof outcome.point === "number")?.point;

        if (typeof point === "number") {
          totalRows.push(point);
        }
      }
    });
  });

  if (h2hRows.length === 0) {
    return null;
  }

  const averageHomeProbability = average(
    h2hRows.map((row) => findProbabilityByName(row, homeTeam) ?? findProbabilityByName(row, "home"))
  );
  const averageAwayProbability = average(
    h2hRows.map((row) => findProbabilityByName(row, awayTeam) ?? findProbabilityByName(row, "away"))
  );
  const totalPoint = totalRows.length > 0 ? Number(average(totalRows).toFixed(2)) : null;
  const marketHomeShift = Number(clamp((averageHomeProbability - averageAwayProbability) * 10, -10, 10).toFixed(1));
  const probabilityVolatility = standardDeviation(
    h2hRows.map((row) => findProbabilityByName(row, homeTeam) ?? findProbabilityByName(row, "home"))
  );
  const pointVolatility = totalRows.length > 1 ? standardDeviation(totalRows) : 0;
  const marketVolatility = Number(clamp(1 + probabilityVolatility * 18 + pointVolatility * 1.25, 0.8, 4.2).toFixed(1));

  return {
    marketHomeShift,
    marketVolatility,
    totalPoint,
    goalBias: totalPoint === null ? 0 : clamp((totalPoint - 2.5) * 0.08, -0.08, 0.08),
    homeBias: clamp(averageHomeProbability - 0.45, -0.22, 0.22),
    awayBias: clamp(averageAwayProbability - 0.45, -0.22, 0.22),
  };
}

function normalizeImpliedProbabilities(outcomes) {
  const normalized = outcomes
    .filter((outcome) => typeof outcome.price === "number" && outcome.price > 1)
    .map((outcome) => ({
      name: outcome.name,
      probability: 1 / outcome.price,
    }));

  const total = normalized.reduce((sum, item) => sum + item.probability, 0);

  if (!total) {
    return null;
  }

  return normalized.map((item) => ({
    name: item.name,
    probability: item.probability / total,
  }));
}

function findProbabilityByName(rows, teamName) {
  const matched = rows.find((row) => normalizeTeamToken(row.name) === normalizeTeamToken(teamName));
  return matched?.probability ?? null;
}

function deriveLineupConfidence(officialCount, expectedCount) {
  if (officialCount >= 11) {
    return 96;
  }

  if (expectedCount >= 11) {
    return 86;
  }

  if (expectedCount >= 8) {
    return 79;
  }

  return null;
}

function countParticipantRows(rows, participantId) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }

  if (!participantId) {
    if (rows.length >= 22) {
      return 11;
    }

    return rows.length;
  }

  return rows.filter((row) => {
    const rowParticipantId = row.participant_id ?? row.team_id ?? row.participant?.id ?? row.team?.id ?? null;
    return rowParticipantId === participantId;
  }).length;
}

function resolveParticipantSide(participant) {
  return (
    participant?.meta?.location ||
    participant?.meta?.position ||
    participant?.location ||
    participant?.pivot?.location ||
    participant?.type
  );
}

function splitFixtureName(name) {
  if (typeof name !== "string") {
    return null;
  }

  const tokens = name.split(/\s+vs?\s+/i);

  if (tokens.length !== 2) {
    return null;
  }

  return {
    homeTeam: tokens[0].trim(),
    awayTeam: tokens[1].trim(),
  };
}

function buildHeadline(fixture, sportmonksSignal, oddsSignal, seedSignal) {
  const segments = [];

  if (sportmonksSignal) {
    if (sportmonksSignal.homeLineupConfidence >= 90 || sportmonksSignal.awayLineupConfidence >= 90) {
      segments.push("首发名单接近确认，临场不确定性比种子版更低。");
    } else if (sportmonksSignal.homeLineupConfidence >= 79 || sportmonksSignal.awayLineupConfidence >= 79) {
      segments.push("预计首发已经开始成型，阵容方向比之前更清楚。");
    }

    const injuryAlerts = sportmonksSignal.alerts.filter((alert) => alert.includes("伤停") || alert.includes("缺阵"));

    if (injuryAlerts.length > 0) {
      segments.push("伤停信息已经进入这场判断。");
    }
  }

  if (oddsSignal) {
    if (Math.abs(oddsSignal.marketHomeShift) >= 2.4) {
      segments.push(`${oddsSignal.marketHomeShift > 0 ? fixture.homeTeam : fixture.awayTeam} 的市场热度更高。`);
    }

    const totalLean = oddsSignal.alerts.find((alert) => alert.includes("进球偏多") || alert.includes("进球偏少"));

    if (totalLean) {
      segments.push(totalLean.replace("市场更偏向", ""));
    }
  }

  if (segments.length === 0 && seedSignal?.headline) {
    return seedSignal.headline;
  }

  return unique(segments).slice(0, 2).join("");
}

function buildTeamAliasMap(teamNames) {
  const aliasMap = new Map();

  teamNames.forEach((teamName) => {
    aliasMap.set(normalizeTeamToken(teamName), teamName);
  });

  const aliases = {
    "united states": "USA",
    "united states of america": "USA",
    usa: "USA",
    "korea republic": "South Korea",
    "republic of korea": "South Korea",
    "south korea": "South Korea",
    "ivory coast": "Ivory Coast",
    "cote divoire": "Ivory Coast",
    "cote d ivoire": "Ivory Coast",
    iran: "Iran",
    "ir iran": "Iran",
    curacao: "Curaçao",
    "cape verde": "Cape Verde",
    qatar: "Qatar",
    "saudi arabia": "Saudi Arabia",
    "new zealand": "New Zealand",
    "costa rica": "Costa Rica",
    "south africa": "South Africa",
    "south korea republic": "South Korea",
  };

  Object.entries(aliases).forEach(([alias, teamName]) => {
    aliasMap.set(alias, teamName);
  });

  return aliasMap;
}

function createNormalizedFixtureKey(date, homeTeam, awayTeam, aliasMap) {
  return `${date}__${canonicalTeamName(homeTeam, aliasMap)}__${canonicalTeamName(awayTeam, aliasMap)}`;
}

function canonicalTeamName(teamName, aliasMap) {
  const normalized = normalizeTeamToken(teamName);
  return aliasMap.get(normalized) || teamName;
}

function latestTimestamp(values) {
  const timestamps = values
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) {
    return new Date().toISOString();
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function average(values) {
  const valid = values.filter((value) => typeof value === "number" && !Number.isNaN(value));

  if (valid.length === 0) {
    return 0;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function standardDeviation(values) {
  const valid = values.filter((value) => typeof value === "number" && !Number.isNaN(value));

  if (valid.length <= 1) {
    return 0;
  }

  const mean = average(valid);
  const variance = average(valid.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

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
const providerFixtureMapPath = resolve(sourceDir, "provider-fixture-map.json");
const groupStageSource = readFileSync(resolve(sourceDir, "worldcup-2026-openfootball-cup.txt"), "utf8");
const seedFeed = readJson(seedPath);
const storedProviderFixtureMap = readJson(providerFixtureMapPath, { mappings: {} });
const apiFootballSnapshot = readJson(resolve(liveDir, "api-football-worldcup.json"));
const sportmonksSnapshot = readJson(resolve(liveDir, "sportmonks-worldcup.json"));
const oddsSnapshot = readJson(resolve(liveDir, "the-odds-api-worldcup.json"));

if (!apiFootballSnapshot && !sportmonksSnapshot && !oddsSnapshot) {
  console.error("没有找到实时快照文件。请先运行 `npm run sync:live:snapshots`。");
  process.exit(1);
}

const localFixtures = parseWorldCupFixtures(groupStageSource);
const localTeams = [...new Set(localFixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]))];
const teamAliasMap = buildTeamAliasMap(localTeams);
const fixtureIndex = buildFixtureIndex(localFixtures, teamAliasMap);
const providerFixtureRegistry = createProviderFixtureRegistry(storedProviderFixtureMap.mappings || {}, fixtureIndex);
const seedFixtureSignalMap = new Map((seedFeed.fixtureSignals || []).map((signal) => [createFixtureKey(signal), signal]));
const apiFootballFixtureMap = buildApiFootballFixtureMap(
  apiFootballSnapshot?.data || {},
  fixtureIndex,
  teamAliasMap,
  providerFixtureRegistry
);
const sportmonksFixtureMap = buildSportmonksFixtureMap(
  sportmonksSnapshot?.data || [],
  fixtureIndex,
  teamAliasMap,
  providerFixtureRegistry
);
const oddsFixtureMap = buildOddsFixtureMap(
  oddsSnapshot?.data || [],
  fixtureIndex,
  teamAliasMap,
  providerFixtureRegistry
);

const allKeys = [
  ...new Set([
    ...seedFixtureSignalMap.keys(),
    ...apiFootballFixtureMap.keys(),
    ...sportmonksFixtureMap.keys(),
    ...oddsFixtureMap.keys(),
  ]),
].sort();
const fixtureSignals = allKeys
  .map((key) => {
    const fixture = fixtureIndex.byExactKey.get(key);

    if (!fixture) {
      return null;
    }

    return buildMergedFixtureSignal({
      fixture,
      seedSignal: seedFixtureSignalMap.get(key) || null,
      apiFootballSignal: apiFootballFixtureMap.get(key) || null,
      sportmonksSignal: sportmonksFixtureMap.get(key) || null,
      oddsSignal: oddsFixtureMap.get(key) || null,
      defaults: seedFeed.defaults || {},
    });
  })
  .filter(Boolean);

const providerNames = [
  apiFootballSnapshot ? "API-Football" : null,
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
    apiFootballSnapshot: apiFootballSnapshot
      ? {
          syncedAt: apiFootballSnapshot.syncedAt,
          resultCount: apiFootballSnapshot.resultCount,
          warnings: apiFootballSnapshot.warnings || [],
          coverage: apiFootballSnapshot.coverage || null,
          quota: apiFootballSnapshot.quota || null,
        }
      : null,
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

writeJson(providerFixtureMapPath, providerFixtureRegistry.toJson());
writeJson(liveOutputPath, feed);

console.log(
  `Built live prematch feed: ${fixtureSignals.length} fixture signals -> data/source/prematch-signals.live.json`
);

function buildMergedFixtureSignal({ fixture, seedSignal, apiFootballSignal, sportmonksSignal, oddsSignal, defaults }) {
  const sourceLabels = unique([
    ...(seedSignal?.sourceLabels || []),
    ...(apiFootballSignal?.sourceLabels || []),
    ...(sportmonksSignal?.sourceLabels || []),
    ...(oddsSignal?.sourceLabels || []),
  ]);
  const alerts = unique([
    ...(apiFootballSignal?.alerts || []),
    ...(sportmonksSignal?.alerts || []),
    ...(oddsSignal?.alerts || []),
    ...(seedSignal?.alerts || []),
  ]).slice(0, 5);
  const homeLineupConfidence = Number(
    clamp(
      sportmonksSignal?.homeLineupConfidence ??
        apiFootballSignal?.homeLineupConfidence ??
        seedSignal?.homeLineupConfidence ??
        defaults.lineupConfidence ??
        74,
      40,
      98
    ).toFixed(0)
  );
  const awayLineupConfidence = Number(
    clamp(
      sportmonksSignal?.awayLineupConfidence ??
        apiFootballSignal?.awayLineupConfidence ??
        seedSignal?.awayLineupConfidence ??
        defaults.lineupConfidence ??
        74,
      40,
      98
    ).toFixed(0)
  );
  const baseHomeDelta = seedSignal?.homeLambdaDelta ?? 0;
  const baseAwayDelta = seedSignal?.awayLambdaDelta ?? 0;
  const liveHomeDelta =
    (apiFootballSignal?.homeLambdaDelta ?? 0) + (sportmonksSignal?.homeLambdaDelta ?? 0) + (oddsSignal?.homeLambdaDelta ?? 0);
  const liveAwayDelta =
    (apiFootballSignal?.awayLambdaDelta ?? 0) + (sportmonksSignal?.awayLambdaDelta ?? 0) + (oddsSignal?.awayLambdaDelta ?? 0);
  const homeLambdaDelta = Number(clamp(baseHomeDelta * 0.45 + liveHomeDelta, -0.28, 0.28).toFixed(2));
  const awayLambdaDelta = Number(clamp(baseAwayDelta * 0.45 + liveAwayDelta, -0.28, 0.28).toFixed(2));
  const marketHomeShift = Number(
    clamp(oddsSignal?.marketHomeShift ?? apiFootballSignal?.marketHomeShift ?? seedSignal?.marketHomeShift ?? 0, -10, 10).toFixed(1)
  );
  const marketVolatility = Number(
    clamp(
      oddsSignal?.marketVolatility ??
        apiFootballSignal?.marketVolatility ??
        sportmonksSignal?.marketVolatility ??
        seedSignal?.marketVolatility ??
        defaults.marketVolatility ??
        1.2,
      0.8,
      4.2
    ).toFixed(1)
  );
  const headline = buildHeadline(fixture, apiFootballSignal, sportmonksSignal, oddsSignal, seedSignal);
  const timestamps = [
    seedSignal?.lastUpdated,
    apiFootballSignal?.lastUpdated,
    sportmonksSignal?.lastUpdated,
    oddsSignal?.lastUpdated,
  ].filter(Boolean);

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

function createProviderFixtureRegistry(seedMappings, fixtureIndex) {
  const mappings = new Map(Object.entries(seedMappings || {}).map(([localKey, value]) => [localKey, { ...value }]));
  const reverse = {
    apiFootballFixtureId: buildReverseProviderMap(mappings, "apiFootballFixtureId"),
    sportmonksFixtureId: buildReverseProviderMap(mappings, "sportmonksFixtureId"),
    theOddsEventId: buildReverseProviderMap(mappings, "theOddsEventId"),
  };

  return {
    findFixture(providerField, providerId) {
      if (providerId === undefined || providerId === null || providerId === "") {
        return null;
      }

      const localKey = reverse[providerField]?.get(String(providerId)) || null;
      return localKey ? fixtureIndex.byExactKey.get(localKey) || null : null;
    },
    record(providerField, providerId, fixture) {
      if (!fixture || providerId === undefined || providerId === null || providerId === "") {
        return;
      }

      const localKey = createFixtureKey(fixture);
      const current = mappings.get(localKey) || {};
      current[providerField] = providerId;
      mappings.set(localKey, current);
      reverse[providerField]?.set(String(providerId), localKey);
    },
    toJson() {
      const serializedMappings = Object.fromEntries([...mappings.entries()].sort(([left], [right]) => left.localeCompare(right)));

      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        mappingCount: mappings.size,
        mappings: serializedMappings,
      };
    },
  };
}

function buildApiFootballFixtureMap(snapshotData, fixtureIndex, aliasMap, providerFixtureRegistry) {
  const result = new Map();
  const fixtureRows = Array.isArray(snapshotData.fixtures) ? snapshotData.fixtures : [];
  const injuryIndex = buildApiFootballInjuryIndex(Array.isArray(snapshotData.injuries) ? snapshotData.injuries : []);
  const oddsIndex = buildApiFootballOddsIndex(Array.isArray(snapshotData.odds) ? snapshotData.odds : []);

  fixtureRows.forEach((row) => {
    const fixtureId = row?.fixture?.id;
    const extracted = extractApiFootballFixture(
      row,
      injuryIndex.get(fixtureId) || null,
      oddsIndex.get(fixtureId) || null
    );

    if (!extracted) {
      return;
    }

    const fixture = resolveProviderFixtureMatch({
      providerField: "apiFootballFixtureId",
      providerId: fixtureId,
      extracted,
      fixtureIndex,
      aliasMap,
      providerFixtureRegistry,
    });

    if (!fixture) {
      return;
    }

    providerFixtureRegistry.record("apiFootballFixtureId", fixtureId, fixture);
    result.set(createFixtureKey(fixture), extracted);
  });

  return result;
}

function buildSportmonksFixtureMap(rows, fixtureIndex, aliasMap, providerFixtureRegistry) {
  const result = new Map();

  rows.forEach((row) => {
    const extracted = extractSportmonksFixture(row);

    if (!extracted) {
      return;
    }

    const fixture = resolveProviderFixtureMatch({
      providerField: "sportmonksFixtureId",
      providerId: row?.id,
      extracted,
      fixtureIndex,
      aliasMap,
      providerFixtureRegistry,
    });

    if (!fixture) {
      return;
    }

    providerFixtureRegistry.record("sportmonksFixtureId", row?.id, fixture);
    result.set(createFixtureKey(fixture), extracted);
  });

  return result;
}

function buildOddsFixtureMap(rows, fixtureIndex, aliasMap, providerFixtureRegistry) {
  const result = new Map();

  rows.forEach((row) => {
    const extracted = extractOddsFixture(row);

    if (!extracted) {
      return;
    }

    const fixture = resolveProviderFixtureMatch({
      providerField: "theOddsEventId",
      providerId: row?.id,
      extracted,
      fixtureIndex,
      aliasMap,
      providerFixtureRegistry,
    });

    if (!fixture) {
      return;
    }

    providerFixtureRegistry.record("theOddsEventId", row?.id, fixture);
    result.set(createFixtureKey(fixture), extracted);
  });

  return result;
}

function buildApiFootballInjuryIndex(rows) {
  const result = new Map();

  rows.forEach((row) => {
    const fixtureId = row?.fixture?.id;
    const teamId = row?.team?.id ?? row?.player?.team?.id ?? null;
    const teamName = row?.team?.name ?? row?.player?.team?.name ?? null;

    if (!fixtureId || (!teamId && !teamName)) {
      return;
    }

    const entry =
      result.get(fixtureId) || {
        counts: new Map(),
        timestamps: [],
        alerts: [],
      };
    const key = teamId ? `id:${teamId}` : `name:${normalizeTeamToken(teamName)}`;
    entry.counts.set(key, (entry.counts.get(key) || 0) + 1);
    entry.timestamps.push(row?.fixture?.date || row?.update || row?.player?.update || null);

    if (teamName && row?.player?.name && entry.alerts.length < 4) {
      entry.alerts.push(`${teamName} 的 ${row.player.name} 出现在伤停名单里。`);
    }

    result.set(fixtureId, entry);
  });

  return result;
}

function buildApiFootballOddsIndex(rows) {
  const result = new Map();

  rows.forEach((row) => {
    const fixtureId = row?.fixture?.id;

    if (!fixtureId) {
      return;
    }

    const fixtureOddsRows = result.get(fixtureId) || [];
    fixtureOddsRows.push(row);
    result.set(fixtureId, fixtureOddsRows);
  });

  return new Map(
    [...result.entries()].map(([fixtureId, fixtureRows]) => [
      fixtureId,
      deriveApiFootballOddsConsensus(fixtureRows),
    ])
  );
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

function extractApiFootballFixture(row, injurySummary, oddsSummary) {
  const fixture = row?.fixture || {};
  const homeTeam = row?.teams?.home?.name || null;
  const awayTeam = row?.teams?.away?.name || null;
  const homeTeamId = row?.teams?.home?.id ?? null;
  const awayTeamId = row?.teams?.away?.id ?? null;
  const date = typeof fixture.date === "string" ? fixture.date.slice(0, 10) : null;

  if (!homeTeam || !awayTeam || !date) {
    return null;
  }

  const lineups = Array.isArray(row.lineups) ? row.lineups : [];
  const homeLineupCount = countApiFootballLineupRows(lineups, homeTeamId, homeTeam);
  const awayLineupCount = countApiFootballLineupRows(lineups, awayTeamId, awayTeam);
  const homeInjuries = countApiFootballInjuries(injurySummary, homeTeamId, homeTeam);
  const awayInjuries = countApiFootballInjuries(injurySummary, awayTeamId, awayTeam);
  const officialHome = deriveLineupConfidence(homeLineupCount, 0);
  const officialAway = deriveLineupConfidence(awayLineupCount, 0);
  const injuryAlerts = [
    ...(injurySummary?.alerts?.filter((alert) => alert.includes(homeTeam) || alert.includes(awayTeam)) || []),
  ];
  const oddsAlerts = oddsSummary?.alerts || [];

  return {
    date,
    homeTeam,
    awayTeam,
    lastUpdated: latestTimestamp([
      fixture.timestamp ? new Date(fixture.timestamp * 1000).toISOString() : null,
      fixture.date,
      injurySummary?.lastUpdated,
      oddsSummary?.lastUpdated,
    ]),
    homeLineupConfidence: officialHome,
    awayLineupConfidence: officialAway,
    homeLambdaDelta: Number(
      clamp((homeInjuries >= 2 ? -0.06 : homeInjuries === 1 ? -0.03 : 0) + (oddsSummary?.homeLambdaDelta ?? 0), -0.2, 0.2).toFixed(2)
    ),
    awayLambdaDelta: Number(
      clamp((awayInjuries >= 2 ? -0.06 : awayInjuries === 1 ? -0.03 : 0) + (oddsSummary?.awayLambdaDelta ?? 0), -0.2, 0.2).toFixed(2)
    ),
    marketHomeShift: Number(clamp(oddsSummary?.marketHomeShift ?? 0, -10, 10).toFixed(1)),
    marketVolatility: Number(
      clamp(
        oddsSummary?.marketVolatility ?? 1 + (homeInjuries + awayInjuries) * 0.18 + (homeLineupCount >= 11 || awayLineupCount >= 11 ? 0.35 : 0),
        0.8,
        4.2
      ).toFixed(1)
    ),
    sourceLabels: unique([
      "api-football fixtures",
      oddsSummary ? "api-football odds" : null,
      homeLineupCount >= 11 || awayLineupCount >= 11 ? "official lineups" : null,
      homeInjuries > 0 || awayInjuries > 0 ? "injuries" : null,
    ]),
    alerts: unique([
      homeLineupCount >= 11 ? `${homeTeam} 的官方首发已经抓到。` : null,
      awayLineupCount >= 11 ? `${awayTeam} 的官方首发已经抓到。` : null,
      homeInjuries > 0 ? `${homeTeam} 当前抓到 ${homeInjuries} 条伤停记录。` : null,
      awayInjuries > 0 ? `${awayTeam} 当前抓到 ${awayInjuries} 条伤停记录。` : null,
      ...injuryAlerts,
      ...oddsAlerts,
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

function deriveApiFootballOddsConsensus(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const fixtureRow = rows.find((row) => row?.teams?.home?.name && row?.teams?.away?.name) || rows[0];
  const homeTeam = fixtureRow?.teams?.home?.name || fixtureRow?.fixture?.teams?.home?.name || null;
  const awayTeam = fixtureRow?.teams?.away?.name || fixtureRow?.fixture?.teams?.away?.name || null;

  if (!homeTeam || !awayTeam) {
    return null;
  }

  const h2hRows = [];
  const totalRows = [];
  const timestamps = [];

  rows.forEach((row) => {
    timestamps.push(row?.update || row?.fixture?.date || null);

    (row?.bookmakers || []).forEach((bookmaker) => {
      (bookmaker?.bets || bookmaker?.markets || []).forEach((bet) => {
        const betName = normalizeTeamToken(bet?.name || bet?.key || "");
        const values = Array.isArray(bet?.values) ? bet.values : Array.isArray(bet?.outcomes) ? bet.outcomes : [];

        if (values.length === 0) {
          return;
        }

        if (isApiFootballWinnerBet(betName)) {
          const probabilities = normalizeImpliedProbabilities(
            values
              .map((value) => ({
                name: mapApiFootballOutcomeName(value?.value || value?.name, homeTeam, awayTeam),
                price: Number(value?.odd ?? value?.price),
              }))
              .filter((value) => typeof value.price === "number" && value.price > 1)
          );

          if (probabilities) {
            h2hRows.push(probabilities);
          }
        }

        if (isApiFootballTotalBet(betName)) {
          const point = values
            .map((value) => Number(value?.handicap ?? value?.point))
            .find((value) => typeof value === "number" && !Number.isNaN(value));

          if (typeof point === "number" && !Number.isNaN(point)) {
            totalRows.push(point);
          }
        }
      });
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
    lastUpdated: latestTimestamp(timestamps),
    marketHomeShift,
    marketVolatility,
    homeLambdaDelta:
      totalPoint === null ? clamp((averageHomeProbability - 0.45) * 0.2, -0.08, 0.08) : clamp((averageHomeProbability - 0.45) * 0.22 + (totalPoint - 2.5) * 0.08, -0.12, 0.12),
    awayLambdaDelta:
      totalPoint === null ? clamp((averageAwayProbability - 0.45) * 0.2, -0.08, 0.08) : clamp((averageAwayProbability - 0.45) * 0.22 + (totalPoint - 2.5) * 0.08, -0.12, 0.12),
    alerts: unique([
      Math.abs(marketHomeShift) >= 2.4
        ? `${marketHomeShift > 0 ? homeTeam : awayTeam} 的市场热度明显更高。`
        : null,
      totalPoint !== null && totalPoint >= 2.9 ? "市场更偏向一场进球偏多的比赛。" : null,
      totalPoint !== null && totalPoint <= 2.3 ? "市场更偏向一场进球偏少的比赛。" : null,
      marketVolatility >= 2.6 ? "不同赔率源之间的分歧偏大，临场还值得继续观察。" : null,
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

function countApiFootballLineupRows(lineups, teamId, teamName) {
  if (!Array.isArray(lineups) || lineups.length === 0) {
    return 0;
  }

  const matched = lineups.find((row) => {
    const lineupTeamId = row?.team?.id ?? row?.id ?? null;
    const lineupTeamName = row?.team?.name ?? row?.name ?? null;

    if (teamId && lineupTeamId === teamId) {
      return true;
    }

    return lineupTeamName && normalizeTeamToken(lineupTeamName) === normalizeTeamToken(teamName);
  });

  if (!matched) {
    return 0;
  }

  const starters = matched?.startXI || matched?.start_xi || matched?.startingXI || matched?.starting_xi || [];
  return Array.isArray(starters) ? starters.length : 0;
}

function countApiFootballInjuries(injurySummary, teamId, teamName) {
  if (!injurySummary?.counts) {
    return 0;
  }

  const teamIdCount = teamId ? injurySummary.counts.get(`id:${teamId}`) : 0;
  const teamNameCount = injurySummary.counts.get(`name:${normalizeTeamToken(teamName)}`) || 0;
  return teamIdCount || teamNameCount || 0;
}

function isApiFootballWinnerBet(name) {
  return (
    name.includes("winner") ||
    name.includes("match result") ||
    name.includes("fulltime result") ||
    name.includes("1x2")
  );
}

function isApiFootballTotalBet(name) {
  return (
    name.includes("goals over under") ||
    name.includes("over under") ||
    name.includes("total goals") ||
    name.includes("totals")
  );
}

function mapApiFootballOutcomeName(name, homeTeam, awayTeam) {
  const normalized = normalizeTeamToken(name);

  if (normalized === "1" || normalized === "home") {
    return homeTeam;
  }

  if (normalized === "2" || normalized === "away") {
    return awayTeam;
  }

  if (normalized === "x" || normalized === "draw" || normalized === "tie") {
    return "draw";
  }

  return name;
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

function buildHeadline(fixture, apiFootballSignal, sportmonksSignal, oddsSignal, seedSignal) {
  const segments = [];

  if (apiFootballSignal) {
    if (apiFootballSignal.homeLineupConfidence >= 90 || apiFootballSignal.awayLineupConfidence >= 90) {
      segments.push("官方首发已经抓到，临场不确定性比种子版更低。");
    }

    const injuryAlerts = apiFootballSignal.alerts.filter((alert) => alert.includes("伤停"));

    if (injuryAlerts.length > 0) {
      segments.push("伤停信息已经进入这场判断。");
    }
  }

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

  const marketSignal = oddsSignal || apiFootballSignal;

  if (marketSignal) {
    if (Math.abs(marketSignal.marketHomeShift) >= 2.4) {
      segments.push(`${marketSignal.marketHomeShift > 0 ? fixture.homeTeam : fixture.awayTeam} 的市场热度更高。`);
    }

    const totalLean = marketSignal.alerts.find((alert) => alert.includes("进球偏多") || alert.includes("进球偏少"));

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

function buildReverseProviderMap(mappings, providerField) {
  const reverse = new Map();

  mappings.forEach((value, localKey) => {
    if (value?.[providerField] !== undefined && value?.[providerField] !== null && value?.[providerField] !== "") {
      reverse.set(String(value[providerField]), localKey);
    }
  });

  return reverse;
}

function resolveProviderFixtureMatch({ providerField, providerId, extracted, fixtureIndex, aliasMap, providerFixtureRegistry }) {
  const fixtureFromStoredId = providerFixtureRegistry.findFixture(providerField, providerId);

  if (fixtureFromStoredId) {
    return fixtureFromStoredId;
  }

  return fixtureIndex.byNormalizedKey.get(
    createNormalizedFixtureKey(extracted.date, extracted.homeTeam, extracted.awayTeam, aliasMap)
  );
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

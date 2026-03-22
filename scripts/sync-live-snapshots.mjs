import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  chunkArray,
  fetchJson,
  formatUtcWindowEnd,
  formatUtcWindowStart,
  loadOptionalEnvFiles,
  parseWorldCupFixtures,
  resolveProjectPaths,
  writeJson,
} from "./live-data-utils.mjs";

const { rootDir, sourceDir, liveDir } = resolveProjectPaths(import.meta.url);
loadOptionalEnvFiles(rootDir);

const groupStageSource = readFileSync(resolve(sourceDir, "worldcup-2026-openfootball-cup.txt"), "utf8");
const fixtures = parseWorldCupFixtures(groupStageSource);
const dateRange = {
  start: fixtures[0]?.date,
  end: fixtures[fixtures.length - 1]?.date,
};
const uniqueFixtureDates = [...new Set(fixtures.map((fixture) => fixture.date))];
const providerFilter = normalizeProviderFilter(process.env.LIVE_SYNC_PROVIDER);

const summaries = [];

if (wantsProvider("api-football") && process.env.API_FOOTBALL_KEY && process.env.API_FOOTBALL_WORLD_CUP_LEAGUE_ID) {
  summaries.push(await syncApiFootballSnapshot());
}

if (wantsProvider("sportmonks") && process.env.SPORTMONKS_API_TOKEN && process.env.SPORTMONKS_WORLD_CUP_LEAGUE_ID) {
  summaries.push(await syncSportmonksSnapshot());
}

if (wantsProvider("the-odds-api") && process.env.THE_ODDS_API_KEY && process.env.THE_ODDS_API_SPORT_KEY) {
  summaries.push(await syncTheOddsApiSnapshot());
}

if (summaries.length === 0) {
  console.error(
    "没有检测到可用的实时数据配置。请先在 `.env.local` 或环境变量里设置 `API_FOOTBALL_KEY` / `API_FOOTBALL_WORLD_CUP_LEAGUE_ID`、`SPORTMONKS_API_TOKEN` / `SPORTMONKS_WORLD_CUP_LEAGUE_ID`，或 `THE_ODDS_API_KEY` / `THE_ODDS_API_SPORT_KEY`。"
  );
  process.exit(1);
}

summaries.forEach((summary) => console.log(summary));

async function syncApiFootballSnapshot() {
  const leagueId = process.env.API_FOOTBALL_WORLD_CUP_LEAGUE_ID;
  const season = process.env.API_FOOTBALL_SEASON || "2026";
  const timezone = process.env.API_FOOTBALL_TIMEZONE || "UTC";
  const warnings = [];

  const leagueResponse = await fetchApiFootball("/leagues", {
    id: leagueId,
    season,
  });
  const coverage = extractApiFootballCoverage(leagueResponse.data?.response || [], season);

  const fixturesResponse = await fetchApiFootball("/fixtures", {
    league: leagueId,
    season,
    from: dateRange.start,
    to: dateRange.end,
    timezone,
  });
  const fixtureRows = extractApiFootballRows(fixturesResponse.data);
  const fixtureIds = [...new Set(fixtureRows.map((row) => row?.fixture?.id).filter(Boolean))];

  let detailedFixtures = fixtureRows;

  if (fixtureIds.length > 0) {
    try {
      detailedFixtures = await fetchApiFootballFixtureDetails(fixtureIds);
    } catch (error) {
      warnings.push(`fixtures/details: ${error.message}`);
    }
  }

  let injuryRows = [];

  if (fixtureIds.length > 0) {
    try {
      injuryRows = await fetchApiFootballInjuries(fixtureIds);
    } catch (error) {
      warnings.push(`injuries: ${error.message}`);
    }
  }

  let oddsRows = [];

  if (uniqueFixtureDates.length > 0) {
    try {
      oddsRows = await fetchApiFootballOdds(leagueId, season, timezone);
    } catch (error) {
      warnings.push(`odds: ${error.message}`);
    }
  }

  const outputPath = resolve(liveDir, "api-football-worldcup.json");
  writeJson(outputPath, {
    provider: "api-football",
    syncedAt: new Date().toISOString(),
    request: {
      range: dateRange,
      leagueId,
      season,
      timezone,
    },
    coverage,
    warnings,
    quota: {
      requestsLimit: fixturesResponse.headers["x-ratelimit-requests-limit"] || null,
      requestsRemaining: fixturesResponse.headers["x-ratelimit-requests-remaining"] || null,
    },
    resultCount: {
      fixtures: detailedFixtures.length,
      injuries: injuryRows.length,
      odds: oddsRows.length,
    },
    data: {
      fixtures: detailedFixtures,
      injuries: injuryRows,
      odds: oddsRows,
    },
  });

  const coverageSummary = coverage
    ? `coverage(lineups:${Boolean(coverage?.fixtures?.lineups ?? coverage?.lineups)}, injuries:${Boolean(
        coverage?.injuries
      )}, odds:${Boolean(coverage?.odds)})`
    : "coverage(unknown)";

  return `API-Football snapshot saved: ${detailedFixtures.length} fixtures, ${injuryRows.length} injuries, ${oddsRows.length} odds rows -> data/source/live/api-football-worldcup.json ${coverageSummary}`;
}

async function syncSportmonksSnapshot() {
  const include = [
    "participants",
    "venue",
    "state",
    "lineups",
    "expectedLineups",
    "sidelined",
    "prematchNews",
  ].join(";");
  const allRows = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(
      `https://api.sportmonks.com/v3/football/fixtures/between/date/${dateRange.start}/${dateRange.end}`
    );
    url.searchParams.set("api_token", process.env.SPORTMONKS_API_TOKEN);
    url.searchParams.set("include", include);
    url.searchParams.set("filters", `fixtureLeagues:${process.env.SPORTMONKS_WORLD_CUP_LEAGUE_ID}`);
    url.searchParams.set("per_page", "50");
    url.searchParams.set("page", String(page));

    const response = await fetchJson(url);
    const payload = response.data;
    const rows = payload.data || [];
    allRows.push(...rows);

    const pagination = payload.pagination || payload.meta?.pagination || {};
    hasMore = Boolean(pagination.has_more);
    page += 1;
  }

  const outputPath = resolve(liveDir, "sportmonks-worldcup.json");
  writeJson(outputPath, {
    provider: "sportmonks",
    syncedAt: new Date().toISOString(),
    request: {
      range: dateRange,
      include,
      leagueId: process.env.SPORTMONKS_WORLD_CUP_LEAGUE_ID,
    },
    resultCount: allRows.length,
    data: allRows,
  });

  return `Sportmonks snapshot saved: ${allRows.length} fixtures -> data/source/live/sportmonks-worldcup.json`;
}

async function syncTheOddsApiSnapshot() {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${process.env.THE_ODDS_API_SPORT_KEY}/odds/`);
  url.searchParams.set("apiKey", process.env.THE_ODDS_API_KEY);
  url.searchParams.set("regions", process.env.THE_ODDS_REGIONS || "eu");
  url.searchParams.set("markets", process.env.THE_ODDS_MARKETS || "h2h,totals");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");
  url.searchParams.set("commenceTimeFrom", formatUtcWindowStart(dateRange.start));
  url.searchParams.set("commenceTimeTo", formatUtcWindowEnd(dateRange.end));

  const response = await fetchJson(url);
  const outputPath = resolve(liveDir, "the-odds-api-worldcup.json");
  writeJson(outputPath, {
    provider: "the-odds-api",
    syncedAt: new Date().toISOString(),
    request: {
      sportKey: process.env.THE_ODDS_API_SPORT_KEY,
      regions: process.env.THE_ODDS_REGIONS || "eu",
      markets: process.env.THE_ODDS_MARKETS || "h2h,totals",
      range: dateRange,
    },
    quota: {
      remaining: response.headers["x-requests-remaining"] || null,
      used: response.headers["x-requests-used"] || null,
      last: response.headers["x-requests-last"] || null,
    },
    resultCount: Array.isArray(response.data) ? response.data.length : 0,
    data: response.data,
  });

  return `The Odds API snapshot saved: ${Array.isArray(response.data) ? response.data.length : 0} events -> data/source/live/the-odds-api-worldcup.json`;
}

async function fetchApiFootballFixtureDetails(fixtureIds) {
  const rows = [];
  const batches = chunkArray(fixtureIds, Number(process.env.API_FOOTBALL_DETAIL_BATCH_SIZE || 20));

  for (const batch of batches) {
    const response = await fetchApiFootball("/fixtures", {
      ids: joinApiFootballIds(batch),
      timezone: process.env.API_FOOTBALL_TIMEZONE || "UTC",
    });
    rows.push(...extractApiFootballRows(response.data));
  }

  return rows;
}

async function fetchApiFootballInjuries(fixtureIds) {
  const rows = [];
  const batches = chunkArray(fixtureIds, Number(process.env.API_FOOTBALL_INJURY_BATCH_SIZE || 20));

  for (const batch of batches) {
    const response = await fetchApiFootball("/injuries", {
      ids: joinApiFootballIds(batch),
    });
    rows.push(...extractApiFootballRows(response.data));
  }

  return rows;
}

async function fetchApiFootballOdds(leagueId, season, timezone) {
  const rows = [];

  for (const date of uniqueFixtureDates) {
    const response = await fetchApiFootball("/odds", {
      league: leagueId,
      season,
      date,
      timezone,
    });
    rows.push(...extractApiFootballRows(response.data));
  }

  return rows;
}

async function fetchApiFootball(pathname, params) {
  const baseUrl = process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
  const url = new URL(pathname, ensureTrailingSlash(baseUrl));

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return fetchJson(url, {
    headers: {
      "x-apisports-key": process.env.API_FOOTBALL_KEY,
    },
  });
}

function extractApiFootballRows(payload) {
  return Array.isArray(payload?.response) ? payload.response : [];
}

function extractApiFootballCoverage(rows, season) {
  const leagueRow = rows[0];
  const seasons = Array.isArray(leagueRow?.seasons) ? leagueRow.seasons : [];
  const currentSeason =
    seasons.find((item) => String(item.year) === String(season)) ||
    seasons.find((item) => item.current) ||
    seasons[0] ||
    null;

  return currentSeason?.coverage || null;
}

function joinApiFootballIds(ids) {
  const separator = process.env.API_FOOTBALL_IDS_SEPARATOR || "-";
  return ids.join(separator);
}

function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

function normalizeProviderFilter(value) {
  return String(value || "all")
    .trim()
    .toLowerCase();
}

function wantsProvider(providerName) {
  return providerFilter === "all" || providerFilter === providerName;
}

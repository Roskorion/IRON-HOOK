export type ItcMode = "team" | "individual";
export type ItcResult = {
  name: string;
  place: number;
  games: number;
  wins: number;
  drawZero: number;
  drawFish: number;
  lossFish: number;
  lossZero: number;
  catches: number;
  opponentCatches: number;
  points: number;
};
export type ItcEvent = {
  id: string;
  title: string;
  date: string;
  venue: string;
  mode: ItcMode;
  organizer: string;
  sourceNote?: string;
  participants: number;
  fieldSize: number;
  archiveParticipants: number;
  virtualParticipants: number;
  url: string;
  protocolUrl: string;
  results: ItcResult[];
};
export type ItcArchive = {
  version: 1;
  source: string;
  checkedAt: string;
  events: ItcEvent[];
};
export const participantKey = (name: string) =>
  name.trim().toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ");
function sourceUrl(value: unknown) {
  if (typeof value !== "string") throw Error("Нет ссылки");
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "msk-trout.ru" ||
    u.username ||
    u.password ||
    u.port
  )
    throw Error("Неверный источник");
  return value;
}
export function parseItc(value: unknown): ItcArchive {
  const a = value as ItcArchive;
  if (
    !a ||
    a.version !== 1 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(a.checkedAt) ||
    !Array.isArray(a.events) ||
    !a.events.length
  )
    throw Error("Неверный формат архива");
  sourceUrl(a.source);
  const ids = new Set<string>();
  for (const e of a.events) {
    if (
      !e.id ||
      ids.has(e.id) ||
      !["team", "individual"].includes(e.mode) ||
      !e.title ||
      typeof e.organizer !== "string" ||
      !e.organizer.trim() ||
      e.organizer !== e.organizer.trim() ||
      (e.sourceNote !== undefined && (typeof e.sourceNote !== "string" || e.sourceNote.length > 2000)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
      !Number.isInteger(e.participants) ||
      e.participants < 1 ||
      !Number.isInteger(e.fieldSize) ||
      e.fieldSize < e.participants ||
      !Array.isArray(e.results) ||
      e.results.length !== e.participants
    )
      throw Error("Неверное событие");
    ids.add(e.id);
    sourceUrl(e.url);
    sourceUrl(e.protocolUrl);
    const names = new Set<string>(),
      places = new Set<number>();
    for (const r of e.results) {
      if (
        typeof r.name !== "string" ||
        !r.name.trim() ||
        names.has(participantKey(r.name))
      )
        throw Error("Неверный участник");
      names.add(participantKey(r.name));
      for (const k of [
        "place",
        "games",
        "wins",
        "drawZero",
        "drawFish",
        "lossFish",
        "lossZero",
        "catches",
        "opponentCatches",
        "points",
      ] as const)
        if (!Number.isSafeInteger(r[k]) || r[k] < 0)
          throw Error("Неверный показатель");
      if (
        r.place < 1 ||
        r.place > e.fieldSize ||
        places.has(r.place) ||
        r.games !==
          r.wins + r.drawZero + r.drawFish + r.lossFish + r.lossZero ||
        r.points !== 4 * r.wins + 2 * r.drawFish + r.lossFish
      )
        throw Error("Не согласуются показатели");
      places.add(r.place);
    }
  }
  return a;
}
export function summarizeItc(results: ItcResult[]) {
  const sum = (
    key:
      | "games"
      | "wins"
      | "drawZero"
      | "drawFish"
      | "lossFish"
      | "lossZero"
      | "catches"
      | "opponentCatches"
      | "points",
  ) => results.reduce((s, r) => s + r[key], 0);
  const games = sum("games"),
    wins = sum("wins");
  return {
    events: results.length,
    games,
    wins,
    draws: sum("drawZero") + sum("drawFish"),
    losses: sum("lossFish") + sum("lossZero"),
    catches: sum("catches"),
    opponentCatches: sum("opponentCatches"),
    points: sum("points"),
    winRate: games ? (wins / games) * 100 : 0,
    best: results.length ? Math.min(...results.map((r) => r.place)) : 0,
    average: results.length
      ? results.reduce((s, r) => s + r.place, 0) / results.length
      : 0,
    podiums: results.filter((r) => r.place <= 3).length,
  };
}

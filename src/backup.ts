import type { Data } from "./types";
import { LURE_TYPES, safeImage } from "./lures";
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
type Row = Record<string, unknown>;
function fail(): never {
  throw new Error(
    "Это не корректная резервная копия IRON HOOK. Проверьте формат записей и связи между ними.",
  );
}
function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Row;
}
function text(value: unknown, max = 2000): string {
  if (typeof value !== "string" || value.length > max) fail();
  return value;
}
function required(value: unknown): string {
  const s = text(value);
  if (!s.trim()) fail();
  return s;
}
function number(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    fail();
  return value;
}
function choice(value: unknown, options: string[]): string {
  const s = text(value);
  if (!options.includes(s)) fail();
  return s;
}
function flag(r: Row) {
  if (r.demo !== undefined && typeof r.demo !== "boolean") fail();
  return r.demo as boolean | undefined;
}
function list(value: unknown): Row[] {
  if (!Array.isArray(value) || value.length > 10000) fail();
  return value.map(row);
}
function unique(items: { id: string }[]) {
  if (new Set(items.map((x) => x.id)).size !== items.length) fail();
}
function date(value: unknown): string {
  const s = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail();
  const d = new Date(s + "T12:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s)
    fail();
  return s;
}
export function parseBackup(raw: string): Data {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "Не удалось прочитать JSON. Выберите файл резервной копии IRON HOOK.",
    );
  }
  const d = row(parsed);
  const lures = list(d.lures).map((l) => {
    const photo = text(l.photo, MAX_BACKUP_BYTES);
    if (!safeImage(photo)) fail();
    return {
      id: required(l.id),
      maker: required(l.maker),
      model: required(l.model),
      type: choice(l.type, LURE_TYPES),
      weight: number(l.weight, 0, Number.MAX_VALUE),
      color: required(l.color),
      code: text(l.code),
      photo,
      demo: flag(l),
    };
  });
  const gear = list(d.gear).map((g) => ({
    id: required(g.id),
    type: choice(g.type, ["Спиннинг", "Катушка", "Леска", "Поводок"]),
    name: required(g.name),
    specs: text(g.specs),
    demo: flag(g),
  }));
  const slots = {
    rod: "Спиннинг",
    reel: "Катушка",
    line: "Леска",
    leader: "Поводок",
  };
  const kits = list(d.kits).map((k) => {
    for (const [slot, type] of Object.entries(slots)) {
      const id = text(k[slot]);
      if (id && !gear.some((g) => g.id === id && g.type === type)) fail();
    }
    return {
      id: required(k.id),
      name: required(k.name),
      rod: text(k.rod),
      reel: text(k.reel),
      line: text(k.line),
      leader: text(k.leader),
      demo: flag(k),
    };
  });
  const trips = list(d.trips).map((t) => {
    const rounds = number(t.rounds, 1, 30, true);
    const catches = list(t.catches).map((c) => {
      const lure = c.lure === undefined ? "" : text(c.lure);
      const lureText =
        c.lureText === undefined ? undefined : required(c.lureText);
      if (lure && !lures.some((l) => l.id === lure)) fail();
      if (!lure && !lureText) fail();
      return {
        id: required(c.id),
        lure,
        ...(lureText === undefined ? {} : { lureText }),
        round: number(c.round, 1, rounds, true),
        count: number(c.count, 1, Number.MAX_SAFE_INTEGER, true),
      };
    });
    unique(catches);
    return {
      id: required(t.id),
      date: date(t.date),
      venue: required(t.venue),
      weather: text(t.weather),
      type: choice(t.type, ["Тренировка", "Соревнование"]),
      rounds,
      catches,
      demo: flag(t),
    };
  });
  [lures, gear, kits, trips].forEach(unique);
  return { lures, gear, kits, trips };
}

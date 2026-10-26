import type { Catch, Lure } from "./types";
export function catchDescription(c: Catch, lures: Lure[]): string {
  if (c.lureText?.trim()) return c.lureText;
  const l = lures.find((l) => l.id === c.lure);
  return l
    ? `${l.maker} ${l.model} · ${l.weight} г · ${l.color}`
    : "Приманка не указана";
}

export const LIBRARY_TYPES = [
  "Блесна",
  "Воблер",
  "Кренк",
  "Цикада",
  "Виб",
  "Раттлин",
] as const;
export const LURE_TYPES = [...LIBRARY_TYPES, "Силикон", "Другое"];
export const CATEGORY_LABELS: Record<string, string> = {
  Блесна: "Блёсны",
  Воблер: "Воблеры",
  Кренк: "Кренки",
  Цикада: "Цикады",
  Виб: "Вибы",
  Раттлин: "Раттлины",
};
export const SOURCE_HOSTS = {
  Onlyspin: ["onlyspin.ru", "www.onlyspin.ru"],
  Japsnasti: ["jpsnasti.ru", "www.jpsnasti.ru"],
  Japan4you: ["japan4you.ru", "www.japan4you.ru"],
  Baita: ["baita.ru", "www.baita.ru"],
};
export type LibrarySource = keyof typeof SOURCE_HOSTS;
export function safeImage(value: string): boolean {
  if (!value) return true;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value))
    return true;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      Object.values(SOURCE_HOSTS).flat().includes(u.hostname) &&
      /\.(?:jpe?g|png|webp)(?:$)/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

export function matchesLure(
  lure: {
    maker: string;
    model: string;
    color: string;
    code: string;
    weight: number;
  },
  query: string,
): boolean {
  const text =
    `${lure.maker} ${lure.model} ${lure.color} ${lure.code} ${lure.weight}`.toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => text.includes(token));
}

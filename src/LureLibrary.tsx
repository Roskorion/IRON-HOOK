import { useEffect, useState } from "react";
import type { Lure } from "./types";
import { parseBackup } from "./backup";

type Entry = {
  lure: Lure;
  source: "Onlyspin" | "Japsnasti";
  url: string;
  checkedAt: string;
};
function parseEntries(raw: unknown): Entry[] {
  if (!Array.isArray(raw) || raw.length > 10000)
    throw Error("Неверный формат библиотеки");
  const entries = raw.map((value): Entry => {
    if (!value || typeof value !== "object") throw Error("Неверная карточка");
    const { source, url, checkedAt, lure } = value;
    if (source !== "Onlyspin" && source !== "Japsnasti")
      throw Error("Неизвестный источник");
    const link = new URL(url);
    const hosts =
      source === "Onlyspin"
        ? ["onlyspin.ru", "www.onlyspin.ru"]
        : ["jpsnasti.ru", "www.jpsnasti.ru"];
    if (
      link.protocol !== "https:" ||
      !hosts.includes(link.hostname) ||
      link.username ||
      link.password ||
      link.port
    )
      throw Error("Неверная ссылка источника");
    if (typeof checkedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(checkedAt))
      throw Error("Нет даты проверки");
    const validated = parseBackup(
      JSON.stringify({ lures: [lure], gear: [], kits: [], trips: [] }),
    ).lures[0];
    return { lure: validated, source, url: link.href, checkedAt };
  });
  if (new Set(entries.map((e) => e.lure.id)).size !== entries.length)
    throw Error("Повторяющиеся карточки");
  // Ограничение относится только к встроенной библиотеке, не к личным записям.
  return entries.filter(
    ({ lure }) =>
      ["Блесна", "Воблер", "Цикада"].includes(lure.type) &&
      lure.weight > 0 &&
      lure.weight <= 5,
  );
}
export default function LureLibrary({
  owned,
  onChoose,
}: {
  owned: Lure[];
  onChoose: (l: Lure) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState("loading");
  const [query, setQuery] = useState("");
  const [maker, setMaker] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [weight, setWeight] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}lure-library.json`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error("Не удалось загрузить библиотеку");
        return r.json();
      })
      .then((raw) => {
        setEntries(parseEntries(raw));
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, []);
  const filtered = entries.filter(
    (e) =>
      (!maker || e.lure.maker === maker) &&
      (!type || e.lure.type === type) &&
      (!source || e.source === source) &&
      (!weight || e.lure.weight === Number(weight)) &&
      `${e.lure.maker} ${e.lure.model} ${e.lure.color} ${e.lure.code} ${e.lure.weight}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const isOwned = (l: Lure) =>
    owned.some(
      (o) =>
        !o.demo &&
        o.maker.toLowerCase() === l.maker.toLowerCase() &&
        o.model.toLowerCase() === l.model.toLowerCase() &&
        o.weight === l.weight &&
        o.color.toLowerCase() === l.color.toLowerCase() &&
        o.code.toLowerCase() === l.code.toLowerCase(),
    );
  return (
    <section aria-label="Встроенная библиотека приманок">
      <p>
        Выберите модель и расцветку, проверьте характеристики и сохраните в
        своём каталоге. Библиотека не влияет на дневник, пока вы не добавите
        приманку.
      </p>
      <div className="notice">
        Только твёрдые приманки до 5 г включительно. Это стартовая подборка, а
        не полный ассортимент магазинов. Если магазин указывает только код
        расцветки, он сохранён без выдуманного названия цвета.
      </div>
      <div className="library-filters">
        <label>
          Поиск в библиотеке
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Модель, цвет, код или вес"
          />
        </label>
        <label>
          Производитель
          <select value={maker} onChange={(e) => setMaker(e.target.value)}>
            <option value="">Все производители</option>
            {[...new Set(entries.map((e) => e.lure.maker))].sort().map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Тип приманки
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Все типы</option>
            {[...new Set(entries.map((e) => e.lure.type))].sort().map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Вес, г
          <select value={weight} onChange={(e) => setWeight(e.target.value)}>
            <option value="">Все веса до 5 г</option>
            {[...new Set(entries.map((e) => e.lure.weight))]
              .sort((a, b) => a - b)
              .map((v) => (
                <option key={v} value={v}>
                  {v} г
                </option>
              ))}
          </select>
        </label>
        <label>
          Источник
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Все источники</option>
            <option>Onlyspin</option>
            <option>Japsnasti</option>
          </select>
        </label>
      </div>
      {status === "loading" && <p role="status">Загрузка библиотеки…</p>}
      {status === "error" && (
        <p className="notice error" role="alert">
          Не удалось загрузить библиотеку. Обновите страницу. Ваш личный каталог
          не изменён.
        </p>
      )}
      {status === "ready" && !entries.length && (
        <div className="notice">
          Библиотека пока не наполнена: данные Onlyspin и Japsnasti ожидают
          проверки. Личный каталог и ручное добавление приманок доступны.
        </div>
      )}
      {status === "ready" && entries.length > 0 && (
        <p>Найдено вариантов: {filtered.length}</p>
      )}
      <div className="cards">
        {filtered.map(({ lure: l, source, url, checkedAt }) => (
          <article className="panel" key={l.id}>
            <span className="eyebrow">{l.maker}</span>
            <h2>{l.model}</h2>
            <p>
              {l.type} · {l.weight} г
            </p>
            <p>
              Цвет: {l.color} · Код: {l.code || "Не указан"}
            </p>
            <a
              className="source-link"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Карточка на {source} ↗
            </a>
            <p className="footnote">Проверено: {checkedAt}</p>
            <button
              className="primary"
              disabled={isOwned(l)}
              onClick={() => onChoose(l)}
            >
              {isOwned(l) ? "Уже в моём каталоге" : "Добавить в мой каталог"}
            </button>
          </article>
        ))}
      </div>
      {status === "ready" && entries.length > 0 && !filtered.length && (
        <p className="empty">Ничего не найдено. Измените поиск или фильтры.</p>
      )}
    </section>
  );
}

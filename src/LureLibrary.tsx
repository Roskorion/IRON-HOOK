import { useEffect, useRef, useState } from "react";
import type { Lure } from "./types";
import LurePhoto from "./LurePhoto";
import {
  LIBRARY_TYPES,
  CATEGORY_LABELS,
  SOURCE_HOSTS,
  matchesLure,
  type LibrarySource,
} from "./lures";
import { parseBackup } from "./backup";

type Entry = {
  lure: Lure;
  source: LibrarySource;
  url: string;
  checkedAt: string;
};
function parseEntries(raw: unknown): Entry[] {
  if (!Array.isArray(raw) || raw.length > 10000)
    throw Error("Неверный формат библиотеки");
  const entries = raw.map((value): Entry => {
    if (!value || typeof value !== "object") throw Error("Неверная карточка");
    const { source, url, checkedAt, lure } = value;
    if (!Object.hasOwn(SOURCE_HOSTS, source))
      throw Error("Неизвестный источник");
    const typedSource = source as LibrarySource;
    const link = new URL(url);
    const hosts = SOURCE_HOSTS[typedSource];
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
    return { lure: validated, source: typedSource, url: link.href, checkedAt };
  });
  if (new Set(entries.map((e) => e.lure.id)).size !== entries.length)
    throw Error("Повторяющиеся карточки");
  // Ограничение относится только к встроенной библиотеке, не к личным записям.
  return entries.filter(
    ({ lure }) =>
      (LIBRARY_TYPES as readonly string[]).includes(lure.type) &&
      lure.weight > 0 &&
      lure.weight <= 5,
  );
}
export default function LureLibrary({
  owned,
  onChoose,
  onUpdatePhoto,
}: {
  owned: Lure[];
  onChoose: (l: Lure) => void;
  onUpdatePhoto: (id: string, photo: string) => boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState("loading");
  const [photoNotice, setPhotoNotice] = useState("");
  const [query, setQuery] = useState("");
  const [maker, setMaker] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [weight, setWeight] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const top = useRef<HTMLElement>(null);
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
      matchesLure(e.lure, query),
  );
  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageNumber = Math.min(currentPage, pageCount);
  function goToPage(number: number) {
    setCurrentPage(number);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const findOwned = (l: Lure) =>
    owned.find(
      (o) =>
        !o.demo &&
        o.maker.toLowerCase() === l.maker.toLowerCase() &&
        o.model.toLowerCase() === l.model.toLowerCase() &&
        o.weight === l.weight &&
        o.color.toLowerCase() === l.color.toLowerCase() &&
        o.code.toLowerCase() === l.code.toLowerCase(),
    );
  const isOwned = (l: Lure) => Boolean(findOwned(l));
  const canFillPhoto = (l: Lure) =>
    Boolean(l.photo && findOwned(l) && !findOwned(l)?.photo);
  return (
    <section ref={top} aria-label="Встроенная библиотека приманок">
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
      <div
        className="category-tabs"
        role="group"
        aria-label="Категории приманок"
      >
        <button
          aria-pressed={!type}
          onClick={() => {
            setType("");
            setCurrentPage(1);
          }}
        >
          Все категории
        </button>
        {LIBRARY_TYPES.map((t) => (
          <button
            key={t}
            aria-pressed={type === t}
            onClick={() => {
              setType(t);
              setCurrentPage(1);
            }}
          >
            {CATEGORY_LABELS[t]}
          </button>
        ))}
      </div>
      <p className="footnote">
        Кренки выделены из воблеров. Вибы и раттлины разделены по категории
        магазина. Фотографии загружаются с сайтов-источников и могут быть
        недоступны; свои фото можно добавить при сохранении приманки.
      </p>
      <div className="library-filters">
        <label>
          Поиск в библиотеке
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Модель, цвет, код или вес"
          />
        </label>
        <label>
          Производитель
          <select
            value={maker}
            onChange={(e) => {
              setMaker(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Все производители</option>
            {[...new Set(entries.map((e) => e.lure.maker))].sort().map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Тип приманки
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Все типы</option>
            {[...new Set(entries.map((e) => e.lure.type))].sort().map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Вес, г
          <select
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              setCurrentPage(1);
            }}
          >
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
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Все источники</option>
            {Object.keys(SOURCE_HOSTS).map((s) => (
              <option key={s}>{s}</option>
            ))}
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
      {photoNotice && <p role="status">{photoNotice}</p>}
      <div className="cards">
        {filtered
          .slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
          .map(({ lure: l, source, url, checkedAt }) => (
            <article className="panel" key={l.id}>
              <div className="lure-image">
                <LurePhoto
                  photo={l.photo}
                  name={`${l.maker} ${l.model} · ${l.color}`}
                />
              </div>
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
                disabled={isOwned(l) && !canFillPhoto(l)}
                onClick={() => {
                  const saved = findOwned(l);
                  if (saved && canFillPhoto(l)) {
                    if (onUpdatePhoto(saved.id, l.photo))
                      setPhotoNotice(
                        "Фото добавлено в личный каталог. Остальные данные не изменены.",
                      );
                  } else onChoose(l);
                }}
              >
                {canFillPhoto(l)
                  ? "Добавить фото в мой каталог"
                  : isOwned(l)
                    ? "Уже в моём каталоге"
                    : "Добавить в мой каталог"}
              </button>
            </article>
          ))}
      </div>
      {filtered.length > pageSize && (
        <div
          className="library-pagination"
          role="group"
          aria-label="Страницы библиотеки"
        >
          <button
            disabled={pageNumber === 1}
            onClick={() => goToPage(pageNumber - 1)}
          >
            ← Предыдущая страница
          </button>
          <span aria-live="polite">
            Страница {pageNumber} из {pageCount}
          </span>
          <button
            disabled={pageNumber === pageCount}
            onClick={() => goToPage(pageNumber + 1)}
          >
            Следующая страница →
          </button>
        </div>
      )}
      {status === "ready" && entries.length > 0 && !filtered.length && (
        <p className="empty">Ничего не найдено. Измените поиск или фильтры.</p>
      )}
    </section>
  );
}

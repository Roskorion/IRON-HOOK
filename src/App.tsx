import { useState } from "react";
import "./App.css";
import ItcStats from "./ItcStats";
import { catchDescription } from "./catches";
import LureLibrary from "./LureLibrary";
import LurePhoto from "./LurePhoto";
import {
  LURE_TYPES,
  CATEGORY_LABELS,
  matchesLure,
  sameLureVariant,
} from "./lures";
import type { Lure, Gear, Kit, Catch, Trip, Data } from "./types";
import { parseBackup, MAX_BACKUP_BYTES } from "./backup";

const key = "iron-hook-v1";
const uid = () => crypto.randomUUID();
const demo: Data = {
  lures: [
    {
      id: "l1",
      maker: "Forest",
      model: "MIU",
      type: "Блесна",
      weight: 2.2,
      color: "Розовый",
      code: "05",
      photo: "",
      demo: true,
    },
    {
      id: "l2",
      maker: "ValkeIN",
      model: "Hi Burst",
      type: "Блесна",
      weight: 1.6,
      color: "Золотой",
      code: "GL",
      photo: "",
      demo: true,
    },
    {
      id: "l3",
      maker: "Daiwa",
      model: "Presso Double Clutch",
      type: "Воблер",
      weight: 3,
      color: "Оливковый",
      code: "OL",
      photo: "",
      demo: true,
    },
  ],
  gear: [
    {
      id: "g1",
      type: "Спиннинг",
      name: "Trout Area 602UL",
      specs: "1,83 м · тест 0,5–4 г",
      demo: true,
    },
    {
      id: "g2",
      type: "Катушка",
      name: "LT 2000S",
      specs: "Передаточное число 5.1:1",
      demo: true,
    },
    {
      id: "g3",
      type: "Леска",
      name: "PE #0.2",
      specs: "Плетёная · 150 м",
      demo: true,
    },
    {
      id: "g4",
      type: "Поводок",
      name: "Fluoro 0.14",
      specs: "Флюорокарбон · 0,14 мм",
      demo: true,
    },
  ],
  kits: [
    {
      id: "k1",
      name: "Лёгкий старт",
      rod: "g1",
      reel: "g2",
      line: "g3",
      leader: "g4",
      demo: true,
    },
  ],
  trips: [
    {
      id: "t1",
      date: "2026-09-20",
      venue: "Тестовый пруд «Арена»",
      weather: "Облачно, +14 °C",
      type: "Тренировка",
      rounds: 3,
      catches: [
        { id: "c1", round: 1, lure: "l1", count: 5 },
        { id: "c2", round: 2, lure: "l2", count: 3 },
        { id: "c3", round: 3, lure: "l1", count: 2 },
      ],
      demo: true,
    },
    {
      id: "t2",
      date: "2026-09-27",
      venue: "Тестовый пруд «Север»",
      weather: "Солнечно, +12 °C",
      type: "Соревнование",
      rounds: 4,
      catches: [
        { id: "c4", round: 1, lure: "l2", count: 4 },
        { id: "c5", round: 2, lure: "l3", count: 2 },
        { id: "c6", round: 3, lure: "l1", count: 3 },
        { id: "c7", round: 4, lure: "l2", count: 1 },
      ],
      demo: true,
    },
  ],
};
function load(): Data {
  const raw = localStorage.getItem(key);
  if (!raw) return demo;
  return parseBackup(raw);
}
const pages = [
  "Главная панель",
  "Приманки",
  "Снасти и комплекты",
  "Дневник рыбалок",
  "Аналитика",
  "Командная статистика",
  "Личная статистика",
];
const icons = ["◈", "◉", "⌁", "▤", "▥", "♜", "◉"];
function App() {
  const [initial] = useState(() => {
    try {
      return { data: load(), error: "" };
    } catch {
      return {
        data: demo,
        error:
          "Не удалось прочитать сохранённые данные. Они не будут перезаписаны до сброса. Скачайте резервную копию.",
      };
    }
  });
  const [data, setData] = useState<Data>(initial.data);
  const [error, setError] = useState(initial.error);
  const [storageBroken, setStorageBroken] = useState(Boolean(initial.error));
  const [restore, setRestore] = useState<Data | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const [restoreNotice, setRestoreNotice] = useState("");
  const [reading, setReading] = useState(false);
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<"lure" | "gear" | "kit" | "trip" | null>(
    null,
  );
  const [edit, setEdit] = useState("");
  const [search, setSearch] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [myLureType, setMyLureType] = useState("");
  const visibleLures = data.lures.filter(
    (l) => (!myLureType || l.type === myLureType) && matchesLure(l, search),
  );
  function commit(next: Data, recovering = false) {
    if (storageBroken && !recovering) {
      alert(error);
      return false;
    }
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setData(next);
      setStorageBroken(false);
      setError("");
      return true;
    } catch {
      setError(
        "Не удалось сохранить данные: возможно, хранилище браузера заполнено. Скачайте резервную копию.",
      );
      return false;
    }
  }
  function open(kind: typeof modal, id = "") {
    setEdit(id);
    setModal(kind);
  }
  const all = data.trips.flatMap((t) => t.catches);
  const total = all.reduce((s, c) => s + c.count, 0);
  const rounds = data.trips.reduce((s, t) => s + t.rounds, 0);
  const gearName = (id: string) =>
    data.gear.find((g) => g.id === id)?.name || "Не выбрано";
  const freeTextTotals = new Map<
    string,
    { id: string; label: string; value: number }
  >();
  all
    .filter((c) => !c.lure)
    .forEach((c) => {
      const label = catchDescription(c, data.lures).trim();
      const id = `comment:${label.toLowerCase()}`;
      const entry = freeTextTotals.get(id);
      if (entry) entry.value += c.count;
      else freeTextTotals.set(id, { id, label, value: c.count });
    });
  const ranking = [
    ...data.lures.map((l) => ({
      id: l.id,
      label: `${l.maker} ${l.model} · ${l.weight} г · ${l.color}`,
      value: all
        .filter((c) => c.lure === l.id)
        .reduce((s, c) => s + c.count, 0),
    })),
    ...freeTextTotals.values(),
  ].sort((a, b) => b.value - a.value);
  function remove(kind: "lures" | "gear" | "kits" | "trips", id: string) {
    if (kind === "lures" && all.some((c) => c.lure === id)) {
      alert(
        "Приманка используется в дневнике. Сначала измените соответствующие уловы.",
      );
      return;
    }
    if (
      kind === "gear" &&
      data.kits.some((k) => [k.rod, k.reel, k.line, k.leader].includes(id))
    ) {
      alert("Снасть используется в комплекте. Сначала измените комплект.");
      return;
    }
    if (confirm("Удалить запись? Это действие нельзя отменить."))
      commit({ ...data, [kind]: data[kind].filter((v) => v.id !== id) });
  }
  function backup() {
    const blob = new Blob(
      [
        storageBroken
          ? localStorage.getItem(key) || ""
          : JSON.stringify(data, null, 2),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "iron-hook-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function readBackup(file: File) {
    setRestoreError("");
    setRestoreNotice("");
    setRestore(null);
    setReading(true);
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("Файл слишком большой. Максимум — 10 МБ.");
      const restored = parseBackup(await file.text());
      setRestore(restored);
    } catch (e) {
      setRestoreError(
        e instanceof Error ? e.message : "Не удалось прочитать файл.",
      );
    } finally {
      setReading(false);
    }
  }
  const badge = (test?: boolean) =>
    test ? <span className="badge">Тестовые данные</span> : null;
  const actions = (
    kind: "lures" | "gear" | "kits" | "trips",
    id: string,
    m: typeof modal,
  ) => (
    <div className="actions">
      <button onClick={() => open(m, id)}>Изменить</button>
      <button className="danger" onClick={() => remove(kind, id)}>
        Удалить
      </button>
    </div>
  );
  return (
    <div className="app">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage(0);
          }}
        >
          <span className="brand-icon">♜</span>
          <span>
            IRON <b>HOOK</b>
            <small>FISHING ASSISTANT</small>
          </span>
        </a>
        <div className="nav-label">ВАША РЫБОЛОВНАЯ БАЗА</div>
        <nav>
          {pages.map((p, i) => (
            <button
              key={p}
              className={page === i ? "active" : ""}
              onClick={() => {
                setPage(i);
                setSearch("");
              }}
            >
              <span aria-hidden="true">{icons[i]}</span>
              {p}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="live-dot" /> Локальное хранилище
          <small>Ваши данные — в этом браузере</small>
          <button onClick={backup}>↓ Скачать резервную копию</button>
        </div>
      </aside>
      <main>
        <header>
          <span>
            TROUT AREA <span className="muted">/</span> ВАША СТАТИСТИКА
          </span>
          <span className="status">● Личный кабинет</span>
        </header>
        <div className="heading">
          <div>
            <div className="eyebrow">IRON HOOK · TROUT AREA FISHING</div>
            <h1>{pages[page]}</h1>
            <p>
              {
                [
                  "Каждый заброс — опыт. Каждая рыбалка — шаг вперёд.",
                  "Ваша коробка. Проверенные решения для каждого тура.",
                  "Соберите снасти в готовый к старту комплект.",
                  "Сохраняйте условия, туры и результат каждого выхода.",
                  "Находите закономерности в собственных результатах.",
                  "Участия, уловы и результаты команд по опубликованным протоколам турниров.",
                  "Личная статистика спортсменов по архиву турниров.",
                ][page]
              }
            </p>
          </div>
          {page > 0 && page < 4 && (
            <button
              className="primary"
              onClick={() =>
                open(page === 1 ? "lure" : page === 2 ? "gear" : "trip")
              }
            >
              ＋{" "}
              {page === 1
                ? "Добавить приманку"
                : page === 2
                  ? "Добавить снасть"
                  : "Новая рыбалка"}
            </button>
          )}
        </div>
        {error && <div className="notice error">{error}</div>}
        {page < 5 &&
          (data.lures.some((l) => l.demo) ||
            data.trips.some((t) => t.demo) ||
            data.gear.some((g) => g.demo) ||
            data.kits.some((k) => k.demo)) && (
            <div className="notice">
              <span>
                ◈ <b>Демонстрационный режим.</b> Тестовые записи включены в
                статистику. Добавляйте свои данные или начните с чистой базы.
              </span>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Удалить все данные и начать с пустой базы? Сначала рекомендуем скачать резервную копию.",
                    )
                  ) {
                    try {
                      localStorage.setItem(
                        key,
                        JSON.stringify({
                          lures: [],
                          gear: [],
                          kits: [],
                          trips: [],
                        }),
                      );
                      setData({ lures: [], gear: [], kits: [], trips: [] });
                      setStorageBroken(false);
                      setError("");
                    } catch {
                      setError("Не удалось очистить хранилище.");
                    }
                  }
                }}
              >
                Очистить базу
              </button>
            </div>
          )}
        {(page === 0 || page === 4) && (
          <>
            <div className="stats">
              {[
                [data.trips.length, "РЫБАЛОК", "↗"],
                [total, "ПОЙМАНО РЫБЫ", "⌁"],
                [
                  rounds ? (total / rounds).toFixed(1) : "0",
                  "В СРЕДНЕМ ЗА ТУР",
                  "◷",
                ],
                [data.lures.length, "ПРИМАНОК В КАТАЛОГЕ", "◉"],
              ].map(([n, l, i]) => (
                <div className="stat" key={l}>
                  <span className="stat-icon">{i}</span>
                  <span>{l}</span>
                  <strong>{n}</strong>
                  <small>
                    {l === "В СРЕДНЕМ ЗА ТУР"
                      ? "Улов / все записанные туры"
                      : "По данным вашего дневника"}
                  </small>
                </div>
              ))}
            </div>
            <div className="grid">
              <section className="panel">
                <div className="panel-title">
                  <h2>Эффективность приманок</h2>
                  <span>РЫБЫ, ШТ.</span>
                </div>
                <Bars items={ranking} />
                <p className="footnote">
                  Количество пойманной рыбы, без учёта времени ловли.
                </p>
              </section>
              <section className="panel">
                <div className="panel-title">
                  <h2>
                    {page === 0 ? "Ваш результат" : "Эффективность по турам"}
                  </h2>
                  <span>УЛОВ</span>
                </div>
                {page === 0 ? (
                  <div className="ring-wrap">
                    <div className="ring">
                      <strong>
                        {total}
                        <small>рыб в дневнике</small>
                      </strong>
                    </div>
                    <p>
                      {data.trips.filter((t) => t.type === "Тренировка").length}{" "}
                      тренировок ·{" "}
                      {
                        data.trips.filter((t) => t.type === "Соревнование")
                          .length
                      }{" "}
                      соревнований
                    </p>
                  </div>
                ) : (
                  <Bars
                    items={Array.from(
                      {
                        length: Math.max(0, ...data.trips.map((t) => t.rounds)),
                      },
                      (_, i) => ({
                        label: `Тур ${i + 1}`,
                        value: all
                          .filter((c) => c.round === i + 1)
                          .reduce((s, c) => s + c.count, 0),
                      }),
                    )}
                  />
                )}
              </section>
            </div>
          </>
        )}
        {page === 0 && (
          <section className="panel">
            <div className="panel-title">
              <h2>Последние рыбалки</h2>
              <button onClick={() => setPage(3)}>Все записи →</button>
            </div>
            {data.trips.length ? (
              [...data.trips]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 4)
                .map((t) => (
                  <div className="trip-row" key={t.id}>
                    <div className="date-tile">
                      {t.date.slice(8)}
                      <small>
                        {t.date.slice(5, 7)} / {t.date.slice(0, 4)}
                      </small>
                    </div>
                    <div>
                      <b>{t.venue}</b>
                      <p>
                        {t.type} · {t.rounds} туров {badge(t.demo)}
                      </p>
                    </div>
                    <strong className="result">
                      {t.catches.reduce((s, c) => s + c.count, 0)}{" "}
                      <small>рыб</small>
                    </strong>
                    <button onClick={() => open("trip", t.id)}>
                      Открыть →
                    </button>
                  </div>
                ))
            ) : (
              <Empty />
            )}
          </section>
        )}
        {page === 1 && (
          <>
            <div
              className="library-tabs"
              role="group"
              aria-label="Каталоги приманок"
            >
              <button
                aria-pressed={!libraryOpen}
                onClick={() => setLibraryOpen(false)}
              >
                Мой каталог
              </button>
              <button
                aria-pressed={libraryOpen}
                onClick={() => setLibraryOpen(true)}
              >
                Встроенная библиотека
              </button>
            </div>
            {libraryOpen ? (
              <LureLibrary
                owned={data.lures}
                onUpdatePhoto={(id, photo) =>
                  commit({
                    ...data,
                    lures: data.lures.map((l) =>
                      l.id === id && !l.photo ? { ...l, photo } : l,
                    ),
                  })
                }
                onViewCatalog={() => {
                  setLibraryOpen(false);
                  setMyLureType("");
                  setSearch("");
                }}
                onAdd={(l) => {
                  if (
                    data.lures.some(
                      (owned) => !owned.demo && sameLureVariant(owned, l),
                    )
                  )
                    return false;
                  return commit({
                    ...data,
                    lures: [...data.lures, { ...l, id: uid(), demo: false }],
                  });
                }}
              />
            ) : (
              <>
                <label className="my-category">
                  Категория моих приманок
                  <select
                    value={myLureType}
                    onChange={(e) => setMyLureType(e.target.value)}
                  >
                    <option value="">Все категории</option>
                    {LURE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {CATEGORY_LABELS[t] || t}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  className="search"
                  placeholder="Поиск по модели, производителю или цвету…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="cards">
                  {visibleLures.map((l) => (
                    <article className="panel lure-card" key={l.id}>
                      <div className="lure-image">
                        <LurePhoto
                          photo={l.photo}
                          name={`${l.maker} ${l.model} · ${l.color}`}
                        />
                        {badge(l.demo)}
                      </div>
                      <span className="eyebrow">{l.maker}</span>
                      <h2>{l.model}</h2>
                      <p>
                        {l.type} · {l.weight} г
                      </p>
                      <div className="specs">
                        {l.color} <span>Код: {l.code || "—"}</span>
                      </div>
                      {actions("lures", l.id, "lure")}
                    </article>
                  ))}
                </div>
                {!visibleLures.length && <Empty />}
              </>
            )}
          </>
        )}
        {page === 2 && (
          <>
            <div className="section-heading">
              <h2>Готовые комплекты</h2>
              <button onClick={() => open("kit")}>＋ Создать комплект</button>
            </div>
            <div className="cards">
              {data.kits.map((k) => (
                <article className="panel" key={k.id}>
                  {badge(k.demo)}
                  <h2>{k.name}</h2>
                  {[
                    ["Спиннинг", k.rod],
                    ["Катушка", k.reel],
                    ["Леска", k.line],
                    ["Поводок", k.leader],
                  ].map(([label, id]) => (
                    <p key={label}>
                      <span className="muted">{label}: </span>
                      {gearName(id)}
                    </p>
                  ))}
                  {actions("kits", k.id, "kit")}
                </article>
              ))}
            </div>
            <h2 className="section-heading">Каталог снастей</h2>
            <div className="cards">
              {data.gear.map((g) => (
                <article className="panel" key={g.id}>
                  <div className="eyebrow">{g.type}</div>
                  <h2>{g.name}</h2>
                  {badge(g.demo)}
                  <p className="prewrap">{g.specs}</p>
                  {actions("gear", g.id, "gear")}
                </article>
              ))}
            </div>
            {!data.gear.length && <Empty />}
          </>
        )}
        {page === 3 && (
          <div className="trip-list">
            {[...data.trips]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((t) => (
                <section className="panel" key={t.id}>
                  <div className="panel-title">
                    <div>
                      <span className="eyebrow">
                        {new Date(t.date + "T12:00:00").toLocaleDateString(
                          "ru-RU",
                        )}{" "}
                        · {t.type}
                      </span>
                      <h2>{t.venue}</h2>
                    </div>
                    {badge(t.demo)}
                  </div>
                  <p>
                    {t.weather || "Погода не указана"} · {t.rounds} туров ·{" "}
                    <b>{t.catches.reduce((s, c) => s + c.count, 0)} рыб</b>
                  </p>
                  <div className="rounds">
                    {Array.from({ length: t.rounds }, (_, i) => (
                      <div key={i}>
                        <span>ТУР {i + 1}</span>
                        <strong>
                          {t.catches
                            .filter((c) => c.round === i + 1)
                            .reduce((s, c) => s + c.count, 0)}
                        </strong>
                        {t.catches
                          .filter((c) => c.round === i + 1)
                          .map((c) => (
                            <small key={c.id}>
                              {catchDescription(c, data.lures)} × {c.count}
                            </small>
                          ))}
                      </div>
                    ))}
                  </div>
                  {actions("trips", t.id, "trip")}
                </section>
              ))}
            {!data.trips.length && <Empty />}
          </div>
        )}
        {page === 4 && (
          <>
            <div className="grid">
              {(["weight", "color"] as const).map((field) => (
                <section className="panel" key={field}>
                  <h2>
                    {field === "weight"
                      ? "Статистика по весам"
                      : "Статистика по цветам"}
                  </h2>
                  <p className="footnote">
                    Здесь учитываются ранее записанные уловы со связью с
                    каталогом. Для свободных комментариев вес и цвет не
                    определяются автоматически.
                  </p>
                  <Bars
                    items={Object.entries(
                      all.reduce<Record<string, number>>((acc, c) => {
                        const l = data.lures.find((l) => l.id === c.lure);
                        if (l) {
                          const label =
                            field === "weight" ? `${l.weight} г` : l.color;
                          acc[label] = (acc[label] || 0) + c.count;
                        }
                        return acc;
                      }, {}),
                    )
                      .map(([label, value]) => ({ label, value }))
                      .sort((a, b) => b.value - a.value)}
                  />
                </section>
              ))}
            </div>
            <section className="panel">
              <h2>Сравнение рыбалок</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Дата / водоём</th>
                      <th>Формат</th>
                      <th>Туры</th>
                      <th>Улов</th>
                      <th>Рыб / тур</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trips.map((t) => {
                      const n = t.catches.reduce((s, c) => s + c.count, 0);
                      return (
                        <tr key={t.id}>
                          <td>
                            {t.date}
                            <br />
                            {t.venue} {badge(t.demo)}
                          </td>
                          <td>{t.type}</td>
                          <td>{t.rounds}</td>
                          <td>{n}</td>
                          <td>{(n / t.rounds).toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!data.trips.length && <Empty />}
            </section>
          </>
        )}
        {page === 5 && <ItcStats key="team" mode="team" />}
        {page === 6 && <ItcStats key="individual" mode="individual" />}
        {restoreError && (
          <div className="notice error" role="alert">
            {restoreError} Текущие записи не изменены.
          </div>
        )}
        {restoreNotice && (
          <div className="notice" role="status">
            {restoreNotice}
          </div>
        )}
        <footer>
          <button onClick={backup}>↓ Резервная копия</button>
          <label className="restore-button">
            {reading ? "Проверка файла…" : "↑ Восстановить из файла"}
            <input
              type="file"
              accept=".json,application/json"
              disabled={reading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void readBackup(file);
              }}
            />
          </label>
          <span>IRON HOOK · Сохраняйте опыт. Совершенствуйте результат.</span>
        </footer>
      </main>
      {restore && (
        <div
          className="overlay"
          onKeyDown={(e) => {
            if (e.key === "Escape") setRestore(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-title"
          >
            <h2 id="restore-title">Восстановление резервной копии</h2>
            <p>
              Файл проверен. В копии: {restore.trips.length} рыбалок,{" "}
              {restore.lures.length} приманок, {restore.gear.length} снастей,{" "}
              {restore.kits.length} комплектов.
            </p>
            <div className="notice">
              Все текущие записи будут заменены данными из файла. Объединение
              записей не выполняется. Сначала скачайте текущую копию, если
              хотите сохранить её.
            </div>
            <button onClick={backup}>Скачать текущую копию</button>
            {error && <p role="alert">{error}</p>}
            <div className="modal-bottom">
              <button autoFocus onClick={() => setRestore(null)}>
                Отмена
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (commit(restore, true)) {
                    setRestore(null);
                    setModal(null);
                    setPage(0);
                    setSearch("");
                    setRestoreNotice(
                      "Резервная копия восстановлена. Данные сохранены в этом браузере.",
                    );
                  }
                }}
              >
                Заменить данные и восстановить
              </button>
            </div>
          </section>
        </div>
      )}
      {modal && (
        <Editor
          key={`${modal}-${edit}`}
          kind={modal}
          id={edit}
          data={data}
          close={() => setModal(null)}
          save={(next) => {
            if (commit(next)) {
              setModal(null);
            }
          }}
        />
      )}
    </div>
  );
}
function Empty() {
  return (
    <p className="empty">
      Здесь пока нет записей. Добавьте первую запись, чтобы увидеть результат.
    </p>
  );
}
function Bars({
  items,
}: {
  items: { id?: string; label: string; value: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return items.length ? (
    <div className="bars">
      {items.map((i) => (
        <div key={i.id ?? i.label}>
          <div className="bar-label">
            <span>{i.label}</span>
            <b>{i.value}</b>
          </div>
          <div className="bar-track">
            <div style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Empty />
  );
}
function Editor({
  kind,
  id,
  data,
  close,
  save,
}: {
  kind: "lure" | "gear" | "kit" | "trip";
  id: string;
  data: Data;
  close: () => void;
  save: (d: Data) => void;
}) {
  const existing =
    kind === "lure"
      ? data.lures.find((x) => x.id === id)
      : kind === "gear"
        ? data.gear.find((x) => x.id === id)
        : kind === "kit"
          ? data.kits.find((x) => x.id === id)
          : data.trips.find((x) => x.id === id);
  const [photo, setPhoto] = useState((existing as Lure)?.photo || "");
  const [photoError, setPhotoError] = useState("");
  const [today] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [rounds, setRounds] = useState((existing as Trip)?.rounds || 1);
  const [catches, setCatches] = useState<Catch[]>(
    ((existing as Trip)?.catches || []).map((c) => ({
      ...c,
      lureText: catchDescription(c, data.lures),
    })),
  );
  const field = (
    name: string,
    label: string,
    value: string | number = "",
    type = "text",
    required = true,
  ) => (
    <label>
      {label}
      <input
        name={name}
        defaultValue={value}
        type={type}
        required={required}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        maxLength={type === "text" ? 160 : undefined}
      />
    </label>
  );
  const select = (
    name: string,
    label: string,
    options: string[],
    value = "",
  ) => (
    <label>
      {label}
      <select name={name} defaultValue={value || options[0]}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const s = (n: string) => String(form.get(n) || "").trim();
    const newid = id || uid();
    let next = data;
    if (kind === "lure") {
      if (!s("maker") || !s("model") || !s("color")) return;
      const l: Lure = {
        id: newid,
        maker: s("maker"),
        model: s("model"),
        type: s("type"),
        weight: Number(s("weight")),
        color: s("color"),
        code: s("code"),
        photo,
        demo: existing?.demo,
      };
      next = {
        ...data,
        lures: id
          ? data.lures.map((x) => (x.id === id ? l : x))
          : [...data.lures, l],
      };
    }
    if (kind === "gear") {
      if (!s("name")) return;
      const g: Gear = {
        id: newid,
        type: s("type"),
        name: s("name"),
        specs: s("specs"),
        demo: existing?.demo,
      };
      next = {
        ...data,
        gear: id
          ? data.gear.map((x) => (x.id === id ? g : x))
          : [...data.gear, g],
      };
    }
    if (kind === "kit") {
      if (!s("name")) return;
      const k: Kit = {
        id: newid,
        name: s("name"),
        rod: s("rod"),
        reel: s("reel"),
        line: s("line"),
        leader: s("leader"),
        demo: existing?.demo,
      };
      next = {
        ...data,
        kits: id
          ? data.kits.map((x) => (x.id === id ? k : x))
          : [...data.kits, k],
      };
    }
    if (kind === "trip") {
      if (!s("venue")) return;
      if (
        catches.some(
          (c) =>
            !c.lureText?.trim() ||
            c.round > rounds ||
            !Number.isInteger(c.count) ||
            c.count < 1 ||
            !Number.isInteger(c.round) ||
            c.round < 1,
        )
      ) {
        alert(
          "Проверьте уловы: напишите приманку или комментарий, целый номер тура и количество рыб от 1. Номер тура не может превышать число туров.",
        );
        return;
      }
      const t: Trip = {
        id: newid,
        date: s("date"),
        venue: s("venue"),
        weather: s("weather"),
        type: s("type"),
        rounds,
        catches: catches.map((c) => ({ ...c, lureText: c.lureText?.trim() })),
        demo: existing?.demo,
      };
      next = {
        ...data,
        trips: id
          ? data.trips.map((x) => (x.id === id ? t : x))
          : [...data.trips, t],
      };
    }
    save(next);
  }
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="modal"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Редактирование записи"
      >
        <div className="panel-title">
          <h2>
            {id ? "Изменить" : "Добавить"}{" "}
            {kind === "lure"
              ? "приманку"
              : kind === "gear"
                ? "снасть"
                : kind === "kit"
                  ? "комплект"
                  : "рыбалку"}
          </h2>
          <button aria-label="Закрыть" onClick={close}>
            ✕
          </button>
        </div>
        <form onSubmit={submit}>
          {kind === "lure" &&
            (() => {
              const l = existing as Lure | undefined;
              return (
                <>
                  <div className="form-grid">
                    {field("maker", "Производитель", l?.maker)}
                    {field("model", "Модель", l?.model)}
                    {select("type", "Тип", LURE_TYPES, l?.type)}
                    {field("weight", "Вес, г", l?.weight ?? 1, "number")}
                    {field("color", "Цвет", l?.color)}
                    {field("code", "Код расцветки", l?.code, "text", false)}
                  </div>
                  <label>
                    Фотография (JPEG, PNG, WebP; до 2 МБ)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (
                          f.size > 2 * 1024 * 1024 ||
                          !["image/jpeg", "image/png", "image/webp"].includes(
                            f.type,
                          )
                        ) {
                          setPhotoError(
                            "Выберите JPEG, PNG или WebP размером до 2 МБ.",
                          );
                          return;
                        }
                        setPhotoError("");
                        const reader = new FileReader();
                        reader.onload = () => setPhoto(String(reader.result));
                        reader.readAsDataURL(f);
                      }}
                    />
                  </label>
                  {photoError && <p role="alert">{photoError}</p>}
                  {photo && (
                    <div className="photo-preview">
                      <img src={photo} alt="Фото приманки" />
                      <button type="button" onClick={() => setPhoto("")}>
                        Удалить фото
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          {kind === "gear" &&
            (() => {
              const g = existing as Gear | undefined;
              return (
                <>
                  {select(
                    "type",
                    "Тип",
                    ["Спиннинг", "Катушка", "Леска", "Поводок"],
                    g?.type,
                  )}
                  {field("name", "Название", g?.name)}
                  <label>
                    Характеристики
                    <textarea
                      name="specs"
                      defaultValue={g?.specs}
                      maxLength={2000}
                      placeholder="Длина, тест, диаметр и другие характеристики"
                    />
                  </label>
                </>
              );
            })()}
          {kind === "kit" &&
            (() => {
              const k = existing as Kit | undefined;
              return (
                <>
                  {field("name", "Название комплекта", k?.name)}
                  {(
                    [
                      ["rod", "Спиннинг"],
                      ["reel", "Катушка"],
                      ["line", "Леска"],
                      ["leader", "Поводок"],
                    ] as const
                  ).map(([name, type]) => (
                    <label key={name}>
                      {type}
                      <select name={name} defaultValue={k?.[name] || ""}>
                        <option value="">Не выбрано</option>
                        {data.gear
                          .filter((g) => g.type === type)
                          .map((g) => (
                            <option value={g.id} key={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                  <p className="footnote">
                    Можно сохранить неполный комплект и дополнить его позже.
                  </p>
                </>
              );
            })()}
          {kind === "trip" &&
            (() => {
              const t = existing as Trip | undefined;
              return (
                <>
                  <div className="form-grid">
                    {field("date", "Дата", t?.date || today, "date")}
                    {select(
                      "type",
                      "Формат",
                      ["Тренировка", "Соревнование"],
                      t?.type,
                    )}
                    {field("venue", "Водоём", t?.venue)}
                    {field("weather", "Погода", t?.weather, "text", false)}
                  </div>
                  <label>
                    Количество туров
                    <input
                      type="number"
                      min="1"
                      max="30"
                      step="1"
                      required
                      value={rounds}
                      onChange={(e) => setRounds(Number(e.target.value))}
                    />
                  </label>
                  <div className="section-heading">
                    <h3>Уловы по турам</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setCatches([
                          ...catches,
                          {
                            id: uid(),
                            round: 1,
                            lure: "",
                            lureText: "",
                            count: 1,
                          },
                        ])
                      }
                    >
                      ＋ Добавить улов
                    </button>
                  </div>
                  <p className="footnote">
                    Запишите приманку и любые заметки свободным текстом. Каталог
                    для записи улова не требуется.
                  </p>
                  {catches.map((c) => (
                    <div className="catch-row" key={c.id}>
                      <label>
                        Тур
                        <input
                          type="number"
                          required
                          min="1"
                          max={rounds}
                          step="1"
                          value={c.round}
                          onChange={(e) =>
                            setCatches(
                              catches.map((x) =>
                                x.id === c.id
                                  ? { ...x, round: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Приманка
                        <textarea
                          value={c.lureText ?? ""}
                          required
                          maxLength={2000}
                          rows={2}
                          placeholder="Например: 1089 60FS, розовая, медленная проводка"
                          onChange={(e) =>
                            setCatches(
                              catches.map((x) =>
                                x.id === c.id
                                  ? { ...x, lure: "", lureText: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Рыб
                        <input
                          type="number"
                          required
                          min="1"
                          step="1"
                          value={c.count}
                          onChange={(e) =>
                            setCatches(
                              catches.map((x) =>
                                x.id === c.id
                                  ? { ...x, count: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        aria-label="Удалить улов"
                        onClick={() =>
                          setCatches(catches.filter((x) => x.id !== c.id))
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <p className="footnote">
                    Тур без записанных уловов учитывается как нулевой.
                  </p>
                </>
              );
            })()}
          <div className="modal-bottom">
            <button type="button" onClick={close}>
              Отмена
            </button>
            <button className="primary" type="submit">
              Сохранить
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export default App;

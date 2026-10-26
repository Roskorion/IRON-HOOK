import { useEffect, useState } from "react";
import {
  parseItc,
  participantKey,
  summarizeItc,
  type ItcArchive,
  type ItcMode,
} from "./itc";
export default function ItcStats({ mode }: { mode: ItcMode }) {
  const [archive, setArchive] = useState<ItcArchive | null>(null),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [year, setYear] = useState(""),
    [selected, setSelected] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch(`${import.meta.env.BASE_URL}itc-archive.json`, {
      signal: abort.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error("HTTP");
        return r.json();
      })
      .then((d) => setArchive(parseItc(d)))
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "Не удалось загрузить статистику ITC. Обновите страницу. Личный дневник не изменён.",
          );
      });
    return () => abort.abort();
  }, []);
  if (error)
    return (
      <div className="notice error" role="alert">
        {error}
      </div>
    );
  if (!archive) return <p role="status">Загрузка статистики ITC…</p>;
  const allEvents = archive.events.filter((e) => e.mode === mode);
  const events = allEvents.filter((e) => !year || e.date.startsWith(year));
  const entities = [
    ...new Map(
      events
        .flatMap((e) => e.results)
        .map((r) => [participantKey(r.name), r.name]),
    ).entries(),
  ]
    .filter(([, name]) =>
      query
        .trim()
        .toLocaleLowerCase("ru")
        .replace(/ё/g, "е")
        .split(/\s+/)
        .every((q) => participantKey(name).includes(q)),
    )
    .sort((a, b) => a[1].localeCompare(b[1], "ru"));
  const current = entities.find(([id]) => id === selected) || entities[0];
  const history = current
    ? events
        .flatMap((e) => {
          const r = e.results.find(
            (r) => participantKey(r.name) === current[0],
          );
          return r ? [{ event: e, result: r }] : [];
        })
        .sort((a, b) => b.event.date.localeCompare(a.event.date))
    : [];
  const summary = summarizeItc(history.map((h) => h.result));
  const entity = mode === "team" ? "Команда" : "Спортсмен";
  return (
    <section
      className="itc-stats"
      aria-label={
        mode === "team" ? "Командная статистика ITC" : "Личная статистика ITC"
      }
    >
      <div className="notice">
        <span>
          Источник:{" "}
          <a href={archive.source} target="_blank" rel="noopener noreferrer">
            архив msk-trout.ru ↗
          </a>
          . Снимок данных: {archive.checkedAt}. В этом разделе{" "}
          {allEvents.length} опубликованных турниров ITC. Новые результаты
          появляются после обновления набора данных приложения; это не прямая
          трансляция.
        </span>
      </div>
      <div className="itc-filters">
        <label>
          {mode === "team" ? "Поиск команды" : "Поиск спортсмена"}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected("");
            }}
            placeholder={
              mode === "team" ? "Название команды" : "Фамилия или имя"
            }
          />
        </label>
        <label>
          Год
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
            }}
          >
            <option value="">Все годы</option>
            {[...new Set(allEvents.map((e) => e.date.slice(0, 4)))]
              .sort()
              .reverse()
              .map((y) => (
                <option key={y}>{y}</option>
              ))}
          </select>
        </label>
        <label>
          {entity}
          <select
            value={current?.[0] || ""}
            disabled={!entities.length}
            onChange={(e) => setSelected(e.target.value)}
          >
            {!entities.length && <option value="">Нет участников</option>}
            {entities.map(([id, name]) => (
              <option value={id} key={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!current ? (
        <p className="empty">
          Участник не найден в выбранных архивах. Измените поиск или год.
        </p>
      ) : (
        <>
          <div className="section-heading">
            <h2>{current[1]}</h2>
            <span className="badge">Данные из протоколов</span>
          </div>
          <div className="stats">
            {[
              [summary.events, "ТУРНИРОВ"],
              [summary.catches, "ПОИМОК"],
              [summary.games, "БОЁВ"],
              [`${summary.winRate.toFixed(1)}%`, "ДОЛЯ ПОБЕД"],
              [summary.best, "ЛУЧШЕЕ МЕСТО"],
              [summary.average.toFixed(1), "СРЕДНЕЕ МЕСТО"],
              [summary.points, "ОЧКИ ЗА БОИ"],
              [summary.podiums, "ПРИЗОВЫХ МЕСТ"],
            ].map(([n, label]) => (
              <div className="stat" key={label}>
                <span>{label}</span>
                <strong>{n}</strong>
              </div>
            ))}
          </div>
          <div className="panel itc-summary">
            <h2>Исходы боёв</h2>
            <div className="itc-outcomes">
              <span>
                Победы <b>{summary.wins}</b>
              </span>
              <span>
                Ничьи <b>{summary.draws}</b>
              </span>
              <span>
                Поражения <b>{summary.losses}</b>
              </span>
            </div>
            <p className="footnote">
              Доля побед = победы / все бои × 100%. Оба вида ничьих и поражений
              из протокола объединены. Очки суммируются как опубликовано;
              сезонный рейтинг не рассчитывается.
            </p>
          </div>
          <section className="panel">
            <h2>Результаты по турнирам</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Дата / турнир</th>
                    <th>Место</th>
                    <th>Бои</th>
                    <th>Поимки</th>
                    <th>П / Н / Пр</th>
                    <th>Очки</th>
                    <th>Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(({ event: e, result: r }) => (
                    <tr key={e.id}>
                      <td>
                        {new Date(e.date + "T12:00:00").toLocaleDateString(
                          "ru-RU",
                        )}
                        <br />
                        <b>{e.title}</b>
                        <br />
                        <span className="muted">{e.venue}</span>
                      </td>
                      <td>
                        {r.place} / {e.fieldSize}
                      </td>
                      <td>{r.games}</td>
                      <td>{r.catches}</td>
                      <td>
                        {r.wins} / {r.drawZero + r.drawFish} /{" "}
                        {r.lossFish + r.lossZero}
                      </td>
                      <td>{r.points}</td>
                      <td>
                        <a
                          href={e.protocolUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Протокол ↗
                        </a>
                        <br />
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Архив ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <p className="footnote">
        Включены только публикации организатора ITC, доступные на странице
        архива при проверке. Area Shop и WTF сюда не входят. Турниры разных лиг
        показаны с исходными названиями; лучшие и средние места относятся только
        к выбранным событиям. Виртуальные участники ВИ исключены из выбора.
        Место и размер поля сохранены из итогового протокола, даже если карточка
        архива указывает другое число участников. Полные тёзки без
        идентификатора в источнике могут не различаться; разные написания имени
        считаются разными участниками.
      </p>
    </section>
  );
}

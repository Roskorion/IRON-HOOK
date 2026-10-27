import { test, expect } from "@playwright/test";
const teamTab = "Командная статистика";
const personalTab = "Личная статистика";
test("командная статистика IRON HOOK совпадает с архивным протоколом", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: teamTab, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: teamTab, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Демонстрационный режим.", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Поиск команды", exact: true })
    .fill("iron hook");
  await expect(
    page.getByRole("heading", { name: "IRON HOOK", exact: true }),
  ).toBeVisible();
  const stat = (label: string) =>
    page
      .locator(".itc-stats .stat")
      .filter({ hasText: label })
      .locator("strong");
  await expect(stat("ТУРНИРОВ")).toHaveText("1");
  await expect(stat("ПОИМОК")).toHaveText("99");
  await expect(stat("БОЁВ")).toHaveText("9");
  await expect(stat("ЛУЧШЕЕ МЕСТО")).toHaveText("13");
  await expect(stat("ОЧКИ ЗА БОИ")).toHaveText("19");
  await expect(stat("ДОЛЯ ПОБЕД")).toHaveText("33.3%");
  await expect(page.locator(".itc-stats tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Протокол", exact: false }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/msk-trout\.ru\/images\/troutcalendar-results\/archive\//,
  );
  await page
    .getByRole("textbox", { name: "Поиск команды", exact: true })
    .fill("нет такой команды");
  await expect(
    page.getByText("Участник не найден", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("iron-hook-v1")),
  ).toBeNull();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("личная статистика суммирует турниры и считает долю побед по всем боям", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: personalTab, exact: true }).click();
  await page.getByRole("combobox", { name: "Организатор", exact: true }).selectOption("ITC");
  await page
    .getByRole("combobox", { name: "Спортсмен", exact: true })
    .selectOption({ label: "Пак Аркадий" });
  const stat = (label: string) =>
    page
      .locator(".itc-stats .stat")
      .filter({ hasText: label })
      .locator("strong");
  await expect(stat("ТУРНИРОВ")).toHaveText("3");
  await expect(stat("ПОИМОК")).toHaveText("229");
  await expect(stat("БОЁВ")).toHaveText("32");
  await expect(stat("ДОЛЯ ПОБЕД")).toHaveText("71.9%");
  await expect(stat("ОЧКИ ЗА БОИ")).toHaveText("105");
  await expect(stat("ЛУЧШЕЕ МЕСТО")).toHaveText("1");
  await expect(page.locator(".itc-stats tbody tr")).toHaveCount(3);
  const options = await page
    .getByRole("combobox", { name: "Спортсмен", exact: true })
    .locator("option")
    .allTextContents();
  expect(options.some((n) => /^ВИ[- ]?\d+$/.test(n))).toBeFalsy();
  await page
    .getByRole("combobox", { name: "Год", exact: true })
    .selectOption("2026");
  await expect(page.locator(".itc-stats tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: teamTab, exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Команда", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Спортсмен", exact: true }),
  ).toHaveCount(0);
});
test("проверенный набор архива содержит полные согласованные протоколы трёх организаторов", async ({
  request,
}) => {
  const r = await request.get("/itc-archive.json");
  expect(r.ok()).toBeTruthy();
  const data = await r.json();
  expect(data.events).toHaveLength(10);
  expect([...new Set(data.events.map((e: { organizer: string }) => e.organizer))].sort()).toEqual(["Area Shop", "ITC", "WTF"]);
  expect(
    data.events.filter((e: { mode: string }) => e.mode === "team"),
  ).toHaveLength(2);
  let rows = 0;
  for (const e of data.events) {
    expect(e.results).toHaveLength(e.participants);
    rows += e.results.length;
    expect(e.url).toMatch(
      /^https:\/\/msk-trout\.ru\/component\/troutcalendar\?/,
    );
    expect(e.protocolUrl).toMatch(
      /^https:\/\/msk-trout\.ru\/images\/troutcalendar-results\/archive\//,
    );
    expect(new Set(e.results.map((r: { name: string }) => r.name)).size).toBe(
      e.results.length,
    );
    for (const r of e.results) {
      expect(r.games).toBe(
        r.wins + r.drawZero + r.drawFish + r.lossFish + r.lossZero,
      );
      expect(r.points).toBe(4 * r.wins + 2 * r.drawFish + r.lossFish);
      expect(r.place).toBeLessThanOrEqual(e.fieldSize);
    }
  }
  expect(rows).toBe(568);
  const event = data.events.find((e: { id: string }) => e.id === "14");
  expect(event.participants).toBe(58);
  expect(event.fieldSize).toBe(60);
});
test("сбой загрузки архива не меняет личный дневник", async ({ page }) => {
  await page.route("**/itc-archive.json", (r) =>
    r.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: teamTab, exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось загрузить статистику",
  );
  await page
    .getByRole("button", { name: "Главная панель", exact: true })
    .click();
  await expect(page.locator(".stat").first().locator("strong")).toHaveText("2");
  expect(
    await page.evaluate(() => localStorage.getItem("iron-hook-v1")),
  ).toBeNull();
});

test("организатор фильтрует участников, турниры и суммы в обоих разделах", async ({ page, request }) => {
  const data = await (await request.get("/itc-archive.json")).json();
  // Synthetic organizer exists only in this test fixture, never in the published archive.
  const extra = structuredClone(data.events);
  for (const e of extra) {
    e.id = `fixture-${e.id}`;
    e.organizer = "Тестовый организатор";
    e.results.forEach((r: { name: string }) => { r.name = `Тест ${r.name}`; });
  }
  await page.route("**/itc-archive.json", route => route.fulfill({ json: { ...data, events: [...data.events, ...extra] } }));
  await page.goto("/");
  for (const tab of [teamTab, personalTab]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    const organizer = page.getByRole("combobox", { name: "Организатор", exact: true });
    const entity = page.getByRole("combobox", { name: tab === teamTab ? "Команда" : "Спортсмен", exact: true });
    await organizer.selectOption("Тестовый организатор");
    const names = await entity.locator("option").allTextContents();
    expect(names.length).toBeGreaterThan(0);
    expect(names.every(n => n.startsWith("Тест "))).toBeTruthy();
    await expect(page.locator(".itc-stats tbody tr").first()).toContainText("Тестовый организатор");
    await organizer.selectOption("ITC");
    expect((await entity.locator("option").allTextContents()).every(n => !n.startsWith("Тест "))).toBeTruthy();
    await expect(page.locator(".itc-stats tbody")).not.toContainText("Тестовый организатор");
    await organizer.selectOption("");
    expect(await entity.locator("option").count()).toBe(names.length * 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test("настоящие протоколы WTF и Area Shop доступны через фильтр организатора", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: personalTab, exact: true }).click();
  const organizer = page.getByRole("combobox", { name: "Организатор", exact: true });
  const athlete = page.getByRole("combobox", { name: "Спортсмен", exact: true });
  const stat = (label: string) => page.locator(".itc-stats .stat").filter({ hasText: label }).locator("strong");
  await organizer.selectOption("WTF");
  await athlete.selectOption({ label: "Зудов Артур" });
  await expect(stat("ПОИМОК")).toHaveText("53");
  await expect(stat("ЛУЧШЕЕ МЕСТО")).toHaveText("1");
  await expect(page.locator(".itc-stats tbody tr")).toHaveCount(1);
  await organizer.selectOption("Area Shop");
  await athlete.selectOption({ label: "Пак Аркадий" });
  await expect(stat("ПОИМОК")).toHaveText("225");
  await expect(stat("ТУРНИРОВ")).toHaveText("3");
  await expect(stat("БОЁВ")).toHaveText("32");
  await expect(page.locator(".itc-stats tbody tr")).toHaveCount(3);
  await organizer.selectOption("");
  await expect(stat("ПОИМОК")).toHaveText("454");
  await expect(stat("ТУРНИРОВ")).toHaveText("6");
  await page.getByRole("button", { name: teamTab, exact: true }).click();
  await page.getByRole("combobox", { name: "Организатор", exact: true }).selectOption("WTF");
  await expect(page.getByText("нет командных турниров", { exact: false })).toBeVisible();
  await expect(page.locator(".itc-stats .stat")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Команда", exact: true })).toBeDisabled();
});

import { test, expect } from "@playwright/test";
const fixture = [
  {
    lure: {
      id: "fixture-1",
      maker: "Тестовый производитель",
      model: "Тестовая модель",
      type: "Блесна",
      weight: 1.8,
      color: "Тестовый цвет",
      code: "TEST",
      photo: "",
    },
    source: "Onlyspin",
    url: "https://onlyspin.ru/test-fixture",
    checkedAt: "2026-10-26",
  },
];
test("библиотека: поиск, фильтры, перенос, защита от дублей и восстановление копии", async ({
  page,
}) => {
  await page.route("**/lure-library.json", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Тестовая модель" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Карточка на Onlyspin" }),
  ).toHaveAttribute("href", fixture[0].url);
  await page
    .getByRole("combobox", { name: "Источник", exact: true })
    .selectOption("Japsnasti");
  await expect(
    page.getByText("Ничего не найдено.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Источник", exact: true })
    .selectOption("Onlyspin");
  await page.getByLabel("Поиск в библиотеке").fill("TEST");
  await page.getByRole("button", { name: "Добавить в мой каталог" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Производитель", { exact: true }),
  ).toHaveValue("Тестовый производитель");
  await expect(page.getByRole("dialog").getByLabel("Вес, г")).toHaveValue(
    "1.8",
  );
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.getByRole("button", { name: "Добавить в мой каталог" }).click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Тестовая модель" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Уже в моём каталоге" }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "↓ Резервная копия", exact: true })
    .click();
  const path = await (await download).path();
  await page.locator("footer input[type=file]").setInputFiles(path!);
  await page
    .getByRole("button", { name: "Заменить данные и восстановить" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Резервная копия восстановлена",
  );
});
test("пустая или повреждённая библиотека не изменяет личный каталог", async ({
  page,
}) => {
  await page.route("**/lure-library.json", (r) => r.fulfill({ json: [] }));
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(
    page.getByText("Библиотека пока не наполнена:", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Мой каталог", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "MIU", exact: true }),
  ).toBeVisible();
  await page.route("**/lure-library.json", (r) =>
    r.fulfill({
      json: [{ ...fixture[0], url: "https://example.com/invalid" }],
    }),
  );
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось загрузить библиотеку",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("iron-hook-v1")),
  ).toBeNull();
});

test("библиотека исключает мягкие приманки и вес свыше 5 г, но сохраняет 5 г", async ({
  page,
}) => {
  const variants = [
    fixture[0],
    {
      ...fixture[0],
      lure: {
        ...fixture[0].lure,
        id: "boundary",
        model: "Ровно пять",
        weight: 5,
      },
    },
    {
      ...fixture[0],
      lure: { ...fixture[0].lure, id: "heavy", model: "Тяжёлая", weight: 5.01 },
    },
    {
      ...fixture[0],
      lure: {
        ...fixture[0].lure,
        id: "soft",
        model: "Мягкая",
        type: "Силикон",
        weight: 2,
      },
    },
  ];
  await page.route("**/lure-library.json", (r) =>
    r.fulfill({ json: variants }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Ровно пять" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Тяжёлая" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Мягкая" })).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Вес, г", exact: true })
    .selectOption("5");
  await expect(page.getByRole("heading", { name: "Ровно пять" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Тестовая модель" }),
  ).toHaveCount(0);
});

test("поставляемая библиотека содержит реальные варианты Onlyspin до 5 г", async ({
  page,
  request,
}) => {
  const response = await request.get("/lure-library.json");
  expect(response.ok()).toBeTruthy();
  const entries = await response.json();
  expect(entries.length).toBeGreaterThan(20);
  expect(
    new Set(entries.map((e: { lure: { id: string } }) => e.lure.id)).size,
  ).toBe(entries.length);
  for (const entry of entries) {
    expect(["Блесна", "Воблер", "Цикада"]).toContain(entry.lure.type);
    expect(entry.lure.weight).toBeGreaterThan(0);
    expect(entry.lure.weight).toBeLessThanOrEqual(5);
    expect(entry.source).toBe("Onlyspin");
    expect(entry.url).toMatch(/^https:\/\/onlyspin\.ru\/catalog\/product\//);
    expect(entry.lure.maker).not.toBe("");
    expect(entry.lure.model).not.toBe("");
    expect(entry.lure.code).not.toBe("");
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(
    page.getByText(`Найдено вариантов: ${entries.length}`, { exact: true }),
  ).toBeVisible();
  const first = page
    .locator('section[aria-label="Встроенная библиотека приманок"] article')
    .first();
  await expect(first).toContainText(entries[0].lure.model);
  await first.getByRole("button", { name: "Добавить в мой каталог" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Модель", { exact: true }),
  ).toHaveValue(entries[0].lure.model);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: entries[0].lure.model, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

import { test, expect } from "@playwright/test";
import {
  LIBRARY_TYPES,
  SOURCE_HOSTS,
  safeImage,
  type LibrarySource,
} from "../src/lures";
import type { Lure } from "../src/types";
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test.beforeEach(async ({ page }) => {
  await page.route(
    /^https:\/\/(?:www\.)?(?:onlyspin\.ru|jpsnasti\.ru|japan4you\.ru|baita\.ru)\//,
    (r) =>
      r.request().resourceType() === "image"
        ? r.fulfill({ contentType: "image/png", body: pixel })
        : r.fallback(),
  );
});
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
  await page.getByRole("button", { name: "＋ В МОЙ КАТАЛОГ" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "добавлена в МОЙ КАТАЛОГ",
  );
  await page.getByRole("button", { name: /Открыть МОЙ КАТАЛОГ/ }).click();
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

test("поставляемая библиотека содержит четыре источника и только твёрдые приманки до 5 г", async ({
  page,
  request,
}) => {
  const response = await request.get("/lure-library.json");
  expect(response.ok()).toBeTruthy();
  const entries = (await response.json()) as {
    lure: Lure;
    source: LibrarySource;
    url: string;
  }[];
  expect(entries.length).toBeGreaterThan(20);
  expect(
    entries.filter((e: { source: string }) => e.source === "Onlyspin").length,
  ).toBeGreaterThan(20);
  expect(
    entries.filter((e: { source: string }) => e.source === "Japsnasti").length,
  ).toBeGreaterThan(100);
  expect(
    new Set(entries.map((e: { lure: { id: string } }) => e.lure.id)).size,
  ).toBe(entries.length);
  for (const source of Object.keys(SOURCE_HOSTS))
    expect(entries.some((e) => e.source === source)).toBeTruthy();
  expect(
    entries.every(
      (e) =>
        (LIBRARY_TYPES as readonly string[]).includes(e.lure.type) &&
        e.lure.weight > 0 &&
        e.lure.weight <= 5 &&
        e.lure.maker &&
        e.lure.model &&
        e.lure.code &&
        safeImage(e.lure.photo) &&
        new URL(e.url).protocol === "https:" &&
        SOURCE_HOSTS[e.source].includes(new URL(e.url).hostname),
    ),
  ).toBeTruthy();
  for (const type of LIBRARY_TYPES)
    expect(entries.some((e) => e.lure.type === type)).toBeTruthy();
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
  await first.getByRole("button", { name: "＋ В МОЙ КАТАЛОГ" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
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

test("источник Japsnasti использует правильный домен jpsnasti.ru", async ({
  page,
}) => {
  const entry = {
    ...fixture[0],
    source: "Japsnasti",
    url: "https://www.jpsnasti.ru/test-fixture",
  };
  await page.route("**/lure-library.json", (r) => r.fulfill({ json: [entry] }));
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Карточка на Japsnasti" }),
  ).toHaveAttribute("href", entry.url);
  await page.getByRole("button", { name: "Мой каталог", exact: true }).click();
  await page.route("**/lure-library.json", (r) =>
    r.fulfill({
      json: [{ ...entry, url: "https://www.japsnasti.ru/test-fixture" }],
    }),
  );
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось загрузить библиотеку",
  );
});

test("библиотека показывает по 24 варианта, поиск сбрасывает номер страницы", async ({
  page,
}) => {
  const entries = Array.from({ length: 26 }, (_, i) => ({
    ...fixture[0],
    lure: { ...fixture[0].lure, id: `page-${i}`, model: `Модель ${i + 1}` },
  }));
  await page.route("**/lure-library.json", (r) => r.fulfill({ json: entries }));
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  const library = page.getByRole("region", {
    name: "Встроенная библиотека приманок",
  });
  await expect(library.locator("article")).toHaveCount(24);
  await expect(
    page.getByRole("button", { name: "Предыдущая страница", exact: false }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Следующая страница", exact: false })
    .click();
  await expect(library.locator("article")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Модель 25", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Следующая страница", exact: false }),
  ).toBeDisabled();
  await page.getByLabel("Поиск в библиотеке").fill("Модель 3");
  await expect(
    page.getByRole("heading", { name: "Модель 3", exact: true }),
  ).toBeVisible();
  await expect(library.locator("article")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("шесть категорий, фото из магазина и восстановление копии с новым типом", async ({
  page,
}) => {
  const types = ["Блесна", "Воблер", "Кренк", "Цикада", "Виб", "Раттлин"];
  const entries = types.map((type, i) => ({
    ...fixture[0],
    source: i % 2 ? "Baita" : "Japan4you",
    url:
      i % 2
        ? "https://baita.ru/product/test/"
        : "https://japan4you.ru/products/test",
    lure: {
      ...fixture[0].lure,
      id: `category-${i}`,
      type,
      model: `Вариант ${type}`,
      photo: "https://japan4you.ru/files/downloads/test.jpg",
    },
  }));
  await page.route("**/lure-library.json", (r) => r.fulfill({ json: entries }));
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  for (const [category, type] of [
    ["Блёсны", "Блесна"],
    ["Воблеры", "Воблер"],
    ["Кренки", "Кренк"],
    ["Цикады", "Цикада"],
    ["Вибы", "Виб"],
    ["Раттлины", "Раттлин"],
  ]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: `Вариант ${type}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(
        'section[aria-label="Встроенная библиотека приманок"] article',
      ),
    ).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Кренки", exact: true }).click();
  const image = page.locator(
    'section[aria-label="Встроенная библиотека приманок"] img',
  );
  await expect(image).toHaveAttribute(
    "src",
    "https://japan4you.ru/files/downloads/test.jpg",
  );
  await expect
    .poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "＋ В МОЙ КАТАЛОГ" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("iron-hook-v1")!).lures.find(
          (l: { model: string }) => l.model === "Вариант Кренк",
        ).type,
    ),
  ).toBe("Кренк");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "↓ Резервная копия", exact: true })
    .click();
  const path = await (await download).path();
  await page.locator("footer input[type=file]").setInputFiles(path!);
  await page
    .getByRole("button", { name: "Заменить данные и восстановить" })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Вариант Кренк" }),
  ).toBeVisible();
  await expect(
    page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Вариант Кренк" }) })
      .locator("img"),
  ).toHaveAttribute("src", "https://japan4you.ru/files/downloads/test.jpg");
});

test("недоступная фотография показывает заглушку, посторонний домен отклоняется", async ({
  page,
}) => {
  const entry = {
    ...fixture[0],
    source: "Baita",
    url: "https://baita.ru/product/test/",
    lure: {
      ...fixture[0].lure,
      photo: "https://baita.ru/wp-content/uploads/test.jpg",
    },
  };
  await page.route(entry.lure.photo, (r) => r.abort());
  await page.route("**/lure-library.json", (r) => r.fulfill({ json: [entry] }));
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(
    page.getByText("Фото недоступно", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Мой каталог", exact: true }).click();
  await page.route("**/lure-library.json", (r) =>
    r.fulfill({
      json: [
        {
          ...entry,
          lure: { ...entry.lure, photo: "https://example.com/track.jpg" },
        },
      ],
    }),
  );
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось загрузить библиотеку",
  );
});

test("1089 60FS присутствует с фото Onlyspin и находится по раздельным словам", async ({
  page,
  request,
}) => {
  const entries = await (await request.get("/lure-library.json")).json();
  const variants = entries.filter(
    (e: { source: string; lure: Lure }) =>
      e.source === "Onlyspin" &&
      e.lure.maker === "1089" &&
      /60FS/i.test(e.lure.model),
  );
  expect(variants.length).toBeGreaterThan(0);
  expect(
    variants.every(
      (e: { lure: Lure }) =>
        e.lure.weight > 0 &&
        e.lure.weight <= 5 &&
        e.lure.photo.startsWith("https://onlyspin.ru/upload/"),
    ),
  ).toBeTruthy();
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Источник", exact: true })
    .selectOption("Onlyspin");
  await page.getByLabel("Поиск в библиотеке").fill("1089 60FS");
  await expect(
    page.getByText(`Найдено вариантов: ${variants.length}`, { exact: true }),
  ).toBeVisible();
  const card = page
    .locator('section[aria-label="Встроенная библиотека приманок"] article')
    .first();
  await expect(card).toContainText("60FS");
  await expect(card.locator("img")).toHaveAttribute(
    "src",
    /lure-photos\//,
  );
  await expect
    .poll(() =>
      card.locator("img").evaluate((i) => (i as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await card.getByRole("button", { name: "＋ В МОЙ КАТАЛОГ" }).click();
  await page.getByRole("button", { name: /Открыть МОЙ КАТАЛОГ/ }).click();
  await page
    .getByPlaceholder("Поиск по модели, производителю или цвету…")
    .fill("1089 60fs");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article")).toContainText("60FS");
});

test("фото ранее сохранённой приманки добавляется без дубля и без замены своих фото", async ({
  page,
}) => {
  await page.route("**/lure-library.json", (r) => r.fulfill({ json: fixture }));
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await page.getByRole("button", { name: "＋ В МОЙ КАТАЛОГ" }).click();
  await page.getByRole("button", { name: /Открыть МОЙ КАТАЛОГ/ }).click();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("iron-hook-v1")!).lures,
  );
  const entry = {
    ...fixture[0],
    lure: {
      ...fixture[0].lure,
      photo: "https://onlyspin.ru/upload/test-450.jpg",
    },
  };
  await page.route("**/lure-library.json", (r) => r.fulfill({ json: [entry] }));
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Добавить фото в мой каталог", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Фото добавлено");
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("iron-hook-v1")!).lures,
  );
  expect(after).toHaveLength(before.length);
  const saved = after.find((l: Lure) => l.model === entry.lure.model);
  expect(saved).toEqual({
    ...before.find((l: Lure) => l.id === saved.id),
    photo: entry.lure.photo,
  });
  await expect(
    page.getByRole("button", { name: "Уже в моём каталоге", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Мой каталог", exact: true }).click();
  await expect(
    page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Тестовая модель" }) })
      .locator("img"),
  ).toHaveAttribute("src", entry.lure.photo);
  // A subsequent library photo must not overwrite the existing photo.
  await page.route("**/lure-library.json", (r) =>
    r.fulfill({
      json: [
        {
          ...entry,
          lure: {
            ...entry.lure,
            photo: "https://onlyspin.ru/upload/another.jpg",
          },
        },
      ],
    }),
  );
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Уже в моём каталоге", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("iron-hook-v1")!).lures.find(
          (l: { model: string }) => l.model === "Тестовая модель",
        ).photo,
    ),
  ).toBe(entry.lure.photo);
});

test("разные расцветки добавляются одним нажатием и остаются после обновления", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const entries = [
    fixture[0],
    {
      ...fixture[0],
      lure: {
        ...fixture[0].lure,
        id: "other-color",
        color: "Другой цвет",
        code: "OTHER",
      },
    },
  ];
  await page.route("**/lure-library.json", (r) => r.fulfill({ json: entries }));
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await page
    .getByRole("button", { name: "＋ В МОЙ КАТАЛОГ", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Уже в моём каталоге", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "＋ В МОЙ КАТАЛОГ", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Уже в моём каталоге", exact: true }),
  ).toHaveCount(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /Открыть МОЙ КАТАЛОГ/ }).click();
  await expect(
    page.getByRole("heading", { name: "Тестовая модель", exact: true }),
  ).toHaveCount(2);
  await page.reload();
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Тестовая модель", exact: true }),
  ).toHaveCount(2);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("iron-hook-v1")!).lures.filter(
      (l: { model: string }) => l.model === "Тестовая модель",
    ),
  );
  expect(new Set(saved.map((l: Lure) => l.id)).size).toBe(2);
  expect(saved.map((l: Lure) => l.code).sort()).toEqual(["OTHER", "TEST"]);
  expect(consoleErrors.filter((text) => text.includes("same key"))).toEqual([]);
});

test("ошибка сохранения не показывает ложное добавление в каталог", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "iron-hook-v1")
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  await page.route("**/lure-library.json", (r) => r.fulfill({ json: fixture }));
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page
    .getByRole("button", { name: "Встроенная библиотека", exact: true })
    .click();
  await page
    .getByRole("button", { name: "＋ В МОЙ КАТАЛОГ", exact: true })
    .click();
  await expect(
    page.getByText("Не удалось сохранить данные:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "＋ В МОЙ КАТАЛОГ", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Уже в моём каталоге", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("iron-hook-v1")),
  ).toBeNull();
});

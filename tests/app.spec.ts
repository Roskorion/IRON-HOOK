import { test, expect } from "@playwright/test";
test("приманка, дневник, статистика и сохранение", async ({ page }) => {
  await page.goto("/");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Очистить базу" }).click();
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page.getByRole("button", { name: "Добавить приманку" }).click();
  await page.getByLabel("Производитель").fill("Test brand");
  await page.getByLabel("Модель").fill("Winner");
  await page.getByLabel("Цвет", { exact: true }).fill("Красный");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Winner" })).toBeVisible();
  await page
    .getByRole("button", { name: "Дневник рыбалок", exact: true })
    .click();
  await page.getByRole("button", { name: "Новая рыбалка" }).click();
  await page.getByLabel("Водоём").fill("Наш пруд");
  await page.getByLabel("Количество туров").fill("2");
  await page.getByRole("button", { name: "Добавить улов" }).click();
  await page.getByLabel("Приманка", { exact: true }).fill("Test brand Winner");
  await page.getByLabel("Рыб", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Наш пруд" })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Главная панель", exact: true })
    .click();
  await expect(page.locator(".stat").nth(1).locator("strong")).toHaveText("5");
  await expect(page.locator(".stat").nth(2).locator("strong")).toHaveText(
    "2.5",
  );
  await page.getByRole("button", { name: "Аналитика", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Наш пруд", exact: false }),
  ).toBeVisible();
  await expect(page.locator(".bars").first()).toContainText(
    "Test brand Winner",
  );
  await page
    .getByRole("button", { name: "Дневник рыбалок", exact: true })
    .click();
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  await page.getByLabel("Рыб", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("7 рыб", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Наш пруд" })).toHaveCount(0);
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Winner" })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("снасти и комплекты редактируются и сохраняются", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Снасти и комплекты", exact: true })
    .click();
  await page.getByRole("button", { name: "Добавить снасть" }).click();
  await page.getByLabel("Название", { exact: true }).fill("Мой спиннинг");
  await page.getByLabel("Характеристики").fill("Тест 0.5–5 г");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("button", { name: "Создать комплект" }).click();
  await page.getByLabel("Название комплекта").fill("Мой комплект");
  await page
    .getByRole("combobox", { name: "Спиннинг", exact: true })
    .selectOption({ label: "Мой спиннинг" });
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Снасти и комплекты", exact: true })
    .click();
  const kit = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Мой комплект" }) });
  await expect(kit).toContainText("Мой спиннинг");
  await kit.getByRole("button", { name: "Изменить" }).click();
  await page.getByLabel("Название комплекта").fill("Турнирный комплект");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Турнирный комплект" }),
  ).toBeVisible();
});

test("резервная копия: экспорт, отмена и восстановление после очистки", async ({
  page,
}) => {
  await page.goto("/");
  const original = await page.evaluate(() => {
    // Сохраняем исходную тестовую базу через действие приложения ниже.
    return localStorage.getItem("iron-hook-v1");
  });
  expect(original).toBeNull();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "↓ Резервная копия", exact: true })
    .click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Очистить базу" }).click();
  await page.locator("footer input[type=file]").setInputFiles(path!);
  const dialog = page.getByRole("dialog", {
    name: "Восстановление резервной копии",
  });
  await expect(dialog).toContainText(
    "2 рыбалок, 3 приманок, 4 снастей, 1 комплектов",
  );
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.locator(".stat").first().locator("strong")).toHaveText("0");
  await page.locator("footer input[type=file]").setInputFiles(path!);
  await dialog
    .getByRole("button", { name: "Заменить данные и восстановить" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Резервная копия восстановлена",
  );
  await page.reload();
  await expect(page.locator(".stat").first().locator("strong")).toHaveText("2");
  await expect(page.locator(".stat").nth(1).locator("strong")).toHaveText("20");
  await page
    .getByRole("button", { name: "Снасти и комплекты", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Лёгкий старт" }),
  ).toBeVisible();
});

test("ошибочные файлы не меняют дневник; восстановление повреждённого хранилища", async ({
  page,
}) => {
  await page.goto("/");
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "↓ Резервная копия", exact: true })
    .click();
  const path = await (await downloadEvent).path();
  // Получаем действительную копию, чтобы проверить отдельные виды повреждения.
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(path!, "utf8");
  const original = JSON.parse(raw);
  for (const payload of [
    "{broken",
    JSON.stringify({ lures: [], gear: [], kits: [], trips: [{}] }),
    JSON.stringify({
      ...original,
      lures: [...original.lures, original.lures[0]],
    }),
    JSON.stringify({
      ...original,
      trips: [
        {
          ...original.trips[0],
          catches: [{ id: "bad", round: 9, lure: "missing", count: -1 }],
        },
      ],
    }),
  ]) {
    await page.locator("footer input[type=file]").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(payload),
    });
    await expect(page.getByRole("alert")).toContainText(
      "Текущие записи не изменены",
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".stat").first().locator("strong")).toHaveText(
      "2",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("iron-hook-v1")),
    ).toBeNull();
  }
  await page.locator("footer input[type=file]").setInputFiles({
    name: "large.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 32),
  });
  await expect(page.getByRole("alert")).toContainText("Файл слишком большой");
  await page.evaluate(() => localStorage.setItem("iron-hook-v1", "{broken"));
  await page.reload();
  await page.locator("footer input[type=file]").setInputFiles(path!);
  await page
    .getByRole("button", { name: "Заменить данные и восстановить" })
    .click();
  await page.reload();
  await expect(
    page.getByText("Не удалось прочитать сохранённые данные.", {
      exact: false,
    }),
  ).toHaveCount(0);
  expect(
    JSON.parse(
      (await page.evaluate(() => localStorage.getItem("iron-hook-v1")))!,
    ),
  ).toEqual(original);
});

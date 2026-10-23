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

import { test, expect } from "@playwright/test";

test("свободная запись без каталога сохраняется, редактируется и восстанавливается", async ({
  page,
}) => {
  await page.goto("/");
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Очистить базу", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Дневник рыбалок", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Новая рыбалка", exact: false })
    .click();
  await page.getByLabel("Водоём").fill("Свободная запись");
  await expect(
    page.getByRole("button", { name: "Добавить улов" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Добавить улов" }).click();
  const note = "1089 60FS, цвет NDM-01\nМедленная проводка с паузами";
  const field = page.getByRole("textbox", { name: "Приманка", exact: true });
  await expect(field).toHaveJSProperty("tagName", "TEXTAREA");
  await expect(
    page.getByRole("combobox", { name: "Приманка", exact: true }),
  ).toHaveCount(0);
  await field.fill(note);
  await page.getByLabel("Рыб", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator(".rounds")).toContainText(note);
  await page.reload();
  await page
    .getByRole("button", { name: "Главная панель", exact: true })
    .click();
  await expect(page.locator(".stat").nth(1).locator("strong")).toHaveText("4");
  await expect(page.locator(".bars").first()).toContainText("1089 60FS");
  await page
    .getByRole("button", { name: "Дневник рыбалок", exact: true })
    .click();
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Приманка", exact: true }),
  ).toHaveValue(note);
  await page
    .getByRole("textbox", { name: "Приманка", exact: true })
    .fill(note + " · смена горизонта");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("iron-hook-v1")!),
  );
  expect(before.lures).toHaveLength(0);
  expect(before.trips[0].catches[0].lureText).toBe(note + " · смена горизонта");
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
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("iron-hook-v1")!),
    ),
  ).toEqual(before);
  // An empty comment without a catalogue reference is invalid and must not replace data.
  const invalid = {
    ...before,
    trips: [
      {
        ...before.trips[0],
        catches: [{ ...before.trips[0].catches[0], lureText: "   " }],
      },
    ],
  };
  await page
    .locator("footer input[type=file]")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
  await expect(page.getByRole("alert")).toContainText(
    "Текущие записи не изменены",
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("iron-hook-v1")!),
    ),
  ).toEqual(before);
});

test("старые уловы сохраняют названия и связи, при изменении названия становятся текстовыми", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Дневник рыбалок", exact: true })
    .click();
  const trip = page
    .locator(".trip-list > section")
    .filter({
      has: page.getByRole("heading", { name: "Тестовый пруд «Арена»" }),
    });
  await trip.getByRole("button", { name: "Изменить", exact: true }).click();
  const field = page
    .getByRole("textbox", { name: "Приманка", exact: true })
    .first();
  await expect(field).toHaveValue(/Forest MIU.*Розовый/);
  await page.getByLabel("Рыб", { exact: true }).first().fill("6");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("iron-hook-v1")!).trips.find(
          (t: { id: string }) => t.id === "t1",
        ).catches[0].lure,
    ),
  ).toBe("l1");
  await trip.getByRole("button", { name: "Изменить", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Приманка", exact: true })
    .first()
    .fill("Самодельная блесна, серебро");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.reload();
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("iron-hook-v1")!).trips.find(
        (t: { id: string }) => t.id === "t1",
      ).catches[0],
  );
  expect(saved.lure).toBe("");
  expect(saved.lureText).toBe("Самодельная блесна, серебро");
});

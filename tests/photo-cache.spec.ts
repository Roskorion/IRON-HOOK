import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
const photos = JSON.parse(readFileSync("src/lure-photo-cache.json", "utf8"));

test("фотографии Onlyspin поставляются с приложением без запросов в магазин", async ({ page }) => {
  const rows = JSON.parse(readFileSync("public/lure-library.json", "utf8"));
  const cache: Record<string, string> = photos;
  for (const row of rows.filter((r: { source: string }) => r.source === "Onlyspin")) {
    expect(cache[row.lure.photo]).toBeTruthy();
    expect(existsSync(`public/${cache[row.lure.photo]}`)).toBe(true);
  }
  const remote: string[] = [];
  page.on("request", request => {
    if (request.resourceType() === "image" && request.url().includes("onlyspin.ru")) remote.push(request.url());
  });
  await page.route("https://onlyspin.ru/**", route => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await page.getByRole("button", { name: "Встроенная библиотека", exact: true }).click();
  const image = page.locator('img[src*="lure-photos/"]').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "＋ В МОЙ КАТАЛОГ", exact: true }).first().click();
  await page.getByRole("button", { name: /Открыть МОЙ КАТАЛОГ/ }).click();
  await expect(page.locator('img[src*="lure-photos/"]').first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Приманки", exact: true }).click();
  await expect.poll(() => page.locator('img[src*="lure-photos/"]').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(remote).toEqual([]);
});

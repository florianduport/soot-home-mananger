import { expect, test } from "@playwright/test";

test.describe("Calendar feed", () => {
  test("requires a token", async ({ request }) => {
    const response = await request.get("/api/calendar/feed");
    expect(response.status()).toBe(400);
  });

  test("rejects unknown tokens", async ({ request }) => {
    const response = await request.get("/api/calendar/feed?token=invalidtoken123");
    expect(response.status()).toBe(404);
  });
});

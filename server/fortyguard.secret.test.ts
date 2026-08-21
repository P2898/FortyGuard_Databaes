import { describe, expect, it } from "vitest";

describe("FORTYGUARD_API_KEY", () => {
  it("is accepted by the lightweight credits endpoint when configured", async () => {
    const apiKey = process.env.FORTYGUARD_API_KEY;
    expect(apiKey, "FORTYGUARD_API_KEY must be configured").toBeTruthy();

    const response = await fetch("https://api.fortyguard.com/v1/system/fetch-api-key-usage", {
      headers: { "api-key": apiKey as string },
    });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  }, 20_000);
});

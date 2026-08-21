import { describe, expect, it } from "vitest";
import { complianceFlags, detectAnomalies, recommendationFor, scoreSite } from "./heat";

describe("industrial heat risk engine", () => {
  it("returns the exact required risk tier labels", () => {
    const site = { id: "1", name: "Plant", lat: 37, lon: -121 };
    const result = scoreSite(site, 43, 12, 8, true);
    expect(["Critical", "High", "Moderate", "Low"]).toContain(result.riskTier);
    expect(result.riskScore).toBeGreaterThan(0);
  });

  it("flags IQR outliers as anomalies", () => {
    const result = detectAnomalies([30, 30.5, 31, 31.5, 32, 47]);
    expect(result.flags.at(-1)).toBe(true);
    expect(result.upper).toBeGreaterThan(32);
  });

  it("supports the OSHA 35 C and UAE 45 C governance examples", () => {
    const flags = complianceFlags(46);
    expect(flags.find(flag => flag.code === "OSHA_35C")?.triggered).toBe(true);
    expect(flags.find(flag => flag.code === "UAE_45C")?.triggered).toBe(true);
  });

  it("uses plain-language action recommendations", () => {
    expect(recommendationFor({ riskTier: "Critical", peakTemperatureC: 45, exceedanceHours: 8, persistenceHours: 4 })).toContain("Halt outdoor work");
    expect(recommendationFor({ riskTier: "High", peakTemperatureC: 40, exceedanceHours: 5, persistenceHours: 3 })).toContain("mobile cooling unit");
  });
});

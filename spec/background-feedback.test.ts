import { describe, expect, it } from "vitest";
import {
  randomShieldBlockFlashColour,
  SHIELD_BLOCK_FLASH_HUES,
} from "../background-feedback";

describe("background collision feedback", () => {
  it("selects colours across the shield-block palette", () => {
    expect(randomShieldBlockFlashColour(() => 0)).toContain("192");
    expect(randomShieldBlockFlashColour(() => 0.42)).toContain("215");
    expect(randomShieldBlockFlashColour(() => 0.999999)).toContain("49");
  });

  it("keeps every shield-block colour outside the red hue ranges", () => {
    expect(new Set(SHIELD_BLOCK_FLASH_HUES).size).toBeGreaterThan(3);

    for (const hue of SHIELD_BLOCK_FLASH_HUES) {
      expect(hue).toBeGreaterThanOrEqual(40);
      expect(hue).toBeLessThanOrEqual(320);
    }
  });
});

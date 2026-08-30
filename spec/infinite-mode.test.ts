import { describe, expect, it } from "vitest";
import { collectRepairPickup } from "../infinite-rules";

describe("infinite mode repair charge", () => {
  it("fills by half, then restores one integrity point", () => {
    const halfCharged = collectRepairPickup(0, 1, 3);
    expect(halfCharged).toEqual({
      charge: 0.5,
      integrity: 1,
      repaired: false,
    });

    expect(
      collectRepairPickup(halfCharged.charge, halfCharged.integrity, 3),
    ).toEqual({ charge: 0, integrity: 2, repaired: true });
  });

  it("never raises integrity above the life-bar maximum", () => {
    expect(collectRepairPickup(0.5, 3, 3)).toEqual({
      charge: 0,
      integrity: 3,
      repaired: false,
    });
  });
});

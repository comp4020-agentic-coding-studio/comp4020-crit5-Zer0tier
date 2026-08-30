import { describe, expect, it } from "vitest";
import { shieldBlocks, shieldContactState } from "../game-rules";

describe("shield collision window", () => {
  it("keeps working after the shield accumulates two full rotations", () => {
    // 118° and 838° point in exactly the same direction. This is the state
    // reached by the seventh clockwise interception in the real spawn order.
    expect(shieldBlocks(118, 838, 31)).toBe(true);
  });

  it("keeps a meteor blockable until its painted body has cleared the shield", () => {
    const contact = {
      previousDistance: 105,
      shieldRadius: 100,
      projectileRadius: 8,
      shieldHalfWidth: 4,
      shieldHalfArc: 31,
    };

    expect(
      shieldContactState({
        ...contact,
        distance: 95,
        projectileAngle: 50,
        shieldAngle: 0,
      }),
    ).toBe("overlapping");

    expect(
      shieldContactState({
        ...contact,
        distance: 94,
        projectileAngle: 50,
        shieldAngle: 50,
      }),
    ).toBe("blocked");

    expect(
      shieldContactState({
        ...contact,
        distance: 87,
        projectileAngle: 50,
        shieldAngle: 0,
      }),
    ).toBe("passed");
  });
});

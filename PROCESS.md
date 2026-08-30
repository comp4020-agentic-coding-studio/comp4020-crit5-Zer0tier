# Process overview

## What I built

Orbital Shield is a wordless pointer-agility game. A white arc follows the
player around a vulnerable core: angular red meteors must be intercepted, while
round green energy must pass through. Standard mode ends at three impacts or
ten absorbed orbs; Infinite mode swaps the win condition for survival against
curving "spiral" meteors and blue repair pickups, scored by a combo/rank meter.
Pause, a mutable background piano score and viewport-scaled particle effects
round out the session without adding a single word of on-screen instruction.

## The moments that mattered

1. **A convention holds only as far as it was tested.** The shield-angle
   wrap-around had been correct for one rotation and wrong for two: after the
   seventh clockwise block the signed modulo left a stale negative remainder,
   so a literally-correct block could miss. No existing fixture crossed 360°,
   so nothing caught it until I wrote one that deliberately did — 118° and
   838° point the same direction and must both block — watched it fail,
   fixed the double-modulo, and kept the fixture in
   [`21950b7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Zer0tier/commit/21950b7).

2. **A grace window replaced a rate limit.** Adding spiral meteors meant a
   projectile could sit inside the core's damage radius across several
   frames, registering as several stacked hits from one visible impact. Rather
   than throttling `damageCore()`, I made damage itself inert for a short
   recovery window (`coreCanTakeDamage`), the same fix pattern as capping how
   many times one source can spawn — bound the cause, not the symptom — in
   the same commit.

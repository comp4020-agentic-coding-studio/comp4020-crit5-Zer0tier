# Process overview

## What I built

Orbital Shield is a wordless pointer-agility game. A white shield arc intercepts
angular red meteors, while round green energy must reach the core. Standard
mode ends after three impacts or ten
absorbed orbs. Infinite mode extends that rule with curving meteors, repair
pickups, combo ranks and escalating pressure. Sound, motion and immediate
consequences teach the game without an instruction screen.

## The moments that mattered

1. **The rendered game overruled my collision geometry.** My first pure
   angular rule was easy to test, but viewport play showed that correctness on
   paper was not fairness on screen. At 390×844, meteors spent too long outside
   the viewport; a near-edge meteor visibly touched the
   rounded shield but still caused damage. I spawned each projectile from its
   actual viewport edge and added seven degrees of collision forgiveness, then
   replayed the 28° case at 1920×1080 and 390×844. Both preserved all three lives
   ([`82d9568`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Zer0tier/commit/82d9568)).
   A later cold playthrough exposed a temporal version of the problem: moving
   the shield onto a still-overlapping meteor did nothing because collision was
   checked for only one frame. I replaced that checkpoint with a radial contact
   window and pinned the behaviour with a regression fixture
   ([`f4b6665`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Zer0tier/commit/f4b6665)).

2. **Infinite mode tested assumptions the short game never reached.** On the
   seventh clockwise interception, the shield angle had accumulated to 838°;
   JavaScript's signed remainder no longer treated it like the equivalent 118°
   direction. I wrote that equivalence as a literal failing fixture before
   fixing the normalisation with a double modulo. Curving meteors also remained
   inside the core across several frames, turning one visible impact into
   several hits. A short recovery window made damage one event per impact. The
   feature and both boundary checks landed together in
   [`21950b7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Zer0tier/commit/21950b7).

# Process overview

## What I built

Orbital Shield is a wordless pointer-agility game. A white arc follows the
player around a vulnerable core: angular red meteors must be intercepted, while
round green energy must pass through. Three impacts lose; ten absorbed orbs win.
The contrast in shape, colour, sound and consequence teaches the second rule
inside play rather than through an explanation.

## The moments that mattered

1. **I constrained the concept before expanding it.** I treated the supplied
   direction—“A glowing core sits mid-screen. A white shield arc … tracking the
   player's mouse cursor”—as the single mechanic, then grounded it against the
   published brief and local contract tests. Collision became a pure angular
   function with a literal wrap-around fixture. I inverted that function,
   watched the fixture fail, restored it and ran all checks green before
   accepting [`a832dbd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Zer0tier/commit/a832dbd).

2. **Rendering changed the rule.** At 390×844, the first meteor spent most of
   its approach outside the screen because spawning used the desktop diagonal;
   I changed it to the relevant viewport edge. Then a 28° near-edge aim looked
   like contact but lost against the 24° drawn arc. After adding seven degrees
   of collision forgiveness, the same play probe preserved all three lives at
   both 1920×1080 and 390×844. The browser audit also reported no overflow,
   runtime errors or axe violations. Those play-led corrections are captured in
   [`82d9568`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Zer0tier/commit/82d9568).
   A later cold play report exposed a temporal version of the same mismatch:
   the one-frame collision checkpoint ignored a shield moved onto a still-
   overlapping meteor. I kept collision active across the painted overlap
   window and captured that exact correction in a regression fixture at
   [`f4b6665`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Zer0tier/commit/f4b6665).

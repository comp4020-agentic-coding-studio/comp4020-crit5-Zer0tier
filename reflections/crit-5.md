# Crit 5 reflection

The breakthrough was realising that the collision rule and the collision
experience were two different artefacts. My angular fixture could prove that a
meteor centre fell inside a twenty-four-degree arc, but it could not see the
meteor's body, the shield's rounded cap or its glow. Playing a near-edge case
made the mismatch immediate: it looked blocked and still removed a life. Keeping
the drawn arc narrow while widening the collision arc by seven degrees aligned
the rule with the image instead of forcing the player to obey invisible
centre-line geometry.

The mobile render produced the same lesson at a larger scale. A shared radial
spawn distance sounded consistent in code, yet a horizontal meteor remained
offscreen much longer on a portrait viewport. Spawning from the actual edge in
its direction gave both viewports comparable reaction time. Neither correction
would have come from reading the implementation or celebrating a green test
suite.

This work makes me want to be a developer who treats tests as precise but
partial witnesses. I want to state deterministic rules clearly enough to test,
then deliberately inspect the layers those rules cannot observe: perception,
timing, aspect ratio and fairness. The goal is not merely code that agrees with
itself, but an experience whose feedback earns the player's trust.

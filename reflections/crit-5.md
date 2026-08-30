# Crit 5 reflection

The breakthrough was realising that a rule can be provably correct against
every fixture it has ever met and still be wrong. My original wrap-around
fixture proved the shield blocked at any single-rotation angle; it said
nothing about what happens after the shield turns twice, because nothing I'd
written asked that question. The double-modulo bug only existed in that unasked
region. It stayed invisible under a fully green suite until I deliberately
wrote a fixture that crossed 360°, which is the same lesson as the first
collision bug in a stricter form: passing tests describe the cases you thought
to write, not the cases that are true.

Extending the game into Infinite mode produced a smaller version of the same
pattern. A spiralling meteor can overlap the core's damage radius for several
consecutive frames, and a naive read of "damage on overlap" fires once per
frame rather than once per hit. The fix wasn't a cooldown bolted on afterwards;
it was making the core briefly unable to take damage at all, so one visible
impact is structurally one event no matter how many frames it spans.

This makes me want to keep asking what region of behaviour my fixtures have
never visited, especially right after a feature changes what "normal" input
looks like — a new game mode, a new projectile type, a longer play session. A
green suite is evidence about the past, not a claim about the input I haven't
tried yet.

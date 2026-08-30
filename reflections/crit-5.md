# Crit 5 reflection

The breakthrough was realising that collision was not only a geometry problem;
it was a promise between the image and the player. My first rule could prove
that a projectile's centre was inside a defined arc, yet it could not see the
meteor's body, the shield's rounded cap or the moment a player moved during an
overlap. Playing those boundary cases made the mismatch obvious: an impact
looked blocked and still removed a life. Expanding collision to the painted
contact window made the rule agree with what the player could actually see.

Infinite mode pushed that lesson further. The original tests exercised one
rotation and brief, straight collisions; longer play introduced accumulated
angles and hazards that stayed inside the core for several frames. The green
suite had not lied, but it only described the region I had asked it to visit.
Writing 118° and 838° as literally equivalent, and defining one overlap as one
damage event, turned two surprising failures into explicit boundaries of the
game.

This work changed the kind of developer I want to become. I want to treat tests
as precise but partial witnesses, then deliberately investigate what they
cannot observe: perception, timing, aspect ratio, long sessions and fairness.
When play reveals a mismatch, I do not want to patch the visible symptom and
move on. I want to identify the missing rule, express it independently of the
implementation, and keep it as a regression test. That combination of
instrumented browser play, human judgement and literal fixtures produces more
than code that agrees with itself; it produces an experience whose feedback a
player can trust.

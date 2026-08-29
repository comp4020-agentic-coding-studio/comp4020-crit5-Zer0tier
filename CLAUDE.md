# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so the deployed head is the only place a broken one shows up.

## The checks

`pnpm check` runs them, and `pnpm check:evidence` is the extra gate before you
ship. CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This file is yours

A starting point, not a rulebook: what you add to it is the harness, and the
harness is assessed. This file and the sensors you wire into `check` carry
across the course --- both come with you into next week's repo. The prototype
doesn't: source, and the tests answering this week's published spec, stay
behind. `spec/README.md` draws the line.

## What I've learned to hold the agent to

Added as each one actually cost me something. Kept short on purpose --- a rule I
won't reread is a rule that doesn't work.

### Read the spec's own tests before writing any code

`spec/*.test.ts` for the week is the contract in executable form, and it holds
requirements a summary of the brief will drop. In C2 my own brief covered the
link to the original but never mentioned the organisation's **contact**
details --- which `spec/crit-2.test.ts` asserts outright. Read those files and
the published spec first, then build. Cheaper than discovering it at the crit.

### Word counts: a crit week is 150--300 words, not an essay

Indicative, not penalised --- but badly overshooting loses marks under the
response criterion, and "badly" is easy to hit by accident. I wrote a 1,182-word
`PROCESS.md` for a 150--300-word slot before checking.

| file | words | shape |
| --- | --- | --- |
| crit-week `PROCESS.md` | 150--300 | **one or two** moments, not four |
| assignment `PROCESS.md` | 400--600 | |
| final-project `PROCESS.md` | 600--900 | folds in stack + workflow |
| any `reflections/*.md` | 150--300 | every week, crit or assignment |

Images and screenshots don't count towards any of these, and are encouraged
where one carries the verification better than a sentence. Tables are a cheap
way to say a lot inside the budget.

### Never let real information be plausible-looking invention

When the week's brief involves a real organisation, its identity, address and
contact details must be **theirs**, fetched and cited --- not generated to look
right. A fabricated address for a real company is worse than no address.
Chinese sites are often GB18030, not UTF-8: if a fetch returns mojibake, pipe it
through `iconv -f gb18030 -t utf-8` rather than guessing at the content.

### The rendered page is the only source of truth for layout

`pnpm check` cannot see the page. It was fully green in C2 while all 24 card
thumbnails rendered as empty tofu boxes (emoji, no emoji font) and three links
had shipped welded to the previous word. Render the built site and measure it at
**both** graded viewports before believing it:

- `document.documentElement.scrollWidth === window.innerWidth` at 1920 and at
  390 --- this is the no-horizontal-scroll contract, and the one thing most
  worth checking
- elements crossing the right edge at 390 should only ever be the contents of a
  deliberate horizontal scroller
- don't assert layout in `spec/` --- jsdom computes none, so the test would pass
  on a visibly broken page. Say so in the test file rather than faking the
  coverage.

Emoji are not safe as load-bearing visuals. Text and CSS need no font that
might be missing.

Run axe-core in that same browser session while it's open --- injecting it from
a CDN and calling `axe.run(document)` at both viewports takes seconds. In C2 it
caught one serious `color-contrast` failure I would not have seen: the Chinese
nav labels sat at ~3.4:1 because I'd dimmed the pill's own colour with
`opacity: 0.65`. Note *why* this isn't a `spec/` test: axe under jsdom cannot
evaluate `color-contrast` at all --- no layout, no computed colours --- so the
wired-up cheap version would have passed on the exact bug it was meant to catch,
and the honest version needs a real browser in CI. Until a spec asks for that,
this is a manual pass to repeat whenever colours change.

### `hidden` loses to any author `display` rule

The UA implements the `hidden` attribute as `display: none` in *its* stylesheet,
so any author rule that sets `display` on the same element outranks it. In C2 an
empty search bar (`display: flex`) rendered 71px tall on every first visit while
carrying `hidden`, and the empty favourites list (`display: grid`) stayed in the
accessibility tree. Ship `[hidden] { display: none !important; }` once, globally.

And measure the right thing: my probe read `el.hidden`, which was `true` the
whole time. The attribute is not the question --- `getComputedStyle(el).display`
and `el.offsetParent !== null` are. Assert what a visitor sees, not what the DOM
property says.

### Make a check fail before trusting it

A test that has never been red is not evidence. Break the thing on purpose,
watch it fail, restore, watch it pass. And any injection or edit used to do that
must **assert it actually matched** --- in C2 a find-and-replace silently hit
nothing (the real markup had a `class` attribute I hadn't accounted for), so the
test never ran and still read as green. A silently-skipped verification is worse
than none, because it manufactures confidence.

**A test that checks a rule by applying that same rule cannot catch the rule
being wrong.** In A1 I inverted `overlaps()` from half-open to closed --- the
classic off-by-one --- and "never puts two overlapping regimes in the same
column" stayed green, because it asks `overlaps()` whether the packing
`overlaps()` produced was right. Only the fixture test ("Ming ends 1644 and
Southern Ming begins 1644 --- not concurrent") went red. So: for any convention
the whole design rests on, write at least one test that states the expected
answer as a **literal**, from outside the implementation. Structural tests check
consistency; only fixtures check correctness.

### "Never commit a red state" has one exception, and only one

The week's own `spec/*.test.ts` encodes the published contract *before* the
thing exists --- red is its correct starting state, and turning each one green
is the commit trail the marker reads. So the rule is: never commit a
**regression**, and never commit with typecheck, build or lint red. A spec test
that has never yet been green is a different thing from a test that just broke.
Say which is which in the commit message, so the distinction is legible rather
than something a reader has to reconstruct.

### Test above `--shell`, not just at the two marking viewports

`--shell` is 1440px, so anything full-bleed looks correctly aligned at every
width up to 1440 and wrong above it. The release timeline bar sat in a
different column from the header directly above it — invisible at 1280 and at
390, plainly wrong at **1920, which is a marking viewport**. Checking the two
graded sizes would have caught this one; checking 1280 and 390, as I had been,
would not have.

When a layout bug depends on a breakpoint, put the breakpoint's far side in the
test — walk a spread of widths around any breakpoint you introduce, because the
bug lives entirely in the range a two-viewport test never visits.

### A listener on an ancestor is not the same as a listener that fires

The relearning test was silently dead on nine of twelve releases. Its answer is
usually the Start button, and `system-interactions.js` calls
`stopPropagation()` there so opening the Start menu does not immediately trip
the desktop's click-outside-to-close handler. A bubble-phase listener on the
desktop never saw the one click that mattered. `addEventListener(..., true)` —
capture runs ancestor-first, before the target's own handlers.

Nothing in `spec/` could have caught this: the markup was right, the script was
attached, and jsdom dispatches no real click. Only driving it in a browser
found it. **When adding an interaction on top of an existing one, assume the
existing one already stops the event, and prove the new one fires.** The
regression test asserts both halves — the guess registers *and* the Start menu
still opens — because the fix shares the event path with the thing it must not
break.

### Don't dim text with `opacity` — I did it again

C2's contrast failure was `opacity: 0.65` on a nav pill. I reached for
`opacity: 0.78` on the new card's lede without thinking, and on the Windows 95
teal it computes to roughly 2.6:1. There is no colour that opacity is safe to
dim against every possible background. Carry hierarchy with size and weight;
if a muted colour is genuinely needed, set the colour and measure it.

Related, and the same mistake in a different costume: a colour token is named
for the job it does. A background token used as a text colour can land two
near-identical colours on top of each other at ~1:1 contrast. Give a background
token its own paired ink token, and look for it before reusing the background
token anywhere else.

### Run axe on the built pages, at both viewports

`pnpm check` cannot see contrast and neither can jsdom. With the preview server
running, inject `node_modules/axe-core/axe.min.js` and call `axe.run(document)`
at 1920 and 390. Doing this once turned up serious violations I hadn't caught
by eye.

### "Supports the claim" is a measurement, not an opinion

Whatever this week's brief claims the page is *for*, check it by measurement,
not by eye component-at-a-time — each piece felt defensible on its own while the
whole page drifted off the claim. Sum the rendered height of each top-level
section at 390px and work out what share actually serves the claim:

```js
document.querySelectorAll("main > section, main > nav").forEach((el) =>
  console.log(Math.round(el.getBoundingClientRect().height), el.className));
```

A number I could not argue with is what actually moved me to cut, after months
of "but each part is good."

### An effect that can cause itself will cause itself

C4's worst bug in one line: a ripple collision spawned a ripple, that ripple
collided with both its parents, and each of those collisions spawned another.
Two clicks became about twenty-five rings stacked on one point inside a second,
a white blown-out core, and — because the flood of notes pinned the limiter —
**no audible sound at all afterwards**. The report I got was "a blinking white
dot, and then nothing makes any sound", which sounds like two unrelated bugs and
was one.

Whenever a generated event can generate more of the same event, the generated
ones must be marked inert at birth (`reactive: false`), not merely rate-limited.
The per-frame cap I already had did nothing: it throttled the cascade without
stopping it. Rate limits bound the symptom, inertness removes the loop.

Then bound the quadratic separately. N live rings means N² possible meetings, so
even without feedback a long drag thickens into a wash that has nothing to do
with what the player is doing now. Cap how many times any one source may fire.

### `animation-fill-mode: both` outranks your normal declarations

`#invite[data-played] { opacity: 0 }` never applied, because the element's
entrance animation ended on `opacity: 1` and `both` retains that final value —
and an animated value beats a normal declaration in the cascade. The element was
only ever hidden by the `visibility: hidden` sitting next to it, and the fade-out
transition had never once run.

Use `backwards`, not `both`, for a pure entrance: it gives you the pre-animation
state and then hands control back to your stylesheet. And this is the same
lesson as the `hidden` one above in a new costume — **read the computed value,
don't trust the rule you wrote.** `getComputedStyle(el).opacity` said `0.998`
while the stylesheet plainly said `0`.

### Measuring sound, when you cannot hear it

Splice an analyser in front of `destination` from *outside* the page, so the
instrument's own code stays honest, then read `getByteTimeDomainData` and report
the peak:

```js
const nativeConnect = AudioNode.prototype.connect;
AudioNode.prototype.connect = function (target, ...rest) {
  const ctx = this.context;
  if (ctx && target === ctx.destination) { /* insert ctx.__probe analyser */ }
  return nativeConnect.call(this, target, ...rest);
};
```

This cannot tell you whether the pool sounds *good* — nothing automated can, and
that judgement stays with a person. It tells you whether it is making any sound
at all, which is a different question and one I had been answering by guesswork.
Playwright plus this probe technique will do the same job again the day a
prototype makes noise; the specific `diagnose.mjs` from C4 was written against
that week's pool of ripples and did not carry forward.

Two environment facts, so this is not re-derived: Playwright's Chromium needs
`libasound.so.2`, which `playwright install --with-deps` cannot install without
root — `apt-get download libasound2t64`, `dpkg -x` it somewhere, and pass
`LD_LIBRARY_PATH=<that>/usr/lib/x86_64-linux-gnu`. And an element scan for
horizontal overflow must skip elements inside an `overflow: hidden` ancestor and
invisible ones, or a deliberately-oversized background decoration reports as a
layout bug on every run. `scrollWidth === innerWidth` is the contract; the
element list is only there to say which one to go and look at.

### When a request contradicts the spec, say so once and let the student decide

Asked for "wrong letter shows red and starts over" in C4, where the brief said
in as many words that instrument has no fail state. Building it silently would
have traded a marked spec line for a feature; refusing would have been
overriding the person whose work it is.

Naming the conflict got a better answer than either: an opt-in mode, off on
every load, never persisted. The mechanic exists and can be demonstrated and
justified; a stranger, or a pod opening the page cold, still cannot reach a fail
state by accident. Whatever this week's brief forbids outright, treat a request
that reaches for it the same way: name the conflict once, then let the design
find the version that keeps the forbidden thing opt-in and never the default.

### Compare siblings, not ancestors, when checking for overlap

Having moved an element inside a container to stop it colliding with something
else, an overlap check went red on both viewports. The layout was fine: a
parent's box always contains its child's, so `overlaps(child, parent)` is
trivially true once one is nested in the other. The check has to compare things
that are actually laid out side by side. A geometric assertion is only as good
as its idea of what should not touch what.

### A constraint taken too literally makes a worse thing than the constraint wanted

C4's brief said there was no way to play the instrument wrong, so I refused to
give the score a cursor: a cursor knows where you *should* be, and could
therefore say you were somewhere else. Instead every occurrence of a target lit
at once — fine on twenty items, a flash across the whole page on sixty-seven,
and the player reported it as a bug.

The middle ground was there the whole time: a cursor that **follows instead of
expecting**. It jumps to whatever was actually done, wrapping if needed. There
is no expected answer, so there is nothing to be wrong about — and it is
genuinely useful for keeping your place. The lesson is not "add cursors". It is
that I enforced the *letter* of a constraint ("nothing may track position") when
the constraint's *purpose* was "nothing may tell the player they failed", and
those permit very different designs. When a rule starts producing something
obviously worse, check whether you are serving the rule or the reason for it.

### Content that asserts something about the world gets verified against the world

C4's songbook's obvious picks — Twinkle Twinkle, Ode to Joy, Happy Birthday —
were all unplayable on that week's pentatonic instrument: no fourth, no
seventh, and each of those songs needs one or both. Written out anyway they
would have looked completely plausible and sounded wrong, with the player
assuming the mistake was theirs. Five minutes checking each tune's degrees
against the scale caught it before a line of markup existed — the same rule as
never inventing a real organisation's address, in a new domain.

Don't transcribe content from memory when a checkable source exists. For tunes,
**ABC notation** is plain text, widely available, and can be PARSED into scale
degrees, so "is this playable here" becomes arithmetic instead of recollection.
**Check the arithmetic of anything you fetch** — one source's Amazing Grace came
back with 3/4 bars containing four eighth-notes instead of six, proof notes had
been dropped in transit, and its second half contradicted a second source. Bars
that add up are cheap, strong evidence the notation survived intact. Where
sources disagreed, the existing entry was left alone rather than shipping the
more interesting guess. Encode the fixture test against the SOURCE (tokens,
not a transcription), and assert separately that the source itself satisfies
whatever constraint is claimed — that turns "nothing here is adapted to fit"
into a checked fact instead of a hope.

### If a mapping doesn't actually hold, don't pretend it does

C4 put one syllable under one chip, right for short words and wrong for
melismas — several notes under one syllable — where the source gives pitches
without a trustworthy alignment. Inventing one is content-shaped invention, the
same failure as an invented address; the honest version showed the whole phrase
at once instead. This generalises: when adapting any external material
(lyrics, captions, translations, credits) into a UI that implies a precise
correspondence, don't manufacture the correspondence if the source doesn't
supply it — say what's actually known. And check that a `role="img"` or similar
presentational wrapper doesn't quietly swallow content that only a screen
reader would otherwise reach.

### `top` without `position` is a no-op that desktop will hide from you

C4 styled a banner with `top: 4.4rem` and never gave it `position: fixed`.
Static elements ignore `top`, so it laid out in normal flow — which at 1440px
put it near the top of the page and looked exactly right, and at 390px dropped
it on top of the fixed header.

Two habits from this. Every offset property needs its `position` checked in the
same breath. And **assert that things do not overlap**, rather than looking at a
screenshot and deciding they seem fine: comparing bounding boxes pairwise
(`a.bottom > b.top && b.bottom > a.top`) found this and three near-misses in one
run, at the viewport where it actually mattered.

### fullPage screenshots lie about `position: fixed`

A `fullPage: true` capture showed a fixed bar floating mid-page and the lower
half washed out — two convincing bugs, neither real. Fixed elements are
composited once at their viewport position and a fixed vignette stretches over
the whole capture. Scrolling a normal viewport and measuring showed the bar
correctly pinned with no overlap.

Use `fullPage` to read content and layout order. To judge anything fixed,
sticky, or viewport-sized, scroll a real viewport and measure boxes.

### A rendering trick that merges at one scale separates at another

C4 drew each ripple as three concentric strokes at fixed pixel offsets, to read
as one soft crest. It does — at small radii. Once the wave is far enough out the
strokes are plainly three separate circles, reported as "one click but there's
two waves? is this a bug?" The underlying logic was correct the whole time; the
drawing was lying about how many there were.

Fixed offsets on a thing whose size changes are a bug waiting for the size to
change. Either scale the offsets with the element or, better, stop faking a
soft edge with several hard ones — a radial-gradient band gives a real crest.
Generalises to: **check a visual at more than one point in its life.** A
full-page screenshot at one instant showed nothing wrong; cropping in close, at
a chosen moment, showed it immediately.

### A full-screen `filter` or `mix-blend-mode` over an animating canvas is the most expensive thing on the page

C4 stuttered on a fast drag. Two rounds went into optimising JavaScript — all
real improvements, none of them the cause. Direct attribution settled it: every
canvas API call together came to a fraction of a millisecond of a ~60ms frame.
The code was never the problem.

A full-viewport element with `mix-blend-mode` AND `filter: saturate()`, sitting
under a canvas that repaints every frame, forces the compositor to re-filter and
re-blend the whole viewport on every single frame. Measured by CSS override,
which is the one control that cannot break the code it is testing, each layer
alone cost tens of milliseconds; removing both took a ~65ms frame to ~17ms and
stutters from 149/149 to 0. `backdrop-filter` on a small element over the same
canvas was a smaller version of the same mistake.

So: **on any page with a continuously repainting element, treat `filter`,
`backdrop-filter` and `mix-blend-mode` on overlapping full-size layers as
suspects before profiling a line of JavaScript.** They cost nothing at rest and
enormously in motion, and no CPU-side measurement of your own code will show it.

### Profile the layer you are actually on

Three separate measurements said "no problem" while the page visibly stuttered,
because each was blind to compositing: animation-frame callback time, canvas API
time, and pointer handler time were all fine in isolation. Frame-to-frame gap
was the only metric that saw it. When timings look fine and the page does not,
the work is happening in a phase you are not measuring.

### Fill the ring, not the disc

Fixing the "two waves" bug in C4, three thin strokes became a filled disc with
a radial-gradient band. Visually right, and a large increase in painted pixels:
the gradient's inner stop was fully transparent, so most of a wide wave was
painting invisible pixels, additively blended, at scale.

Stroking the band — `lineWidth = outer - inner`, arc at the crest — covers the
identical visible pixels for a fraction of the fill rate. **When a shape's
middle is transparent, paint the edge.** Do the arithmetic on painted area when
changing how something is drawn; it is a one-line calculation and it would have
caught this the day it was introduced.

### Timing the animation-frame callback does not measure painting

Per-frame callback work measured as fine while the page was visibly stuttering,
which nearly convinced me there was no problem. Paint and composite happen
*after* the callback returns, so instrumenting the callback is blind to exactly
the cost a heavy canvas incurs. Use `PerformanceObserver` for `longtask`
entries as well — those caught dozens of long tasks the callback timing could
not see.

And establish the floor before believing any of it: measuring the GAP between
animation-frame callbacks was worthless on a headless renderer, because it
renders in software and an idle page scored the same as a scribbling one.

### Synthetic input is not fast input

Playwright's `mouse.move` goes over CDP, so a fast synthetic drag took over ten
times longer than a real one — tens of milliseconds between moves, where a real
hand with a high-polling mouse is 1-8ms. The gesture that stutters could not be
reproduced by the harness at all, and a rate limit looked like it had done
nothing when in fact it was never exercised.

Synthetic input measures throughput, not burst. For anything triggered by input
*rate*, either compute the cost analytically or dispatch synthetic
`PointerEvent`s directly in the page rather than driving the real mouse.

### An audit that hardcodes what it measures against stops being an audit

C4's audit compared text colours to a literal hex value. That was true when it
was written. Then the background became a multi-stop gradient with drifting
coloured lights — and the audit went on cheerfully reporting contrast against a
background that no longer existed anywhere on the page. It would have passed
every state without having seen any of them.

The fix: hide the text, screenshot, read the **actual pixels** underneath each
label, put the text back. The general form: **a check whose expected value is
baked in only tests the past.** If the thing being measured can change, the
measurement has to be taken from the running page, not from a constant written
next to it.

### Measure target size and contrast; don't eyeball either

A browser-level audit that prints every interactive element's rendered box,
font size, resolved font family and contrast ratio found defects in C4 that had
been looked straight at and not seen: a nav link under the WCAG 2.2 AA minimum
of **24x24 CSS px** for a pointer target (note the web figure is 24, not the
44pt/48dp native numbers — quoting the native one at a web review is a common
way to be wrong in both directions); pills that passed 24px but needed 44px for
comfortable thumb reach at a mobile viewport; body-adjacent text under the 12px
floor. Contrast passed everywhere once colours were set explicitly instead of
dimmed with `opacity`.

Two traps worth remembering if this technique is rebuilt this week. Sampling
every element's box out of ONE viewport screenshot silently only works while
every target is above the fold — anything scrolled far down falls outside the
image and a pixel read returns transparent black, i.e. a contrast reading
against a background that exists nowhere. Scroll each target into view and
re-read its box AFTER scrolling. And `fullPage` is not the escape hatch, because
`position: fixed` elements don't composite correctly in it either (see above).
Anything that cannot be measured should say NOT MEASURED and fail the run,
rather than being silently skipped.

### A font stack whose first entry is platform-specific ships two designs

`font-family: ui-rounded, "Segoe UI", system-ui` meant Apple users saw SF
Rounded and everyone else saw Segoe UI — two different typefaces depending on
who opened the page, which is not something you can notice on your own machine.
If a stack's first entry only exists on one platform, that is a fork in the
design, not a fallback. Either commit to a webfont or start from `system-ui`.

### A design-system generator can return a confidently wrong answer

Asked for a visual direction for C4's dark ambient instrument, a UI dataset
returned a landing-page pattern (hero, product video, feature breakdown, CTA)
in a bold block style — reasonable for a marketing site *about* music, ruinous
for a page with no hero and no CTA.

Its own contract says to verify the returned category fits the product before
using it, and that is the step worth keeping: **check what a recommender thinks
you are building before taking its advice.** The parts worth keeping from a
mismatched result are the measurable ones — contrast thresholds, target sizes,
reduced-motion — not the aesthetic direction.

### Collision geometry has to include what was painted

C5's shield and its collision initially shared the same 24-degree half-arc. The
fixture was correct and the result felt wrong: a meteor whose centre was four
degrees outside still visibly overlapped the thick, round-ended, glowing arc.
The honest geometry included that painted thickness, so collision gained seven
degrees of forgiveness while the drawing stayed narrow. Test the literal
boundary, then play it; centre-line maths cannot see the pixels around the line.

The same game exposed an aspect-ratio version of the mistake. Projectiles all
started at one diagonal radius, which gave a horizontal meteor seconds less
visible approach on a portrait screen. A radial object should spawn where its
ray meets the actual viewport edge, not at the longest radius that happens to
contain every edge.

### Don't autoplay, and keep at most one thing playing

C4 had several startup sounds on one page with `preload="auto"`, and the script
also tried to autoplay one. The first sound worked; later triggers could sit
disabled at "Loading" while the browser fetched competing files. Attribute
checks proved every source existed but could not prove that a second player
could take control. For anything that makes sound: nothing plays before a user
gesture (the Web Audio autoplay policy enforces this for an `AudioContext` too
— it starts `suspended` until resumed from a gesture), and starting a new sound
should stop or fade out whatever was already playing rather than layering
indefinitely. Prove the shared state in a browser: start one, start a second,
require the first to actually stop.

### An ablation that doesn't ablate says its target is free

A C4 perf harness had four ablations. Two of them did nothing: one set a flag
no code ever read, and another handed back a cached resource that measured
SLOWER than baseline instead of faster. Both rows sat in the results table for
a whole optimisation round, each reading as "the thing I removed wasn't the
problem" — which is the most expensive sentence a perf harness can say, because
it sends you off optimising something else.

So: **every ablation must increment a counter as it fires, and the runner must
refuse to print a row where the counter is zero.** This is "make a check fail
before trusting it" applied to measurement instead of to tests — an ablation is
a check whose green is a number, and a number from a control that never fired is
worse than no number at all.

### One perf run on this machine decides nothing

Consecutive baseline runs of the *same code* on C4 gave wildly different
stutter counts, and the unchanged code's median frame time drifted noticeably
across sessions an hour apart — so a blocked A/B (all "after", then all
"before") attributes machine drift to the change under test.

**Interleave the pairs and report the paired difference.** `git stash push` /
`stash pop` between runs flips the real code with HMR, no build needed.
Alternating pairs gave a readable answer where blocked runs had not. Report
"wins N of M pairs", not a single before/after, and say when the spread swamps
the effect.

### Measure an optimisation's hit rate before believing your own comment

An off-screen cull in C4 shipped with a confident comment calling the culled
cases "the EXPENSIVE ones". Instrumented, it skipped almost nothing at one
viewport and only a few percent at another — an existing, cheaper cut already
retired most of what it targeted. The comment was fiction and the guard cost
real work per frame to buy nothing.

The habit: an optimisation gets a counter before it gets a comment, and the
comment quotes the counter. Where the real cost was, once the controls were
honest: an O(N²) collision scan was building a string key for every pair before
any geometry ran — thousands of throwaway strings a second at scale. Cheaper
test first, expensive key construction only for pairs that actually matched,
per-frame allocations compacted in place.

### Alpha profile is a fill-rate decision too

"Fill the ring, not the disc" had a second half that was missed at first: a
gradient that runs transparent → low alpha → peak → low alpha → transparent
across a wide stroke spends most of its width under ~6% alpha on a dark ground —
shaded on every pixel, invisible. Narrowing the stroke to the fraction actually
carrying visible alpha, with the stops rescaled to keep the same curve, cut real
paint work for no visual change — verified by cropping the same feature young
and old, before and after, not by a full-page shot.

Related: anything computed once per instance (a colour string, say) should be
built once per instance, not once per frame or once per sub-part — building it
repeatedly at scale (many instances × many parts × 60fps) removes work that
serves no purpose.

### Audit every interactive element, not the ones you remember

Teaching a C4 audit script to assert the sizes it had only been *printing*
found a link at well under the WCAG 2.2 AA minimum, sitting there since a
nearly identical defect had already been fixed elsewhere on the page. A number
in a column nobody compares to a threshold is decoration — if a script measures
something, make it assert against the threshold, not just report the value.

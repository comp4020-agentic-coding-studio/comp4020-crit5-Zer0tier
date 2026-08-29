import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// C5 "A game"
// https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/
//
// Mechanically checkable from the built site alone:
//   - it wires some interaction, so there's a first move to make
//   - it teaches itself: no how-to-play text anywhere on the shipped pages
// Everything else in the spec ("a wrong move is possible, and play ends
// somewhere — a win, a loss or a finish", "a stranger can pick it up and
// reach an ending inside five minutes", "one change you made came from
// playing the finished game rather than reading its code") is judged by
// playing the built game, not by a test that can only read markup — jsdom
// dispatches no real pointer/keyboard event and computes no layout, so
// faking that coverage here would be theatre.

const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const shipped = files().map((path) => relative(DIST, path).split(sep).join("/"));

const htmlDocs = shipped
  .filter((name) => name.endsWith(".html"))
  .map((name) => ({
    name,
    doc: new JSDOM(readFileSync(join(DIST, name), "utf8")).window.document,
  }));

const scripts = shipped.filter((name) => name.endsWith(".js"));
const allScript = scripts.map((name) => readFileSync(join(DIST, name), "utf8")).join("\n");

describe("crit 5: a game", () => {
  it("built at least one page and one script", () => {
    expect(htmlDocs.length).toBeGreaterThan(0);
    expect(
      scripts.length,
      "no built JS found — a game needs logic, not just markup",
    ).toBeGreaterThan(0);
  });

  it("wires some interaction — a click, key or pointer listener", () => {
    // Not proof the game is any good, just proof there's a first move to
    // make at all. This is the one test in this file that starts red: the
    // template's main.ts has no listeners.
    const hasInteraction = /\b(addEventListener|onclick|onkeydown|onpointerdown)\b/.test(
      allScript,
    );
    expect(
      hasInteraction,
      "no addEventListener/onclick/onkeydown/onpointerdown found in the built JS",
    ).toBe(true);
  });

  it("never explains itself: no how-to-play text anywhere on the shipped pages", () => {
    // The brief bans this outright: no how-to-play modal, no instructions
    // page, nothing in the README standing in for either. README isn't
    // shipped to dist, so this only has to look at what a player actually
    // sees.
    const FORBIDDEN = /how[\s-]to[\s-]play|instructions|tutorial|controls\s*:/i;
    for (const { name, doc } of htmlDocs) {
      const text = doc.body?.textContent ?? "";
      expect(
        FORBIDDEN.test(text),
        `${name} contains text matching ${FORBIDDEN} — the brief wants the opening screen to ` +
          "teach the first move by itself, not tell the player how to play",
      ).toBe(false);
    }
  });
});

// "It can be lost" and "a stranger reaches an ending in five minutes" depend
// on whatever one rule the game actually turns out to have, which doesn't
// exist yet. Once it does, put ONE of that rule's outcomes under a fixture
// test here, the same shape as C4's songbook checks: state the expected
// answer as a literal, from outside the implementation, so the test can
// catch the rule itself being wrong (see CLAUDE.md, "make a check fail
// before trusting it" and "a test that checks a rule by applying that same
// rule cannot catch the rule being wrong"). That test, plus a PROCESS.md
// entry citing a change that came from playing rather than reading code, is
// what the published spec actually asks for here.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  classicalPianoVoicing,
  CLASSICAL_PIANO_BPM,
  CLASSICAL_PIANO_PATTERN_LENGTH,
  midiNoteFrequency,
} from "../classical-music";

describe("background music control", () => {
  const document = new JSDOM(
    readFileSync(resolve("index.html"), "utf8"),
  ).window.document;

  it("uses a native toggle with an accessible name and state", () => {
    const button = document.querySelector<HTMLButtonElement>("#music-button");
    expect(button?.tagName).toBe("BUTTON");
    expect(button?.getAttribute("aria-label")).toBe("Background music");
    expect(button?.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the speaker artwork out of the accessibility tree", () => {
    expect(
      document.querySelector("#music-button svg")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("uses a measured classical piano tempo and a complete eight-bar phrase", () => {
    expect(CLASSICAL_PIANO_BPM).toBeGreaterThanOrEqual(80);
    expect(CLASSICAL_PIANO_BPM).toBeLessThanOrEqual(105);
    expect(CLASSICAL_PIANO_PATTERN_LENGTH).toBe(64);

    const phrase = Array.from(
      { length: CLASSICAL_PIANO_PATTERN_LENGTH },
      (_, step) => classicalPianoVoicing(step),
    );
    expect(phrase.every(({ harmony }) => Number.isFinite(harmony))).toBe(true);
    expect(new Set(phrase.map(({ harmony }) => harmony)).size).toBeGreaterThan(8);
    expect(phrase.filter(({ melody }) => melody !== null).length).toBeGreaterThan(24);
  });

  it("loops cleanly and tunes concert A to 440 hertz", () => {
    expect(classicalPianoVoicing(CLASSICAL_PIANO_PATTERN_LENGTH)).toEqual(
      classicalPianoVoicing(0),
    );
    expect(midiNoteFrequency(69)).toBe(440);
  });
});

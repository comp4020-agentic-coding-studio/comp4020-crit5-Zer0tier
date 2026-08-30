import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  gameSessionIsFrozen,
  toggledPausePhase,
} from "../pause-state";

describe("Escape pause control", () => {
  it("toggles only active and paused sessions", () => {
    expect(toggledPausePhase("playing")).toBe("paused");
    expect(toggledPausePhase("paused")).toBe("playing");
    expect(toggledPausePhase("ready")).toBe("ready");
    expect(toggledPausePhase("won")).toBe("won");
    expect(gameSessionIsFrozen("paused")).toBe(true);
    expect(gameSessionIsFrozen("playing")).toBe(false);
  });

  it("provides an accessible touch and keyboard resume control", () => {
    const document = new JSDOM(
      readFileSync(resolve("index.html"), "utf8"),
    ).window.document;
    const pauseScreen = document.querySelector("#pause-screen");
    const resumeButton = document.querySelector("#resume-button");

    expect(pauseScreen?.getAttribute("role")).toBe("dialog");
    expect(pauseScreen?.getAttribute("aria-modal")).toBe("true");
    expect(pauseScreen?.hasAttribute("hidden")).toBe(true);
    expect(resumeButton?.tagName).toBe("BUTTON");
    expect(resumeButton?.textContent).toContain("Resume");
    expect(pauseScreen?.textContent).toContain("Esc");
  });
});

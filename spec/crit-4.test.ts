import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// This week's brief: https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/04-instrument/
// Turns the mechanically-checkable lines of the published spec into tests.
// "Deployed and live", the process-evidence lines, and anything only a person
// can judge (does it feel expressive, does the opening screen invite play)
// are left to the crit and to `pnpm check:evidence` --- see spec/README.md.

const DIST = resolve("dist");
const html = readFileSync(join(DIST, "index.html"), "utf8");
const doc = new JSDOM(html).window.document;

// jsdom doesn't execute module scripts, so the audio behaviour itself can't
// run here --- instead this reads the built bundle's text for the calls that
// prove sound is synthesised rather than played back, and that both pointer
// and keyboard input are wired up.
function bundledScriptSource(): string {
  const script = doc.querySelector("script[type='module']");
  const src = script?.getAttribute("src");
  expect(src, "expected a module script with a src in the built page").toBeTruthy();
  const path = join(DIST, src!.replace(/^\.?\//, ""));
  expect(existsSync(path), `bundled script not found at ${path}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("crit 4: an instrument", () => {
  const bundle = bundledScriptSource();

  it("makes sound live in the page rather than playing back a recording", () => {
    expect(bundle).toMatch(/AudioContext/);
    expect(html).not.toMatch(/<audio[\s>]/i);
    expect(bundle).not.toMatch(/\.(mp3|wav|ogg)['"]/);
  });

  it("invites a stranger to play without instructions", () => {
    const invite = doc.querySelector('[data-testid="invite"]');
    expect(invite?.textContent?.trim()).toBeTruthy();
  });

  it("is playable with mouse, touch, or keyboard", () => {
    const pads = [...doc.querySelectorAll('[data-testid="pad"]')];
    expect(pads.length).toBeGreaterThan(0);
    for (const pad of pads) {
      expect(pad.tagName).toBe("BUTTON");
      expect(pad.hasAttribute("disabled")).toBe(false);
    }
    expect(bundle).toMatch(/keydown/);
    expect(bundle).toMatch(/pointerdown/);
    expect(bundle).toMatch(/pointermove/);
  });

  it("gives different input different sound, not one fixed tone", () => {
    const pads = [...doc.querySelectorAll('[data-testid="pad"]')];
    const notes = new Set(pads.map((pad) => pad.getAttribute("data-note")));
    expect(notes.size).toBeGreaterThan(1);
    // Position on the pad (brightness) and the drone both key off the actual
    // frequency at trigger time, not a fixed sample --- this is the one
    // structural signal jsdom can check for "the player's choices shape it".
    expect(bundle).toMatch(/detune/);
    expect(bundle).toMatch(/frequency/);
  });

  it("has no score, win, or fail state", () => {
    expect(html).not.toMatch(/\bscore\b|\bfail(ed)?\b|game\s*over|you\s*(win|lose)/i);
  });
});

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
checks it, so look at the deployed head when you add pages.

## The checks

`pnpm check` runs them (`pnpm check:evidence` is the extra gate before you
ship); CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out (a
linter, say), a fact about the stack that is easy to get wrong --- write it down
here and wire it into `check`. Growing this file is the work.

## Rules learned so far

Carried forward from Assignment 1 (a different stack --- an OLS house-price
model, not audio) --- only the stack-independent lessons survive the switch:

- **Don't trust that a listener is wired right just because the code reads
  right --- drive the actual control and watch the output change.** A `<select>`
  that looked correctly wired silently dropped updates from a scripted
  `input`-only listener. For an audio instrument: don't assume `ctx.resume()`
  or a trigger fired just because the call site looks right --- actually
  tap/click/press and confirm sound comes out.
- **Rule out the tool before you believe the page is broken.** A scripted
  interaction that changes nothing might be the automation failing to drive
  that specific control (a native `<select>`'s OS popup, browser autoplay
  gating audio before a real user gesture), not a bug in the page. Cross-check
  with a different control or a manual pass before trusting a negative result.

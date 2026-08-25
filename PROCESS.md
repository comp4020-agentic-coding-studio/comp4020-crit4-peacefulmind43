# Process overview

A reading-guide to how the work came together.

## What I built

Constellation, a ten-note pentatonic pad instrument. Each pad is a pair of
detuned oscillators through a lowpass filter, sent to a shared echo (feedback
delay) and shimmer (algorithmic convolution reverb) bus. A slow three-oscillator
drone continuously retunes toward whichever note you last played, so the
texture keeps drifting as you play rather than sitting on one fixed chord.

## The moments that mattered

The harness came from assignment-1's `CLAUDE.md`, which I read expecting it to
be a strict superset of the current template's boilerplate. Diffing the two
showed the opposite: the current template had been rewritten shorter (the
detailed checks section collapsed to two lines) and had gained a section
assignment-1 never had (the link-preview card). Pasting assignment-1's whole
file over the fresh template would have quietly reverted those upstream
changes. Instead I kept the current template as the base and carried forward
only the two lessons that were genuinely mine, reworded for an audio instrument
instead of an OLS model, rather than its boilerplate
([`ebf3af9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-peacefulmind43/commit/ebf3af9ed24f1651d26eba3a7949c53df6056c02)).

The obvious way to wire pointer input is per-pad `pointerdown`/`pointerup`
listeners. That breaks a drag across pads on touch, because touch implicitly
captures the pointer to whichever element received the initial `pointerdown` --
every later `pointermove` still reports that same element as the target, no
matter where the finger actually is. So instead of trusting `event.target`, I
hit-test the pointer's coordinates against every pad's bounding rect on each
`pointermove` and switch the sounding voice myself when the pointer crosses
into a different pad. `spec/*.test.ts` runs against jsdom, which has no Web
Audio implementation and doesn't model pointer capture, so it can't tell me
this actually works -- I confirmed it with a headless Playwright script driving
a real `pointerdown` → drag → `pointerup` sequence against the built site,
which showed the `active` class following the pointer across pads, the
keyboard path also toggling it, and zero console errors, before trusting the
interaction rather than just the type-checker
([`5589941`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-peacefulmind43/commit/5589941)).

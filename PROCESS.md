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

The player reported two bugs: pad labels didn't match the keys that played
them, and releasing a key seemed to kill the sound. The label fix was
mechanical. The sound fix was not: I first assumed the per-note release
envelope was too abrupt and rewrote it to let each note ring out its full
decay regardless of release
([`3dad911`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-peacefulmind43/commit/3dad911)).
The player then reported the opposite complaint -- sound persisting after
release -- so I reverted to a proper note-on/note-off release
([`28ae70e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-peacefulmind43/commit/28ae70e))
and re-checked each voice's own gain automation with a Playwright script that
reads the real `AudioParam` calls, which showed the release was correctly
scheduled. The complaint didn't stop, which meant the bug wasn't in the voice
at all. Rather than keep guessing at the signal chain, I attached a real
`AnalyserNode` to the master bus and measured actual output level over six
seconds after release: it never reached zero, it *climbed* and then sat flat.
That pointed straight at the always-on ambient drone, which faded in on first
touch and simply never faded back out. Tying the drone's gain to whether any
note is currently held, so it fades to silence a couple of seconds after the
last release, fixed it
([`ec0e0bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-peacefulmind43/commit/ec0e0bd)).
The lesson: when a fix doesn't land and the obvious suspect checks out clean,
measure the thing the player actually hears rather than re-inspecting the
code you already convinced yourself was right.

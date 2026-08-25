# Crit 4: an instrument

The breakthrough was realising that "make it more complex" couldn't just mean
more oscillators. A first version had each pad play a single fixed tone --
technically an instrument, but every player would produce the same handful of
sounds in the same order. The actual gap was in how much of the *player's*
input the sound paid attention to. So the rewrite mapped where on a pad you
pressed to brightness, made a drag glissando across pads by hit-testing pointer
coordinates instead of trusting native pointer capture, and added a drone that
slowly retunes toward whatever you last played -- so the instrument keeps
sounding a little different depending on what you did a few seconds ago, not
just what you're doing right now. Complexity that doesn't touch what the player
can shape is just more code, not more instrument.

The other thing this week changed is how I check "does it actually work" for
something the test suite structurally can't run. jsdom has no Web Audio
implementation and doesn't model touch pointer capture, so my spec tests could
only assert the static contract -- real buttons, both event types wired,
distinct notes -- never that a drag actually glissandos or that the audio graph
doesn't throw. I'd been treating a green `pnpm check` as roughly "it works."
Here it wasn't enough, so I drove a real headless browser through the actual
gesture instead of trusting the type-checker. That's the habit I want to keep:
know which layer your tests can't see, and go look at that layer directly
instead of assuming green means done.

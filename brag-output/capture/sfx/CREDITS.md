# The film's break sounds

The brag film's breaks are these pops and pings instead of breaking glass. They were made for the film with ElevenLabs
sound effects (model `eleven_text_to_sound_v2`, prompt influence 0.5) on 2026-10-23, in the ElevenLabs flow
`uj9NsU96K2WOcd3agfhJ`. Each prompt made four takes; the takes named here were picked by measurement (no clipping, the
mellowest top, a clean single pop) and cut to one sound each.

| File | Take (generation id) | Prompt | Cut |
|---|---|---|---|
| `break_ping1.wav` | `u8ehIWj18ouhq72PQzpJ` | "Satisfying soft crystal pop, a round bubbly pop with a clean bell-like ping, close-mic" (1 s) | whole take; rings at 1744.9 Hz (A6, 15 cents flat) |
| `break_ping2.wav` | `cRBBzSELHnpiVxeE1RSU` | same prompt | whole take; rings at 1761.2 Hz (A6) |
| `break_deep.wav` | `BQgbZ5s0cmhV0FiApoop` | "Satisfying crystal burst, a deep soft pop that scatters into gentle sparkling chimes, close-mic" (1.8 s) | left channel only (the take's channels cancel when summed); a band at 650-710 Hz with no clear note |
| `break_pop1.wav` | `QyiU43nacMInCUfoagrb` | "Short round bubble pop, soft and satisfying, close-mic" (0.6 s) | the pop at 0.168 s |
| `break_pop2.wav` | `XzIOzi7DdUvA2P9RogcF` | same prompt | the pop at 0.027 s |
| `break_pop3.wav` | `XzIOzi7DdUvA2P9RogcF` | same prompt | the pop at 0.144 s |
| `break_pop4.wav` | `ISWfE46GzFQSFijExNRw` | same prompt | the pop at 0.248 s (the take's first pop clips) |

All are 48 kHz mono 16-bit, each starting on its attack and normalised to -1 dBFS peak. Cost: 45.3 ElevenLabs credits for
the 12 takes (under one US cent at the account's rate).

How they are used:
- `capture/stems.py`: in each level's game sound, a small piece breaks with a pop, a big one with a bell ping retuned to
  the chain's note (D minor pentatonic, folded into C6-C7).
- `katana-v2/tools/build_mix.py`: the film's own breaks. A big break is the deep pop with a ping on a note the music holds
  there; the sparkles are quick D-F-A pings; the swells into "SHATTER." and the rewind are the same sounds reversed.

Terms: these are ElevenLabs outputs, so their use follows the ElevenLabs terms for the account's plan. ElevenLabs' sound
effects FAQ says paid plans can use them in commercial projects without attribution, and the free plan requires
attribution to elevenlabs.io (https://elevenlabs.io/sound-effects/commercial, https://elevenlabs.io/sound-effects-terms).

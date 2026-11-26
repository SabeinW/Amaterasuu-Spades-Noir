# Sound sources

Every file here is a slice of one real recording: nothing is synthesized, layered or pitch-shifted. There is no music, no instrument, no bell or chime, and no voice.

Two licences cover the set. Neither one needs a credit, and both allow commercial use.

- **Freesound CC0 1.0** (public domain dedication). The licence was re-checked on each sound's own page when it was downloaded.
- **Sonniss #GameAudioGDC Bundle 2026 (Part 9)**, royalty-free licence. It allows commercial use and changes without attribution, and selling the sounds as part of a project such as a game. It does not allow selling the raw files on their own, or using them for AI training.

## Processing (all files)

1. Decoded to mono at 44.1 kHz (SoX resampler). Stereo sources were averaged to mono.
2. A 2-pole high-pass filter removed rumble that phone speakers can't play: 100 Hz, or 150–200 Hz where noted.
3. Trimmed tight: the cut starts 1.5 ms before the first sample above 6 % of the slice peak, and ends once the sound has dropped 50 dB below its peak.
4. A 2 ms fade-in to stop clicks, and a cosine fade-out (length given below).
5. Gain was set so the loudness matches. The two `play` files at −3 dBFS peak are the reference. Over a 50 ms window, with roughly K-weighting:
   - `shuffle` sits at 0 dB.
   - `sweep`, `bid`, `turn`, `win` and `error` sit at −2 dB.
   - `deal1`–`deal3` and `tick` sit at −5 dB.

   No file peaks above −3 dBFS. Dense sounds like the sweep and the claps peak lower because they are loudness-matched, not peak-normalised.
6. Encoded as MP3 with LAME at 96 kbps, mono, 44.1 kHz, with no ID3 tags. The Xing/LAME header stays in, so decoders that read it skip the encoder delay.

Times below are positions in the original file, in seconds.

| File | What it is | Source | Original file / Freesound page | Licence | Cut and treatment |
|---|---|---|---|---|---|
| `shuffle.mp3` | Riffle shuffle of a paper deck, ending in the final snap (1.55 s) | Freesound #611107, "cards riffle shuffle.wav" by 5ro4 | https://freesound.org/people/5ro4/sounds/611107/ | CC0 1.0 | Third riffle of the take, 8.945–10.497. HP 100 Hz, 0.25 s fade-out, +2.4 dB. |
| `deal1.mp3` | One card flicked off a deck by a casino dealer (0.145 s) | Sonniss GDC 2026, 344 Audio – Casino Cards Vol. 1 | `344 Audio - Casino Cards Vol. 1/GAMECas_Dealing 3_344 Audio_Casino Cards Vol 1.wav` | Sonniss royalty-free | 5.420–5.565. HP 200 Hz, 0.10 s fade-out, +25.2 dB (the source is very quiet). |
| `deal2.mp3` | Same dealer, another card (0.177 s) | as above | as above | Sonniss royalty-free | 0.753–0.930. HP 200 Hz, 0.10 s fade-out, +29.5 dB. |
| `deal3.mp3` | Same dealer, a softer card (0.156 s) | as above | as above | Sonniss royalty-free | 2.624–2.780. HP 200 Hz, 0.10 s fade-out, +28.7 dB. |
| `play1.mp3` | A card snapped down on a wooden table: edge tick, then slap (0.24 s) | Freesound #571577, "Playing Card Deal Variation 1" by el_boss | https://freesound.org/people/el_boss/sounds/571577/ | CC0 1.0 | 0.244–0.484. HP 100 Hz, 0.15 s fade-out, −3.1 dB. |
| `play2.mp3` | A card landing on a table and settling (0.27 s) | Freesound #787405, "Card Deal" by RealSquink | https://freesound.org/people/RealSquink/sounds/787405/ | CC0 1.0 | 0.355–0.624, starting at the landing (the slide before it is dropped). HP 100 Hz, 0.15 s fade-out, −3.0 dB. |
| `sweep.mp3` | Several cards gathered up off the table at once (0.30 s) | Sonniss GDC 2026, 344 Audio – Casino Cards Vol. 1 | `344 Audio - Casino Cards Vol. 1/GAMECas_Pick Up Multiple Cards At Once 5_344 Audio_Casino Cards Vol 1.wav` | Sonniss royalty-free | 0.075–0.375, nearly the whole file. HP 150 Hz, 0.12 s fade-out, +25.7 dB. |
| `bid.mp3` | A plastic card tapped once on a wooden table (0.22 s) | Freesound #588325, "Credit card tap.wav" by honeybunny_ | https://freesound.org/people/honeybunny_/sounds/588325/ | CC0 1.0 | The 5th tap, 5.517–5.740. HP 100 Hz, 0.12 s fade-out, −2.8 dB. |
| `turn.mp3` | Two light knocks on wood, 0.33 s apart (0.45 s) | Freesound #594389, "Knocking on wood.wav" by Elandre01 | https://freesound.org/people/Elandre01/sounds/594389/ | CC0 1.0 | Knocks 1 and 2, 0.192–0.640. HP 100 Hz, 0.10 s fade-out, +11.8 dB. |
| `win.mp3` | Four people clapping in a small theatre, no voices (2.1 s) | Freesound #347034, "01 small group clapping - theatre OMNI mics.wav" by gladkiy | https://freesound.org/people/gladkiy/sounds/347034/ | CC0 1.0 | 0.181–2.300. HP 100 Hz, 0.9 s fade-out, −1.8 dB. |
| `error.mp3` | A deck of cards knocked down on a wooden table: a dull, papery thud (0.25 s) | Freesound #466789, "Pounding Cards On Table" by HogantheLogan | https://freesound.org/people/HogantheLogan/sounds/466789/ | CC0 1.0 | 1st thud, 0.392–0.640. HP 100 Hz, 0.12 s fade-out, +2.5 dB. |
| `tick.mp3` | One tick of an antique mechanical clock (0.055 s) | Sonniss GDC 2026, 344 Audio – Antique Clocks | `344 Audio - Antique Clocks/CLOCKTick_You're Running Late _344 Audio_Antique Clocks.wav` | Sonniss royalty-free | The softer "tock" beat, 1.124–1.179. HP 150 Hz, 0.04 s fade-out, +2.8 dB. |

Local copies of the sources are in the Doodlewreck library:

- The Sonniss files are under `channel/sfx/sonniss/wav/`.
- The Freesound HQ previews are `channel/sfx/real/src/fs_<id>.mp3`, logged in `channel/sfx/real/src/freesound.json`.

## Checks on the finished MP3s

- **Hiss:** In the quietest 20 % of each file, the energy above 6 kHz sits at −50 dBFS or lower. On most files it is −58 dBFS or lower, so there is no hiss bed.
  - Across whole files, the share of energy above 6 kHz is 0–23 %.
  - The exception is `tick`, at 48 %. A clock tick is a high click, and its 55 ms are all tick.
- **Tones:** The longest steady narrow spectral peak in any file lasts 0.02 s, so no file holds a pitch. That rules out bells, chimes and hum.
- **Voices:** A 40 ms periodicity check (80–500 Hz) found no voiced frames: 0 of 62 in `win`, and 0 in every other file.
- **Clipping:** The sources were picked without clipping. Clipped candidates were rejected.

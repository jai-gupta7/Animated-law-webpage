# First Light R2: style test, A and C side by side (D219)

Jai liked the R1 concept (D218) but called the graphics "typical Claude visual animations". This test rebuilds scenes 0–1 (the kitchen, the street, and a view further down the street) with more detailed shared geometry. It renders them in two art directions on one synced timeline. R1 in `first-light/` is unchanged.

**Run it:** from the repository root, run `py -3 first-light-r2/serve.py` and open <http://localhost:5181/first-light-r2/>. The preview tool also has a `first-light-r2` entry. This server covers the whole repository, because R2 reuses R1's letter and page styles.

| Page | What it shows |
|---|---|
| `index.html` | Both looks side by side, with a journey slider, **Play the journey**, **Turn the letter over**, and the pointer moving both cameras |
| `test.html?style=ink` / `?style=paper` | One look as a scrolling page, with R1's hero and street panels (the page styles are R1's, unchanged) |

## What changed from R1 (both looks)

- **Detail.** The kitchen now has:
  - floor planks, wainscot, a 2×2 casement window and curtains;
  - a turned-leg table, a chair, a mug with a handle, a pen and the bills;
  - a counter run with a kettle, a shelf with jars and plates, and a clock at ten past two.

  The street now has:
  - curbs and sidewalks, gabled houses with porches, picket fences and lit windows;
  - lantern street lamps, utility poles with sagging wires;
  - a parked car, a hydrant and a mailbox, and puddles;
  - layered hills, the far signpost, the moon and clouds.
- **Light.** One soft shadow from the pendant lamp, a moon that casts shadows, and real spot lights in the lanterns. Bloom halos are gone.
- **Motion with weight:**
  - The camera eases on a damped spring with a slight handheld drift and roll.
  - The letter follows on a spring, so it lags, overshoots softly and tilts with its own speed.
  - The curtains blow into the room when the window opens.
  - The rain is angled by wind, and splash rings appear on the road.

## A · Ink and watercolour (`ink.js`)

The scene renders with plain diffuse light, then a post-process repaints it:
- **Ink lines** from depth and normal breaks, with a wobbling width and dry-brush gaps, fading with distance.
- **Washes:** two pigment ramps. Indigo is used for the night, and ochre and umber wherever lamplight falls.
- **Paint behaviour:** soft granulation, bleed through a paper-fixed wobble, and pigment pooling where washes meet.
- **Paper:** lights are left as bare paper with a warm bleed, plus faint paper fibres.

## C · Paper world (`paper.js`)

- **Materials:** card and paper with a procedural fibre texture and bump, so the paper's tooth catches raking light.
- **Light glowing through paper** in the windows and lanterns.
- **Diorama cues:** ambient occlusion (GTAO) for contact shadows, and shallow depth of field that racks focus to the letter, which gives the miniature feel.
- **Cut-card edges:** a pale core where a nearer layer ends, and a small shadow just behind it.
- **Scenery:** cut-card trees as angled flats, clouds hung on threads, and paper halo rings around the moon.
- **Finish:** a warm grade, vignette and film grain.

## Checked, 24–25 November 2026 (in-app browser at 1440 × 900)

- Both looks render the kitchen, the street and the view down the street.
- The slider drives both cameras in sync.
- Both full-page tests scroll and show R1's panels over the new looks.
- No console errors.
- Screenshots are in [evidence/](evidence/). `compare-0-kitchen-first-render.jpg` is before the palette and edge tuning.

**Not checked:**
- Phone widths.
- Real frame rate. The hidden pane is slow, and two GTAO, depth-of-field and ink renderers running side by side are heavy.
- Reduced motion.
- Safari and Firefox.
- The letter turn and Play were wired up but not visually reviewed.

## Known limits

- **Paper (C):** the porch houses on the right are partly hidden behind the lawn trees in the view down the street.
- **Ink (A):** the clouds read as outlined circles.
- **Ink (A):** the rain is very faint.
- **Both:** only scenes 0–1 exist. The rest of the journey (crossroads to the door) needs the chosen look applied after Jai picks one.

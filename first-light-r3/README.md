# First Light R3: the full journey as a paper world (D220)

R3 is the D218 concept (R1) rebuilt in look C from the D219 style test (R2). Jai first picked look A and then switched to look C before any R3 work was built. R1 (`first-light/`) and the R2 test (`first-light-r2/`) are unchanged.

**Run it:** from the repository root, run `py -3 first-light-r3/serve.py` and open <http://localhost:5182>. The preview tool also has a `first-light-r3` entry. Caching is off.

## What R3 is

R3 keeps R1's page, its story beats, the form and confirmation, interactions, lite mode and accessibility behaviour. The files carried over unchanged are `index.html` (title only), `ui.js`, `styles.css`, `audio.js`, `us-map.js` and `letter.js`. The 3D world is new: `world.js` and `build.js`, rendered by `paper.js`.

| Beat | Scene in R3 |
|---|---|
| 0 | The detailed kitchen from R2: curtains, the casement window, the table, chair, counter and clock. The pendant lamp casts one soft shadow |
| 1 | The rainy street: gabled houses with porches, fences, lantern lamps, wires, a parked car, puddles and splashes |
| 2 | The crossroads, with a cross street and a corner lamp. The R1 signposts are now card boards (hover or click; linked to the list) |
| 3 | The firm's brick offices, with lit attorney windows in frames (hover or click; linked to the team), and the columned hearing office |
| 4 | Porch houses that light up from near to far as you arrive, with real porch lights |
| 5 | The map of lights as pinholes in a dark paper sheet, with the coastline as a gold thread. The state finder draws a gold thread to its office |
| 6 | A paper sun rises over the firm's roof, the door opens, and the form is shown. Sending it seals the letter into an envelope and brings in daylight |

**Paper look:**
- **Materials:** card materials with fibre texture and bump.
- **Light and shadow:** one shadow-casting sky light that changes from moon to sun, a pool of four lamp spots and three porch lights, and ambient occlusion.
- **Cut-card edges:** a pale core where a nearer layer ends, with a small shadow just behind it.
- **Scenery:** cut-card trees angled toward the road like theatre flats, clouds hung on threads (hidden in the high map view), and paper discs with halo rings for the moon and sun.
- **Finish:** a warm grade, grain and vignette.
- **Depth of field:** focus racks to the letter in the kitchen and street, and to the place from the crossroads on. The aperture narrows with distance, so the map stays sharp.

**Motion (from R2):**
- The camera eases on a spring with a slight handheld drift.
- The letter follows on a spring and sways.
- The curtains blow in, and the rain falls at an angle with splashes.
- There are no bloom halos.

## Checked, 25 November 2026 (in-app browser)

- **1440 × 900:** all seven scenes. The signposts are readable. The state finder rings Georgia and draws the thread. The form sends to the confirmation, focus moves to its heading and the URL is unchanged. Daylight comes up after sending.
- **375 × 812:** the hero and the porch-light scene.
- No console errors.
- **Fixed during the check:**
  - dark wedges from the letter's shadow on the table;
  - signposts too dark (a corner lamp and a soft glow on the boards were added);
  - the map blurred by depth of field;
  - the sun hidden behind the roof;
  - hung clouds showing their threads from above.
- **Screenshots:** in [evidence/](evidence/).

**Not checked:**
- Phone scenes 1–3, 5 and 6, and 320 and 1024 widths.
- Real frame rate. Shadows, ambient occlusion, depth of field and the depth pass are heavy, so low-power devices should fall back to lite mode.
- Reduced motion.
- A full keyboard or screen-reader pass.
- Safari and Firefox.
- The envelope's flight was checked by jumping its timeline, not watched in real time.

## Known limits

- On phones, the letter can sit partly under the header in the porch scene.
- The signpost boards' card edges are square at the arrow tips.
- Before any real use, the firm must sign off the legal wording (attorney advertising, the 60-day statement and the sample reviews).

## R3.1, 25 November 2026 (D221): fixes from Jai's screenshot review

R3.0 is kept in [versions/2026-11-25-r3.0/](versions/2026-11-25-r3.0/). You can open it at `localhost:5182/versions/2026-11-25-r3.0/`.

| Jai's note | Cause | Fix |
|---|---|---|
| The letter is too big and goes under the desk | It lay on the table at its full 1 × 1.3 m companion size, and its curl bent the edges down | It is now paper-sized on the table (scale 0.3, about 30 × 39 cm), the curl lifts the edges, and it is never placed below the table top |
| The car needs a better model | It was a single extruded block | A sedan: wheel arches, a glass cabin with windscreen and rear window, B-pillars, tyres with rims and hubs, headlights and tail lights, bumpers, grille, mirrors, door lines and handles |
| The building needs a better model | Boxes with flat windows | **Brick office:** plinth, string courses, pilasters, recessed windows with stone lintels, sills and muntins, a dentil cornice, parapet and coping, a rooftop stair house and water tank, an entrance surround with steps and a canopy with the firm's name, and windows on the end wall. **Hearing office:** stone, with a six-column portico, entablature with the name, pediment and steps |
| The camera goes below ground before section 4 | No ground plane at all (lost when the builder was split), and the camera curve dipped because the next station (the map) is high above | A grass ground under everything; two extra path points keep the camera level; outdoors it never goes below 1.35 m |
| The map looks like a flat 2D image | A flat dark sheet in empty space, seen from straight above | The road now leads to a **paper relief** on the ground: three stacked land layers with a gold-thread edge, stacked contour layers for the Rockies, Appalachians and Sierra, a blue paper sea with cut ripple lines, city lights on the relief, small paper office buildings with beams, and a state thread drawn over the relief. It is always in the world and seen from an angle |

**Checked at 1440:**
- the paper-sized letter on the table;
- camera height through scenes 3–4 (it stays at 1.68 m or higher);
- the new car while passing;
- the brick office with the attorney windows;
- the map relief with Texas → Atlanta;
- the door;
- no console errors.

**Screenshots:** in [evidence/r3.1/](evidence/r3.1/).

**Not checked:**
- the phone map framing (a new station, not viewed) and other phone scenes;
- the hearing office up close (it sits behind the text panel on desktop);
- frame rate with the extra geometry.

**Follow-up, same day (Jai: the letter is too small on the first screen and almost invisible on the last):**
- **First screen:** the letter on the table is now scale 0.5 (about 50 × 65 cm), and the opening camera moved in close over the table, so the letter and its DENIED stamp are the subject.
- **Door:** the letter sits low-left in front of the brick, not against the bright sky. Focus comes back to it, with a shallower blur so the firm stays legible.
- Checked at 1440: `evidence/r3.1/0-kitchen-letter-hero-closer.jpg` and `6-door-letter-sharp.jpg`.


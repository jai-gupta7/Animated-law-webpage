# First Light: immersive SSD landing-page pilot (D218)

An experimental proof of concept (POC), separate from the Figma catalogue. It is a single first-person 3D journey, travelled by native scroll from night to dawn. It follows the visitor's denial letter from the kitchen table to the firm's door, where the letter becomes the free case review form and then the confirmation. Ashgrove & Penn is the placeholder firm (D4), and all content is sample SSD content.

**Run it:** from the repository root, run `py -3 first-light/serve.py` and open <http://localhost:5180>. The preview tool also has a `first-light` entry in `.claude/launch.json`. The server turns caching off so edits show on reload.

## The journey

| Beat | Scene | Page section | Interaction from the world's own elements |
|---|---|---|---|
| 0 | Night. The kitchen table under one lamp, with the denial letter on it and rain on the window | Hero: headline and the question bar *Where are you in your claim?* | Click the letter, or use **Turn the letter over**, to read the plan on its back. Each answer flies the camera to that stage and pre-fills the form |
| 1 | The window swings open and the letter flies out into a wet street | After a denial (60-day reconsideration) | Scroll speed makes the letter flutter |
| 2 | A crossroads with signposts in the mist | Choose your path: SSDI, SSI, Appeals, Hearings | Point at a signpost and it lights and swings. Clicking a signpost opens the matching item, and pointing at an item lights its signpost |
| 3 | Pre-dawn. The firm's windows are lit across from the hearing office | Your hearing and the attorneys | Pointing at a lit window highlights that attorney, and the other way round. Clicking a window opens their profile |
| 4 | Porch lights come on from near to far as you arrive | People we've helped (sample reviews and disclaimer) | None beyond the scroll |
| 5 | The camera rises and the land becomes a US map of lights spreading out from the three offices | Where we help: the state finder | Choosing a state rings it and draws a gold thread to its office |
| 6 | Sunrise over the firm's roof. The door opens | The free case review form | Sending the form folds the letter in thirds, seals it in an envelope and carries it to the door. Daylight floods the scene |

You can drag sideways anywhere outside the text to look around; the view springs back when you let go. The sound is off by default. Turning it on plays rain at night and birds at dawn, generated in the browser with no audio files.

## Techniques

- **3D:** three.js 0.170.0 through an import map, with no build step.
  - One continuous world, with the camera on CatmullRom curves driven by section centres, as in Moonbloom.
  - Instanced houses, trees and lamps.
  - Rain built from line segments that move in the shader.
  - A sky that changes with the time of day through five keys.
  - Bloom that eases off at dawn.
  - The letter is a shader that flutters and folds in thirds.
  - The map has about 3,000 lights in an additive point shader.
- **Motion on the page:**
  - CSS `@property` colour transitions for the background in lite mode.
  - Each panel is revealed once, then stays still.
  - A same-document View Transition swaps the form for the confirmation.
  - No scroll hijacking.
- **Resilience:**
  - **Lite mode** uses the HTML with a CSS sky and never loads three.js. It turns on automatically for Save-Data or devices with 2 GB of memory or less, and can be toggled from the footer.
  - If WebGL fails, a message appears and the page switches to lite mode.
  - Without JavaScript, all content is readable.
  - With reduced motion, the camera follows the scroll directly, with no rain or flutter, instant folding and fades only.
- **Conversion paths:**
  - A **Free case review** button in the header and a click-to-call phone number.
  - The phone call bar appears after the hero and hides while the form is on screen (D108).
  - The hero answer pre-fills the form.
  - Contact is one click from every scene.

## Pilot tokens

The colours come from the KT vision document, not the DLM System modes.

| Token | Value |
|---|---|
| Ink | `#14171C` |
| Paper | `#F5F1EA` |
| Gold on dark | `#D9B36C` |
| Gold deep | `#8A6526` |
| Seal | `#7A2430` |
| Muted on dark | `#B9BFCB` |

The fonts are Newsreader and Hanken Grotesk. Measured contrast: paper on night 17:1, muted text on night 10.4:1, ink on the gold button 9.1:1, muted text on paper 6.1:1, seal on paper 8.8:1, and the button border on paper 4.7:1.

## Verification, 24 November 2026, in the in-app browser

**Checked:**
- Every beat renders at 1440 × 900, and at 375 × 812 for beats 0, 1, 5 and 6.
- No console errors from the current code. One earlier error, an unhandled rejection from a skipped View Transition, was fixed.
- **Validation:** an empty submit shows four inline errors, announces the count and moves focus to Name.
- **Sending:** a valid send shows the confirmation, moves focus to its heading and keeps the URL unchanged (no form data in the URL). **Start again** restores the form.
- **Hero answer:** it scrolls to the right beat, shows *You are here*, pre-fills the form and announces the change.
- The letter turns over from the button.
- The state finder answers correctly and its ring and thread draw.
- The envelope seals.
- **Lite mode:** three.js and `world.js` are not requested, and the background still changes from night to dawn.

**Screenshots:** in [evidence/](evidence/). Some were taken before the last tuning, such as the early street shot and the letter positions.

**Not verified:**
- Reduced motion (it could not be emulated here).
- Real keyboard-only travel through the whole page.
- A screen reader.
- Hover and drag on touch devices.
- Frame rate on real phones. The hidden browser pane renders at a few frames per second, so the animation speeds seen here are not real.
- The tablet width (1024) and 320.
- Safari and Firefox (View Transitions and `@property` need fallbacks there; the page still works).
- Load time or Largest Contentful Paint (LCP) measurements.

## Limits and follow-ups

- On phones, the form card covers most of the door scene. This keeps the form first.
- The US outline is hand-traced at low detail. It works as a map of lights, not as a cartographic map.
- **Legal:** the attorney-advertising wording, the disclaimers, the 60-day statement and the sample reviews need the firm's sign-off before any real use. No statistics are claimed.
- Not committed anywhere. This folder is not a git repository.

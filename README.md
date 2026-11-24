# First Light: an immersive law-firm landing page (prototype)

An experimental landing page for Social Security Disability claims. A 3D world you travel through by scrolling, from night to dawn. The visitor's denial letter starts on a kitchen table, flies out into a rainy street, and passes the crossroads, the firm's offices, porch lights and a paper map of the country. It reaches the firm's door at sunrise, where it becomes the free case review form and is sealed into an envelope when the form is sent.

**Ashgrove & Penn is a placeholder firm.** Every name, review, office and phone number is a sample, and the form sends nothing.

## Versions

| Folder | What it is | Run it (from this folder) | Then open |
|---|---|---|---|
| [`first-light-r3/`](first-light-r3/) | **Current.** The full journey in the "paper world" look: card materials, soft shadows, ambient occlusion, depth of field, cut-card edges, a paper-relief map | `py -3 first-light-r3/serve.py` | <http://localhost:5182> |
| [`first-light-r2/`](first-light-r2/) | Style test: the kitchen and street in two looks side by side (A ink and watercolour, C paper world) | `py -3 first-light-r2/serve.py` | <http://localhost:5181/first-light-r2/> |
| [`first-light/`](first-light/) | R1, the first proof of concept (glow look) | `py -3 first-light/serve.py` | <http://localhost:5180> |

You can use any static server instead of `serve.py`. Opening the HTML files directly from disk will not work, because the 3D code uses ES modules. Python 3 is only needed for the local server. On macOS or Linux use `python3` in place of `py -3`.

## How it is built

- **No build step.** The pages are plain HTML, CSS and JavaScript modules. [three.js](https://threejs.org) 0.170.0 loads from jsDelivr through an import map.
- **Content stays in the HTML.** All text, the form and every action are real HTML over the 3D canvas, so the page reads without JavaScript, without WebGL, and in the lite mode, which never loads three.js.
- **Accessibility:**
  - `prefers-reduced-motion` turns off flutter and rain, and the camera follows the scroll directly.
  - Every 3D interaction (letter, signposts, office windows, state finder) has an HTML equivalent.
  - Targets are at least 44 px and focus states are visible.
- **Everything in the world is built in code;** no models or images are downloaded. The US outline is hand-traced at low detail.

Each version's README lists what was checked in the browser and what wasn't.

## Before any real use

This is a design prototype. The attorney-advertising wording, the disclaimers, the "60 days to appeal" statement and the sample reviews need the firm's review and sign-off. The form needs a real, secure back end.

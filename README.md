# Grand Line — A Pirate's Log

A first-person 3D pirate adventure that runs in the browser, built for iPad.

Sail a caravel across an open sea, make landfall on eleven islands from the East
Blue to the Grand Line, walk each one in first person, talk your way through the
people who live there, fight when you have to, and gather a crew.

Everything is generated at runtime — the islands, the ship, the people, the
waves, even the sound effects. There are no model files, no textures and no
audio to download. The whole game is about 800 KB, most of which is the 3D
engine.

<p align="center">
  <em>East Blue → Reverse Mountain → the Grand Line</em>
</p>

---

## Playing it on an iPad

The game is a static web page — any way of serving this folder over HTTP will
work. Two routes, depending on whether you want a link you can keep.

### The quickest way: over your own Wi-Fi

Nothing to configure, works with the repository private. On a computer on the
same network as the iPad:

```sh
git clone https://github.com/mj-lilfire/Milo.git
cd Milo
python3 -m http.server 8000
```

Find that computer's local address (`ipconfig getifaddr en0` on a Mac,
`hostname -I` on Linux) and open `http://<that-address>:8000` in Safari on the
iPad. The computer needs to stay awake and on the network while you play.

### A permanent link: GitHub Pages

Two settings, about thirty seconds, and you get a URL you can open on the iPad
from anywhere.

1. **Make the repository public** — [Settings](https://github.com/mj-lilfire/Milo/settings),
   scroll to *Danger Zone*, **Change repository visibility → Make public**.
   (GitHub Pages only serves private repositories on a paid plan.)
2. **Turn on Pages** — [Settings → Pages](https://github.com/mj-lilfire/Milo/settings/pages),
   set *Source* to **Deploy from a branch**, pick branch
   **`claude/one-piece-3d-game-prototype-71p064`** (already the default) and
   folder **`/ (root)`**, then **Save**.

Give it a minute to build. The site lands at:

```
https://mj-lilfire.github.io/Milo/
```

Any other static host works just as well — Netlify, Vercel, Cloudflare Pages,
an S3 bucket. There is no build step, so the folder *is* the site.

### Either way, make it feel like an app

In Safari on the iPad, tap **Share → Add to Home Screen**, then launch it from
the icon. It opens full screen in landscape with no browser chrome, and it
keeps working offline after the first load.

> Safari needs WebGL, which is on by default. If the game reports that it could
> not set out, check **Settings → Apps → Safari → Advanced**.

## The controls

On a touchscreen:

| Control | What it does |
| --- | --- |
| **Left thumb, anywhere on the left of the screen** | Walk. The stick appears wherever you put your thumb down, so you don't have to find it. |
| **Drag on the right of the screen** | Look around. |
| **USE** | Talk, board, open chests, take the helm, drop anchor. |
| **STRIKE** | Swing (ashore only). |
| **JUMP** / **RUN** | As they say. |
| **Log** | The captain's log: your route, your crew, your purse. |

**At the wheel**, the left stick changes job: push forward to set the sails,
left and right to steer. The sails *stay where you trim them* when you let go —
so set your canvas once and steer with your thumb. A ship with no way on barely
answers her helm, which is the point.

With a keyboard: `WASD` move, mouse look, `E` use, `F` strike, `Space` jump,
`Shift` run, `M` log, `Esc` pause.

## The voyage

Eleven islands, each with its own climate, terrain, cast and quest chain.
The Log Pose on the HUD points at the next one and tells you how far.

| | Island | Sea | |
| --- | --- | --- | --- |
| 1 | Foosha Village | East Blue | A windmill town where every voyage starts |
| 2 | Shells Town | East Blue | A Marine garrison with something tied up in its yard |
| 3 | Orange Town | East Blue | Emptied by a circus crew with cannons and a grudge |
| 4 | Syrup Village | East Blue | Sleepy, wealthy, and about to be robbed blind |
| 5 | Baratie | East Blue | A restaurant that floats, staffed by former pirates |
| 6 | Arlong Park | East Blue | A fortress of fish-men taxing a village to the bone |
| 7 | Loguetown | East Blue | The last port before the Grand Line |
| 8 | Reverse Mountain | The Gate | Where four seas climb a mountain |
| 9 | Whisky Peak | Grand Line | A town that welcomes every crew with a feast |
| 10 | Drum Island | Grand Line | A winter island with no doctors left |
| 11 | Alabasta | Grand Line | A desert kingdom three years without rain |

Six crewmates can be recruited along the way. Once aboard they stand on deck,
have something to say, and hit harder alongside you ashore.

Progress saves automatically — on landfall, on departure, at every quest beat,
and whenever you switch away from the tab.

## Running it locally

No build step, no dependencies to install. Serve the folder over HTTP (ES
modules won't load from `file://`):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

To play it on an iPad on the same Wi-Fi, use your machine's LAN address instead
of `localhost`.

## How it's built

Plain ES modules and a vendored copy of [three.js](https://threejs.org) r160.
Nothing is transpiled or bundled, so what is in the repository is exactly what
the browser runs.

```
index.html            the page
style.css             the HUD, tuned for touch and safe-area insets
sw.js                 offline cache
vendor/               three.js r160 (MIT)
src/
  core/    engine, input, HUD, procedural audio, saves, math
  world/   ocean, sky, ship, terrain, props, characters, island assembly
  game/    player controller, sailing, exploring, dialogue, quests, combat
  data/    the route and the crew — pure data
tests/                browser tests that play the game
```

A few things worth knowing if you want to change it:

**Adding an island is a data change.** `src/data/islands.js` describes each one
— terrain shape, palette, what grows there, who lives there, what they want —
and the generators in `src/world` turn that into somewhere you can walk around.
No modelling required.

**The sea is one surface.** A disc of water centred on the viewer, with rings
spaced geometrically so it is dense underfoot and coarse at the horizon. The
fragment shader derives its normals analytically from world position rather than
from the mesh, so distant water keeps its detail on very few triangles.

**The waves are defined once.** `WAVES` in `src/world/ocean.js` is the single
source of truth: the GLSL is generated from that table, so the hull floats on
exactly the water you can see.

**An island is a couple of draw calls.** Every prop is baked down to merged,
vertex-coloured buffers sharing one material — a whole island of palms, houses,
crates and rocks costs two draw calls rather than several hundred. That is most
of the difference between 60fps and a slideshow on a tablet.

**Resolution flexes, frame rate doesn't.** The renderer watches frame cost and
sheds pixel ratio before it sheds frames.

## Testing

Two browser tests drive the real game in a real browser — no mocks, no build
step, the same files a player loads. See [`tests/README.md`](tests/README.md).

```sh
npm install playwright
python3 -m http.server 8099 &
node tests/smoke.js    # one voyage: sail, dock, walk, talk, save, resume
node tests/route.js    # all eleven islands, every quest stage, teardown audited
```

`smoke.js` fails on any console error and audits every island's places,
islanders, chests, beacons, buildings and enemy camps for anything sitting
underwater or on a cliff face. `route.js` visits all eleven islands, steps
through each quest stage to confirm gated enemies appear on cue, lands a hit on
one, and — by hooking geometry disposal — verifies that leaving an island
releases everything it allocated except the ship.

## A note on what this is

This is an original, non-commercial fan prototype, made for the fun of it. It
is inspired by *One Piece* — the island names, the shape of the voyage and the
crew are affectionate nods to the series and its live-action adaptation — but
every asset here is generated from the numbers in this repository. No art,
audio, models or text from any published work is included or reproduced.

*One Piece* is created by Eiichiro Oda; all rights belong to their respective
owners. Nothing here is endorsed by or affiliated with them.

The code is MIT-licensed; three.js is vendored under its own MIT licence in
`vendor/THREE-LICENSE.txt`.

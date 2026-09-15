# Tests

Browser tests that drive the real game in a real browser. There is nothing to
build — they load the same files a player loads.

```sh
npm install playwright            # once, anywhere on your PATH
python3 -m http.server 8099 &     # serve the repository root
node tests/smoke.js               # one voyage, start to finish
node tests/route.js               # every island, end to end
node tests/weather.js             # every sea state
node tests/encounters.js          # cannons, sea kings, patrols, hull damage
node tests/shop.js                # traders and upgrades
```

Environment variables: `BASE` (default `http://127.0.0.1:8099/`), `SHOTS`
(where screenshots are written), and `CHROMIUM_PATH` if you want to point at a
browser Playwright did not install itself.

### `smoke.js`

Boots the game, starts a new voyage, takes the helm, sets the sails and checks
the ship makes way, docks at the first island, walks ashore, holds a
conversation through to the end and checks it advanced the quest, saves,
reloads the page, resumes, and opens the captain's log. It fails on any console
error, and audits every island's places, islanders, chests, beacons, buildings
and enemy camps for anything sitting underwater or on a cliff face.

### `route.js`

Makes landfall on all eleven islands in turn. For each one it checks the island
builds with its cast and scenery, steps through every quest stage to confirm
the objective updates and gated enemies appear on cue, lands a hit on one of
them, and then — using a hook on geometry disposal — verifies that leaving the
island releases everything it allocated except the ship, which sails on. It
finishes by checking a full crew renders on deck.

Both write screenshots as they go, which is the quickest way to see what the
game actually looked like when something failed.

### `weather.js`

Steps through calm, breeze, squall and storm, and for each one checks that the
shader uniform and the CPU buoyancy sampler agree on how big the sea is running
and that the hull is riding the water it is actually in — the failure this
guards against is a ship that hovers above a storm or sinks through it. Also
checks rain and fog respond, and that the weather survives a save and reload.

### `encounters.js`

Spawns a sea king and confirms its body trails its head instead of bunching up
at the skull, fires the cannon and confirms the reload gate, drives a threat to
zero and checks the payout, spawns a Marine patrol, then takes hull damage and
founders the ship to confirm being holed costs Berries rather than the voyage.

### `shop.js`

Opens a trader with an empty purse (only the polite exit should be offered),
then with a full one (the whole list, priced, with upgrade levels), buys the
rigging and checks the money left and the top speed rose, buys a repair, and
confirms a maxed-out upgrade drops off the list.

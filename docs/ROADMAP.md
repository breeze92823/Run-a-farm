# Run a Farm: Roadmap

Ideas for what to build next, in the suggested order. Each item says what it is, which parts of the code it touches, and how to tell it's done. Read `CLAUDE.md` first: it documents the current systems (economy in `src/game.js`, tunables in `src/config.js`, world modules in `src/farm/`, HUD in `src/hud/`).

## Where the game stands

- **Progression:** the player starts with $0, Coop 1 and the Farm Stand. Everything else is bought on build pads: coops, fields, seed market, storage barn, carton packer, tractor and truck bays, drone base, ranch barns, oil field and rail station. Buildings rise out of the ground when bought (`farm/gates.js`).
- **Selling:** the stand, the town market (east along the road), the egg van (cartons), trucks and drones (storage goods), and the train (oil).
- **Vehicles:** a free bike, plus trucks and tractors bought at the town's vehicle dealer. The player drives them first; hired drivers automate them later. All share the animator in `farm/rig.js`.
- **Ranch:** ducks, cows, pigs and horses with jointed gaits (`farm/animals.js`). Each barn has a produce crate, +1 animal, Better Feed and Barn Expansion upgrades.
- **Oil:** full-size pump jacks (`farm/pumpjack.js`), each needing an oil worker, with Motor, Drill Bit and Counterweight upgrades. The train stops at the rail station to buy oil.
- **Saving:** progress is saved to localStorage under `run-a-farm.save.v2`. There is no networking yet.

## Rules for every feature

- Every tunable goes in `src/config.js` (`GAME` / `FARM`), never inline.
- Every action needs a touch path and must work at 375×812 and 812×375 (see "Mobile & responsive" in `CLAUDE.md`).
- New models use the kit in `farm/detail.js` (`rbox`, `tube`, `lathe`, `extrude`, `tyre`, `lens`, `compact`). Keep moving parts in their own groups, or flag them with `userData.keep`, so `compact()` never merges them.
- Anything bought later is built inside `gated(root, id, fn)` so it stays hidden until bought.
- Watch draw calls. A full farm currently costs about 1,000 to 1,900 calls, shadows included. Measure with `renderer.info` after a change.
- New sounds go in `audio/sfx.js`. Use the particles in `farm/particles.js` (`burst`, `confetti`, `coins`, `ring`, `puff`, `dust`).
- `vite build` does not catch undefined names. After a change, load the game and check the console for errors.

---

## Phase 1: fix what's already there (do first)

### 1.1 Real-time playtest and tuning — NOT DONE (needs hands-on playtesting)
- Drive the bike, truck and tractor with the keyboard and with touch. Tune turn rate, speed and acceleration (`GAME.bike`, `GAME.truck`, `GAME.tractor`) and the camera follow while riding (`src/camera.js`).
- Check the avatar's seat heights and offsets on each vehicle (`SEAT_Y` in `src/main.js`).
- Pacing targets: Coop 2 in about 2 minutes, the Storage Barn in about 10 minutes, the first truck in about 20 minutes. Adjust prices in `GAME.buildings`, `GAME.shop` and `GAME.vehicles`.
- **Done when:** a fresh save reaches the Storage Barn in 8 to 12 minutes of normal play, and every vehicle can be driven around the farm and into town without getting stuck.

### 1.2 Phone performance pass — PARTLY DONE (`farm/lod.js`: small moving models hide beyond `GAME.lod.far`, no shadows on Medium/Low; not profiled on a real phone)
- Add lower-detail versions (or hide them) for vehicles, animals and pump jacks beyond about 60 m.
- On the Medium and Low presets, turn off shadows on small and moving parts (wheels, animals, NPCs).
- Profile on a mid-range phone; the target is a steady 30 fps.
- **Done when:** a fully built farm runs at 30 fps or more on the Medium preset on a phone, and at 60 fps on desktop High.

### 1.3 Onboarding — DONE (`econ/tutorial.js`, `farm/living.js` arrow, `hud/hud2.js` hint)
- A guided first few minutes with floating arrows and short HUD hints:
  1. Collect eggs at Coop 1.
  2. Restock the stand.
  3. Ride the bike to town and sell.
  4. Buy Coop 2.
- Store tutorial progress in the save, and let the player skip it in Settings.
- **Done when:** a new player is led to the town market without reading any instructions, and the tutorial never shows again once finished.

---

## Phase 2: production chains (the core tycoon fun)

### 2.1 Processing buildings — DONE (`econ/processing.js`, `farm/park.js`, `farm/procmodels.js`)
Each is a new gated building with an animated machine: conveyors, spinning parts, steam and particles. Each takes inputs from storage and outputs a higher-value good back into storage.

| Building | Input | Output | Machine idea |
|---|---|---|---|
| Flour Mill | wheat | flour | windmill sails or a grinder with flour dust |
| Bakery | flour + eggs | bread, cakes | oven glow, rising smoke, cooling racks |
| Dairy | milk | cheese, butter | churn, cheese wheels on shelves |
| Juice Press | carrots, pumpkins | juice | press plate, bottles on a conveyor |
| Oil Refinery | crude oil | fuel | distillation column, flare, pipe racks |

- Add new goods to `GAME.goods` (market prices) and icons to `hud/icons.js` `GOOD_ICONS`.
- Each building has a processing timer, a speed upgrade, a capacity upgrade and a worker type (Miller, Baker, and so on), following the ranch pattern.
- **Done when:** wheat → flour → bread works end to end with storage, trucks and drones selling the products, and every machine visibly runs while processing.

### 2.2 Contracts board (in town) — DONE (`econ/contracts.js`)
- A board in town offering 3 contracts at a time, for example "Deliver 40 milk + 20 bread within 10 minutes", with a reward of 1.5 to 2× the market value plus a bonus item.
- Contracts are delivered at the town market zone (by truck or on foot).
- **Done when:** contracts generate, expire, can be completed by delivery, and pay out with a big confetti and coin effect.

### 2.3 Changing market prices — DONE (`econ/prices.js`)
- Each good's price drifts within ±25% over the day, and one "hot item" a day sells for 2×.
- Show the price trend in the Index window and in a town market window (up and down arrows).
- **Done when:** prices change visibly over time, and the hot item is highlighted in the HUD.

---

## Phase 3: a living world

### 3.1 Day/night cycle that matters — DONE (`econ/clock.js`; N skips to dawn/dusk)
- Automatic day/night on a timer (it currently toggles with N), lasting about 10 minutes.
- At night hens lay slower, the stand has fewer customers, and lanterns, headlights and barn lights glow (`rig.js` `env.night` already handles headlights).
- **Done when:** night arrives on its own with the lights coming on and economy effects active, and the HUD shows a clock.

### 3.2 Weather — DONE (`econ/clock.js`, `farm/seasons.js`, `audio/extra.js`)
- Rain (a particle sheet, puddles, darker sky): crops grow faster.
- Wind gusts (stronger leaf and wheat sway): drones fly slower.
- Storms (lightning flashes, thunder): vehicles slow down.
- Weather sounds go in `audio/farm.js` / `audio/sfx.js`.
- **Done when:** weather changes over time, shows a HUD badge, and has visible, audible and economic effects.

### 3.3 Seasons and events — DONE (festival, blossom; winter was removed)
- The weigh-off pumpkin festival in autumn (the pumpkin and weigh-off already exist): crowds, stalls, a judging event.
- Spring: a planting bonus and blossom trees.
- **Done when:** at least one seasonal event runs on a schedule, with its own decorations and reward.

### 3.4 Visitors and NPC life — DONE except the van driver's wave (`farm/living.js`, ranch riders)
- Customers walk from the road to the stand, queue, and leave carrying cartons.
- Tourists ride horses in the arena (this would also explain where ride money comes from).
- The van driver waves, and a vet visits the ranch now and then.
- **Done when:** the farm feels busy, and NPC activity scales with how many customers the farm gets each minute.

---

## Phase 4: animals and ranch

### 4.1 Animal care — DONE (`econ/care.js`)
- Feed and water troughs empty over time, and the player or a ranchhand refills them.
- Happiness (0 to 100%) scales production. Happy animals show hearts; unhappy ones look sad and drop their heads.
- An Automatic Feeder upgrade removes the chore.
- **Done when:** neglected barns slow down visibly, and refilling troughs restores production with a feedback effect.

### 4.2 Breeding — DONE
- Buying "+1 animal" (or breeding) spawns a baby (a scaled-down model) that grows to adult size over a few minutes.
- **Done when:** babies appear, follow their mothers, and grow up.

### 4.3 New animals — DONE (sheep, goats, bees)
- **Sheep:** wool. Shearing is a short hold-to-shear interaction with wool particles.
- **Goats:** goat milk, which becomes goat cheese at the Dairy.
- **Bees:** hives near the sunflowers make honey, and full sunflower fields give a bonus.
- **Done when:** each new animal has a gated building, a herd with a gait, a product, and upgrades.

### 4.4 Horse riding — DONE
- Ride a horse like the bike: walk, trot and canter gaits already exist in `animals.js`.
- Horses can cross fields and paddocks.
- **Done when:** the player can mount a horse from the stables and ride it anywhere on the farm.

### 4.5 Jumping mini-game — DONE (`econ/minigames.js`)
- A timed course in the arena: jump the existing fences, collect time bonuses, earn prize money, and post a best time.
- **Done when:** the course has a start and finish, a timer, scoring, and a reward.

---

## Phase 5: vehicles and machines

### 5.1 New vehicles — DONE (`econ/fleet.js`, `farm/fleet3d.js`; the plane is a helicopter)
- **Combine harvester:** the one parked in the barn becomes drivable. It harvests whole fields in one pass with a big chaff cloud.
- **Crop sprayer:** temporarily speeds up a field's growth.
- **Milk tanker:** an automated ranch → town route.
- **Livestock trailer:** sell animals.
- **Cargo helicopter or plane:** a late-game long-distance sale with a big payout.
- Every vehicle uses `makeRig` and `updateRig` from `farm/rig.js`.

### 5.2 Fuel and repairs — DONE (the fuel station stands in the Processing Park)
- Vehicles use fuel; a fuel pump sits at the truck bay. Refinery fuel can supply it for free.
- Vehicles wear over time, show more smoke when worn, and are repaired at a new workshop.
- **Done when:** fuel and wear are visible in the HUD while riding and can be refilled or repaired.

### 5.3 Customisation — DONE
- Paint colours, decals, horns, rims and light bars bought at the dealer and shown on the models (the `setLevel` pattern).
- **Done when:** each vehicle's look is saved, and a preview shows in the dealer window.

### 5.4 Garage and car wash — DONE
- Bays visibly fill up with bought vehicles.
- A car wash with foam particles and brushes gives a temporary speed boost.

---

## Phase 6: progression and goals

### 6.1 Farm level and XP — DONE (`econ/progress.js`)
- Earning, building and harvesting all give XP. Levels unlock new zones: a north orchard (apples), a lake with a fishing dock, a greenhouse for year-round crops.
- **Done when:** an XP bar appears in the HUD, levelling up plays a celebration, and zones unlock by level.

### 6.2 Achievements and trophy shelf — DONE (the shelf is on the cottage porch)
- Examples: "Harvest 1,000 corn", "Own every animal", "Sell 10,000 eggs".
- Trophies appear on a shelf inside the farmhouse, with a window listing every achievement.

### 6.3 Prestige / rebirth — DONE
- Sell the farm for a permanent money multiplier and start again faster. Some cosmetics carry over.
- **Done when:** a confirmation window appears, the multiplier applies to all earnings, and it is saved.

### 6.4 Zone managers — DONE
- A foreman per zone (yard, fields, ranch, oil) who auto-hires and auto-upgrades the cheapest option within a budget the player sets.

---

## Phase 7: satisfaction and polish — DONE (combo, rare drops, overview, music, photo mode)

- **Combo meter:** fast manual collecting builds a streak multiplier, shown in the HUD with sound pitch rising.
- **Rare drops:** a golden egg or giant crop (1% chance) with a big particle burst and a jingle.
- **Overview camera:** a slow aerial fly-over of the farm, opened from the menu.
- **Music:** a different background track per zone (farm, town, ranch, oil field) that crossfades as the player moves.
- **Photo mode:** a free camera with the HUD hidden.

---

## Phase 8: multiplayer (uses `Run-a-farm-backend`) — NOT STARTED

The backend (Colyseus + MongoDB) exists, but the frontend no longer talks to it. `net.js` was removed, so this phase starts by rebuilding the client connection.

- **Cloud save:** move progress from localStorage to the backend.
- **Farm visits:** visit friends' farms (read-only), and help harvest one of their fields for a shared reward.
- **Trading:** send goods to a friend's storage.
- **Leaderboards:** the pumpkin weigh-off, farm value, and contracts completed.
- **Done when:** two players can see each other on one farm, and saves persist across devices.

---

## How to use this file in a new chat

Start the chat with something like:

> Read `CLAUDE.md` and `docs/ROADMAP.md`. Implement **2.1 Processing buildings** (start with the Flour Mill and Bakery), following the rules in the roadmap. Test it in the browser when done.

Do one numbered item (or one row of a table) per chat. Mark items done here as they ship.

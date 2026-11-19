[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/OhhRayy/solmar/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/OhhRayy/solmar/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar

A sun-soaked open-world crime game, built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01) (gta6-01). An original 2D top-down city — no Rockstar names, characters, maps, art or music anywhere in it.

You are **Rio Vega**, a driver fresh out of the marina with an empty wallet and a fast reputation. **Mara Sol**, the fixer at the Palm Plaza, has five jobs for you. Finish them all and the city is yours.

## The city

Solmar is a seeded coastal city: an 8×6 road grid with buildings (some with rooftop pools), parks, a palm plaza, and a beach with the sea at its southern edge. Sixteen traffic cars drive the lanes and turn at intersections; twenty-six pedestrians stroll the sidewalks and run from crime. Everything is procedural canvas art — no libraries, no network requests, no assets to download.

## Play

- **On foot:** WASD / arrows to move, Shift to sprint, Space or F to punch (find the bat near the plaza to hit twice as hard), E to steal a car.
- **By car:** W / Up to accelerate, S / Down to brake and reverse, A / D to steer, Shift for the handbrake drift. Cars slide off walls instead of sticking. E steps back out.
- **Wanted:** five stars. Stealing cars, hitting pedestrians and punching cops raise the heat; it cools off when no officer can see you. Foot cops chase and arrest; interceptor cars chase and ram. Get wasted or busted and you wake up at Solmar General, lighter in the pocket.
- **Missions (five, in order):** Hot Wheels (steal and deliver a car), Sunset Run (five checkpoints, 90 seconds), Lose the Heat (shake a two-star wanted level), Cab Hustle (three fares), The Solmar Score (walk into the Reserve Bank, take the vault cash, lose the law at the beach). Objectives, timers and a target arrow live on the HUD; passing a job pays cash.
- **HUD:** cash, health, wanted stars, a live minimap (roads, buildings, police, target), an objective banner, a speedometer, and toasts. Title, pause, Wasted, Busted and failed-job screens; progress (cash, jobs done, best cash) saves in localStorage.
- **Sound:** synthesised WebAudio only — a groove, two-tone sirens and an engine hum that follows your speed. It starts on your first keypress and never errors without audio.

## Run

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no install: `game/` is plain static files, and `game/index.html` plays in desktop Chrome with no network request. `main.ts` (Node 22, standard library only) hands the entry in: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Screenshots

Deterministic scenes, staged by playing the real rules with an autopilot — `?shot=finale|drive|mission|start&seed=1`:

1. `1-finale.jpg` — the getaway from The Solmar Score: five stars, two interceptors closing in, timer running
2. `2-drive.jpg` — cruising in a stolen car
3. `3-mission.jpg` — Sunset Run in progress, timer running, checkpoint ahead
4. `4-start.jpg` — the title over the living city

## Structure

One clear job per file under `game/src/`: `config`, `random`, `world` (city + collision + road routing), `input`, `audio`, `player`, `vehicles` (car physics + enter/exit), `traffic`, `police` (wanted level + law), `missions`, `combat`, `render`, `hud`, `shots` (deterministic scenes + autopilot), `engine`, `main`.

Referral code: `9j4a5was`

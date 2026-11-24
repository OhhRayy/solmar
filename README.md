[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/OhhRayy/solmar/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/OhhRayy/solmar/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [Make GTA 6 bounty on make.fun](https://make.fun/bounty/gta6-01).

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/OhhRayy/solmar/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/OhhRayy/solmar/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [Make GTA 6 bounty on make.fun](https://make.fun/bounty/gta6-01).

# Solmar — an open-world crime game

A sun-soaked coastal city, a driver in debt, and five missions to buy his
freedom. Solmar is a complete 2D top-down open-world crime game that runs
entirely from static files in a desktop browser — no network, no build step,
no libraries.

## The story

Dax Mercer just got out of the Solmar docks and owes fixer Lena Cruz one
last favour. Five jobs stand between him and a clean slate: a marina pickup,
a borrowed car, a handoff on Coral Row, a getaway through Harbor Heights,
and finally the vault truck crossing the causeway at dawn.

## How to play

Open `game/index.html` from any static server (for example
`node serve.ts`, then http://localhost:8080) and press ENTER.

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk, or drive when in a car |
| E | Steal / enter the nearest car, or step out |
| SPACE | Fight (fists, or the baseball bat if you found one) |
| P | Pause |
| M | Mute |

## What is in the city

- **A city to explore** — a deterministic 3200×3200 street grid with
  buildings, parks, palm trees, a beach and the sea, on foot or by car.
- **Traffic and pedestrians** — cars cruise the roads and turn at
  intersections; pedestrians stroll the sidewalks and flee speeding cars.
- **Cars to steal** — walk up to any car and press E. Stealing in front of
  witnesses raises your wanted level.
- **Wanted level and police** — five stars. Cruisers spawn, chase and ram
  you; the heat cools off if you stay out of sight. Get caught on foot at
  high heat and you are Busted; run out of health and you are Wasted.
- **Five missions with payouts** — follow the gold marker and the yellow
  target arrow; each completed job pays cash (total $4,800).
- **Combat and pickups** — fists and a baseball bat, plus first-aid
  pickups hidden around the city.
- **HUD** — cash, health bar, wanted stars, a live minimap with the
  mission target and police blips, an objective line, a target arrow with
  distance, and a speedometer while driving.
- **Screens and saves** — title, pause, Wasted and Busted screens;
  progress saves automatically to localStorage.
- **Sound** — everything is synthesized with WebAudio: a bass groove,
  two-tone sirens, engine hum and impact effects. No audio files.

## Files

- `game/index.html` — the page
- `game/style.css` — page chrome
- `game/js/audio.js` — synthesized sound (WebAudio)
- `game/js/city.js` — the deterministic city generator and renderer
- `game/js/entities.js` — traffic, pedestrians and police
- `game/js/missions.js` — the five-mission story
- `game/js/game.js` — player, HUD, minimap, screens, saves, shot scenes
- `main.ts` — builds the submission output (`/output` + `dossier.json`)
- `serve.ts` — local static server for play-testing

## Screenshots

Staged deterministic scenes, opened with `?shot=<name>&seed=1`:

- `1-finale.jpg` — the final mission: five stars, police chase, causeway
- `2-drive.jpg` — driving with three wanted stars and cruisers behind
- `3-foot.jpg` — on foot downtown with one star
- `4-mission.jpg` — mission 3, the handoff, with the target arrow

Everything in Solmar — the city, the names, the characters, the story and
the music — is original work made for this entry.

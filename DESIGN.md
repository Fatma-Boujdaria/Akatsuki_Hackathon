# Tranche Guard design

Source of truth for the web app (`frontend/`) and the phone app (`mobile/`).
Visual reference: the "Tranche Guard App Screens" design canvas (home dark and light,
login, electricity, water, alerts and tips, challenges, profile and settings, demo control).
Web implementation: `frontend/src/index.css`. Flutter: `mobile/lib/theme.dart`.

## Palette (Sicily)
Bahr `#1D59BB` (brand), Chams `#FEBD19` (electricity), Ciel `#76B9FF` (water),
Sable `#FEF3B3`, navy `#0D1820`. Dark first, light twin. Components use the semantic
tokens below, never raw hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| canvas | #EEF4FB | #0D1820 | page background |
| surface | #FFFFFF | #16273A | cards, nav pill |
| sunken | #E4ECF5 | #1B2F44 | inner tiles, inactive chips |
| hairline | #DCE6F0 | #24384C | dividers, bar track |
| control | #8496A8 | #6F8397 | input borders, disabled |
| mute | #4A5B6C | #9FB1C2 | secondary text |
| body | #24384C | #D5E1EC | body text |
| ink | #0D1820 | #FFFFFF | titles, numbers |
| primary | #1D59BB | #FEBD19 | main button, active nav |
| on-primary | #FFFFFF | #0D1820 | text on primary |
| primary-soft | #DFEAFA | #2A2410 | soft fills |
| link | #1D59BB | #76B9FF | links |
| chip-active / on | #1D59BB / #FFF | #FFFFFF / #0D1820 | selected chip |
| elec / elec-ink / elec-soft | #FEBD19 / #8A5E00 / #FEF3B3 | #FEBD19 / #FEBD19 / #2A2410 | electricity |
| water / water-ink / water-soft | #76B9FF / #1D59BB / #E3F0FF | #76B9FF / #76B9FF / #1D3B5E | water |
| bar / bar-track | #1D59BB / #DCE6F0 | #76B9FF / #24384C | tranche bar |
| success / soft | #15803D / #DCF5E7 | #3DDC97 / #143327 | OK states |
| harissa / soft / line / body | #A15C00 / #FFF4D6 / #FEBD19 / #5C4400 | #FEBD19 / #2A2410 / #FEBD19 / #E9DDB0 | heads-up (tranche near or crossed) |
| grenade / soft / line | #B42318 / #FDE8E6 / #F5B5AE | #FF9A8A / #3A1F22 / #6B3236 | broken (leak, fault, error) |
| tile | #E3F0FF | #1D3B5E | icon tile behind a tip |

## Type
Plus Jakarta Sans everywhere (Arabic: Noto Sans Arabic, line height +3 px). Numbers use
tabular figures.

| Style | Size / line | Weight |
|---|---|---|
| hero | 40 / 44 (48 / 52 wide) | 800, -1 px |
| display | 22 / 30 | 800 |
| h1 | 22 / 28 | 800 |
| metric | 28 / 34 | 800, -0.5 px |
| h2 | 18 / 26 | 800 |
| h3 | 15 / 22 | 700 |
| body | 15 / 23 | 400 |
| small | 13 / 19 | 500 |
| label | 13 / 18 | 700 |
| data | 14 / 20 | 700 |

## Shape and layout
- Radius: cards 20, inputs and small tiles 14, chips inside cards 12, pills and nav fully round.
- Phone: 16 px gutter; floating pill bottom nav (68 px high, 12 px from the sides, 14 px above
  the safe area, shadow `0 10 30 rgba(13,24,32,.25)`): Accueil, Électricité, Eau, Défis, Profil.
- Home header (home screen only): home name with a chevron and "city · en direct" under it,
  round bell (Chams dot when an alert is open) and round Bahr avatar with the initial.
- Tap targets at least 44 px. No borders on cards: surface colour on canvas.
- Forecast part of a tranche bar: Chams diagonal hatching.

## Voice
French first ("tu"), English and Tunisian Arabic (derja, right to left). Money in DT,
estimates marked "≈" or "(estimation)".

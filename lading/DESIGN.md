# Lading design language: Carbon Copy

Vendors send messy paperwork: acknowledgments, backorder notices, freight updates, receiving reports. Lading turns each one into a clean duplicate that a designer can trust. The design language comes from that idea: a carbon copy of the paperwork, with the source always visible underneath.

## Principles

1. **Every fact shows its source.** Any date, status or quantity that Lading read from an email carries a carbon-blue underline. Hovering or focusing it highlights the exact line in the original email. Nothing changes without the line it came from.
2. **Time is drawn, not just printed.** An order's lost time appears as a hatched gap between the promised date and the current date. Hatching is the architect's mark for cut material; here it marks time cut out of the schedule.
3. **Calm by default, loud only for real problems.** Most rows are graphite on paper. Color appears only when a date slips, a carton is damaged or an install is at risk.
4. **The designer confirms, Lading files.** Uncertain reads ask for confirmation in plain words ("The vendor said 'late January'. Check the date."). Lading never guesses silently.

## Color

One accent, three signal colors, cool neutrals. No cream, no gradients.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F3F4F6` | `#101216` | Page ground |
| `--sheet` | `#FCFCFD` | `#171A1F` | Raised surfaces: email sheet, drawer, inputs |
| `--ink` | `#16181D` | `#E8EAEE` | Primary text |
| `--ink-2` | `#596070` | `#A0A7B3` | Secondary text, labels |
| `--rule` | `#D9DCE2` | `#2A2E36` | Hairlines, tracks |
| `--carbon` | `#2340D8` | `#8EA1FF` | The accent: sources, links, primary action, install markers |
| `--carbon-wash` | `#E5E9FB` | `#1C2442` | Highlighted source text, selected rows |
| `--late` / `--late-wash` | `#A8500C` / `#FAEBD9` | `#F0A35C` / `#36260F` | Slipped dates, backorders |
| `--risk` / `--risk-wash` | `#BF2630` / `#FBE3E4` | `#FF8B8F` / `#3A1C1F` | Damage, install conflicts |
| `--ok` / `--ok-wash` | `#1D7549` / `#DFF1E6` | `#6FD39C` / `#13301F` | Delivered, arriving early |

Signal colors are never decoration. Carbon blue is never used for a warning.

## Type

| Role | Face | Where |
|---|---|---|
| Stencil | Big Shoulders Stencil Display 700 | Only the wordmark and the few numbers that matter most: days of drift, counts that need action. Freight crates are stenciled; so are these. |
| Text | Schibsted Grotesk 400/500/600 | All interface text and email bodies |
| Data | IBM Plex Mono 400/500 | PO numbers, sidemarks, dates in columns, tracking numbers |

Scale: 12, 13, 15, 18, 24, 40, 64 px. Interface text is 15 px. Uppercase labels are 12 px with 0.06em tracking, used sparingly. All numbers in columns use tabular figures.

## Shape

- **Radius:** 3 px on every rectangle (sheets, inputs, buttons). No pills.
- **Hang tag:** status chips are shaped like a shipping tag: a pointed left end and a punched hole. This is the only non-rectangular shape in the system.
- **Elevation:** surfaces are separated by hairlines and the paper/sheet contrast. Only the drawer and the toast cast a shadow, tinted toward the ink.

## Signature components

- **Drift line:** a shared time axis across all orders. A short tick marks the promised date, a solid block marks the current estimate, and the gap between them is hatched (amber when late, green when early). Each room's install date is a dashed carbon line through its rows, so a late item visibly crosses it.
- **Source underline:** extracted values link to their source span in the email. Hover, focus or tap to highlight it.
- **Room readiness line:** each room states when everything should be on site and how that compares with the install date, in one sentence.

## Motion

- 160 ms for hover and focus, 240 ms for state changes, easing `cubic-bezier(.2,.7,.2,1)`.
- One orchestrated moment: when an update is applied, that order's estimate block slides from the old date to the new one and the hatch grows behind it.
- Everything is instant under `prefers-reduced-motion`.

## Writing

- Name things the way designers do: acknowledgment, sidemark, receiver, install date, COM.
- Short, active sentences. Buttons say what happens ("Apply to order", "Copy text").
- Client-facing drafts are warm and plain, never alarmed, and always end with the next step.
- No em dashes.

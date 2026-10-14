---
{
  "name": "Mazi — Luminous night",
  "description": "Implemented visual system for the local Atlas: a night globe in space by default and a daylit paper atlas on request.",
  "colors": {
    "bg-void": "#05070c",
    "bg-deep": "#0a0f18",
    "bg-raised": "#121a26",
    "surface": "#161f2d",
    "line": "#263244",
    "line-soft": "#1c2636",
    "text-primary": "#eef2f7",
    "text-body": "#c9d2de",
    "text-secondary": "#9aa6b8",
    "text-muted": "#7f8b9e",
    "accent-atmosphere": "#8fd3ff",
    "accent-terminator": "#ffb46a",
    "accent-node": "#ffe2a8",
    "accent-hot": "#fff3da",
    "on-accent": "#05070c",
    "focus": "#b8e4ff",
    "success": "#6fd6a5",
    "warning": "#f2c25b",
    "error": "#ff7a6e",
    "day-bg-void": "#f4f2ec",
    "day-bg-deep": "#ece9e1",
    "day-bg-raised": "#e2ded4",
    "day-surface": "#fbfaf6",
    "day-line": "#cfc9bc",
    "day-line-soft": "#ddd8cc",
    "day-text-primary": "#10141b",
    "day-text-body": "#2a303b",
    "day-text-secondary": "#4a5160",
    "day-text-muted": "#5e6573",
    "day-accent-atmosphere": "#1c6599",
    "day-accent-terminator": "#934f10",
    "day-accent-node": "#7d5a12",
    "day-accent-hot": "#a85a12",
    "day-on-accent": "#fbfaf6",
    "day-focus": "#0b5cad",
    "day-success": "#1a6e48",
    "day-warning": "#825900",
    "day-error": "#b3261e"
  },
  "typography": {
    "display-xl": {
      "fontFamily": "Instrument Serif, serif",
      "fontSize": "72px",
      "fontWeight": 400,
      "letterSpacing": "-0.01em"
    },
    "display-l": {
      "fontFamily": "Instrument Serif, serif",
      "fontSize": "48px",
      "fontWeight": 400
    },
    "display-m": {
      "fontFamily": "Instrument Serif, serif",
      "fontSize": "32px",
      "fontWeight": 400
    },
    "display-s": {
      "fontFamily": "Instrument Serif, serif",
      "fontSize": "22px",
      "fontWeight": 400
    },
    "body": {
      "fontFamily": "Geist, sans-serif",
      "fontSize": "17px",
      "fontWeight": 400,
      "lineHeight": 1.6
    },
    "body-s": {
      "fontFamily": "Geist, sans-serif",
      "fontSize": "15px",
      "fontWeight": 400
    },
    "ui": {
      "fontFamily": "Geist, sans-serif",
      "fontSize": "14px",
      "fontWeight": 500
    },
    "button": {
      "fontFamily": "Geist, sans-serif",
      "fontSize": "15px",
      "fontWeight": 600
    },
    "label": {
      "fontFamily": "Geist Mono, monospace",
      "fontSize": "11px",
      "fontWeight": 400,
      "letterSpacing": "0.16em"
    }
  },
  "rounded": {
    "photo": "3px",
    "panel": "6px",
    "sheet": "22px",
    "pill": "999px",
    "circle": "50%"
  },
  "spacing": {
    "space-1": "4px",
    "space-2": "8px",
    "space-3": "12px",
    "space-4": "16px",
    "space-5": "24px",
    "space-6": "32px",
    "space-7": "48px",
    "space-8": "64px",
    "gutter": "48px",
    "target": "44px",
    "target-phone": "48px",
    "header": "72px"
  },
  "components": {
    "button-primary": {
      "backgroundColor": "{colors.accent-terminator}",
      "textColor": "{colors.on-accent}",
      "rounded": "{rounded.pill}",
      "padding": "0 24px",
      "height": "48px"
    },
    "button-secondary": {
      "backgroundColor": "{colors.bg-raised}",
      "textColor": "{colors.text-primary}",
      "rounded": "{rounded.pill}",
      "padding": "0 18px",
      "height": "44px"
    },
    "button-danger": {
      "backgroundColor": "transparent",
      "textColor": "{colors.error}",
      "rounded": "{rounded.pill}"
    },
    "icon-button": {
      "backgroundColor": "transparent",
      "textColor": "{colors.text-secondary}",
      "rounded": "{rounded.circle}",
      "width": "44px",
      "height": "44px"
    },
    "menu": {
      "backgroundColor": "{colors.surface}",
      "rounded": "{rounded.panel}",
      "width": "290px",
      "padding": "6px"
    },
    "sheet": {
      "backgroundColor": "{colors.surface}",
      "rounded": "{rounded.sheet}"
    },
    "toast": {
      "backgroundColor": "{colors.surface}",
      "textColor": "{colors.text-primary}",
      "rounded": "{rounded.panel}",
      "padding": "10px 8px 10px 14px"
    },
    "field": {
      "backgroundColor": "{colors.bg-deep}",
      "textColor": "{colors.text-primary}",
      "rounded": "{rounded.panel}",
      "padding": "0 18px",
      "height": "56px"
    },
    "photo-frame": {
      "backgroundColor": "{colors.bg-raised}",
      "rounded": "{rounded.photo}"
    },
    "hud-label": {
      "textColor": "{colors.text-secondary}"
    },
    "navigation": {
      "textColor": "{colors.text-secondary}"
    }
  }
}
---

# Design System: Mazi — Luminous night

## Overview

**Creative North Star: "Luminous night"**

Mazi is a globe seen from space at night. The circle's memories are warm lights on a cool, dark world. A member turns the globe, scrubs through the years, and dives through a portal into one memory. Day is the same atlas printed on paper, not an inverted night.

This file records what the redesign built. The values come from the code: [`src/styles/tokens.css`](src/styles/tokens.css), [`src/styles/base.css`](src/styles/base.css), [`src/ui/`](src/ui/), [`src/atlas/palette.ts`](src/atlas/palette.ts) and the screen stylesheets. The owner chose the direction in [D19](docs/DECISIONS.md#luminous-night-visual-world-14-october-2026). The stage order and data shapes are in the [program plan](work/poteto/luminous-night/PLAN.md). The Claude Design "Round 2 · Luminous night" artboards are the measured contract. This file describes the build; it is not production acceptance.

**Key characteristics:**

- Night is the default for everyone. A header toggle switches to day, and the browser remembers it under `mazi.theme`.
- Cool is the world, warm is the people.
- One authored 3D scene, with a flat map and plain HTML controls that reach every memory without it.
- Motion follows one sheet of durations and easings. Under reduced motion, movement becomes a short fade.
- Sound is off by default and sits behind a visible toggle.

## Colors

Tokens are CSS custom properties on `:root`. `data-theme="night"` or `"day"` on the root element picks the set. Each colour token is registered with `@property`, so a theme switch tweens every colour over 600ms (`--dur-slow`, `--ease-arrive`). Under reduced motion it switches at once. Components use the tokens and never raw hex. The globe is the exception: WebGL cannot read custom properties, so `src/atlas/palette.ts` keeps its own copy.

**The Warmth Rule: cool is the world, warm is the people.** Atmosphere, journey arcs, the graticule and links are ice-blue (`accent-atmosphere`). Memories are warm: place nodes, the selected memory, the current-page underline and primary actions use `accent-node`, `accent-terminator` and `accent-hot`. The only warm part of the world is the terminator, the line where daylight begins.

### Primary

| Token | Night | Day | Role |
| --- | --- | --- | --- |
| `accent-terminator` | #ffb46a | #934f10 | Primary action fill, terminator glow, caret |
| `accent-node` | #ffe2a8 | #7d5a12 | Memory nodes, selection, current page, text selection |
| `accent-hot` | #fff3da | #a85a12 | The selected node's core |
| `accent-atmosphere` | #8fd3ff | #1c6599 | Links, atmosphere, arcs, pressed toggles |
| `on-accent` | #05070c | #fbfaf6 | Text on a warm fill |
| `focus` | #b8e4ff | #0b5cad | 2px focus outline, 3px offset |

### Neutral

| Token | Night | Day | Role |
| --- | --- | --- | --- |
| `bg-void` | #05070c | #f4f2ec | Page and space |
| `bg-deep` | #0a0f18 | #ece9e1 | Fields, phone bars at night |
| `bg-raised` | #121a26 | #e2ded4 | Secondary buttons, hovered menu rows, photo placeholders |
| `surface` | #161f2d | #fbfaf6 | Menus, sheets, toasts, dossier; phone bars by day |
| `line` | #263244 | #cfc9bc | Control outlines |
| `line-soft` | #1c2636 | #ddd8cc | Dividers |
| `text-primary` | #eef2f7 | #10141b | Headings and controls |
| `text-body` | #c9d2de | #2a303b | Reading text |
| `text-secondary` | #9aa6b8 | #4a5160 | Metadata, HUD labels, resting icons |
| `text-muted` | #7f8b9e | #5e6573 | Disabled text, field borders |

Status colours are `success` #6fd6a5 / #1a6e48, `warning` #f2c25b / #825900 and `error` #ff7a6e / #b3261e (night / day), each with an 8–16% tint for backgrounds. `overlay-hud` is rgba(10, 15, 24, 0.92) at night and rgba(251, 250, 246, 0.94) by day. `overlay-sheet` dims the page behind a sheet. `shadow-float` is `0 24px 60px rgba(0, 0, 0, 0.5)` at night and `0 18px 48px rgba(16, 20, 27, 0.16)` by day. Day accents and status colours clear 4.6:1 on every day surface, `bg-raised` included.

The browser's own surfaces use the palette too. Text selection is `accent-node` behind `on-accent`. The caret and native accents are `accent-terminator`. Scrollbars are `line` on `bg-void`.

## Typography

Three self-hosted families from `@fontsource`; nothing loads from the network.

- **Instrument Serif 400 and italic** is the voice. It sets the wordmark (32px in the header, 128px on Entry), headings, memory titles, the year readout and the italic welcome line. Headings use −0.01em tracking and balanced wrapping.
- **Geist 400, 500 and 600** carries reading and controls: body 17px at 1.6 line height, small body 15px, UI 14px at 500, buttons 15px at 600.
- **Geist Mono 400 and 500** is for data only. HUD labels are 11px, uppercase, with 0.16em tracking. Dates, coordinates and counts use tabular numerals.

Display sizes are tokens: `display-xl` 72px, `display-l` 48px, `display-m` 32px and `display-s` 22px. Below 1150px `display-xl` drops to 60px. Below 800px it drops to 48px, `display-l` to 36px, `display-m` to 28px and body to 15px.

## Layout

The desktop shell has a 72px header with 40px side padding. It holds the wordmark, the primary navigation and the Archive tools menu on the left. On the right it holds the circle name, the theme toggle, the sound toggle and the avatar. The Atlas fills the page under it. A places index sits on the left, the globe in the middle and the selected memory on the right, with the year scrubber below. Page gutters are 48px, then 32px below 1150px, 24px below 800px and 20px below 600px.

At 800px the wide-only links move into the Archive tools menu. Below 600px the header is 64px and keeps the wordmark (plus the leave link in sample mode). A 64px tab bar, plus the safe-area inset, holds Home, Timeline, Search, Imports and More. More opens a bottom sheet with the theme and sound toggles, the archive tools and sign-out. Touch targets are 44px, and 48px for primary phone actions.

## Elevation & Depth

Depth belongs to the globe. Panels separate by tone and a 1px inset line. Floating layers (menus, sheets, toasts, the dossier) add `shadow-float`. Photo frames sit on `bg-raised` with a 3px radius and crop with `object-fit: cover`.

### The globe at night

The ocean is dark, #04070c, lifting to #07101b in sunlight. Land is a halftone of dots: 72,000 on desktop and 36,000 on phones. The dots run from #2b3747 in shadow to #a9b8ca in light. A warm terminator band (#ffb46a) runs along the line between day and night, through both the ocean and the dots. An ice-blue atmosphere rim (#8fd3ff) breathes slowly and is brightest on the sunlit edge. Behind the globe, 6,000 stars twinkle in #d6e9ff (1,200 on phones). Memory places are warm nodes (#ffe2a8), and the selected one has a hot core (#fff3da). Journeys are ice-blue arcs (#8fd3ff); the selected journey is #eef7ff.

### The globe by day

By day the globe is a printed paper atlas. The ocean runs from #b9cad8 at the edge to #dce6ee where it faces the viewer. Land is #ebe5d8, printed with dark ink dots (#4b4842 and #3a3833). A 15° graticule (#8eabc1) is drawn over it, and the atmosphere thins to a faint #7f9bb1 edge. Nodes and the selected journey turn burnt orange (#a85a12); other arcs are ink blue (#1f6fa8). Every shader mixes night and day with one uniform, so the globe changes theme in the same 600ms as the CSS.

The globe idles at 3°/s with a 35° field of view, which narrows to 28° on a dive. If WebGL fails, or a member chooses it, the flat map draws the same land, places, journeys and selection in plate carrée. No memory needs 3D.

### Motion

Durations: `instant` 120ms, `quick` 200ms, `base` 320ms, `slow` 600ms, `camera` 1100ms. Easings: `arrive` cubic-bezier(0.22, 1, 0.36, 1), `reveal` cubic-bezier(0.16, 1, 0.3, 1), `camera` cubic-bezier(0.7, 0, 0.2, 1), `exit` cubic-bezier(0.4, 0, 1, 1).

| Moment | Built timing |
| --- | --- |
| Hover and press feedback | 120ms ease-out on colour, background, border and shadow |
| Screen change in the shell | Rises 8px and fades over 320ms, `arrive` |
| Archive tools menu | Drops 6px and fades over 200ms, `arrive` |
| Bottom sheet | Rises over 320ms (`reveal`), falls over 240ms (`exit`) |
| Toast | Rises 12px over 320ms (`arrive`), leaves over 200ms (`exit`) |
| Theme switch | 600ms colour tween, `arrive` |
| First Atlas visit | 4,200ms title sequence over the rising globe |
| Dive into the portal | 1,600ms: camera 0–1,100ms (`camera`), portal opens 600–1,100ms, dossier rises from 900ms |
| Back out of the portal | 1,100ms: dossier out over 300ms, portal closes from 250ms, both `exit` |
| Home to memory photo morph | 600ms in, 420ms back |
| Photo change in the viewer | Drifts 24px and fades over 360ms, `arrive` |
| Introduction beats | 480ms, `arrive` |
| Replay | One year every 1.2s |
| List and grid stagger | Rows 40ms apart (first eight), tiles 30ms apart (first twelve) |

**The Reduced Motion Rule.** Under `prefers-reduced-motion`, a global rule sets every CSS animation and transition to zero. Each moving layer then gets back a short linear fade. Sheets fade in over 160ms and out over 120ms, and toasts fade over 120ms. The portal crossfades over 300ms and the camera snaps. The intro shortens to 1,800ms. Introduction beats fade over 200ms, and viewer photos over 150ms. Replay steps every 1.5s, and the theme switches at once. Nothing is lost: every state that motion reveals is still shown.

## Shapes

Small controls are pills (999px) or 44px circles. Panels, menus, fields and toasts use a 6px radius, menu rows 4px and photos 3px. The bottom sheet's top corners are 22px. Outlines are 1px insets (`box-shadow: inset 0 0 0 1px`), so they never change a control's size. Icons are drawn SVG on a 24px grid with a 1.6px round stroke.

## Components

The shared primitives live in `src/ui/`.

- **Button.** Four variants. `primary` is the warm pill: `accent-terminator` fill, `on-accent` text, 48px high, 15px Geist 600, with a soft warm glow on hover. `secondary` is a 44px `bg-raised` pill with a `line` outline. `ghost` is text only. `danger` is an `error` outline, used for sign-out. Disabled buttons drop to `bg-raised` and `text-muted`.
- **IconButton.** A 44px circle with a `line` outline and a 16px icon in `text-secondary`. It turns `text-primary` on hover. In the header it sits on `overlay-hud`.
- **Theme toggle.** In headers, an IconButton named "Switch to day" or "Switch to night". In the phone More sheet, a secondary pill labelled "Day" or "Night".
- **Sound toggle.** Named "Sound", with `aria-pressed` carrying the state. In the desktop header it is an IconButton next to the theme toggle, with a tooltip that reads "Sound off" or "Sound on". On Entry and in the phone More sheet it is a pill with that label visible. When on, it turns `accent-atmosphere`.
- **Menu.** The Archive tools popover: 290px wide, 6px padding, `surface` with `shadow-float`. Rows are 44px high. The current page reads in `accent-node`.
- **Sheet.** A bottom sheet with a scrim and a drag handle. It traps focus and closes on Escape, a scrim tap or a downward drag. Focus then returns to the opener.
- **Toast.** Bottom centre, above the phone tab bar, up to 440px wide, with a status icon in `success` or `error`.
- **Field.** 56px high on `bg-deep` (`surface` by day), with a `text-muted` border, a 6px radius and a HUD label above it.
- **HUD label.** Geist Mono 11px, uppercase, 0.16em tracking, `text-secondary`. It labels data and places over the globe and fields; it never sits above a heading as a kicker.
- **Memory meta.** 13px `text-secondary` with tabular numerals; items are joined by a muted middle dot.
- **Navigation.** Header links are 14px Geist 500 in `text-secondary`. The current page turns `text-primary` with a 1.5px `accent-node` underline.

### Sound

Sound is procedural Web Audio: no files, no network, no dependency. The choice is stored under `mazi.sound` and defaults to off. The audio context is created only by a gesture made while sound is on. It is suspended when the tab is hidden or sound is turned off. The master gain is about −24 dBFS. On the Atlas a quiet bed plays: two detuned pads under a slow low-pass sweep. Diving into the portal plays a 1,600ms filtered-noise whoosh, and backing out plays a reversed 1,100ms one. A newly selected memory plays a small chime, and each year step while scrubbing or replaying plays a faint tick. Under reduced motion the whooshes are dropped and the rest stays.

## Do's and Don'ts

### Do:

- Do use the tokens for every colour in both themes, and keep the globe's palette in step with them.
- Do keep warmth for people: memories, selection and the one primary action on a screen.
- Do keep every memory reachable through the places index, the scrubber, the flat map and plain links.
- Do take every new motion's duration and easing from the table, and give it a fade under reduced motion.
- Do show people as evidence only: "Shared by …" and "In the conversation: …".

### Don't:

- Don't paint world chrome warm, or memories cool.
- Don't invent counts, names or group sizes in copy; they come from the archive.
- Don't play sound until a member turns it on, and never autoplay media audio.
- Don't load fonts, tiles or audio from the network.
- Don't treat this record as production or milestone acceptance.

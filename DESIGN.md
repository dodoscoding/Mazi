---
{
  "name": "Mazi — The Atlas of Us",
  "description": "Implemented visual system for the local synthetic Atlas experiment.",
  "colors": {
    "ground": "#091b29",
    "surface": "#102737",
    "ink": "#f3e5cf",
    "muted": "#adbac0",
    "line": "#294253",
    "copper": "#e5a16c",
    "action": "#ae572d",
    "focus": "#ffd09a",
    "action-hover": "#a8542b",
    "action-ink": "#fff4e6",
    "action-hover-ink": "#fff9f0",
    "action-active": "#793f26"
  },
  "typography": {
    "display": {
      "fontFamily": "Libre Caslon Text, Georgia, serif",
      "fontSize": "clamp(27px, 3.4vw, 49px)",
      "fontWeight": 400,
      "lineHeight": 1.3,
      "letterSpacing": "-0.03em"
    },
    "headline": {
      "fontFamily": "Libre Caslon Text, Georgia, serif",
      "fontSize": "clamp(24px, 2.22vw, 38px)",
      "fontWeight": 400,
      "lineHeight": 1.3,
      "letterSpacing": "-0.025em"
    },
    "title": {
      "fontFamily": "Libre Caslon Text, Georgia, serif",
      "fontSize": "24px",
      "fontWeight": 400,
      "lineHeight": 1.4
    },
    "body": {
      "fontFamily": "Libre Caslon Text, Georgia, serif",
      "fontSize": "17px",
      "fontWeight": 400,
      "lineHeight": 1.85
    },
    "label": {
      "fontFamily": "Source Sans 3, sans-serif",
      "fontSize": "15px",
      "fontWeight": 400
    }
  },
  "rounded": {
    "action": "3px",
    "memory": "6px",
    "thumbnail": "2px",
    "circle": "50%"
  },
  "spacing": {
    "compact": "6px",
    "small": "12px",
    "control": "16px",
    "group": "20px",
    "page-phone": "24px",
    "page-desktop": "36px",
    "detail-gap": "48px"
  },
  "components": {
    "button-primary": {
      "backgroundColor": "{colors.action}",
      "textColor": "{colors.action-ink}",
      "rounded": "{rounded.action}",
      "padding": "13px 18px"
    },
    "button-primary-hover": {
      "backgroundColor": "{colors.action-hover}",
      "textColor": "{colors.action-hover-ink}"
    },
    "button-outline": {
      "backgroundColor": "transparent",
      "textColor": "{colors.ink}",
      "padding": "12px 20px"
    },
    "photo-control": {
      "rounded": "{rounded.circle}",
      "width": "44px",
      "height": "44px"
    },
    "search-field": {
      "backgroundColor": "{colors.surface}",
      "textColor": "{colors.ink}",
      "padding": "12px 16px"
    },
    "memory-choice": {
      "backgroundColor": "transparent",
      "textColor": "{colors.ink}",
      "rounded": "{rounded.memory}",
      "padding": "6px"
    },
    "navigation": {
      "textColor": "{colors.ink}"
    }
  }
}
---

# Design System: Mazi — The Atlas of Us

## Overview

**Creative North Star: "The Atlas of Us"**

The Atlas of Us pairs a midnight blue cartographic ground with warm ivory serif lettering and copper selection. Photography remains the dominant material; the dated curved chart gives memories a spatial index. Controls are restrained and readable.

This record describes the implemented local synthetic experiment, not an accepted production standard. The team selected Atlas; the finish verdict clears experiment readiness and three resolved fixes. Numerical comp gates remain incomplete in `.impeccable/build/REVIEW_STATUS.md`; no pixel-fidelity certification is claimed. The reported 20 passing Chromium desktop/phone-emulation contracts do not establish real-phone, browser-matrix, manual screen-reader, GPU or friend-study outcomes.

**Key Characteristics:**

- Midnight blue ground with warm photographic emphasis.
- Ivory serif hierarchy; sans-serif source evidence and utility controls.
- Copper marks selection, actions and chart accents.
- Real procedural depth with equivalent dated HTML controls.

## Colors

The warm accent and lettering sit against cool blue surfaces. Values in the frontmatter are extracted from `src/styles.css`; its custom properties remain the implementation source. Sidecar tonal ramps are synthesized OKLCH panel previews, not implemented palette steps.

### Primary

- **Copper:** selection borders, dated controls, navigation state and chart accents.
- **Burnished action:** primary action fill, with separately recorded hover and pressed colors and warm light foregrounds.
- **Warm focus:** visible keyboard outline.

### Neutral

- **Midnight ground:** page and canvas surround.
- **Blue surface:** image loading/error ground and search input.
- **Ivory ink:** headings and primary text.
- **Mist muted:** metadata, secondary text and source labels.
- **Cartographic line:** dividers and resting control borders.

**The Selection Rule.** Copper identifies the current memory in the chart, dated controls and memory list.

## Typography

Self-hosted Libre Caslon Text (Georgia fallback) carries headings and reflective copy. Source Sans 3 (sans-serif fallback) carries source facts, search, recovery, photo counters and footer utilities. Both use regular weight; conversation names use sans-serif semibold (600). Italic serif appears in years, photo captions and conversation preview.

The frontmatter records the implemented desktop detail display, Home headline, context title, descriptive body and source-label roles. Navigation uses serif (16px desktop, 14px phone); memory metadata uses (13px desktop, 12px phone). Phone Home titles use (31px), detail titles (32px), and description (16px); narrow screens reduce titles to (27px Home, 28px detail). Description line height is (1.85); ordinary paragraphs use (1.6). Phone descriptions are limited to (65ch).

**The Evidence Rule.** Keep photographs, dates and source context readable together; utility text uses the sans-serif where implemented.

## Layout

Home currently uses a chart/photo split (48%/52%), a maximum width (1800px), and three dated memory choices below. Detail uses a maximum width (1536px), gallery/context columns (1.9fr/1fr), and a gap (48px). These describe the current surfaces, not a mandatory layout for every future page.

At (1150px) the Home split becomes (45%/55%) and detail spacing contracts. At (800px) Home leads with the selected photo and action, followed by the compact chart (390px high) and single-column memory list; detail stacks context below the gallery. Phone gutters are (24px), reducing to (16px) at (370px). At (1600px) Home chart minimum height increases from (650px) to (790px). Photo frames crop with object-fit cover: Home (1.36 desktop, 1.35 phone), gallery (1.5).

## Elevation & Depth

There are no CSS box shadows. Borders, tonal surfaces and the curved procedural Three chart establish separation. The chart has a rough blue sphere, fine translucent grid lines and pickable photographic planes. It indexes dates, not geography or inferred social relationships.

**The Chart Rule.** Depth belongs to the procedural date chart; surrounding photographs and controls remain flat.

Selection retargets a shallow rotation (−0.055 to +0.055 radians), interpolated with exponential rate (12). Settled scenes render on demand; offscreen/hidden scenes pause. Canvas DPR is bounded (1–1.5). Reduced motion snaps chart orientation. Home-to-memory navigation uses an interruptible browser View Transition (360ms, cubic-bezier(0.16, 1, 0.3, 1)); unsupported or reduced-motion navigation updates immediately.

## Shapes

Photographs and search fields are rectangular. Primary actions have slight rounding; memory choices use softer corners; selection indicators, group-emblem outlines and photo arrow controls are circular. Fine borders carry structure. Avoid extrapolating these local treatments into decorative rounded containers everywhere.

## Components

- **Primary action:** warm solid fill, slight rounding, minimum height (50px), serif label (14px), darker hover and pressed states. Hover foreground is separate from resting foreground.
- **Outline/retry button:** transparent ground, line border, copper hover border; retry padding (12px 20px). Disabled controls fade (opacity 0.4).
- **Photo controls:** circular (44px) targets, sans-serif tabular counter; thumbnails scroll horizontally and copper borders identify selection.
- **Memory choice:** horizontal photographic button, fine border, copper border plus outline when selected; a circular indicator repeats state. Photo counts come from fixtures.
- **Search field:** blue surface, fine line border, warm ink and copper caret, minimum height (52px), sans-serif input (18px).
- **Navigation:** Home, Timeline and Search are conventional links; the current page uses copper and an underline (2px). Supporting links reflow at phone widths.
- **Conversation disclosure:** full-width copper sans-serif control with bottom border and minimum height (48px), expanding actual fixture messages and source information.
- **Photo/scene recovery:** readable loading status and independent retry controls. Home photo retry stays Home; failed images do not wrap retry in a navigation link. Scene failure preserves dated HTML access and offers retry.

Interactive controls share short color/border feedback (160ms ease-out) and a warm focus outline (2px, offset 5px). Reduced motion disables CSS transition and animation durations. Canvas is hidden from assistive technology; dated HTML controls carry equivalent selection.

## Do's and Don'ts

### Do:

- Do retain visible synthetic provenance and truthful fixture photo counts.
- Do preserve photo-first phone reflow and conventional dated selection controls.
- Do preserve focus visibility, recovery controls and live reduced-motion behavior.

### Don't:

- Don't replace photographic content with decorative chart density.
- Don't require orbit or dragging to reach a memory.
- Don't treat this experiment's tokens or review as production acceptance.

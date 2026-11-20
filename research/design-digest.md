# House Checker: Surf Design Standard digest

Source: the "Surf Design Standard" at `scratchpad/design-docs-src/repo/`. Citations read `[doc §N]`, where N
is the doc's own rule number. `[doc table]` means an unnumbered table in that doc. README, principles,
ai and shells are not summarised here. Where another doc leans on `ai.md`, the rule number is given so
you can look it up yourself.

The standard was written for a large Next.js + Tailwind social app ("Surf") with eight themes. House
Checker only needs the **Light** and **Dark** themes, which are the two flat "mode" themes: sheen,
gel, bevel, bloom and canvas images are all inert in them [colour-and-effects table: effects].

---

## 1. CSS custom properties (paste-ready)

**What the docs give exactly and what is approximated.** These values are verbatim from `tokens.md`
and `colour-and-effects.md`: canvas, accent, ink anchor and ink-tier alphas, inverted ink, the type
ramp, weights, spacing, radii, blur, z-index, durations, easings, press scales, tap target, scrim
alphas, sheet heights, dialog widths, header row and breakpoints. Some values are named only in the
abstract. The card surface, opaque overlay ground, hairline/border alpha, neutral fill, shadows, the
semantic status hues and the category ramp all live in `lib/theme/contract.ts`, which is not in the
docs. For those I chose the closest faithful values, marked `/* ≈ */`. The constraints they still have
to meet: the overlay ground is opaque [colour-and-effects §4]. Every status hue has a saturated fill
rung and a deep text rung that reads on light [colour-and-effects §14]. Text reaches 4.5:1 and control
edges 3:1 [accessibility §25]. I checked the ink tiers against these values. On the light canvas,
muted is 4.53:1 and faint is 3.08:1. On the dark canvas, muted is 4.62:1 and faint is 3.05:1. That is
why faint is chrome only and never data [colour-and-effects §2].

The first-time default theme is **dark** [colour-and-effects, "The eight themes" table notes]. `system`
is a preference that is resolved when the theme is applied, never a theme of its own. The theme is
stamped on `<html>` by a blocking script before first paint [colour-and-effects §27].

```html
<!-- In <head>, before any stylesheet paints. Three independent try blocks [colour-and-effects traps §27]. -->
<script>
(function () {
  var d = document.documentElement, pref = null, rm = null, fs = null;
  try { pref = localStorage.getItem('hc-theme'); } catch (e) {}
  try { rm = localStorage.getItem('hc-reduce-motion'); } catch (e) {}
  try { fs = localStorage.getItem('hc-font-size'); } catch (e) {}
  var scheme = pref === 'light' || pref === 'dark' ? pref
    : pref === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : 'dark';                                   /* first-visit default is dark */
  d.setAttribute('data-theme', scheme);         /* id and scheme move together [colour-and-effects §28] */
  d.setAttribute('data-theme-scheme', scheme);
  d.style.colorScheme = scheme;
  if (rm === '1') d.classList.add('reduce-motion');
  if (fs === 'small' || fs === 'large') d.setAttribute('data-font-size', fs);
})();
</script>
```

```css
/* ============ Theme-independent tokens [tokens] ============ */
:root {
  /* ---- Type ramp [tokens: Type] [type: The ramp]. Every step × --font-scale. ---- */
  --font-scale: 1;                 /* 0.875 small, 1 default, 1.125 large [type §25] */
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --text-badge: calc(11px * var(--font-scale)); --text-badge--line-height: 1;            /* count badge only */
  --text-sm:    calc(14px * var(--font-scale)); --text-sm--line-height: 1.4286;          /* 20/14, meta, the floor */
  --text-body:  calc(15px * var(--font-scale)); --text-body--line-height: 1.4667;        /* 22/15, reading */
  --text-body--letter-spacing: -0.005em;
  --text-base:  calc(16px * var(--font-scale)); --text-base--line-height: 1.5;           /* 24/16, inputs */
  --text-lg:    calc(18px * var(--font-scale)); --text-lg--line-height: 1.5556;          /* 28/18, titles */
  --text-lg--letter-spacing: -0.01em;
  --text-xl:    calc(20px * var(--font-scale)); --text-xl--line-height: 1.4;             /* 28/20 */
  --text-xl--letter-spacing: -0.01em;
  --text-2xl:   calc(24px * var(--font-scale)); --text-2xl--line-height: 1.3333;         /* 32/24, page/hero title */
  --text-2xl--letter-spacing: -0.02em;
  --text-3xl:   calc(30px * var(--font-scale)); --text-3xl--line-height: 1.2;            /* 36/30, display number */
  --text-3xl--letter-spacing: -0.02em;
  --text-4xl:   calc(36px * var(--font-scale)); --text-4xl--line-height: 1.1111;         /* 40/36 */
  --text-4xl--letter-spacing: -0.02em;
  --text-5xl:   calc(48px * var(--font-scale)); --text-5xl--line-height: 1;              /* one glanceable figure */
  --text-5xl--letter-spacing: -0.02em;
  --text-7xl:   calc(72px * var(--font-scale)); --text-7xl--line-height: 1;
  --text-7xl--letter-spacing: -0.02em;

  --font-weight-normal: 400;   /* body */
  --font-weight-medium: 500;   /* label, count */
  --font-weight-semibold: 600; /* title, a name */
  --font-weight-bold: 700;     /* page title or a glanced number only [type §5] */

  /* ---- Spacing: 4px base, step name × 4 [tokens: Spacing] ---- */
  --spacing-0: 0; --spacing-0_5: 2px; --spacing-1: 4px; --spacing-1_5: 6px; --spacing-2: 8px;
  --spacing-2_5: 10px; --spacing-3: 12px; --spacing-3_5: 14px; --spacing-4: 16px; --spacing-5: 20px;
  --spacing-6: 24px; --spacing-7: 28px; --spacing-8: 32px; --spacing-9: 36px; --spacing-10: 40px;
  --spacing-11: 44px; --spacing-12: 48px; --spacing-14: 56px; --spacing-16: 64px; --spacing-20: 80px;
  --spacing-24: 96px; --spacing-32: 128px;
  --spacing-overlay: 16px;               /* 20px from sm (640) — see media query below [components §14a] */
  --page-gutter: 10px;                   /* below lg (1024); 0 above [layout §9] */
  --card-padding: 16px;                  /* CARD_PADDING [layout §9] */

  /* ---- Radius [tokens: Radius]; Light/Dark radius scale is 1 ---- */
  --theme-radius-scale: 1;
  --radius-xs: calc(8px * var(--theme-radius-scale));    /* small chips */
  --radius-sm: calc(12px * var(--theme-radius-scale));   /* controls */
  --radius-md: calc(16px * var(--theme-radius-scale));   /* controls, popups */
  --radius-lg: calc(20px * var(--theme-radius-scale));   /* tiles */
  --radius-xl: calc(24px * var(--theme-radius-scale));   /* cards */
  --radius-2xl: calc(28px * var(--theme-radius-scale));  /* cards, sheets */
  --radius-3xl: calc(32px * var(--theme-radius-scale));  /* overlay panels */
  --radius-full: 9999px;                                  /* pills, circles */

  /* ---- Blur [tokens: Blur] (only the header should frost; one frost per screen) ---- */
  --blur-overlay: 4px; --blur-media: 8px; --blur-header: 12px; --blur-chrome: 14px;
  --blur-sheet: 14px; --blur-glass: 16px; --blur-strong: 24px;

  /* ---- Z-index: the CSS mirror's nine rungs + inPageChrome [tokens: Z-index] ---- */
  --z-index-base: 0; --z-index-in-page-chrome: 50; --z-index-sticky: 200; --z-index-overlay: 300;
  --z-index-dropdown: 350; --z-index-modal: 400; --z-index-floating: 500; --z-index-tooltip: 550;
  --z-index-toast: 600; --z-index-gate: 700; --z-index-max: 9999; /* skip link only [accessibility §13] */

  /* ---- Durations [tokens: Durations] [motion: The duration ladder] ---- */
  --transition-duration-instant: 75ms;     /* release after press, toggle knob */
  --transition-duration-fast: 150ms;       /* colour, opacity, hover, crossfade */
  --transition-duration-normal: 200ms;     /* small/in-page reveal */
  --transition-duration-slow: 300ms;       /* page-level reveal, cascade row, toast */
  --transition-duration-nav-glide: 320ms;  /* chrome gliding away */
  --transition-duration-slower: 400ms;     /* takeover; the ceiling for any motion [motion §6] */
  --ovl-dur: 240ms;                        /* DIALOG_MOTION_MS: dialog/sheet/side panel */
  --ovl-dur-menu: 160ms;                   /* MENU_MOTION_MS: menu/popover */
  --exit-ratio: 0.8;                       /* EXIT_DURATION_RATIO [motion §7] */
  --tooltip-delay: 400ms; --tooltip-fade: 160ms;
  --skeleton-delay: 150ms;                 /* SKELETON_DELAY_MS hold [loading-and-states §15] */
  --duration-shimmer: 1.8s;
  --shimmer-band: clamp(9rem, 26vw, 26rem);
  --duration-reduce-motion: 0.01ms;        /* blanket kill value, never a rung */
  /* JS-only (not motion): debounce 300, feedback 2000, toast 4000, undo 5000, stagger 50ms (fast 30, slow 100),
     NAV_GHOST grace 100 / min 200 / max 10000, MAX_VISIBLE_TOASTS 3 */

  /* ---- Easings [tokens: Easings] — cross-wired names; read the curve, not the name ---- */
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);    /* EASE_STANDARD: in-place colour/opacity/size-on-transform */
  --ease-dialog: cubic-bezier(0.32, 0.72, 0, 1);  /* EASE_SMOOTH: the house arrival (dialogs, sheets, cascades) */
  --ease-enter: cubic-bezier(0, 0, 0.2, 1);       /* EASE_OUT: arriving from off-screen, toasts */
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);        /* EASE_LEAVE: anything leaving */
  --ease-gentle: cubic-bezier(0.25, 0.1, 0.25, 1);/* EASE_ENTER: quiet crossfade, skeleton swap */
  /* JS-only curves: EASE_ARRIVE 0.16,1,0.3,1 (ceremony, rationed); EASE_IN_OUT 0.4,0,0.6,1;
     EASE_SMOOTH_OUT 0.25,0.46,0.45,0.94; EASE_BACK 0.34,1.56,0.64,1 (one element, never a group).
     Springs: SNAPPY 400/34, SHEET 400/35, GENTLE 200/25. */

  /* ---- Press [tokens: Press] ---- */
  --press-subtle: 0.98; --press: 0.96; --press-firm: 0.93; --press-opacity: 0.7;

  /* ---- Sizes and geometry [tokens: Sizes, Sheet/dialog geometry] [layout: The measures] ---- */
  --tap-target-min: 44px;
  --icon-sm: 16px; --icon-md: 18px; --icon-lg: 20px; --icon-xl: 24px; --icon-chrome: 26px; --icon-3xl: 48px;
  --dialog-xs: 360px; --dialog-sm: 460px; --dialog-md: 560px; --dialog-default: 620px;
  --dialog-lg: 720px; --dialog-xl: 920px;
  --dialog-gutter: 1.5rem;
  --sheet-top-gap: 0.5rem;
  --sheet-h-xs: 30svh; --sheet-h-sm: 45svh; --sheet-h-md: 60svh; --sheet-h-lg: 75svh;
  --sheet-h-full: min(92svh, calc(100svh - var(--safe-top) - var(--sheet-top-gap)));
  --page-header-row: 3.5rem;
  --page-header-pad: 0.25rem;            /* 0.75rem in the regular size class */
  --page-header-h: calc(max(var(--page-header-pad), var(--safe-top)) + var(--page-header-row) + var(--page-header-pad));
  --reading-column: 560px;               /* 600 @1280, 640 @1440, 680 @1680, 700 @1920 [layout: measures] */
  --wide-column: 700px;                  /* 760 @1024, 820 @1280, 860 @1440, 1000 @1680, 1120 @1920 */

  /* ---- Safe areas: read these, never env() directly [layout §16] ---- */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --app-vh: 100svh;                      /* replaced by JS from visualViewport [layout §19] */

  /* ---- Scrim: fixed black in both themes [colour-and-effects §18] ---- */
  --scrim-hint: rgb(0 0 0 / 0.25); --scrim-subtle: rgb(0 0 0 / 0.4); --scrim-soft: rgb(0 0 0 / 0.55);
  --scrim-strong: rgb(0 0 0 / 0.7); --scrim-heavy: rgb(0 0 0 / 0.85);

  /* ---- Status hues: two rungs each [colour-and-effects §13–14] ≈ ---- */
  --success: #22c55e; --success-deep: #15803d;   /* ≈ */
  --warning: #f59e0b; --warning-deep: #b45309;   /* ≈ */
  --error:   #ef4444; --error-deep:   #b91c1c;   /* ≈ */
  --info:    #3b82f6; --info-deep:    #1d4ed8;   /* ≈ */
}
@media (min-width: 640px) { :root { --spacing-overlay: 20px; } }
@media (min-width: 1024px) { :root { --page-gutter: 0px; } }
@media (min-width: 1280px) { :root { --reading-column: 600px; } }
@media (min-width: 1440px) { :root { --reading-column: 640px; } }
@media (min-width: 1680px) { :root { --reading-column: 680px; } }
@media (min-width: 1920px) { :root { --reading-column: 700px; } }

html[data-font-size="small"] { --font-scale: 0.875; font-size: 14px; }
html                          { font-size: 16px; }
html[data-font-size="large"] { --font-scale: 1.125; font-size: 18px; }

/* ============ Light theme [colour-and-effects: eight themes, ink per theme] ============ */
:root, :root[data-theme="light"] {
  color-scheme: light;
  --theme-ink-rgb: 11 11 18;
  --canvas: #f4f5f8;
  --text-primary:   rgb(var(--theme-ink-rgb));
  --text-secondary: rgb(var(--theme-ink-rgb) / 0.66);
  --text-muted:     rgb(var(--theme-ink-rgb) / 0.57);   /* lowest tier for data */
  --text-faint:     rgb(var(--theme-ink-rgb) / 0.45);   /* chrome only, never data */
  --text-inverted:  #ffffff;
  --accent: #2563eb;
  --on-accent: #ffffff;
  --cta: rgb(var(--theme-ink-rgb));        /* Light/Dark: the CTA is the inverted chip, not the accent [§10] */
  --on-cta: var(--text-inverted);
  --surface-card: #ffffff;                 /* ≈ GLASS_CARD_SOLID ground */
  --surface-overlay-strong: #ffffff;       /* ≈ must be opaque [§4] */
  --surface-solid: #ffffff;                /* ≈ */
  --bg-overlay: rgb(var(--theme-ink-rgb) / 0.06);   /* ≈ neutral capsule (chosen tab), hover tint */
  --glass-border: rgb(var(--theme-ink-rgb) / 0.10); /* ≈ the hairline most borders read */
  --border-default: rgb(var(--theme-ink-rgb) / 0.14);/* ≈ field edge; ≥3:1 needs the focus/active state */
  --cat-shift: 46%;
  --shadow-sm: 0 1px 2px rgb(11 11 18 / 0.06);                          /* ≈ */
  --shadow-md: 0 4px 12px rgb(11 11 18 / 0.08);                         /* ≈ */
  --shadow-lg: 0 12px 32px rgb(11 11 18 / 0.12);                        /* ≈ overlays */
  /* status as text on light uses the deep rung [§14] */
  --success-ink: var(--success-deep); --warning-ink: var(--warning-deep);
  --error-ink: var(--error-deep);     --info-ink: var(--info-deep);
}

/* ============ Dark theme ============ */
:root[data-theme="dark"] {
  color-scheme: dark;
  --theme-ink-rgb: 255 255 255;
  --canvas: #050508;
  --text-primary:   rgb(var(--theme-ink-rgb));
  --text-secondary: rgb(var(--theme-ink-rgb) / 0.6);
  --text-muted:     rgb(var(--theme-ink-rgb) / 0.46);
  --text-faint:     rgb(var(--theme-ink-rgb) / 0.35);
  --text-inverted:  #060a1e;
  --accent: #2563eb;
  --on-accent: #ffffff;
  --cta: #ffffff;                          /* the inverted chip */
  --on-cta: var(--text-inverted);
  --surface-card: #111217;                 /* ≈ opaque; muted ink measures 4.67:1 on it */
  --surface-overlay-strong: #111217;       /* ≈ opaque */
  --surface-solid: #0b0c10;                /* ≈ */
  --bg-overlay: rgb(var(--theme-ink-rgb) / 0.08);   /* ≈ */
  --glass-border: rgb(var(--theme-ink-rgb) / 0.10); /* ≈ */
  --border-default: rgb(var(--theme-ink-rgb) / 0.16);/* ≈ */
  --cat-shift: 0%;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.5);                              /* ≈ */
  --shadow-md: 0 4px 12px rgb(0 0 0 / 0.5);                             /* ≈ */
  --shadow-lg: 0 12px 32px rgb(0 0 0 / 0.6);                            /* ≈ */
  /* the saturated rung reads on the dark canvas */
  --success-ink: var(--success); --warning-ink: var(--warning);
  --error-ink: var(--error);     --info-ink: var(--info);
}
/* No-JS fallback only: the boot script normally decides. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { /* copy the dark block here, or keep the boot script mandatory */ }
}

/* ============ Base behaviour the tokens assume ============ */
html { scrollbar-gutter: stable; overscroll-behavior-y: none; }   /* [layout §24] [platform §14] */
body { touch-action: manipulation; overscroll-behavior-y: none; } /* [platform §13–14] */
button, a, [role=button], [type=button], [type=submit] { cursor: default; }  /* never pointer [platform §1–2] */
* { scrollbar-width: thin; }                                /* one thin theme-aware bar [platform §6] */
body {
  background: var(--canvas); color: var(--text-primary);   /* no transition: a theme switch is one repaint [§29] */
  font-family: var(--font-sans);
  font-size: var(--text-body); line-height: var(--text-body--line-height);
  letter-spacing: var(--text-body--letter-spacing);
  -webkit-tap-highlight-color: transparent;                /* only because every control carries its own press [feedback §3] */
}
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }  /* FOCUS_RING [accessibility §15] */

/* Press ladder: instant down, eased up [feedback §1–5] [motion catalogue: Press] */
.press, .press-subtle, .press-firm {
  transition: transform var(--transition-duration-fast) var(--ease-smooth),
              opacity var(--transition-duration-fast) var(--ease-smooth);
}
.press:active:not(:has(:is(button,[role=button],a):active))        { transform: scale(var(--press)); transition-duration: 0s; }
.press-subtle:active:not(:has(:is(button,[role=button],a):active)) { transform: scale(var(--press-subtle)); transition-duration: 0s; }
.press-firm:active:not(:has(:is(button,[role=button],a):active))   { transform: scale(var(--press-firm)); transition-duration: 0s; }

/* Reduced motion: shorten functional motion, keep presence, keep status loops [motion §47–53] */
@media (prefers-reduced-motion: reduce) { :root { --reduced: 1; } }
html.reduce-motion *, html.reduce-motion *::before, html.reduce-motion *::after { /* and the same under the media query */
  animation-duration: var(--duration-reduce-motion) !important; animation-delay: 0s !important;
  transition-duration: var(--duration-reduce-motion) !important; transition-delay: 0s !important;
}
/* Opt back in (higher specificity): overlays fade at fast; spinner + shimmer keep looping */
html.reduce-motion .ovl-panel, html.reduce-motion .ovl-scrim { transition-duration: var(--transition-duration-fast) !important; transform: none !important; }
html.reduce-motion .animate-spin { animation-duration: 1s !important; }
html.reduce-motion .skeleton-shimmer { animation-duration: var(--duration-shimmer) !important; }
html.reduce-motion .press:active, html.reduce-motion .press-subtle:active, html.reduce-motion .press-firm:active
  { transform: none; opacity: var(--press-opacity); }
```

Reduced motion has to be honoured from **both** switches, the OS query and an in-app class, at first
render [motion §53]. Either mirror the `html.reduce-motion` rules inside
`@media (prefers-reduced-motion: reduce)`, or have the boot script add the class when the media query
matches.

---

## 2. Compliance checklist for House Checker

Each item is a rule you can test. Items marked **(app)** are my application of the rule to this flow.
Everything else is the doc's own rule stated concretely.

### tokens
- [ ] No arbitrary value that a token already names. Font sizes, radii, durations, z-indices and blur
      are all `var(--…)`. No hex or `rgb()` appears outside the theme blocks [tokens §2–3].
- [ ] Each CSS variable is declared at the same level it is read. A `:root` property never reads a
      panel-scoped variable [tokens §4].
- [ ] Blur, shadow, radius, duration and easing are set by classes. No inline `transition`,
      `boxShadow` or `backdropFilter` strings [tokens §5].
- [ ] A class/style string used twice becomes one named recipe (one CSS class or one JS const)
      [tokens §6].
- [ ] z-index comes from the ladder only. A companion surface uses a rung, never `+ 1` [tokens: Z-index].

### colour-and-effects
- [ ] Only four ink tiers plus inverted are used. A number, address, date or status the user acts on
      is `muted` at the lowest. `faint` is for chrome only [§1–2] [accessibility §27].
- [ ] Two surfaces only: canvas and card. Never a card on a card [§4] [craft §23].
- [ ] Chrome may be glass. Content is solid. There is at most one frosted layer per screen at rest,
      and only the header should frost [§5, §34].
- [ ] No `#fff`/`#000` or `text-white`. Use `--on-cta`/`--on-accent`, or a scrim for media [§6].
- [ ] The accent marks exactly **one** thing per screen, either the primary action or the active
      step. Never two, never decoration [§8] [craft §7].
- [ ] Accent never colours product words. Source links, "Retry", the toast's Undo and section titles
      use primary or secondary ink, with weight and position showing they can be pressed. A glyph may
      take accent to mark an on state [§8a].
- [ ] The primary button is `background: var(--cta); color: var(--on-cta)`, never `--accent` directly
      [§10].
- [ ] Finding labels use status colour as state: `success` / `warning` / `error` / `info` at **5%
      fill and 40% border**. Text uses the deep rung on light [§13–14]. No feature adopts a status hue
      as its look [§13].
- [ ] Effects carry no meaning. Selected, active, failed and unread are shown by fill, ink and glyph
      weight, never by glow or shadow [§38].
- [ ] Colour is contained. No full-page tint or wash behind chrome [§20].
- [ ] Nothing transitions on a theme change. No `transition` on `body` or on surface backgrounds
      [§29].
- [ ] The theme is stamped before first paint by a blocking script, never by a React effect [§27].
- [ ] Every screen is checked in Light **and** Dark. A dark check sets the app theme and the OS scheme
      together [§25–26] [definition-of-done §2].
- [ ] Never scale or fade a blurred surface. Anything that animates open is solid [§35] [motion §41].

### type
- [ ] Three reading sizes carry the app: `text-body` 15 (reading), `text-sm` 14 (meta), and `text-lg`
      18 or `text-xl` 20 (titles). Use `2xl` and above only for a page title or a display figure
      [§1].
- [ ] Nothing renders below 14px except a count badge at 11. No `scale()` shrinks text. No SVG
      `font-size` sits under the floor [§2–3].
- [ ] Every text input is 16px (`--text-base`) on a coarse pointer, which stops iOS zoom [§4]
      [input-and-forms §6].
- [ ] Four weights only, 400/500/600/700. 700 is only for the page title or a glanced figure [§5].
- [ ] Tracking comes from the ramp only. No ad-hoc `letter-spacing` [§6].
- [ ] Line-height is relative (unitless). No frozen px line boxes [§7].
- [ ] Emphasis comes from weight and ink, never a bigger size. Quiet comes from muted ink, never
      smaller type [§8] [craft §8].
- [ ] Headings and centred lines use `text-wrap: balance`. Body text uses neither balance nor pretty
      [§9].
- [ ] `overflow-wrap: break-word` applies to user text. `word-break: break-all` applies **only** to
      URLs, permit or record numbers, and APNs (`block/lot`) [§10].
- [ ] `white-space: nowrap` is for values that must not split: a permit number, a date, a count with
      its glyph. Never put it on a button label [§11].
- [ ] Single-line values truncate. A finding preview uses `line-clamp-2`, an excerpt `line-clamp-3`.
      Every clamped string has its full text reachable through `title` on a fine pointer or by
      opening the row [§15–16].
- [ ] Truncation width comes from the column with `min-width: 0`, never a pixel `max-width` [§17].
- [ ] **(app)** Every changing number uses `font-variant-numeric: tabular-nums`: the step counter, sq
      ft, unit and bath counts, permit counts, dates, money [§18].
- [ ] Numbers are formatted with Intl, never concatenated. A missing value renders as "—" [§20]
      [copy-and-voice §37].
- [ ] One family: Inter, loaded with `display: swap` and a real system fallback [§29–30].
- [ ] The layout survives `--font-scale` 1.125, and 1.75 on a 360-wide phone. Nothing clips in a
      button label, finding row, dialog title or actions, or a skeleton line box [§27]
      [accessibility §32].

### craft
- [ ] **Three gaps per page.** Rows 0–8px apart, groups 16–24px, sections 32px or more, all on the
      spacing scale. A fourth distance is a bug. Groups are separated by space, never by lines
      [§1–2].
- [ ] One gap inside a row (`gap: 12px`, the list-row recipe) [§3].
- [ ] A row is at least 44px tall [§4].
- [ ] Text never touches an edge. Padding is symmetric unless the reason is written down [§5–6].
- [ ] **One title, one primary (filled) action, one accent per screen.** Every other action is text
      or a quiet icon button. No filled button inside a list row: "Draft email" on each finding row
      must be a quiet text action [§7].
- [ ] Size, weight and ink move together. A title is larger, heavier and primary. A subtitle is body,
      regular and secondary. Meta is sm, regular and muted [§8].
- [ ] A row says one thing: glyph, label, chevron. A subtitle appears only if it carries live state
      [§9].
- [ ] One signal per state. Selected is a fill, not a fill plus a ring [§10].
- [ ] **Facts on one line are separated by space, never by `·`, `|`, `•` or `—`.** Example: source,
      date and record number as separate children with a gap [§10a].
- [ ] Radius nests concentrically using the table. Card `rounded-2xl` (28) with 16px padding holds
      children at `rounded-sm` (12). A child is never rounder than its parent [§11–12].
- [ ] Circles are circles: equal width and height plus `rounded-full`. A capsule is only a pill, a
      button or a badge [§13].
- [ ] Pill is `full`, control is `sm`/`md`, card is `2xl`/`3xl` [§14].
- [ ] One edge at rest. A ring appears only for state (focus or selected), never beside a border
      [§15a].
- [ ] No hairlines between rows of one list. A line is only allowed where two unlike lists meet
      [§16].
- [ ] One icon family (Phosphor), `regular` weight, with `fill` only for selected or active. No bold,
      duotone, thin or light [§18].
- [ ] Glyph sizes come from the icon scale: 16, 18, 20, 24, and 26 for header controls [§19].
- [ ] One glyph per concept across the whole app [§21]. If a glyph needs a tooltip to be understood,
      give it a label instead [§22].
- [ ] Controls rest quiet: no border unless every field has one, no shadow, no accent. The active
      state is exactly one change [§28].
- [ ] Control heights are Button 40/44/48 (sm/md/lg) and IconButton 32/40/44/48. Menu rows are at
      least 48 [§29, table]. Controls side by side match height, radius and padding [§30].
- [ ] On a phone a row of controls scrolls and never wraps [§31] [layout §22].
- [ ] Nothing shifts after first paint. Labels are fixed to their widest state, for example
      "Send" ↔ "Sending" [§34].
- [ ] Everything aligns to one vertical rule, including section labels above cards [§35].
- [ ] **No ornament.** No gradient on a button, no glow on a card, no confetti, no mascot, no
      sparkle, no decorative dot, **no "AI" purple** [§40].
- [ ] At most one row of choices above the content. A header carries actions, not choices [§41].
- [ ] Each header control is an IconButton, a 48px box with a 26px glyph [§42].
- [ ] One door per action per view. The empty state's action must not duplicate the header's [§44].

### layout
- [ ] Two postures are chosen by size class. Compact means width under 600, or under 1024 and shorter
      than 480. Regular is everything else. CSS uses one `regular` variant, and the decision is
      stamped on `<html>` before paint [§1].
- [ ] Layout asks about width. Interaction asks about the pointer: hover and hold use
      `(hover: hover)` / `(pointer: coarse)`, never width [§2].
- [ ] Dialogs are bottom sheets under 640px and centred panels from 640px [§3].
- [ ] No hover-only affordance. Hover styles live only under `@media (hover: hover)` [§4].
- [ ] **(app)** One column measure. Input, steps and findings use the reading column: 560px, rising
      to 600/640/680/700 at 1280/1440/1680/1920. Never a literal `max-width` [§6].
- [ ] The page gutter is 10px below 1024 and 0 above. A card's inner padding is 16px [§9].
- [ ] One header. Row height is `--page-header-row` 3.5rem, and anything pinned under it offsets by
      `--page-header-h` [§12–13].
- [ ] The header never resizes when a field focuses or on scroll. It moves on transform only [§14].
- [ ] Safe areas are read through `--safe-*`, never `env()` directly. Side padding uses logical
      properties (`padding-inline-start`) [§16, §16a].
- [ ] At the end of every scroller the last control clears the bottom inset and any pinned bar
      [§16f].
- [ ] Every grid or flex child that holds text has `min-width: 0` [§20].
- [ ] Nothing scrolls the body horizontally [§22].
- [ ] `scrollbar-gutter: stable` is set on `<html>`, and scroll lock never pads the body [§24].
- [ ] **(app)** Thumb reach on a phone: the primary action, a sheet's confirm and Send sit in the
      bottom third. A destructive action never sits under the resting thumb [§34].
- [ ] Resizing from 1440 to 900 to 400 breaks nothing. A stateful input (the draft editor, the
      address field) is mounted once and moved by layout, never rendered twice and toggled by
      breakpoint [§35].
- [ ] Use `overflow-x: clip`, not `hidden`, on page wrappers. `hidden` breaks sticky headers [layout
      traps §12].

### components (primitives you must hand-build once each)
- [ ] One primitive per concept. Build one each of `Button`, `IconButton`, `Input`, `Textarea`,
      `Field`, `Dialog`/sheet, `ConfirmDialog`, `Toast`, `EmptyState`, `ErrorAlert`, `Skeleton`,
      `Spinner`, `Chip`, `Meter`, `MetaLine` and `CloseButton`, then reuse them. Never build a sibling
      [§1, §2, table].
- [ ] No bare `<button>`/`<input>`. The primitive sets `type="button"`, focus, `aria-busy` and
      disabled handling [§6].
- [ ] Focus shows once. A field's focus is one change to its edge, and an invalid field keeps its red
      edge while focused. A textarea or composer shows focus by caret alone, with no ring [§5]
      [input-and-forms §21].
- [ ] Exclusive choices, for example ADU "Yes / No / Not stated", are one radiogroup primitive with a
      roving tabindex [§7].
- [ ] A section heading is one style (`SECTION_LABEL`) [§8].
- [ ] Overlays are one family: Dialog (sheet <640 / centred ≥640), menu sheet, anchored popover. The
      family owns the portal to body, scrim, focus trap and restore, Escape (topmost only), Back (one
      history entry per open dialog), scroll lock held through the exit, close control, exit, and
      `inert` on what is covered [§12, overlay family].
- [ ] A dialog's width comes from a preset (360/460/560/620/720/920). A phone sheet hugs its content
      between `--sheet-h-xs` and `--sheet-h-full`, and its content stands at the top [§13].
- [ ] One close control (`CloseButton`). No hand-drawn × [§14].
- [ ] An overlay has one inset on every edge, 16px (20px from 640), including between title row and
      body [§14a].
- [ ] A fill against a total, such as "steps done of total", is one `Meter` with
      `role="progressbar"` [§23] [accessibility §40].
- [ ] **(app)** The agent's steps are one list primitive, the `AiSteps` concept: each step is led by
      its tool's glyph (assessor, permits, complaints, violations, hazards) and states its own
      progress [components table: "A conversation with AI"; ai §26a].
- [ ] **(app)** Findings with sources follow the `AiCitedText` / `AiSources` / `AiVerdict` concepts.
      A claim links to source n. Each source shows its title, then publisher and date separated by a
      gap [components table; ai §19–21].
- [ ] **(app)** Model-written text that would replace the user's (a rewritten draft) follows
      `AiProposal`: the proposal sits beside the user's text before replacing it [components table;
      ai §13–16].
- [ ] A status label on a finding is the one `Chip` primitive [components table].
- [ ] A relative time and a count come from one formatter each [§17].
- [ ] Pills are content or tools, never page chrome [§29].
- [ ] **(app)** Source links to city records: the closest analogue is `CreditLink`, which links to a third party's page in a new tab with no referrer (`target="_blank" rel="noopener noreferrer"`) [§26a]. A link's words are primary or secondary ink, never accent [colour-and-effects §8a]. The URL is isolated LTR [internationalisation §23]. The native long-press menu is kept [platform §11]. None of the docs states a new-tab rule for product links in general, so this is an inference.
- [ ] A section switcher, if you have one (Findings / Actions), is an underline `TabStrip` driven by
      the URL. There are no pill tabs. The chosen tab is a neutral capsule and is not accent [§9,
      §27].

### motion
- [ ] Motion has four jobs only: orient, causality, continuity, status. Remove anything that does
      none of these [§1].
- [ ] **Only status loops.** Spinner, skeleton shimmer and an indeterminate ring. No pulsing dots, no
      breathing glows, no looping "thinking" gradients [§2].
- [ ] At most one burst per flow, answering something **the user did**, never something the app did.
      Finishing the report is the app's doing, so it gets no burst [§3].
- [ ] If one member of a family animates, they all do [§4].
- [ ] Every duration is a rung. Nothing exceeds 400ms except the one 800ms burst [§5–6].
- [ ] Exit is 0.8 of enter: a 240ms dialog leaves in 192ms, a 160ms menu in 128ms [§7].
- [ ] Arrivals decelerate (`--ease-dialog` / `--ease-enter`). Departures accelerate (`--ease-exit`).
      Every transition names its curve, never a bare `ease` [§8–10].
- [ ] Arrive is opacity 0→1 plus a short travel: **dialog 12px, in-page reveal 8px, popover 4px**.
      Nothing scales from 0 except the burst [§16–17].
- [ ] **Change in place is opacity only**: a crossfade at 150ms on `--ease-gentle`. A step's glyph
      changing from spinner to check to warning crossfades. It never slides or scales [§18].
- [ ] **(app)** Steps and findings arriving together cascade: 8px rise plus fade, one 50ms stagger
      step each, `animation-fill-mode: both`, capped so the last never waits long. The sequence
      steps once and stops [§20, catalogue: "Cascade of results"].
- [ ] A server-rendered or first-paint reveal is a CSS class, never JS that sets `opacity: 0` in the
      HTML [§21].
- [ ] Overlays open on CSS transitions, not JS. One duration source: the JS unmount timer equals
      `--ovl-dur` [§24–25].
- [ ] Pointer events stop the instant a close begins (`data-interactive="false"` or
      `pointer-events: none`) [§27].
- [ ] Only `transform` and `opacity` animate. Never height, width, top, margin, `box-shadow` on large
      surfaces, `filter`. A progress bar is `transform: scaleX` from `transform-origin: left`, or
      right in RTL [§39, catalogue: "Progress and level bars"].
- [ ] The only layout animation is a disclosure: `grid-template-rows: 0fr→1fr` at 200ms
      `--ease-smooth`, for example for expanding a finding's details [§40].
- [ ] `will-change` lives only for the duration of the motion [§43].
- [ ] Never transform a page container to fade it [§45].
- [ ] Nothing animates while the user is typing or scrolling except what they are driving [§46].
- [ ] Reduced motion: functional motion is shortened to a 150ms fade and never removed. Travel is
      removed and presence stays. Decorative motion (cascade, burst) is removed. Spinner and shimmer
      keep running. Press becomes opacity 0.7 [§47–52].
- [ ] What never moves: body text colour and size on hover or focus, chrome under content, no
      parallax, a status badge (it fades, never pulses), a burst and a toast together [§54–59].
- [ ] Page arrival with no gesture is **a cut**, not a fade from opacity 0 [catalogue: "Page arrival
      with no gesture"].
- [ ] Skeleton to content: hold 150ms invisible, then bones, then a crossfade in at 150ms. Opacity
      only [catalogue: "Skeleton to content"].
- [ ] Toast: rises from the dock at 300ms `--ease-enter` on `translate` plus opacity. The undo window
      is a draining fill (`scaleX`) that keeps running under reduced motion [catalogue: "Toast"].
- [ ] Empty state: reveals after the data settles, never during the hold [catalogue: "Empty state"].
- [ ] Error page: arrives like a panel. It **never shakes and never flashes red** [catalogue: "Error
      page"].
- [ ] **(app)** Multi-step flow, the input→working→report transition: the chrome holds still and only
      the content moves. The first step paints at rest [catalogue: "Onboarding"].
- [ ] Composer or textarea growing: height follows the content with **no transition** [catalogue:
      "Composer growing"].
- [ ] Hover (desktop only) tints at 150ms. Focus outline is drawn, never animated [catalogue].

### loading-and-states
- [ ] **Exactly one of four states at a time**, in fixed order: pending → error → empty → content
      [§1]. Gate on "pending", not on a flag that is false when the data is cached or the query is
      disabled [§3].
- [ ] **An error never shows as empty.** "No permits found" must never be what a failed permits
      fetch renders [§4] [copy-and-voice §20].
- [ ] **(app)** Partial failure: when four of five sources load and one fails, keep the four. The
      failure and its Retry go at the foot of that source's section [§5].
- [ ] Bones only stand in for content coming from a server, never for a form, picker or chrome [§6].
- [ ] A ghost is the exact shape of the content: line bones sit in the real line box and use the
      same row recipe. Zero layout shift [§7].
- [ ] A list ghost's height comes from its column, never from a guessed row count [§7a].
- [ ] Chrome is drawn, not boned. The header, Back and any known title (the address the user typed)
      are real during loading [§8–9].
- [ ] One shimmer: a 1.8s band of `clamp(9rem,26vw,26rem)`. No `animate-pulse`, no second loading
      keyframe [§12].
- [ ] A spinner is only for a surface with no shape to promise, for example the running-step glyph.
      Anything that resolves into laid-out content gets bones [§13].
- [ ] A pending surface announces itself once, at the outermost boundary: `role="status"` and
      `aria-busy` [§14] [accessibility §39].
- [ ] **Hold 150ms before showing any bone.** Content that lands sooner shows no skeleton. The held
      space is laid out but invisible. Crossfade in only if bones were actually seen [§15–17].
- [ ] Empty appears only after the data has settled [§24]. Filtered-to-empty says so and offers Clear
      [§25].
- [ ] **A null row and a thrown request are different states.** "No assessor record for this
      address" is not-found. "Couldn't reach the assessor" is an error [§26].
- [ ] **(app)** Refusal precedence: connectivity, then abort, then HTTP status, then the source's own
      reason. An offline user never reads a 500 [§27].
- [ ] Every failed read has a Retry that the user triggers. Nothing retries on an invisible timer
      [§30].
- [ ] Empty, error and gone share one card shape: tile, one line, one action [§30a].
- [ ] Inline errors use `ErrorAlert`: the error tone for a refusal, the warning tone for a condition.
      A failed action uses a toast [§31].
- [ ] An error boundary replaces the page, not the app [§32].
- [ ] If retrying cannot fix it ("Address is outside San Francisco"), offer no Retry [§39].
- [ ] A limit names its number, for example "Up to 20 lookups an hour. Resets at 3:40 PM" [§40].
- [ ] **(app)** Long-tail catalogue to design before demo: address not found or ambiguous, outside
      SF, a source down, every source down, rate limited, offline, the agent stopped by the user, a
      draft failed to generate, a send refused, a booking slot gone [§36].

### input-and-forms
- [ ] Use field primitives only [§1].
- [ ] **Every field declares `type`, `inputMode`, `enterKeyHint`, `autoComplete`,
      `autoCapitalize`, `autoCorrect` and `spellCheck`** [§2]. For this app:

| Field | type | inputMode | enterKeyHint | autoComplete | autoCapitalize | autoCorrect | spellCheck |
|---|---|---|---|---|---|---|---|
| Address **(app)** | `text` | `text` | `next` | `street-address` | `words` | `off` | `false` |
| Units, sq ft (whole number) | `text` | `numeric` | `next` | `off` | `none` | `off` | `false` |
| Baths (allows 1.5) **(app)** | `text` | `decimal` | `next` | `off` | `none` | `off` | `false` |
| Price / offer amount (money) | `text` | `decimal` | `done` | `off` | `none` | `off` | `false` |
| Listing URL | `url` | `url` | `done` | `url` | `none` | `off` | `false` |
| Pasted listing text **(app)** | textarea | — | `done` | `off` | `sentences` | `off` | `false` |
| Email to agent / offer condition (body) | textarea | — | (newline) | `off` | `sentences` | `on` | `true` |
| Agent / inspector email | `email` | `email` | `next` | `email` | `none` | `off` | `false` |
| Inspection date (near today) | `date` | — | `done` | `off` | — | — | — |

- [ ] `type="number"` never ships. Money is parsed in the user's locale and refused, never guessed,
      when it can't be read [§5].
- [ ] A date near today keeps `type="date"` and the native picker [§5a].
- [ ] 16px input text on a coarse pointer [§6].
- [ ] Enter does the obvious thing. A single-line field moves to the next field or submits. A
      multi-line field gets a newline from Return on touch, and Cmd/Ctrl+Enter submits. IME composing
      never submits (`isComposing` / keyCode 229) [§7, §23].
- [ ] A character limit, if any, appears only in the last tenth of the budget and turns `error` past
      it [§8].
- [ ] An overlay containing one editing surface focuses it (`data-autofocus`), with `preventScroll`.
      The scroll to it waits 240ms until the sheet stops [§9].
- [ ] Chrome rides the keyboard on `translate`. The header never resizes. The caret is never under the
      keyboard [§11–12].
- [ ] A search or address-autocomplete query is debounced at 300ms. The field itself never is [§13].
- [ ] Paste binds to the field, never to `window`. A mixed paste keeps its text [§15–16].
- [ ] **(app)** A pasted listing URL becomes a card under the text, not a chore [§18].
- [ ] A field has **one** message slot and it is only for errors: `role="alert"`, wired with
      `aria-describedby` [§25]. **No hint or helper text** under fields [§26].
- [ ] **Errors appear on submit or on blur, never while typing** [§27].
- [ ] The message is on the field, not a form banner, and names what refused [§28].
- [ ] An invalid field shows it with `aria-invalid` plus edge tint. The message slot grows below the
      baseline without reflowing the form [§29].
- [ ] Settings, such as theme or text size, apply on change. No Save button [§31–32].
- [ ] Defaults are read before first paint (the boot script) [§36].

### feedback
- [ ] Use one press ladder: subtle 0.98 for wide surfaces, 0.96 for compact controls, 0.93 for small
      glyphs. Down is instant and up is eased at 150ms. A card stays still when a control inside it
      is pressed [§1–4].
- [ ] Under reduced motion the press becomes opacity 0.7, never nothing [§5].
- [ ] Haptics are optional on web. If used, there is one `haptic()` helper, and it fires only on
      `success` (10·50·10), when the report the user waited on finishes, or on `error`
      (30·30·30·30), when the work refused. **Never on a plain tap** [§6–9, vocabulary].
- [ ] No sounds for taps, sends, success or errors [§12].
- [ ] Toasts come from one dock, bottom-end on desktop and above any bottom bar on phone, at z 600.
      **At most 3** show at once [§18–19].
- [ ] One toast per outcome. Duplicates are dropped, except actionable toasts [§20].
- [ ] **An outcome toast lasts 4s. An undo toast lasts 5s** [§21].
- [ ] An undo toast is one line, "Email sent" plus Undo, separated by space. It has no icon, no
      description and no close. The window is a draining fill, never a number [§22].
- [ ] A toast never takes focus. It uses `role="status"`, or `role="alert"` for an error [§23].
- [ ] **A rollback always toasts and names what refused** [§24].
- [ ] **Reversible acts happen now and offer Undo for 5s** [§30].
- [ ] **Confirm is for the irreversible only**: no inverse exists, money moves, or other people see
      it. `ConfirmDialog` asks once and names the thing. Cancel is its only way out, with no close
      glyph [§31].
- [ ] **Never both.** An action that offers undo doesn't also ask, and vice versa [§32].
- [ ] Undo is a real inverse. An act with no inverse, such as sending an email, is **held**: show the
      undo offer and make the write only when the window closes [§33].
- [ ] **(app)** Outward actions:
  - *Add offer condition* is local and reversible. It applies now, with the toast "Condition added"
    plus Undo [§30].
  - *Email the listing agent* has no inverse once delivered, so it is held. Send closes the editor,
    shows "Email sent" plus Undo for 5s, and actually sends when the window closes. A tab closed
    inside the window sends nothing, so show a pending state on the action row until it sends [§33].
    The alternative is a `ConfirmDialog`, "Send to dana@agency.com?" with Send and Cancel, but not
    both [§32].
  - *Book inspector* commits someone else's time and possibly money, so it is irreversible:
    `ConfirmDialog` naming inspector, date, time and price, with buttons "Book" and "Cancel"
    [§31].
- [ ] Nothing interrupts typing. No overlay opens, focus doesn't move and the list doesn't reorder
      while a field has focus. Findings arriving during an edit wait [§36].
- [ ] One thing arrives at a time [§37].
- [ ] A browser prompt (clipboard, geolocation, notifications) follows a tap only [§40].

### copy-and-voice
See section 4.

### accessibility
- [ ] Every control's accessible name is its action. An icon-only button requires `aria-label`. Two
      controls reachable at once never share a name, so give each finding row's action a unique name
      ("Open permit 2019-0412-3345") [§1].
- [ ] An icon-only label hidden by width becomes `sr-only` and is never dropped [§2]. A tooltip is
      never the only name [§3].
- [ ] A name changes with state, for example "Stop" and "Run again" [§4].
- [ ] Only valid ARIA roles with their required attributes [§5].
- [ ] Decorative glyphs are `aria-hidden` [§7].
- [ ] One `<main id="main-content">`. One `<h1>` per page. Headings never skip a level. Levels are
      never picked for size [§9–11].
- [ ] A skip link is first in the document [§13].
- [ ] DOM order is visual order. No positive `tabIndex`. No `order` that reorders keyboard path [§14].
- [ ] Focus is always visible: a 2px accent outline offset 2px, inset inside a clipping list, and
      round on round targets [§15].
- [ ] Focus never lands on a `div` acting as a button [§16].
- [ ] An overlay moves focus in (to `[data-autofocus]`, else the first focusable) and restores it to
      the trigger on close. A surface opened by touch contains Tab without lighting a ring. Only the
      topmost surface owns keys [§17–19].
- [ ] When a row, sheet or dialog unmounts, focus returns to its opener, never `<body>` [§20].
- [ ] **44px hit areas on a coarse pointer** and 24px on fine. At least 4px dead space between
      adjacent independent targets [§21, §24].
- [ ] **4.5:1 for text, 3:1 for large text and control edges, in both themes** [§25].
- [ ] Faint ink never carries data [§27].
- [ ] Preferences (reduced motion, text size) change tokens, never render a different tree [§29].
- [ ] A change the user caused on the control they pressed is not announced, because its label
      changes. One they caused elsewhere is announced once by the toast. One they didn't cause, such
      as agent steps completing, is `aria-live="polite"` [§34–36].
- [ ] **A live region is in the DOM before its text.** Mount it empty at page load [§38].
- [ ] Live regions never nest [§39].
- [ ] Determinate progress ("3 of 5 sources checked") uses `role="progressbar"` with
      `aria-valuenow`, or a polite text line [§40].
- [ ] A validation error is `role="alert"` and bound by `aria-describedby` [§41].

### definition-of-done (the demo-day checklist)
- [ ] Seen at **390px with coarse pointer at DPR 3**, and at **1440px with a fine pointer** [§1].
- [ ] Seen in **light and dark**, with app theme and OS scheme both set [§2].
- [ ] The tallest and widest real case: the longest SF address, the property with the most permits
      and complaints, at the largest text size [§3, §6].
- [ ] Every overlay opened, closed and opened again from its real trigger. Escape closes only the
      topmost. Back leaves exactly one thing [§4].
- [ ] Driven by clicks, not by visiting URLs [§5].
- [ ] RTL sanity check if time allows: `dir="rtl"`, chevrons and slide direction mirror [§7].
- [ ] Under reduced motion, both OS and in-app: nothing teleports and nothing hangs [§8].
- [ ] Offline where it sends: the send answers in the frame and the offline state says what is
      happening [§9].
- [ ] Throttled 4x CPU: no long frames, no layout shift after first paint, no blur animating [§10].
- [ ] Contact sheet: screenshots side by side read as one product [§11].
- [ ] **Every string read aloud.** Cut what survives being cut [§12].

### navigation-and-history
- [ ] **Every state the user can be sent back to has a URL**, for example `/check?address=…` or
      `/check/:id`. A refresh lands on the same report, not the empty form. A deep link paints what it
      names first, with no default painted and then corrected [§1–2].
- [ ] A tab or section switch is a search param written with `replaceState`. Ten taps leave one
      history entry [§3–4]. Never use `<Tabs defaultValue>`, which ignores deep links [traps].
- [ ] One small module is the only code that touches `history.state` [§5].
- [ ] **An overlay is not a URL.** The draft editor or confirm dialog pushes one phantom entry on open,
      so Back closes it, and a refresh lands on the page beneath it [§6, §8].
- [ ] A close never calls `history.back()` on its own. To navigate out of an overlay, close it, wait
      for the pop (with a ~300ms fallback), then navigate [§9, §11].
- [ ] **Back leaves exactly one thing**, the topmost overlay or else the page, and never nothing. On a
      cold deep link, in-app Back goes to the app's landing route rather than off-site [§7, §10, §12].
- [ ] Escape closes only the frontmost surface. **Escape inside a field blurs first; the next Escape
      closes the editor** [§14, §17]. Key listeners exist only while their surface is on screen [§15].
- [ ] Shortcuts never fire while typing in an input, textarea or contentEditable. Every shortcut has a
      touch equivalent. Cmd/Ctrl+Enter submits the editor [§35–37].
- [ ] Scroll: set `history.scrollRestoration = 'manual'`. Only a pop restores, by anchor row plus
      offset, recorded while scrolling. A fresh push lands at the top. Any wheel, touch or key cancels
      a restore [§18–21].
- [ ] Warm on intent (pointerenter, pointerdown, focus), never on viewport entry [§32–33].

### speed
- [ ] The response ladder:
  - **0ms**: the pressed state, from CSS.
  - **1 frame**: the result on screen, optimistic.
  - **≤100ms**: chrome plus cache or ghost.
  - **150ms**: pending data earns bones.
  - **≤1s**: content on a warm device.
  - A failure crossfades back and names what refused.

  [speed: ladder]
- [ ] Budgets [speed §1–3]:

  | Measure | Budget |
  |---|---|
  | Input to response | 1 frame |
  | INP (p75) | 100ms |
  | Overlay open to first motion frame | 1 frame |
  | CLS after first paint | 0 |
  | LCP | <1.5s warm, <2.5s cold on 4G |
  | Round trips chained before paint | at most 2 |

  Measure on 4x CPU throttle plus throttled 4G.
- [ ] **(app)** Fire the assessor, permits, complaints, violations and hazards lookups **in
      parallel**. Show each section as it lands [§21]. Stream agent progress with SSE rather than
      polling. Nothing polls where an event exists [§30].
- [ ] A tap handler does no work: it writes state and returns [§23].
- [ ] **Every mutation is optimistic.** Write locally, then send. On rollback, restore the snapshot
      and name the refusal. A control is never dimmed to wait for its write. A second tap during the
      round trip is queued, not dropped [§24].
- [ ] A read retries at most twice. Never retry a deterministic refusal or 4xx (except 408 and 429)
      [§25] [resilience §7–8].
- [ ] Typing never lags. Derived work, such as address autocomplete, debounces at 300ms and cancels
      superseded requests with `AbortSignal`, keeping the last answer up [§26].
- [ ] The user waits only for what the result can't exist without. "A model cannot be in front of"
      an action the user can take now [§31].
- [ ] No refetch on window focus [§17]. Fonts never block (`display: swap`) [§12]. Heavy code loads
      after first interaction [§10].

### resilience
- [ ] `navigator.onLine === false` is only a hint; confirm it with a real `HEAD` to your API before
      changing the screen [§1].
- [ ] Offline is **one banner** in the toast dock, "Offline, showing what's saved", and costs no
      layout [§2].
- [ ] **Nothing is disabled for being offline.** The attempt fails in its own surface and says so
      [§3].
- [ ] A network failure says which network. **(app)** "You're offline" and "Couldn't reach DBI
      permits" are different sentences [§4].
- [ ] Writes fail fast rather than hang. Every request has a deadline via an `AbortController`
      timeout. Don't use `AbortSignal.any`, which throws below Safari 17.4 [§5, §11a].
- [ ] A retry that succeeded is never mentioned [§11]. Retry loops are bounded and jittered [§9–10].
- [ ] **A refused send is still the user's message.** Keep it with Retry and Dismiss; the app never
      deletes it [§17].
- [ ] "Not sent yet" (waiting on the connection) shows a clock and one quiet line, with no toast. Red,
      Retry and exactly one toast are only for a send that is out of tries or refused [§17a].
- [ ] **An automatic resend carries an idempotency key.** **(app)** The email send and the inspector
      booking each carry a `crypto.randomUUID()` key, deduped on the server [§20].
- [ ] Only sends queue. Other writes fail, roll back and toast [§22].
- [ ] **Nothing typed is ever lost.** **(app)** The address form, the pasted claims and every draft
      (email, offer condition) autosave to `localStorage` on a time ceiling (not a debounce), silently,
      with no toast. They flush on `visibilitychange` plus `pagehide` [§38, §23].
- [ ] A draft is deleted only when its send has *landed* or the user discards it. Leaving the editor
      keeps the draft, says so once ("Draft kept" + Discard), and Discard deletes the stored copy
      [§40–41].
- [ ] A `beforeunload` guard runs only while genuinely dirty or while a send is unsettled [§42].
- [ ] **Nothing moves under the reader.** New content is an offer, not an insertion [§28]. No refetch
      on focus [§29]. A new deploy is offered, never forced over unsaved work [§31].

### internationalisation (en-only build, still binding)
- [ ] Every reader-facing string, including `aria-label`, `placeholder`, `alt` and `title`, comes from
      one strings object. Never a literal in markup [§1].
- [ ] A sentence is one key with `{param}` interpolation. No concatenation, and no number placed
      beside a translated noun in markup [§34–35]. A label never renders as its key or `undefined`
      [§42].
- [ ] **No em dash in any UI string** [§10]. The one em dash allowed is the `EMPTY_VALUE` glyph for a
      missing number [type §20] [copy-and-voice §37]. Write copy with full stops, colons and commas.
- [ ] Serve `<html lang="en" dir="ltr">` in the document, never set in an effect [§11].
- [ ] Numbers go through one formatter module that passes the locale explicitly:
      `Intl.NumberFormat(LOCALE, {style:'currency', currency:'USD'})` for price and assessed value.
      **`toLocaleString()` with no locale argument is a defect** [§24–25].
- [ ] Counts use one plural helper over `Intl.PluralRules`, never `n === 1` or "(s)" [§26–27].
- [ ] **(app)** Square feet has no Intl unit, so write `"{count} sq ft"` as one key with the number
      formatted.
- [ ] Dates use one formatter with no `'en-US'` or options at call sites [§29]. Relative times use one
      `Intl.RelativeTimeFormat` helper [§28].
- [ ] **A bare `YYYY-MM-DD` is a calendar day, not an instant.** Parse permit, complaint and
      violation dates at local midnight. `new Date('2026-09-09')` shows Sept 8 in San Francisco
      [§30].
- [ ] Time of day takes its hour cycle from the locale, for the inspector slot [§31]. A booking
      calendar starts weeks on the locale's first weekday [§32].
- [ ] Use logical properties only (`margin-inline-start`, `inset-inline-end`, `text-align: start`).
      Chevrons flip with `scaleX(-1)` and never rotate. A progress fill's `transform-origin` is left in
      LTR and right in RTL [§16–18].
- [ ] **Addresses, URLs, permit numbers and APNs never mirror.** Isolate them LTR (`<bdi>` or
      `dir="ltr"`). Pasted listing text renders `dir="auto"` [§23].
- [ ] Normalise addresses with `\p{L}\p{N}` and the `u` flag, never `[a-z0-9]` or `\w` [§39].
- [ ] A label survives twice its English width. Dialog footer button pairs, header actions and chip
      strips must not wrap on a 390px phone [§36–37].

### arrival
- [ ] The tab title follows the template **"<page> on House Checker"**, for example "123 Main St on
      House Checker", with no glyph between. A route whose tab reads only the product name is a defect
      [§1].
- [ ] One favicon. Add `<meta name="theme-color">` once per OS scheme with `media`, and replace it
      with a single tag once a theme is applied [§2–3].
- [ ] Every theme block declares `color-scheme` [§4].
- [ ] The first frame is already right: the blocking theme and reduce-motion script runs before paint,
      with separate `try` blocks [§5–6].
- [ ] Viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover,
      interactive-widget=resizes-content`. **Never `maximum-scale` or `user-scalable=no`** [§12–13].
- [ ] **The first screen paints its real controls at final shape**, so the address form renders
      immediately with no skeleton [§19]. It collects; it doesn't explain. No intro paragraph about
      features [§29, §31].
- [ ] No permission prompt, install offer or interruption on load or in the first session [§33–34].
- [ ] One attempt runs at a time. The pressed control holds the spinner and every other control goes
      inert [§21].
- [ ] iOS: add an empty `touchstart` listener so `:active` paints, since the tap highlight is
      transparent [arrival traps] [feedback §3].

### platform
- [ ] **Buttons and links keep `cursor: default`. `cursor: pointer` never ships.** The cursor changes
      only when its shape carries information: `text`, `grab`, `zoom-in`, `not-allowed` (set by the
      primitive), `wait` [§1–3].
- [ ] Scrollbars are one thin, theme-aware bar. Vertical scrollers never hide it. Horizontal strips
      hide it with `overscroll-behavior-x: contain`. A textarea hides its bar and grows instead
      [§6–7b].
- [ ] Content is selectable: findings, address, permit numbers and draft text. `user-select: none`
      only on chrome. Keep the native long-press menu on source links [§9–11].
- [ ] `touch-action: manipulation` on body. `overscroll-behavior-y: none` on html and body. Every inner
      scroller (dialog, sheet, autocomplete list) uses `overscroll-behavior: contain` [§13–15].
- [ ] Rotation loses nothing. Use `--app-vh`, not `100vh`. Every width from 320 to 2560 is clean
      [§17–19].
- [ ] Media queries are named constants, never literal strings scattered around [§20].
- [ ] Sharing the report: `navigator.share`, falling back to clipboard plus toast. An `AbortError`
      does nothing [§22–24].
- [ ] **"Nothing prints"**: no `@media print`, no `window.print()` [§27]. This is a product choice
      that may conflict with buyers wanting a PDF; see section 5.

### signature-motion (skim)
- [ ] The signatures (morphs, capsule, listening edge) are **not required**. A surface that can't
      carry one at quality uses the plain sentence from `[motion]` [signature-motion intro].
- [ ] The press shows on the first frame. Highlight on pointer down, act on pointer up, and dragging
      off cancels [§1–2]. Nothing is disabled "while animating", and every animation is interruptible
      [§5].
- [ ] **A step's glyph performs its change once, on its cause.** The spinner-to-check change is a
      content transition, played once and never on mount. A spinner is "indefinite" and ends when its
      state ends [§21].
- [ ] A changing count rolls only the changed digit at 200ms `--ease-dialog` in tabular figures. This
      is optional; the fallback is a 150ms crossfade [§20] [motion catalogue].
- [ ] Regenerating a draft shows the shimmer band (1.8s) over the block, then the new text crossfades
      in at 150ms. The user can leave while it runs [§24] [ai §8].
- [ ] Two things never arrive together toward the same attention. The second waits for the first's
      duration [§25].
- [ ] Desktop: Escape reverses what a drag reverses on a phone. No horizontal travel. No full-window
      takeover [§29, §52–53].
- [ ] No spring bounces above 0.4. No bespoke glow, pulsing dot or spinner while "listening" [§39].

### media (images only: map thumbnail or street photo)
- [ ] A placeholder paints first, as an aspect-ratio box in a neutral token. The image fades in over
      it at 400ms `--ease-enter`. A photo never zooms. An image in the first HTML is not held at
      opacity 0 [§1] [motion catalogue: Image].
- [ ] Request the size it's drawn at, about 2–3x DPR on phones, and declare `sizes` or width and
      height. Never upscale [§4–6, §12].
- [ ] A picture that fails to load is not drawn: remove it and its frame. No broken-image icon, no
      empty box [§12a].
- [ ] Real alt text ("Street view of 123 Main St"). `alt=""` only on purpose. A model-written
      description is labelled "AI description: …" [§13a, §15].

### enforcement (lite version for a hackathon)
The standard compiles rules into source-reading "fitness" tests that run on pre-push, plus e2e for
pixels. A rule and its test land together [enforcement §1–3, §12]. Cheap stand-ins, as a `check.sh`:
```sh
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src --include=*.{css,tsx,jsx,ts,js} | grep -v tokens.css   # raw colour [tokens §2]
grep -rnE '[0-9]+ms|cubic-bezier|ease-in-out|\bease\b' src | grep -v tokens.css                  # literal motion [motion §5, §10]
grep -rnE 'cursor:\s*pointer|cursor-pointer' src                                                 # [platform §2]
grep -rnE 'maximum-scale|user-scalable' .                                                        # [arrival §13]
grep -rnE '@media print|window\.print' src                                                       # [platform §27]
grep -rnE 'type="number"|type=\{?.number' src                                                     # [input-and-forms §5]
grep -rnE "animate-pulse|@keyframes" src                                                         # one shimmer, status-only loops [loading-and-states §12] [motion §2]
grep -rniE "\bwe\b|\bour\b|please|simply|\bjust\b|!\"|successfully|something went wrong|N/A|\(s\)" src/strings*  # [copy-and-voice §2–4, §14, §22, §36–37]
grep -rn '—' src/strings*                                                                        # no em dash in copy [internationalisation §10]
grep -rnE "toLocaleString\(\)|new Date\('[0-9]{4}-[0-9]{2}-[0-9]{2}'\)|'en-US'" src             # [internationalisation §25, §29, §30]
grep -rnE "catch\s*(\([^)]*\))?\s*\{\s*\}" src                                                   # nothing fails silently [loading-and-states §30]
grep -rnE "history\.back\(\)" src                                                                # [navigation-and-history §9]
grep -rnE "<(button|input|textarea|select)\b" src | grep -v components/ui                        # bare controls [components §6]
grep -rnE "margin-left|margin-right|padding-left|padding-right|\bleft:|\bright:|text-align:\s*(left|right)" src  # logical props [internationalisation §16]
```
Also run `python3 contrast.py` over your token pairs (4.5:1 text, 3:1 edges), and an axe pass in the
browser.

---

## 3. Banned patterns (fail review)

**Visual**
- A second card on a card. A list of cards where a flat list of rows belongs [craft §23]
  [colour-and-effects §4].
- Hairlines or `divide-y` between rows of one list [craft §16].
- `·`, `|`, `•` or dashes between facts on a meta line [craft §10a].
- Two filled buttons on one screen. A filled button in each list row [craft §7].
- Accent on two things at once. Accent on product words: links, "Retry", "Undo", section titles
  [colour-and-effects §8, §8a].
- The primary button reading `--accent` instead of `--cta` [colour-and-effects §10].
- A status colour used as a feature's look. Glow or shadow signalling state [colour-and-effects §13,
  §38].
- **Gradient buttons, glowing cards, confetti, mascots, sparkles, decorative dots, "AI" purple**
  [craft §40].
- Raw `#fff`, `#000` or `text-white` [colour-and-effects §6]. A full-pane tint [colour-and-effects
  §20].
- A second icon family, or a Phosphor weight other than regular or fill [craft §18].
- Text under 14px (badge excepted). Text shrunk by `transform`. A fifth font weight or a fourth
  reading size [type §1–5].
- Ad-hoc `letter-spacing`. Pixel line-heights. `break-all` on sentences. `nowrap` on button labels
  [type §6, §7, §10, §11].
- A child rounder than its parent. Equal nested radii [craft §11–12].
- A ring plus a border at rest. Two focus rings [craft §15a] [components §5].
- A literal `max-width` instead of the column measure [layout §6].
- Hover-only affordances [layout §4]. Body horizontal scroll [layout §22]. A second row of controls on
  a phone [craft §31].
- `overflow-x: hidden` on a page wrapper, which breaks sticky [layout traps].
- More than one frosted layer per screen. Blur on content. Blur on anything that animates
  [colour-and-effects §5, §34, §35].

**Motion**
- Any loop that isn't status: pulsing dots, breathing "thinking" glows, animated gradients
  [motion §2].
- A burst or celebration for something the app did, such as the report finishing [motion §3].
- Durations over 400ms. Literal durations or curves. Bare `ease`. A private easing set [motion §5–6,
  §10, §13].
- Accelerating arrivals [motion §8].
- Sliding or scaling for a change in place. Scale-from-0 arrivals [motion §16, §18].
- Animating height, width, top, margin, padding, box-shadow or filter [motion §39]. Disclosure via
  `grid-template-rows` is the only exception [motion §40].
- JS-driven overlay opens. An overlay whose unmount timer differs from its CSS duration [motion
  §24–25].
- An invisible but still hit-testing scrim after close [motion §27].
- Parallax [motion §57]. A pulsing live or status badge [motion §58]. Shaking or red-flashing errors
  [motion catalogue: "Error page"].
- A page fading in from opacity 0 [motion catalogue: "Page arrival with no gesture"] [traps: Loading].
- A transition on textarea height [motion catalogue: "Composer growing"].
- Removing functional motion under reduced motion (teleporting). Freezing spinner or shimmer under
  reduced motion [motion §47, §50].

**States and flow**
- Two states at once, for example empty then skeleton then list [loading-and-states §1, §3].
- **An error rendered as empty** [loading-and-states §4] [copy-and-voice §20].
- Wiping loaded content on a later failure [loading-and-states §5].
- Bones for forms, chrome or menus. `animate-pulse`. A second loading texture [loading-and-states §6,
  §12].
- A skeleton before 150ms. A crossfade on a surface that never showed bones [loading-and-states
  §15, §17].
- A skeleton that doesn't match the content's shape, causing layout shift [loading-and-states §7].
- A spinner where the content's shape is known [loading-and-states §13].
- A failure with nothing to press. Auto-retry on a hidden timer [loading-and-states §30].
- A Retry on a refusal that a retry can't fix [loading-and-states §39].
- Not-found and error collapsed into one state [loading-and-states §26].
- A progress line keyed to a phase that says one thing for a minute [traps: Speed] [ai §9].
- Confirm **and** undo on the same action [feedback §32]. Confirm on a reversible action [feedback
  §31].
- An undo that is a refetch, not an inverse [feedback §33]. A silent rollback [feedback §24].
- A toast that asks, promises or offers ("Coming soon") [copy-and-voice §23].
- A toast that steals focus [feedback §23].
- Anything opening, moving focus or reordering while the user types [feedback §36].
- Haptics on plain taps. Sounds on success or error [feedback §7, §12].

**Forms**
- `type="number"` [input-and-forms §5].
- Inputs under 16px on touch [input-and-forms §6].
- Fields missing keyboard attributes [input-and-forms §2].
- Errors while typing (`onChange` validation) [input-and-forms §27].
- Helper or hint text under fields [input-and-forms §26] [copy-and-voice §11].
- A form-level banner for a field-level fault [input-and-forms §28].
- Paste listeners on `window` [input-and-forms §15].
- A focus ring on a textarea or editor [input-and-forms §21].
- A Save button on settings [input-and-forms §31].

**Platform, navigation, resilience, i18n**
- `cursor: pointer` [platform §2]. `@media print` / `window.print()` [platform §27].
  `maximum-scale` / `user-scalable=no` [arrival §13]. A permission prompt on load [arrival §33].
- `history.back()` from a close handler. A global Escape listener in a layout. `<Tabs defaultValue>`
  [navigation-and-history §9, §15, traps]. A report view with no URL that a refresh loses
  [navigation-and-history §1].
- Prefetch on viewport entry [speed §8]. Refetch on window focus [speed §17]. Sequential source
  lookups [speed §21]. A poll where SSE or an event exists [speed §30]. A control dimmed while its
  write is in flight [speed §24].
- Reading `navigator.onLine` as truth. Greying controls when offline. Unbounded or unjittered retries.
  Retrying refusals. **Auto-resending without an idempotency key.** Deleting a draft on close.
  Autosave toasts. Inserting new content under the reader [resilience §1, §3, §8–10, §20, §28, §38,
  §40].
- `toLocaleString()` with no locale. Hard-coded `'en-US'` at call sites. `new Date('YYYY-MM-DD')`.
  `n === 1` plurals. Physical left and right. `rotate(180deg)` for direction. `[a-z0-9]`
  normalisers. **Em dashes in UI copy** [internationalisation §10, §16–17, §25, §27, §29–30, §39].

**Copy**: see section 4. Banned: title case, we/our/us, `!`, please/simply/just, "Something went
wrong", "Failed to…", "successfully", "N/A", "(s)" plurals, sentences assembled from fragments,
status codes or raw `error.message` shown to users.

**Code hygiene the standard checks**: bare `<button>` or `<input>` [components §6]. A hand-built
overlay with `fixed inset-0` [components §12]. A duplicate component name [components §20]. A
duplicated class string that isn't a recipe [tokens §6]. Raw `z-index` numbers [tokens: Z-index].
Inline `backdropFilter` or `transition` [tokens §5].

---

## 4. Copy and voice: exact rules, rewritten for House Checker

**The rules** [copy-and-voice]:
1. **Sentence case, always.** Proper nouns keep their capitals: San Francisco, the Assessor-Recorder,
   DBI. "Open permits", not "Open Permits" [§1].
2. **No first person.** No "we", "our" or "us", and the agent doesn't narrate itself with "I". Say
   what happened and what the reader can do. "my" and "I" are allowed only in the reader's own
   voice, for example in the draft email the user sends [§2].
3. **No exclamation marks** [§3].
4. **No "please", "simply" or "just"** [§4].
5. **≤110 characters per string.** Cut to the sentence that changes what the reader does [§5].
6. **One term per concept, everywhere.** Pick one and use it in rows, menus, toasts and empty states.
   For this app: **Retry** (never "Try again" alongside it), **finding** (not "issue" in one place
   and "flag" in another), **source**, **listing agent**, **offer condition** [§6]. The standard's
   own retry verb is `button.retry`, "Retry" [loading-and-states §30a] [copy-and-voice table].
7. **Present tense. The reader or the thing is the subject.** "Permits show 1 unit", not "It was
   found that permits would only show…" [§7].
8. **No jargon the reader didn't choose.** Define an invented term the first time, or don't use it.
   "NOV" is a term the reader didn't choose, so write "Notice of violation". "APN" is OK beside the
   label "Parcel" [§8].
9. **A label is the whole row.** No caption repeating it. No page subtitle saying what the page lists
   [§9].
10. **A description only when it names what the label can't**: what changes, what is lost, who sees
    it [§10].
11. **No helper prose.** Fields get a placeholder, not a caption. Dialogs get a title and controls, not
    an intro paragraph [§11].
12. **One string, one key**: one strings object, with no sentence duplicated [§12].
13. **Never assemble sentences from parts**, such as "Failed to {verb}". Each sentence is whole, with
    `{count}` or `{value}` substituted inside it [§13, §38].
14. **An error names what refused**, never "Something went wrong" [§14].
15. **Absence is not failure.** Not-found names what is missing [§15].
16. **No status codes, table names or raw `error.message`** [§16].
17. **Every gate names itself and its way through** [§17].
18. **A rollback says what was refused** [§18].
19. **An empty state is a title, one line and at most one action.** The line says what *will* be
    here [§19]. An empty state that is really an error says so [§20]. It never sells [§21].
20. **A toast is an object plus a past participle**, with no subject, full stop, adverb or `!`
    [§22]. It reports and never asks [§23]. An undo toast says what happened, then Undo [§24].
21. **Counts come from one plural helper**, never "(s)" [§36]. **A missing value is "—"**, never
    "N/A", "none" or "0" [§37].
21a. **No em dash in any UI string** [internationalisation §10]. The em dash survives only as the `EMPTY_VALUE` glyph for a missing number [copy-and-voice §37]. Rewrite "Permits — 3 open" as "3 open permits".
21b. **The tab title** is "<page> on House Checker" [arrival §1].
22. Emails are one card with one action. The preheader says the thing. A security-type email carries
    the facts and the escape hatch [§30–34]. The *agent-drafted* email is the user's own voice, so
    "I" is fine there.

**Buttons** are verbs naming the action, in sentence case: "Check this home", "Stop", "Retry", "Send",
"Book", "Cancel", "Undo", "Add condition", "Draft email", "Copy". The accessible name changes with
state, for example "Stop" ↔ "Run again" [accessibility §4]. Keep the width fixed to the wider label
[craft §34].

**Rewrites for House Checker**

| Situation | Fails | Passes | Rules |
|---|---|---|---|
| Page title | "Welcome to House Checker!" | "Check a home" | 3, 9 |
| Address placeholder | "Please enter the property address here" | "Street address in San Francisco" | 4, 11 |
| Listing claims placeholder | "Paste the listing description so we can analyze it" | "Paste the listing text" | 2, 11 |
| Primary button | "Analyze Property" | "Check this home" | 1 |
| Field error | "Invalid input" | "Enter a street address in San Francisco" | 14, 28 |
| Field error (out of area) | "Error: address not supported" | "This address is outside San Francisco" | 14, 15 |
| Agent step running | "We're now searching the permit database…" | "Reading permits since 1980" | 2, 7 |
| Agent step progress | "Analyzing…" for 40s | "Read 12 of 31 permits" (real, from the reads) | traps: Speed; ai §9 |
| Step done | "Successfully retrieved complaints!" | "4 complaints found" | 3, 22 |
| Step failed | "Failed to load violations. Please try again." | "Couldn't reach DBI violations. Retry" | 4, 14 |
| Not found | "Error 404" | "No assessor record for 123 Main St" | 15, 16 |
| Finding (mismatch) | "⚠️ Uh oh! Bathroom count doesn't match!!" | "Listing says 3 baths. Assessor records 2" | 3, 7 |
| Finding (ADU) | "The ADU may possibly not be permitted" | "No permit found for the rear ADU" | 7, 10 |
| Finding, zero sources | (silently omitted) | "No sources found for the ADU claim" | ai §20 |
| Empty section | "No data" / "N/A" | "No open complaints" | 19, 37 |
| Missing value | "N/A", "0", "" | "—" | 37 |
| Count | "1 permit(s)" | "1 permit" / "12 permits" via the plural helper | 36 |
| Toast after adding a condition | "Your condition was added successfully!" | "Condition added" + Undo | 22, 24 |
| Toast after send | "Email has been sent." | "Email sent" + Undo | 22 |
| Rollback | "Failed" | "Couldn't send: you're offline" | 18 |
| Confirm dialog title | "Are you sure?" | "Book Bay Inspections for Tue 9 Dec, 10:00 AM?" | 10, feedback §31 |
| Confirm buttons | "Yes" / "No" | "Book" / "Cancel" | 6 |
| Rate limit | "Too many requests" | "Up to 20 checks an hour. Resets at 3:40 PM" | 17, loading §40 |
| Offline | "Network error" | "You're offline. Retry when you're back" | 14 |
| Unknown failure | "Something went wrong" | "House Checker couldn't finish that. Reference 7F3K2Q9A" | 2, 14, loading §29 |
| AI disclosure | "Powered by our AI ✨" | One plain line under the first answer, e.g. "Written by AI" | ai §26b; craft §40 |

---

## 5. Constraints on a hackathon build, and faithful approximations

| The standard assumes | Hackathon reality | Faithful approximation |
|---|---|---|
| Next.js + Tailwind v4 `@theme`, named recipes in `lib/styles/` [tokens §1, §6] | React or plain HTML/CSS | Put the section 1 block in `tokens.css`. Write every repeated style once as a CSS class, such as `.row`, `.card`, `.btn-primary` and `.meta-line`. Never inline it. |
| Eight themes and a theme contract file | Two themes | Ship Light and Dark only. Every token is declared in both blocks. The boot script defaults to dark [colour-and-effects §21, §27]. |
| Card, border, shadow and status hex values in an unshipped `contract.ts` | Not in the docs | Use the `≈` values in section 1. Their contrast was checked (muted ≥4.5:1, deep status rungs ≥4.6:1 on light). Re-check any change against the 4.5 and 3:1 rule [accessibility §25]. |
| Inter self-hosted through `next/font`, `display: swap`, preload only the default [type §30] | No next/font | Use a Google Fonts `<link>` for Inter 400;500;600;700 with `&display=swap` and a `preconnect`, plus the system stack fallback. Or skip the web font and accept the system face; the standard prefers a real fallback over blocking. |
| Phosphor icons, `regular` plus `fill` only, one catalogue `lib/constants/icons.ts` [craft §18, §21] | — | Use `@phosphor-icons/web` (classes `ph ph-…` and `ph-fill ph-…`) from unpkg/jsdelivr at a pinned version, or `@phosphor-icons/react`. Keep one `ICONS` map from concept to glyph: house, permit, complaint, violation, hazard, source link, AI. The AI glyph is the star with its verb. Sparkle, Robot, Brain and MagicWand don't mean AI [ai §1, §4]. |
| `QueryStateWrapper`, `usePendingBones`, `state-held`, `state-fade-in` | — | Write one `<AsyncSection state={…}>` that renders pending, error, empty or content in that order. It starts a 150ms timer before swapping in bones, keeps the slot `visibility: hidden` while held, and adds a fade class only if bones were shown. |
| `useCssPresence`, `.ovl-panel[data-mode][data-state]` | — | Mount the panel with `data-state="open"` on the next frame. On close, set `data-state="closed"` plus `pointer-events: none` and unmount after `--ovl-dur × 0.8` with `setTimeout`, reading the same constant. Use the native `<dialog>` with `showModal()` for the focus trap, `inert` background and Escape for free, and add `history.pushState` on open and `popstate` to close, so Back closes the topmost [components §12]. |
| Framer Motion `LazyMotion`, springs [motion §44] | — | Don't use it. Everything here is expressible in CSS. Springs are only for gesture releases, and you have none except possibly a sheet drag, so skip the drag and use the grabber-less sheet. |
| `Toast` dock with `undoableToast` and a `toast-drain` fill | — | Write one `toast(message, {undo})` helper. The container is `role="status"` (separate `role="alert"` for errors) and mounted empty at load. Max 3 visible. 4s for outcomes, 5s for undo. The drain is a `scaleX(1→0)` transition over 5s with `linear` timing, which is a timer, not decoration. |
| `AiSteps`, `AiProgressLine`, `AiSources`, `AiCitedText`, `AiVerdict`, `AiProposal`, `AiThread` [components table] | — | These concepts are owned by `ai.md`, which you are reading. Hand-build one of each. The other docs depend on: real progress from the reads [traps: Speed], steps led by tool glyph [ai §26a], sources listed as title then publisher and date apart [ai §19], a verdict only after a second check [ai §21], and proposal beside the original before replace, with Use this and Keep mine at equal size [ai §13–14]. |
| i18n catalogue, `countOf`, `formatRelativeTime`, `formatSummary`, `EMPTY_VALUE` | — | Keep one `strings.en.ts` object, which satisfies one string one key [copy-and-voice §12]. Use `Intl.PluralRules`, `Intl.NumberFormat` (currency USD, sq ft as a unit or plain number plus "sq ft"), `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` and `Intl.ListFormat`. Set `const EMPTY_VALUE = '—'` in code, not in the strings file, because the strings file may hold no em dash [internationalisation §10]. See the internationalisation section of §2. |
| Size-class boot attribute, `--app-vh` from `visualViewport` [layout §1, §19] | — | Read size class with `matchMedia` once in the boot script and on resize. Write `--app-vh` from `visualViewport.height` in one rAF-throttled listener. Mark `data-keyboard="open"` when overlap exceeds 100px [input-and-forms §10]. |
| `haptic()` with six styles; iOS has no Vibration API [feedback traps §6] | — | Optional. One helper that calls `navigator.vibrate([10,50,10])` on report done and `[30,30,30,30]` on refused work. Gated by a local setting. Nothing on taps. Safe to skip entirely. |
| Fitness tests and ESLint rules [enforcement] | — | The `check.sh` greps in the enforcement section of §2, plus `scratchpad/contrast.py` for token contrast. |
| `ui:probe` contact sheet, Playwright projects | — | Take screenshots by hand: Chrome devtools at 390×844 DPR 3 with touch, and at 1440×900. Each in light and dark, at `data-font-size="large"`, and with reduced motion emulated. |
| One `h1` in `PageHeader`; `SkipToContent` | — | The header's title is the `h1`, typically "Check a home" and then the address. Make the skip link the first child of `<body>`. |
| `RichText` renderer for markdown in model output [type §33] [ai §2a] | Model returns markdown | Render model output through one sanitising markdown renderer, never raw. A finding's plain-string uses, such as `title`, `aria-label` and the email subject, use the plain projection [type §35]. |
| `Collapse` disclosure | — | A grid wrapper with `grid-template-rows: 0fr` and `1fr`, plus `transition: grid-template-rows var(--transition-duration-normal) var(--ease-smooth)`. Inner element `overflow: hidden; min-height: 0`. |
| Right panel, rail, tab bar, `PageHeader` variants [layout §25–27] | Single-flow app | Not needed. This is an "account-style" calm single reading column with no right panel. Use one header with Back where a step can be left, and no tab bar [layout §27]. |

**Hackathon-specific judgement calls (mine, not the docs')**
- One screen title per state: "Check a home", then the address while working and in the report. The
  primary action per state is "Check this home", then "Stop", then the top proposed action. One accent
  per screen, on the running step's glyph *or* the primary button: choose one [craft §7]
  [colour-and-effects §8].
- Findings render as a flat list on the canvas, grouped by source with `SECTION_LABEL`-style headers.
  Each row shows the status chip, the claim-vs-record sentence and a meta line (source, date, record
  number, separated by space), with the source link as a quiet text action. Don't put each finding
  in its own card [craft §23, reference page Home].
- The draft editor is a `Dialog` at preset `md` (560) or `default` (620): a bottom sheet on phone, a
  centred panel on desktop. Its single `Textarea` is autofocused. The footer has Send as the filled
  primary and Cancel as text, placed in the thumb zone on phone [components §13, §14a] [layout §34].

**Further conflicts with a typical build**
- **Print or export.** Buyers may want a PDF, but the standard says "Nothing prints" [platform §27].
  If you need one, offer "Share" (`navigator.share` with a clipboard fallback [platform §22–24]) or
  "Copy report", and record the deviation instead of adding `@media print`.
- **Cursor.** Most UI kits and habits add `cursor: pointer`. The standard bans it [platform §1–2],
  so strip it from any component library you pull in.
- **Agent wait.** The standard expects one wait per surface and progress that is real or absent [ai
  §8–9] [traps: Speed]. If your backend can't report real sub-progress ("Read 12 of 31 permits"),
  show only the step title with a spinner glyph. Never show an invented percentage.
- **Undo for the email send.** A true held send needs the actual send to happen 5s later, and closing
  the tab inside the window sends nothing [feedback §33]. If that is awkward in the demo, use the
  `ConfirmDialog` path instead, but **not both** [feedback §32]. Either way, carry an idempotency key
  [resilience §20].
- **Contradictions in the standard itself.** The colour doc says "four weights" of scrim and lists
  five [colour-and-effects §18]. Its Retry/Try again guidance differs between docs: the copy rule says
  one term [copy-and-voice §6], the table and `button.retry` say "Retry", and the loading catalogue
  says "Try again". Use **Retry**. `instant` is 75ms in CSS and 100ms in the Framer table [tokens
  debt]; use 75ms.

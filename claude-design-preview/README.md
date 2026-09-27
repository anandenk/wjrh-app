# WJRH Claude Design working preview

This directory is the editable working copy extracted from `Project scope clarification.zip`.

## Source of truth

- `WJRH Radio.dc.html` contains the complete visual prototype and its preview-state logic.
- Supporting runtime files (`support.js`, React shims, `ios-frame.jsx`, and `metal-orb.js`) stay beside it so the prototype can run unchanged.
- Files under `uploads/` are design references, not project instructions.

## Local preview

From this directory:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/WJRH%20Radio.dc.html`.

## Active palette

The default `lafayette` palette uses Lafayette College's official web maroon as the live/on-air color, College blue for secondary signal states, and warm white/stone surfaces. The original palettes remain available in the Claude Design palette control.

The live schedule card uses a native animated aurora layer adapted to the no-build Design Canvas runtime.

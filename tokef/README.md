# Tokef

Checks subcontractors' insurance certificates (אישור קיום ביטוחים) against a
project's insurance requirements, and shows who may enter the site today.

The app is a single page published as a claude.ai Artifact. With the page open
in Claude, data is shared through the artifact's `db` capability, uploaded
certificates are kept with `assets`, certificates are read with `sample`, and
reports are saved with `downloads`. Opened anywhere else, the same page runs
on a store in the browser and asks for details by hand.

## The web version

`app/` is the same page as a complete web document, built by `tools/build.py`
and committed so GitHub Pages can serve it:
https://tomerzor.github.io/TOMERZOR/tokef/app/

Opened there, it runs as a demo: data stays in the visitor's browser, and
certificate details are typed in by hand (automatic reading needs the page
open in Claude). `test/standalone.mjs` opens it with no viewer runtime.

## Layout

- `src/core.js`: dictionaries (coverage types, coverage codes of the unified
  form, default requirement profiles), date and money helpers, the compliance
  engine (`evaluate`) and the WhatsApp, e-mail and CSV builders. No DOM.
- `src/platform.js`: capability access and the data store.
- `src/ui-base.js`, `src/views.js`, `src/flows.js`, `src/main.js`: the
  interface (Preact with htm, loaded from jsDelivr).
- `src/app.css`: tokens and components, light and dark.
- `assets/`: photos, the icon font subset and `demo.json`.
- `tools/build.py`: inlines everything into `dist/index.html` (the artifact) and `app/index.html` (the web page).
- `tools/demo.py`: writes the demo project. `tools/icons.py`: rebuilds the icon font.
- `test/`: unit checks for the engine, a mock of the viewer runtime, and
  end-to-end browser tests.

## Build and test

```sh
python3 tokef/tools/demo.py
python3 tokef/tools/build.py
node tokef/test/core.test.js
node tokef/test/e2e.mjs /tmp/tokef-e2e
node tokef/test/standalone.mjs /tmp/tokef-standalone
```

The browser tests serve CDN libraries and fonts from local copies of the npm
packages (`TOKEF_VENDOR`), so they run without network access.

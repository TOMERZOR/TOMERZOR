# קפיץ (Kafitz): animated captions

Drop in a video and get word-by-word animated captions. Size, shadow, outline, words per line, font, colours and animation can all be changed, and the video can be transcribed again whenever you want. Static site, no build step:

```
npx http-server -p 8790 -c-1 .     # from the repo root, then open http://localhost:8790/kafitz/
```

Live (once merged to the Pages branch): https://tomerzor.github.io/TOMERZOR/kafitz/

## How it works

1. **Upload.** The video plays locally in the browser and is never uploaded.
2. **Transcribe.** The sound is decoded to 16 kHz mono, split into pieces of up to ~28 s at the quietest moments (silent pieces are skipped so Whisper doesn't invent text), and each piece is sent to a Web Worker running Whisper through [transformers.js](https://github.com/huggingface/transformers.js). Captions appear as each piece finishes.
3. **Style.** `js/render.js` draws the captions on a canvas over the video. Every animation is a pure function of time, so the preview and the export match frame for frame.
4. **Export.** MP4 with the captions burned in (WebCodecs via [Mediabunny](https://mediabunny.dev), faster than real time, audio kept), or an SRT file.

## Transcription engines

Chosen in the Text tab (טקסט). The choice and the language are remembered in the browser.

| Engine | Model | Notes |
|---|---|---|
| מהיר | `onnx-community/whisper-base_timestamped` | Small download, word timings |
| מאוזן (default) | `onnx-community/whisper-small_timestamped` | Good for most videos, word timings |
| עברית מדויקת | `ivrit-ai/whisper-large-v3-turbo-onnx` | Best Hebrew on device, ~700 MB download. Timings come per sentence and are shared between the words by length |
| ElevenLabs | Scribe v2 (`scribe_v2`) | Cloud, needs your own API key (kept in localStorage). Only the extracted audio is sent |

Models download once from Hugging Face and are cached by the browser. WebGPU is used when available and falls back to WebAssembly. Whisper doesn't detect the language reliably in this setup, so the language is picked by the user (Hebrew by default).

## Editing

- **Text tab:** each caption is editable (Enter saves, Esc cancels). Keeping the same number of words keeps every word's timing; otherwise the caption's time is shared between the new words. Each caption can be deleted or transcribed again on its own.
- **Style tab:** 9 animations (פופ is the default), speed, size, words per line (1 to 8), 1 or 2 lines, 8 Hebrew fonts, text and highlight colours, outline width and colour, shadow strength, softness, distance and colour, height on screen, a dark band behind the line, and uppercase for English. Settings are remembered.
- Drag the caption up or down on the video to move it. Click the video or press Space to play.

## Premiere Pro panel

`premiere/` is the same app as a Premiere Pro panel (CEP, Premiere 2021 and up). Download `kafitz-premiere.zip` (linked on the home screen), unzip, run `install/install-mac.command` or `install/install-windows.bat`, restart Premiere, then Window > Extensions > Kafitz.

- **Transcribe** reads the selected clips (or everything on A1, then V1), transcribes the part of each clip that's used, and places the words on the sequence's timeline.
- The preview follows Premiere's playhead; clicking a caption moves the playhead.
- **הוספה לטיימליין** puts every caption on the timeline as its own clip, named with its text: a transparent PNG sequence per caption in `Kafitz Captions/<sequence>/` next to the project file, imported at the sequence frame rate, on the first video track that is free above the clips (adding one if needed). Updating redraws only the captions whose words, timing or style changed, and redraws any caption clip that was deleted by hand. Replaced clips' project items move to `Kafitz/<sequence>/ישנים`.
- **כתוביות פרימייר** writes an SRT and adds it as a native Premiere caption track. Premiere's caption tracks can't animate, so this is plain text, editable in Premiere.

How it runs: `bootstrap.html` (the panel's page, with Node) starts `server.js` on 127.0.0.1 and shows `panel.html` from it in an iframe, so the panel gets a normal http origin for module workers and the model cache. Calls to Premiere go through `postMessage` to the bootstrap, which runs them in `host/kafitz.jsx`. The server only accepts media reads and writes with a random per-session token, and only writes inside a `Kafitz Captions` folder.

Build the zip after changing anything the panel uses: `python3 kafitz/premiere/build.py`.

Not handled: clips with speed changes or time remapping (the timing assumes 100% speed), and nested sequences as the clip to transcribe.

## Files

- `js/render.js`: page grouping (`buildPages`), layout (RTL aware) and the animations
- `js/transcribe.js`: audio extraction, splitting, engines, ElevenLabs call
- `js/worker.js`: the Whisper worker
- `js/export.js`: MP4 export and SRT
- `js/ui.js`: the style controls and caption list, shared with the Premiere panel
- `js/app.js`: the website UI
- `premiere/`: the Premiere Pro panel

## Browser support

Transcription works in current Chrome, Edge, Firefox and Safari. MP4 export needs WebCodecs (Chrome, Edge, Safari 17+; recent Firefox). Without it, export SRT instead.

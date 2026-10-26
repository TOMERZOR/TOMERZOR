# Koli promo images

Instagram posts (1080×1350, one feature each) and a wide cover (1600×900) for WhatsApp, LinkedIn and decks. Every screenshot is the real app running the demo account (Maya and the Lumi brand are made up); only Claude's replies were fixed in advance so the shots are repeatable.

To regenerate after a design change, run the local app (`node tools/serve.mjs 8787`), then:

```sh
node koli/promo/source/capture.cjs <shots-dir>
node koli/promo/source/posts.cjs <shots-dir> <out-dir>
```

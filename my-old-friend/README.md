# My Old Friend

**AI for the third age.** An iPhone app where **Moffy**, a cute pink helper, looks through the camera and explains technology to older people, one step at a time. Moffy listens, answers out loud in a warm natural voice, and hops over to point at the exact button to press. Hebrew and English.

## How it works

1. The person points the camera at the thing they need help with (a TV remote, a WhatsApp screen, a computer, and so on).
2. They tap the pink **Tap and talk** button and say what they need.
3. Moffy takes a picture of what's inside the frame, asks Claude (Anthropic's AI) for the next step, then:
   - says it out loud,
   - shows it in a card in big letters ("STEP 1 · Press the red button"),
   - hops next to the thing to press and circles it.
4. They tap **Done, next step**. Moffy looks again and gives the next step, until the task is finished.

The camera fills the whole screen. Four corner marks show what Moffy sees, and the rest is gently darkened. At the top there is a short status line ("Point at what needs help", "Listening…", "Looking…") and the settings gear. At the bottom there is one pink button whose job changes with the moment (talk, I'm done, Done – next step, ask something else), plus a round button for typing. Moffy's answer appears in a white card only when there is something to say, with **Say again** and a close button. Moffy introduces herself once, on the welcome screen, and never repeats it.

Moffy is told to give real, specific help: work out the exact device or app in the picture, quote buttons as they are written, give one action at a time, say what will happen next, and say so plainly (or ask one question) when unsure instead of guessing.

## Design rules (from Apple's Human Interface Guidelines)

- **Surfaces:** white, with the camera as the hero. Only one pink button is on the main screen at a time.
- **Pink buttons:** fully filled (#E84A8A to #D02A6B) and sitting on a deeper pink base (#A81E55), the way Moffy is built, so they look pressable. Pressed, the face sinks into the base with a light tap. White text on the button pink (#D6336F) is 4.6:1, and body text is 8.4:1 or more. Moffy's bright pink is never used for text.
- **Text size:** every text uses a system text style in SF Pro, so it grows with the iPhone's Larger Text setting. The in-app letter size sets a minimum.
- **Motion:** calm by default. Moffy breathes slowly and blinks, and hops only when something happens. The frame glides between its waiting and answering sizes. With Reduce Motion on, Moffy and the pointing ring stay still and simply fade in.
- **Feedback:** Moffy's spoken words always appear on screen too, and a light vibration marks when listening starts and stops and when an answer arrives.
- **AI transparency:** the welcome screen and Settings say Moffy is an AI, can make mistakes, and that photos are sent over the internet.
- **Dark mode:** every color has a dark variant.

The App Store texts (English and Hebrew) are in `AppStore.md`.

## What's in the folder

| Folder | What it does |
|---|---|
| `MyOldFriend/Moffy/` | Moffy (breathing, blinking, hopping, eyes that follow things) and the pointing ring |
| `server/src/prompt.ts` | **Moffy's personality and teaching rules.** Edit this to change how Moffy talks; it takes effect on the next server deploy, no app update needed |
| `MyOldFriend/Brain/ServerBrain.swift` | Sends the question and camera photo to Moffy's server |
| `MyOldFriend/Brain/DemoBrain.swift` | Practice mode, used when the app is built without a server |
| `MyOldFriend/App/Backend.swift` | Reads the server's address and token from `Backend.plist` |
| `MyOldFriend/Camera/`, `MyOldFriend/Voice/` | Camera, listening, and speaking (Moffy's natural voice with an on-phone cache, the iPhone's voice as a fallback) |
| `server/` | Moffy's server (a Cloudflare Worker). It holds the Claude and ElevenLabs keys |
| `MyOldFriend/Views/` | The screens: welcome (with the agreement to send data to the AI), main helper screen, settings, typing, subscription |
| `MyOldFriend/Store/` | The subscription (StoreKit 2) and the phone's random install ID |

## Running it on an iPhone

On your MacBook:

1. Install **Xcode** from the Mac App Store (free, about 10 GB). Open it once and let it install its components.
2. Get the code: in Terminal, `git clone https://github.com/TOMERZOR/TOMERZOR.git`, then `cd TOMERZOR && git checkout claude/my-old-friend-app`. Or download the branch as a ZIP from GitHub.
3. Open `my-old-friend/MyOldFriend.xcodeproj` in Xcode.
4. Click the project at the top left → **Signing & Capabilities** → choose your **Team** (your Apple ID works; sign in under Xcode → Settings → Accounts).
5. Plug in the iPhone, pick it at the top of Xcode, and press ▶︎ (Run).
6. On the iPhone, the first time only: **Settings → General → VPN & Device Management** → trust your developer profile. iOS 16+ also asks you to turn on **Developer Mode**.

With a free Apple ID the app runs for 7 days before you have to press Run again. To share it through TestFlight or the App Store, you need the Apple Developer Program ($99/year).

Every change pushed to GitHub is also built automatically on GitHub's Mac servers (`.github/workflows/my-old-friend-ios.yml`), to check that it compiles.

## Moffy's server (so nobody has to set anything up)

People who install the app never see a key or a setting. The app talks to a small server of yours, in `server/`, which holds the Claude and ElevenLabs keys and passes questions and voice requests on. It runs on **Cloudflare Workers**. Until the app is built with a server address, Moffy runs in **practice mode**: everything works except actually seeing and understanding.

You need three accounts, all set up by you, once:

1. **Claude:** go to **console.anthropic.com** → **Billing** → add credit → **Settings → Workspaces** → open (or create) a workspace → **API Keys** → **Create Key** inside it (it starts with `sk-ant-`). A key that isn't tied to a workspace is refused with "not scoped to a workspace"; either create it inside one, or also set `ANTHROPIC_WORKSPACE_ID`.
2. **ElevenLabs:** go to **elevenlabs.io** → your profile → **API keys** → create a key. Using library voices like Yael through the API may need a paid plan.
3. **Cloudflare:** sign up at **dash.cloudflare.com** (free).

Then, on your MacBook, in Terminal (Node.js from nodejs.org must be installed):

```sh
cd TOMERZOR/my-old-friend/server
npm install
npx wrangler login                          # opens the browser to sign in to Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY   # paste the Claude key when asked
npx wrangler secret put ELEVENLABS_API_KEY  # paste the ElevenLabs key
npx wrangler secret put APP_TOKEN           # make up a long random password, e.g. from `openssl rand -hex 24`
npx wrangler kv namespace create USAGE      # counts free questions; paste the id it prints into wrangler.toml
npx wrangler deploy                         # prints the address, like https://my-old-friend.NAME.workers.dev
```

Paste keys only into these prompts, never into a chat or a file in git. Check it works by opening `https://…workers.dev/health` in a browser: it should say `ok`.

Finally, tell the app where the server is: copy `Backend.example.plist` to `MyOldFriend/Backend.plist`, fill in the address and the same `APP_TOKEN`, and press ▶︎ in Xcode. `Backend.plist` is kept out of git.

**Optional, recommended:** keep one shared copy of every voice clip, so a sentence is made only once for all users. Run `npx wrangler r2 bucket create moffy-voice`, remove the `#` in front of the three `[[r2_buckets]]` lines in `server/wrangler.toml`, and deploy again. Without it, each Cloudflare data center keeps its own copy.

**Set spending limits** in both the Anthropic console (**Limits**) and ElevenLabs, so a surprise can't run up a bill. The `APP_TOKEN` keeps casual strangers out, but it ships inside the app, so treat the limits as the real protection.

**Privacy policy:** the server publishes one at `https://…workers.dev/privacy` (English and Hebrew), and the App Store listing, the welcome screen and the subscription screen link to it. Put your contact email in `CONTACT_EMAIL` in `server/src/pages.ts` before publishing.

### The subscription (₪24.90 a month, 20 free questions)

Every phone gets **20 free questions**. After that Moffy says the free questions are over and the subscription screen opens: **₪24.90 a month** through Apple, shareable with the family (so a son or daughter can pay for a parent). Subscribers get up to 40 questions a day, as a fair-use cap. Both numbers are `TRIAL_QUESTIONS` and `DAILY_LIMIT` in `server/wrangler.toml`.

How it is enforced: the app makes a random ID for the phone (kept in the Keychain, so reinstalling doesn't reset it) and sends it with each question. The server counts free questions per ID in the `USAGE` KV namespace. A subscriber's app also sends Apple's subscription number, and the server asks Apple's App Store Server API whether it is active (remembered for 6 hours). New voice clips are made only for Moffy's own recent answers, plus 30 a day per phone for the app's fixed sentences, so nobody can use the server as a free voice service.

Set it up once in **App Store Connect** (needs the Apple Developer Program):

1. **Business** (Agreements, Tax and Banking): accept the Paid Apps agreement and add your bank and tax details. Subscriptions don't work until this is done.
2. Your app → **Subscriptions** → create a group "Moffy" and a subscription with product ID `com.tomerzor.myoldfriend.monthly`, duration 1 month, price ₪24.90 (Israel; Apple fills in the other countries), **Family Sharing** on, and a name and description in English and Hebrew.
3. **Users and Access** → **Integrations** → **In-App Purchase** → generate a key. Download the `.p8` file (only possible once) and note the key ID and the issuer ID shown above the list. Then:

   ```sh
   npx wrangler secret put APPLE_ISSUER_ID
   npx wrangler secret put APPLE_KEY_ID
   npx wrangler secret put APPLE_PRIVATE_KEY   # paste the whole .p8 file, including the BEGIN and END lines
   ```

**Trying purchases before the App Store:** `MyOldFriend.storekit` is a test store with the same subscription at ₪24.90. In Xcode: **Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration** → choose `MyOldFriend.storekit`. Purchases in Xcode are fake and Apple's servers don't know them, so for that kind of testing only, run the server with `npx wrangler dev --var DEV_TRUST_SUBSCRIPTIONS:true`, or deploy with that variable temporarily. Never leave it on in the real server. TestFlight purchases are real sandbox purchases and are checked with Apple normally.

### What it costs

- **Claude Haiku 5.5** at medium effort ($0.10 per million input tokens, $0.50 per million output tokens): one question with a photo is roughly 3,000 to 4,000 input tokens and a few hundred output tokens, so **well under a tenth of a US cent per question**. In a 16-question test with camera pictures it matched Claude Opus 5.5 on every case. A question Haiku's safety checks decline is retried once on Opus 5.5 (about 2 cents). To switch model, change `MODEL` in `server/src/index.ts`.
- **ElevenLabs** (`eleven_v4`; a 130-character sentence cost about 2.4 cents on the creative plan used for testing, and API pricing per character may be lower, so check your plan): Moffy's answers are one or two short sentences, about 100 characters, so **roughly 1 to 2 cents per new answer**. Repeats are free (see below). The voice is now the main cost.
- **Per subscriber:** ₪24.90 a month leaves about ₪17.90 after VAT and Apple's 15%. At about 1 cent a question, that covers roughly 400 questions a month; the server's daily limit (40 questions) keeps heavy use in check.
- **Cloudflare:** the free plan is enough to try it out. Its 10 ms CPU limit per request can be tight for large photos, so for real use take the Workers Paid plan ($5 a month).

### Moffy's voice

Moffy speaks with a warm female voice from ElevenLabs: **Yael – Gentle, Confident Ad** in Hebrew and **Emily – Trustworthy, Warm, Conversational** in English, using the `eleven_v4` model, which reads Hebrew in context ("מִסְפַּר" or "מְסַפֵּר") without nikud. Because the voice is female, Moffy speaks about herself in the feminine in Hebrew ("אני מקשיבה", "רגע, אני מסתכלת…").

**Nothing is generated twice.** Every clip is saved on the phone the first time it plays (`Library/Caches/MoffyVoice`), and the server keeps a copy for everyone. "Say again", repeated answers and the app's fixed lines (errors, "I didn't hear anything", and so on) play from a saved copy for free; the phone saves the fixed lines on first launch. Offline, or in practice mode, Moffy uses the nicest female voice installed on the iPhone.

To change voices, edit `VOICES` in `server/src/index.ts` and the matching IDs in `MyOldFriend/Voice/MoffyVoice.swift`.

## Trying it without an iPhone

You can also try it without an iPhone: pick an iPhone simulator at the top of Xcode and press ▶︎. The camera doesn't work in the simulator, so Moffy helps from words only.

## Moffy's look

A pink rounded square with two white pill eyes, based on the original drawing. The eyes carry the feeling, and the body moves little:

- **waiting**: a slow breath and natural blinks
- **listening**: eyes open wide, leaning toward you
- **thinking**: eyes look up, three dots glow in turn
- **talking**: a small nod on each word
- **happy**: eyes become ^ ^ with one small hop
- **pointing**: hops next to the target, looks at it, and a ring draws itself around it
- **worried**: tilted eyes, used for scam warnings and errors

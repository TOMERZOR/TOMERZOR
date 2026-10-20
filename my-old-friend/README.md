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
| `MyOldFriend/Brain/MoffyPrompt.swift` | **Moffy's personality and teaching rules.** Edit this to change how Moffy talks |
| `MyOldFriend/Brain/ServerBrain.swift` | Sends the question and camera photo to Moffy's server |
| `MyOldFriend/Brain/DemoBrain.swift` | Practice mode, used when the app is built without a server |
| `MyOldFriend/App/Backend.swift` | Reads the server's address and token from `Backend.plist` |
| `MyOldFriend/Camera/`, `MyOldFriend/Voice/` | Camera, listening, and speaking (Moffy's natural voice with an on-phone cache, the iPhone's voice as a fallback) |
| `server/` | Moffy's server (a Cloudflare Worker). It holds the Claude and ElevenLabs keys |
| `MyOldFriend/Views/` | The screens: welcome, main helper screen, settings, typing |

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

1. **Claude:** go to **console.anthropic.com** → **Billing** → add credit → **API Keys** → **Create Key** (it starts with `sk-ant-`).
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
npx wrangler deploy                         # prints the address, like https://my-old-friend.NAME.workers.dev
```

Paste keys only into these prompts, never into a chat or a file in git. Check it works by opening `https://…workers.dev/health` in a browser: it should say `ok`.

Finally, tell the app where the server is: copy `Backend.example.plist` to `MyOldFriend/Backend.plist`, fill in the address and the same `APP_TOKEN`, and press ▶︎ in Xcode. `Backend.plist` is kept out of git.

**Optional, recommended:** keep one shared copy of every voice clip, so a sentence is made only once for all users. Run `npx wrangler r2 bucket create moffy-voice`, remove the `#` in front of the three `[[r2_buckets]]` lines in `server/wrangler.toml`, and deploy again. Without it, each Cloudflare data center keeps its own copy.

**Set spending limits** in both the Anthropic console (**Limits**) and ElevenLabs, so a surprise can't run up a bill. The `APP_TOKEN` keeps casual strangers out, but it ships inside the app, so treat the limits as the real protection.

### What it costs

- **Claude Opus 5.5** ($4 per million input tokens, $20 per million output tokens): one question with a photo is roughly 2,000 to 3,000 input tokens and a few hundred output tokens, so **about 2 to 3 US cents per question**. To switch model, change `MODEL` in `server/src/index.ts`.
- **ElevenLabs:** each new answer is spoken once, roughly 2 to 3 cents a clip depending on your plan. Repeats are free (see below).
- **Cloudflare:** the free plan is enough to try it out. Its 10 ms CPU limit per request can be tight for large photos, so for real use take the Workers Paid plan ($5 a month).

### Moffy's voice

Moffy speaks with a warm female voice from ElevenLabs: **Yael – Gentle, Confident Ad** in Hebrew and **Emily – Trustworthy, Warm, Conversational** in English, using the `eleven_v3` model. Because the voice is female, Moffy speaks about herself in the feminine in Hebrew ("אני מקשיבה", "רגע, אני מסתכלת…").

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

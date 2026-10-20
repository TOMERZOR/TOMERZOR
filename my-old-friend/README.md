# My Old Friend

An iPhone app where **Moffy**, a cute pink helper, looks through the camera and explains technology to older people, one small step at a time. He listens, talks back out loud, and hops over to point at the exact button to press. Hebrew and English.

## How it works

1. The person points the camera at the thing they need help with (a TV remote, a WhatsApp screen, a computer, and so on).
2. They tap the big pink **Tap and talk** button and say what they need.
3. Moffy takes a picture, asks Claude (Anthropic's AI) for the next step, then:
   - says it out loud, slowly,
   - shows it in big letters,
   - hops next to the thing to press and circles it.
4. They say "done" or "what next?", and Moffy gives the next step.

Also: **Say again**, **Type** (for typing instead of talking), **Start over**, hide/show camera, and Settings (language, letter size, voice speed).

## What's in the folder

| Folder | What it does |
|---|---|
| `MyOldFriend/Moffy/` | Moffy himself (bobbing, blinking, hopping, eyes that follow things) and the pointing ring and arrow |
| `MyOldFriend/Brain/MoffyPrompt.swift` | **Moffy's personality and teaching rules.** Edit this to change how he talks |
| `MyOldFriend/Brain/ClaudeBrain.swift` | Sends the question and camera photo to Claude |
| `MyOldFriend/Brain/DemoBrain.swift` | Practice mode, used until a key is added |
| `MyOldFriend/Camera/`, `MyOldFriend/Voice/` | Camera, listening and speaking |
| `MyOldFriend/Views/` | The screens: welcome, main helper screen, settings, typing |

## Running it on an iPhone

You need a **Mac with Xcode 16 or newer** (free from the Mac App Store).

1. Open `MyOldFriend.xcodeproj` in Xcode.
2. Click the project at the top left → **Signing & Capabilities** → choose your **Team** (your Apple ID works; sign in under Xcode → Settings → Accounts).
3. Plug in the iPhone, pick it at the top of Xcode, and press ▶︎ (Run).
4. On the iPhone, the first time only: **Settings → General → VPN & Device Management** → trust your developer profile. iOS 16+ also asks you to turn on **Developer Mode**.

With a free Apple ID the app runs for 7 days before you have to press Run again. To share it through TestFlight or the App Store, you need the Apple Developer Program ($99/year).

Every change pushed to GitHub is also built automatically on GitHub's Mac servers (`.github/workflows/my-old-friend-ios.yml`), to check that it compiles.

## Getting a Claude API key

Without a key, Moffy runs in **practice mode**: everything works except actually seeing and understanding.

1. Go to **console.anthropic.com** and sign up.
2. **Billing** → add credit (the minimum is a few dollars).
3. **API Keys** → **Create Key** → copy it (it starts with `sk-ant-`).
4. In the app: ⚙︎ Settings → scroll to **For the helper who sets this up** → paste → **Save key**.

Don't send the key to anyone or paste it into a chat. It is stored encrypted in the iPhone's Keychain.

**Cost:** the app uses Claude Opus 5.5 ($4 per million input tokens, $20 per million output tokens). One question with a photo is roughly 2,000 to 3,000 input tokens and a few hundred output tokens, so **about 2 to 3 US cents per question**. $5 covers roughly 200 questions. Claude Haiku 5.5 would cost about 40 times less but is less precise at pointing. To switch, change `model` in `ClaudeBrain.swift`.

**Before publishing:** a key stored inside the app is fine for testing on your own family's phones, but a published app needs a small server that holds the key, so nobody can pull it out of the app. That is the next step before the App Store.

## Moffy's look

A pink rounded square with two white pill eyes, based on the original drawing. His moods:

- **happy**: eyes become ^ ^ and he wiggles
- **listening**: eyes open wide and he bobs faster
- **thinking**: eyes look up, three dots bounce, he sways
- **talking**: he squishes on every word
- **pointing**: he hops next to the target, leans and looks at it
- **worried**: tilted eyes, used for scam warnings and errors

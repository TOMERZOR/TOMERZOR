# שומר (Shomer)

A camera that alerts your phone when someone approaches, with a live picture. The two devices talk through a small relay on the internet, end-to-end encrypted with a key only they have, and nothing is saved anywhere. Alerts also arrive as push notifications while your phone is locked or Shomer is in the background (end-to-end encrypted too, without photos, through Apple's or Google's push service).

Two ways to run it:

- **Two phones (this web app):** an old phone is the camera, your phone gets the alerts.
- **Raspberry Pi (`pi/`):** a Pi with a camera is the camera and its own Wi-Fi network; your phone opens its page. That one is fully local, with no internet.

## Two phones

Static site, no build step:

```
npx http-server -p 8790 -c-1 .     # from the repo root, then open http://localhost:8790/shomer/
```

Live: https://tomerzor.github.io/TOMERZOR/shomer/ (direct links: `#camera` for the camera phone, `#phone` for yours)

Both phones need internet: mobile data, Wi-Fi, or your phone's hotspot. A service worker (`sw.js`) stores the whole app on the phone, including the person-detection model, so the app itself loads even with a poor connection.

1. On your iPhone, add Shomer to the home screen (Safari, Share, Add to Home Screen) and always open it from there; push notifications only work in that app.
2. Camera phone: המכשיר הזה יהיה המצלמה, set it up, התחל לשמור. It shows a QR code.
3. Your phone: הטלפון שלי, scan that code. **Only once:** from then on the two find each other by themselves, after a drop, after the phone was locked, or after either app restarts.
4. Connected: your phone shows a live picture (a new still about once a second) and rings on every alert. Turn on התראות כשהטלפון נעול to get them at the top of the screen when Shomer isn't open.

**Dark camera phone:** once your phone connects (or on מסך שחור), the camera phone shows pure black, and on Android it also goes full screen so the status bar is hidden. Only a 2-second press brings the display back, so leaves or a brush of the hand can't light it up or reach the buttons. A web page can't change screen brightness, so before placing it: brightness to minimum with auto-brightness off, Do Not Disturb on, dark mode on. On OLED screens black gives off no light; an LCD still glows faintly, so cover it. The camera-in-use dot (Android/iPhone) can be taped over too.

**Keep the camera phone awake:** Auto-Lock Never and Low Power Mode off (it forces Auto-Lock to 30 s), since the browser stops the camera when the screen turns off. The app also holds a screen wake lock, with a silent looping video as a fallback (iPhone home-screen apps before iOS 18.4).

**If something drops:** both sides keep reconnecting by themselves (1, 2, 4, 8, then every 10 s, and right away when the network or the screen comes back). While Shomer is open, your phone sounds a low alarm every 15 s and says why if the camera stays away for 10 s: no internet on the phone, the camera isn't connected, or it isn't answering. The live picture dims and shows its age, so an old frame isn't mistaken for a live one. The camera shows 📵 when your phone isn't there. Every alert waits for the phone to confirm it and is sent again after a reconnect (the last 10), and is pushed if the phone isn't watching, so none are lost.

### How the link works (`js/link.js`, `relay/`)

The camera makes a random 256-bit key and shows it in the QR code (`SHOMER3:<key>`); the phone keeps it. Both connect out over a WebSocket to the relay's room `/room/<id>`, where the id is a hash of the key, so the relay never learns the key. Every message is encrypted with AES-GCM under that key before it leaves the device, and anything that doesn't decrypt is ignored. The room (a Cloudflare Durable Object) passes binary messages between the camera and up to 3 phones and tells each side who is connected; it stores nothing and sleeps while nothing is sent (keep-alive pings are answered without waking it). A connection that looks open but is dead (common after an iPhone was locked) is found by a ping when the screen comes back and replaced.

Messages: alerts (with a JPEG), heartbeats both ways (with the camera's battery and whether the phone is showing Shomer), acknowledgements, push setup, and the preview picture (320px JPEG about once a second, only while your phone shows it, skipped while the connection has a backlog). QR codes are read with the browser's BarcodeDetector or jsQR. "קוד חדש" on the camera makes a new key, which disconnects phones that scanned the old one.

### Push notifications (`js/push.js`, `relay/`)

For an alert at the top of the screen while the phone is locked or Shomer is in the background. An iPhone can only get that through Apple's push service, so this needs internet on both phones (your hotspot is enough).

1. On iPhone, push works only in the app added to the home screen (iOS 16.4+): in Safari tap Share, Add to Home Screen, open Shomer from the icon and pair from there.
2. After pairing, the phone shows התראות כשהטלפון נעול: tap הפעל התראות and allow notifications. A test notification arrives; שלח התראת בדיקה sends another (lock the phone to see it at the top).

How it works: over the link the camera gives the phone its public key (VAPID, RFC 8292, a P-256 key kept on the camera); the phone subscribes with it and hands the subscription back. The camera keeps it, so pushes keep coming while the link is down or after the camera restarts. On an alert the camera sends it over the link first. If the phone isn't showing Shomer (it reports that in its heartbeat), or doesn't confirm within 3 s, the camera encrypts the text for the phone (Web Push, RFC 8291, aes128gcm), signs it, and posts it through the relay to the push service. Only the title and time go this way, never a photo.

The relay's `/send` (`relay/worker.js`, a Cloudflare Worker deployed by `.github/workflows/shomer-push.yml`, which then writes its address into `js/config.js`) is there because browsers can't post to Apple's push service directly. It forwards the encrypted, signed message unchanged, only to known push services, and holds no keys and stores nothing. Neither it nor Apple can read the alert.

## Detection

- **כל תנועה (any motion):** each frame (160px wide, ~8 per second) is compared with a slowly adapting background. Only 8x8 cells where a real patch changed count, so sensor noise is ignored; two frames in a row over the threshold trigger. A sudden change of most of the frame (a light switched on) resets the background instead of alerting. Sensitivity 1 to 10 sets how much of the frame must move (10% down to 0.1%). `js/motion.js`.
- **רק אנשים (people only, the default):** motion wakes up a person detector (TensorFlow.js COCO-SSD, lite MobileNet v2, shipped in `vendor/` and run on the camera phone). An alert goes out only for a person with 55%+ confidence; branches in the wind, animals and passing cars are ignored. If the model can't load, it falls back to any motion and says so.

Each alert has the camera name, time and (optionally) a photo with the person or moving area boxed. After an alert it waits the chosen pause (10 s to 1 min) before the next.

## In the field

- **Internet:** check that the camera phone has signal (or reaches your hotspot) from where it will stand. A phone hotspot reaches roughly 30 to 50 m outdoors.
- **Power:** put a power bank under the camera phone. With the screen and camera on, a battery alone lasts only a few hours. Your phone shows the camera's battery level. The live picture uses a little battery on both ends; hide it when you don't need it, and alerts keep working.
- **Mode:** use רק אנשים among bushes; כל תנועה fires on every gust of wind.
- **Night:** a phone camera sees little in the dark, so detection gets weak. For night use, the Raspberry Pi with a NoIR camera and an infrared light works much better.
- **Test** before every shift: בדיקת חיבור וצליל, שלח התראת בדיקה with your phone locked, then walk past the camera.
- **Tested** in Chrome against the relay running on Cloudflare's runtime locally, not yet on two real iPhones.

## Raspberry Pi version (`pi/`)

A Raspberry Pi (Zero 2 W, 4 or 5) with a Camera Module 3 (NoIR plus an IR light for night) or a USB webcam. `pi/shomer.py` runs the same motion detection in Python/OpenCV; people mode uses OpenCV's built-in HOG person detector. The Pi serves the phone page itself (`pi/viewer.html`): live video (MJPEG), alerts with a photo, and the same lost-connection alarm. Photos are kept in memory only (the last 20). Every address needs the access key.

```
sudo apt install python3-opencv python3-picamera2
# The Pi as its own Wi-Fi network (Raspberry Pi OS Bookworm):
sudo nmcli device wifi hotspot ifname wlan0 ssid Shomer password "a-long-wifi-password"
sudo nmcli connection modify Hotspot connection.autoconnect yes
python3 shomer.py --people --name "שיחים" --key some-long-random-key
```

Connect your phone to the `Shomer` Wi-Fi and open `http://10.42.0.1:8000/?k=<key>`. Try it on a video first with `--source clip.mp4`. `pi/shomer.service` starts it at boot.

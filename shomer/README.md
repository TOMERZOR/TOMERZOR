# שומר (Shomer)

Turns an old phone (or a Raspberry Pi with a camera) into a camera that sends a push notification to your phone when someone approaches. Static site, no build step:

```
npx http-server -p 8790 -c-1 .     # from the repo root, then open http://localhost:8790/shomer/
```

Live: https://tomerzor.github.io/TOMERZOR/shomer/ (camera access needs HTTPS or localhost)

## How it works

```
[camera device] --Wi-Fi/internet--> ntfy.sh --push--> [your phone: ntfy app or this site]
```

1. **Camera device:** open the site, tap המכשיר הזה יהיה המצלמה, set it up and tap התחל לשמור. Keep it plugged in with the page open (the screen stays awake; מסך שחור blacks it out).
2. **Your phone:** scan the QR code on the camera device. It opens the receiving screen, which beeps and shows the photo while it is open. For alerts while the phone is locked, install the free **ntfy** app ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy), [iPhone](https://apps.apple.com/app/ntfy/id1625396347)) and subscribe to the channel code (`shomer-...`).
3. **שלח התראת בדיקה** checks the whole chain.

Notifications go through [ntfy](https://ntfy.sh), a free open-source push service, so no account or server of our own is needed. The channel code is random and acts as the password: anyone who has it can see the alerts. Photos are stored on ntfy.sh for a few hours. To keep everything at home, run your own ntfy server and set it under מתקדם.

## Live view

The receiving screen shows the camera live (⛶ for full screen), with the moving area boxed in yellow. An alert flashes the view red and rings at once, without waiting for ntfy. The video goes straight from camera to phone over WebRTC, encrypted and peer to peer. ntfy only carries the short setup messages, on a separate topic (`<channel>-live`) so they never show up as notifications. Up to 3 phones can watch; the camera shows how many are watching. The camera's שידור חי לטלפון שלך setting turns it off. `js/live.js`.

Live view connects most reliably when both devices are on the same network. Both still need internet for the setup messages and the ntfy alerts, so the easiest setup is the camera device on your phone's hotspot. Over two separate mobile networks it may fail to connect: there is no relay (TURN) server. Alerts still arrive either way.

## In the field (e.g. watching the approach to a post)

- **Network:** turn on your phone's hotspot and connect the camera device to it. Outdoors that reaches roughly 30 to 50 m; test it from the spot first.
- **Power:** a power bank under the camera device. With the screen on and the camera streaming, a phone battery alone lasts only a few hours. Live view uses more battery on both ends, so turn it off when you don't need it; alerts keep working.
- **Mode:** use רק אנשים. Leaves and branches moving in the wind set off כל תנועה all the time.
- **Night:** a phone camera sees little in the dark, so detection gets weak. For night use, the Raspberry Pi version with a NoIR camera and an infrared light works much better.
- **Test** before every shift: שלח התראת בדיקה, then walk past the camera.
- **Photos** go to ntfy.sh's servers. Where that isn't allowed, untick לצרף תמונה להתראה; live video doesn't pass through any server.

Bluetooth isn't used: a web page can't keep a Bluetooth link to another phone, and Wi-Fi works across the house and when you are away.

## Detection

- **כל תנועה (any motion):** each frame (160px wide, ~8 per second) is compared with a slowly adapting background. Only 8x8 cells where a real patch changed count, so sensor noise is ignored; two frames in a row over the threshold trigger. A sudden change of most of the frame (a light switched on) resets the background instead of alerting. Sensitivity 1 to 10 sets how much of the frame must move (10% down to 0.1%). `js/motion.js`.
- **רק אנשים (people only):** motion wakes up a person detector (TensorFlow.js COCO-SSD, lite MobileNet v2, loaded from jsDelivr the first time and run on the device). An alert goes out only for a person with 55%+ confidence; pets, curtains and passing cars are ignored. If the model can't load, it falls back to any motion and says so.

Each alert has the camera name, time and (optionally) a photo with the moving area or the person boxed. Urgent priority makes ntfy ring and vibrate longer. After an alert it waits the chosen pause (15 s to 5 min) before the next. If the camera page is sent to the background (screen off, another app), it sends a "שומר עבר לרקע" warning, and "חזר לשמור" when it is back.

## Raspberry Pi version (`pi/`)

For a dedicated device: a Raspberry Pi Zero 2 W / 4 / 5 with a Camera Module 3 (or any USB webcam) runs `pi/shomer.py`, the same detection in Python/OpenCV, posting to the same ntfy channel. People mode uses OpenCV's built-in HOG person detector (no download).

```
sudo apt install python3-opencv python3-picamera2
python3 shomer.py --topic shomer-xxxx --name "הכניסה"          # any motion
python3 shomer.py --topic shomer-xxxx --people --sensitivity 7  # people only
python3 shomer.py --topic shomer-xxxx --source clip.mp4          # try it on a video
```

Use the channel code shown in the web app so both camera types alert the same phone, or leave out `--topic` to get a new one. `pi/shomer.service` starts it at boot. The Pi version sends alerts only; it has no live view yet.

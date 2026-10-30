# שומר (Shomer)

A camera that alerts your phone when someone approaches, with live view. **Local only:** there is no server and no cloud. Video, photos and alerts go straight between the two devices over the Wi-Fi they share, encrypted, and nothing is saved anywhere. It works with no internet at all.

Two ways to run it:

- **Two phones (this web app):** an old phone is the camera, your phone gets the alerts.
- **Raspberry Pi (`pi/`):** a Pi with a camera is the camera and its own Wi-Fi network; your phone opens its page.

## Two phones

Static site, no build step:

```
npx http-server -p 8790 -c-1 .     # from the repo root, then open http://localhost:8790/shomer/
```

Live: https://tomerzor.github.io/TOMERZOR/shomer/

**Before you go (with internet):** open the site once on both phones and add it to the home screen. A service worker (`sw.js`) stores the whole app on the phone, including the person-detection model, and the home screen says ✓ מוכן לעבודה בלי אינטרנט. From then on it runs offline; loading it only downloads the app's own files, and nothing is ever uploaded.

**At the spot (no internet needed):**

1. Turn on your phone's hotspot and connect the camera phone to it. Both phones must be on the same Wi-Fi.
2. Camera phone: המכשיר הזה יהיה המצלמה, set it up, התחל לשמור. It shows a QR code.
3. Your phone: הטלפון שלי, scan that code. Your phone then shows its own code: point it at the camera phone's lens (about 20 cm away).
4. Connected: your phone shows the live view and rings on every alert. בדיקת חיבור וצליל checks the link end to end.

Keep both screens on: the browser stops the camera when the screen turns off, and the app keeps both awake. Your phone only rings while the Shomer screen is open.

**Dark camera phone:** once your phone connects (or on מסך שחור), the camera phone shows pure black, and on Android it also goes full screen so the status bar is hidden. Only a 2-second press brings the display back, so leaves or a brush of the hand can't light it up or reach the buttons. If the link drops, the new pairing code waits under the black screen. A web page can't change screen brightness, so before placing it: brightness to minimum with auto-brightness off, Do Not Disturb on, dark mode on. On OLED screens black gives off no light; an LCD still glows faintly, so cover it. The camera-in-use dot (Android/iPhone) can be taped over too.

**If the link drops,** your phone shows ❌ and sounds a different, low alarm every 15 s. The camera sends a heartbeat every 2 s, so this happens within about 10 s if the camera dies, leaves Wi-Fi range or its screen turns off. The live picture dims so a frozen frame isn't mistaken for live video. The camera phone puts up a new code by itself: tap חבר מחדש on your phone and scan again. Alerts from while the phone was away (the last 5) are delivered when it reconnects.

### How the link works (`js/link.js`, `js/scan.js`)

WebRTC with no STUN/TURN servers, so only the devices' own local addresses are used. Pairing takes no server either: the two QR codes are the WebRTC offer and answer. They describe only a data channel, and only the fields that differ between connections (ICE credentials, DTLS fingerprint and role, local addresses, about 140 characters), so the codes are small and scan easily. The other side rebuilds the full description. Video is added afterwards over the data channel, which also carries alerts (with a JPEG), motion boxes, heartbeats and battery level. QR codes are read with the browser's BarcodeDetector or jsQR.

## Detection

- **כל תנועה (any motion):** each frame (160px wide, ~8 per second) is compared with a slowly adapting background. Only 8x8 cells where a real patch changed count, so sensor noise is ignored; two frames in a row over the threshold trigger. A sudden change of most of the frame (a light switched on) resets the background instead of alerting. Sensitivity 1 to 10 sets how much of the frame must move (10% down to 0.1%). `js/motion.js`.
- **רק אנשים (people only, the default):** motion wakes up a person detector (TensorFlow.js COCO-SSD, lite MobileNet v2, shipped in `vendor/` and run on the camera phone). An alert goes out only for a person with 55%+ confidence; branches in the wind, animals and passing cars are ignored. If the model can't load, it falls back to any motion and says so.

Each alert has the camera name, time and (optionally) a photo with the person or moving area boxed. After an alert it waits the chosen pause (10 s to 1 min) before the next.

## In the field

- **Range:** a phone hotspot reaches roughly 30 to 50 m outdoors. Test from the spot before relying on it.
- **Power:** put a power bank under the camera phone. With the screen and camera on, a battery alone lasts only a few hours. Your phone shows the camera's battery level. Live view uses more battery on both ends; turn it off when you don't need it, and alerts keep working.
- **Mode:** use רק אנשים among bushes; כל תנועה fires on every gust of wind.
- **Night:** a phone camera sees little in the dark, so detection gets weak. For night use, the Raspberry Pi with a NoIR camera and an infrared light works much better.
- **Test** before every shift: בדיקת חיבור וצליל, then walk past the camera.
- **Untested combinations:** the phone-to-phone link has been tested in Chrome, not yet on two real phones over a hotspot. If the phones don't connect while one of them is the hotspot, put both on a separate small Wi-Fi router (no SIM or internet needed), or use the Pi.

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

// Native touches when running inside the iOS/Android app (Capacitor).
// Everything here is a no-op in a browser.

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useEffect, useState } from "react";

export const isNative = Capacitor.isNativePlatform();

/** Light tap for selections, success/warning for outcomes that matter. */
export function haptic(kind: "tap" | "success" | "warning" = "tap") {
  if (!isNative) return;
  const done =
    kind === "tap" ? Haptics.impact({ style: ImpactStyle.Light }) : Haptics.notification({ type: kind === "success" ? NotificationType.Success : NotificationType.Warning });
  done.catch(() => undefined);
}

export function setStatusBar(theme: "day" | "night") {
  if (!isNative) return;
  // Style.Light = dark text for light backgrounds
  StatusBar.setStyle({ style: theme === "night" ? Style.Dark : Style.Light }).catch(() => undefined);
}

export function hideSplash() {
  if (isNative) SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
}

/** Android back button: close the top screen, or leave the app from the root. */
export function useBackButton(onBack: () => boolean) {
  useEffect(() => {
    if (!isNative) return;
    const sub = App.addListener("backButton", () => {
      if (!onBack()) App.exitApp();
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, [onBack]);
}

/** Tracks connectivity; on the trail this changes often. */
export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

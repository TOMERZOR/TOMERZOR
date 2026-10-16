import type { CapacitorConfig } from "@capacitor/cli";

// appId is the bundle identifier in App Store Connect and the package name in
// Google Play. Change it before the first upload; it cannot change after.
const config: CapacitorConfig = {
  appId: "app.galed",
  appName: "גלעד",
  webDir: "dist",
  backgroundColor: "#EEE6D3",
  ios: {
    contentInset: "never",
  },
  android: {
    backgroundColor: "#EEE6D3",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // hidden from the app once the first screen is ready
      backgroundColor: "#EEE6D3",
      showSpinner: false,
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;

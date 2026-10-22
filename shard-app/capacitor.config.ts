import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tomerzor.shard",
  appName: "SHARD",
  webDir: "www",
  backgroundColor: "#FBF5EE",
  ios: {
    contentInset: "never",
    backgroundColor: "#FBF5EE",
    preferredContentMode: "mobile",
    scrollEnabled: false,
  },
  android: {
    backgroundColor: "#FBF5EE",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_shard",
      iconColor: "#FF6B57",
    },
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#FBF5EE",
      showSpinner: false,
    },
  },
};

export default config;

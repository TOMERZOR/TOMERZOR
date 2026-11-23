import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tomerzor.arslate",
  appName: "ערסלייט",
  webDir: "www",
  backgroundColor: "#CFE0F7",
  ios: {
    contentInset: "never",
    backgroundColor: "#CFE0F7",
    preferredContentMode: "mobile",
    scrollEnabled: true,
  },
};

export default config;

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tomerzor.livingroom",
  appName: "Living Room",
  webDir: "www",
  backgroundColor: "#EDEFF1",
  ios: {
    contentInset: "never",
    backgroundColor: "#EDEFF1",
    preferredContentMode: "mobile",
    scrollEnabled: true,
  },
};

export default config;

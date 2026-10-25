import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tomerzor.echo",
  appName: "ECHO",
  webDir: "www",
  backgroundColor: "#141a33",
  ios: {
    contentInset: "never",
    backgroundColor: "#141a33",
    preferredContentMode: "mobile",
    scrollEnabled: false,
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The application ID is permanent once the app is uploaded to Google Play.
  // Change it here AND in android/app/build.gradle before the first upload if you want another.
  appId: 'com.capacitydesk.app',
  appName: 'Capacity Desk',
  webDir: 'dist',
  android: {
    // The app loads only its own bundled files; plain-http content is never allowed.
    allowMixedContent: false,
    // The Content-Security-Policy in index.html allows WebAssembly (the SQLite engine)
    // with 'wasm-unsafe-eval', which Android System WebView understands from version 97
    // (early 2022). Older WebViews would refuse to start the database.
    minWebViewVersion: 97,
  },
  plugins: {
    SystemBars: {
      // index.html uses viewport-fit=cover and pads with env(safe-area-inset-*), so the
      // app draws edge to edge. Saying so up front avoids a layout jump at start-up.
      initialViewportFitValueHint: 'cover',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#0B6E5F',
    },
  },
};

export default config;

/**
 * Native shell bootstrap.
 * Loaded only when running inside Capacitor (not required for remote URL mode,
 * but available if you later bundle assets).
 */
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

async function boot() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#123247" });
  } catch {
    /* web or unsupported */
  }

  try {
    await SplashScreen.hide();
  } catch {
    /* optional */
  }

  // Android hardware back: go back in WebView history when possible
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });
}

void boot();

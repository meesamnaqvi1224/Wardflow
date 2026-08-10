# WardFlow Mobile (v1 — remote shell)

Native **Android** (and later iOS) wrapper around the live web app using [Capacitor](https://capacitorjs.com/).

| Setting | Value |
|--------|--------|
| App name | **WardFlow** |
| Application ID | **`meesam.wardflow`** |
| Mode | Remote WebView |
| Production URL | `https://wardflow-meesam1.vercel.app` |

The Android app does **not** embed the Next.js build. It opens the Vercel site inside a secure WebView. Deploy web fixes → users get them on next open (no new store build unless native config changes).

---

## Prerequisites (Android)

1. **[Android Studio](https://developer.android.com/studio)** (Hedgehog or newer)
2. Android SDK + a virtual device (or a USB phone with debugging on)
3. **JDK 17** (Android Studio ships one; set `JAVA_HOME` if CLI builds fail)
4. Node 20+ and npm (for Capacitor CLI in this folder)

This machine may need Android Studio installed before `cap run android` works.

---

## Setup (once)

```bash
cd mobile
npm install
npx cap sync android
```

Open in Android Studio:

```bash
npx cap open android
```

Then: **Run → Run 'app'** (pick emulator or device).

### CLI run (if SDK + Java are configured)

```bash
npx cap run android
```

---

## Change production URL

Edit `capacitor.config.json`:

```json
"server": {
  "url": "https://YOUR-VERCEL-URL.vercel.app",
  ...
}
```

Then:

```bash
npx cap sync android
```

Rebuild/run the app.

---

## Useful commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install Capacitor deps |
| `npx cap sync android` | Copy config + plugins into Android project |
| `npx cap open android` | Open Android Studio |
| `npx cap run android` | Build & launch on device/emulator |

---

## Project layout

```
mobile/
  capacitor.config.json   # app id, remote URL, plugins
  www/                    # minimal fallback HTML (required by Capacitor)
  android/                # native Android Studio project
  package.json
```

Web product code stays in the repo root (`src/`, Next.js). Do **not** run Next build for the mobile shell.

---

## Signed Play Store build (AAB)

### Secrets (local only — never commit)

| File | Purpose |
|------|--------|
| `keystore/wardflow-release.keystore` | Signing key (private) |
| `keystore/keystore.properties` | Passwords for Gradle |
| `keystore/BACKUP-THESE-CREDENTIALS.txt` | Human-readable backup |

Copy `keystore/keystore.properties.example` if you recreate a keystore.

**Back up the keystore + passwords offline.** Losing them means you cannot update the same Play listing.

### Build the release bundle

```bash
cd mobile
npm install
npx cap sync android

export JAVA_HOME="$HOME/Applications/Android Studio.app/Contents/jbr/Contents/Home"
# If Studio is in /Applications:
# export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

cd android
./gradlew bundleRelease
```

Output AAB:

```text
mobile/android/app/build/outputs/bundle/release/app-release.aab
```

Copy to a convenient folder:

```bash
mkdir -p ../release
cp app/build/outputs/bundle/release/app-release.aab ../release/wardflow-1.0.0.aab
```

### Upload to Google Play Console

1. Create app at [https://play.google.com/console](https://play.google.com/console)  
2. Package name must match: **`meesam.wardflow`**  
3. **Production** or **Internal testing** → Create release → upload the **.aab**  
4. Complete: store listing, content rating, privacy policy, target audience  
5. For a **remote WebView app**, note that the app loads  
   `https://wardflow-meesam1.vercel.app` (network required)  
6. Privacy policy should mention web content + fictional demo data  

### Version bumps

In `android/app/build.gradle` under `defaultConfig`:

- `versionCode` — integer, must increase each Play upload (1, 2, 3…)  
- `versionName` — user-facing string (`1.0.0`, `1.0.1`, …)  

Then rebuild `bundleRelease`.

### iOS (later)

```bash
npx cap add ios
```

Requires Xcode and an Apple Developer account.

---

## Notes

- **Auth cookies / login** depend on the live site; test sign-in on a real device.  
- **Offline:** app needs network for v1.  
- **Package ID** is `meesam.wardflow` (as requested). For Play Console, reverse-DNS like `com.meesam.wardflow` is more common if you rebrand later.  

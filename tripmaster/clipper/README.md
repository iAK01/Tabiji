# Tabiji Clipper (Safari)

Saves places and tips from any web page to **Discover → Saved by you** in Tabiji.
Right-click highlighted text → **Clip to Tabiji**, or use the toolbar button
(trip, kind, note, optional screenshot).

`extension/` is the extension itself. Safari needs it wrapped in a small Mac app,
made once with Xcode.

## One-time setup

1. Install **Xcode** from the Mac App Store, open it once, and sign in under
   Xcode → Settings → Accounts with your Apple developer account.
2. Point the command-line tools at it:
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. From the repo root, make the Xcode project:
   ```
   xcrun safari-web-extension-converter clipper/extension \
     --project-location clipper \
     --app-name "Tabiji Clipper" \
     --bundle-identifier ie.tabiji.clipper \
     --swift --macos-only --no-open
   ```
   The project points at `clipper/extension/`, so edits there are picked up on the next Run.
4. Open `clipper/Tabiji Clipper/Tabiji Clipper.xcodeproj`. For each target, under
   **Signing & Capabilities** choose your Team.
5. Press **Run**.
6. Safari → Settings → Extensions → tick **Tabiji Clipper**, and allow it on all websites.
   If it isn't listed: Safari → Settings → Advanced → *Show features for web developers*,
   then Develop → *Allow Unsigned Extensions*.
7. In Tabiji: Profile → **Clip from the web** → **Connect the clipper**. Paste the code
   into the clipper's pop-up and press Connect.

## After changing the extension

Press **Run** in Xcode again.

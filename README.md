# Diegetic for macOS

A little Mac app that gives your windows physical states. 🕸️
Leave a window neglected and it grows cobwebs, let an app burn CPU and its frame glows red-hot like cast iron, forget an idle app and it slowly frosts over.

[Try the interactive preview →](https://nimvorodev.github.io/diegetic/)

## Get it

You can just send this repo to your coding agent and ask it to install Diegetic for you:

> Install Diegetic on my Mac: https://github.com/nimvorodev/diegetic

Or install it yourself. You only need Apple's Command Line Tools (`xcode-select --install`) and Python 3 (bundled with macOS):

```zsh
git clone https://github.com/nimvorodev/diegetic.git
cd diegetic/macos
./scripts/build-app.sh
python3 scripts/install-local.py
```

This builds a universal (`arm64` + `x86_64`) `Diegetic.app` for macOS 13+, installs it into `~/Applications`, and opens it in your menu bar. The installer backs up any previous local installation before replacing it.

You can also download `install-diegetic.sh` from the [landing page](https://nimvorodev.github.io/diegetic/) ("Get for macOS") and run `bash ~/Downloads/install-diegetic.sh`.

If macOS blocks it, open **System Settings → Privacy & Security → Open Anyway** after trying to launch it. The app is ad-hoc signed, not notarized by Apple.

## Make your desktop feel physical

Click the spider icon in your menu bar to switch between organic procedural webs and 8-bit pixel art, set the cobweb delay, or pause everything. To leave an app alone, open **Apps** and untick it. Its windows shed their states straight away and stay off until you tick it again, even after a restart.

The three states:

- **Cobwebs**: leave a window unfocused for over 2 hours (configurable) and procedural corner webs grow in, complete with a tiny dangling spider. Clicking the window brushes them away in a burst of silk.
- **Cast-iron heat**: when an app burns serious CPU or RAM, its window frame glows red-hot with rising heat waves and embers. Cool the app down and the glow fades.
- **Frost**: apps that sit idle and quiet slowly frost over at the edges with rime and dendritic crystals. Wake them up and the frost thaws.

All telemetry is sampled locally via `proc_pidinfo`. Nothing leaves your Mac.

If macOS asks for Accessibility access, enable **Diegetic** in **System Settings → Privacy & Security → Accessibility** so it can follow which window is focused.

## A little work in progress

Built for **macOS 13 or later, on Apple Silicon and Intel**. It draws with private SkyLight window APIs (click-through overlays that sit above your windows), so system updates may affect how it works. Overlays hide while you resize a window and return when you're done.

If something looks wrong, [open an issue](https://github.com/nimvorodev/diegetic/issues) and tell me your macOS version and what you saw.

## Command-line options

```
Diegetic [--pixel] [--cobweb-minutes=N] [--no-menu]
```

- `--pixel`: 8-bit pixel art instead of organic procedural
- `--cobweb-minutes=N`: cobweb threshold in minutes (default: 120)
- `--no-menu`: run without the menu-bar item

## Taking it off

Quit Diegetic from the spider icon first. Then drag **Diegetic.app** from `~/Applications` to the Trash, and delete `~/Library/Preferences/local.diegetic.app.plist` if you want everything gone. macOS remembers the Accessibility permission separately, so remove Diegetic from **System Settings → Privacy & Security → Accessibility** too.

## License

Released under [GPL-3.0](LICENSE).

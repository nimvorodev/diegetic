# Diegetic for macOS

A native macOS menu-bar app that gives your real macOS windows physical, passive-aggressive states based on how you use your computer. Built in C, Objective-C, SkyLight, and CoreGraphics.

## What It Does to Your Real macOS Windows

- **Cobwebs (`> 2 hours` unfocused)**: Any window left sitting unfocused in the background for more than 2 hours slowly grows procedural (or 8-bit pixel) cobwebs in its corners with a tiny dangling spider. Clicking/focusing that window sweeps and brushes the cobwebs away in a burst of silk particles.
- **Red-Hot Cast Iron + Heat Waves (High CPU / RAM)**: If an app (like Google Chrome or Docker Desktop) burns massive CPU or RAM (`proc_pidinfo` `PROC_PIDTASKINFO`), the edges of its macOS window frame glow red-hot like forged cast iron with rising heat waves and embers.
- **Frosted Edges (Idle Apps)**: Idle, low-CPU apps slowly frost over at their window edges with translucent rime and dendritic ice crystals.

## Build & Install on Your Mac

You only need Apple's Command Line Tools (`xcode-select --install`) and Python 3 (included with macOS):

```zsh
cd macos
./scripts/build-app.sh
python3 scripts/install-local.py
```

This compiles a universal (`arm64` + `x86_64`) binary for macOS 13+, packages `outputs/Diegetic.app`, ad-hoc signs it with `codesign`, installs it into `~/Applications/Diegetic.app`, and opens it in your menu bar (`LSUIElement = true`, so there is no Dock icon).

## Permissions

When macOS asks for **Accessibility** access, enable **Diegetic** in **System Settings → Privacy & Security → Accessibility** so it can detect which window is focused via `AXUIElement` and brush away cobwebs the instant you click back into a neglected window.

## Taking It Off

1. Click the spiderweb icon in your macOS menu bar and choose **Quit Diegetic**.
2. Move `~/Applications/Diegetic.app` to the Trash.
3. Delete `~/Library/Preferences/local.diegetic.app.plist`.

import appInfoPlist from '../macos/AppInfo.plist?raw';
import makefileRaw from '../macos/Makefile?raw';
import readmeRaw from '../macos/README.md?raw';
import buildAppSh from '../macos/scripts/build-app.sh?raw';
import installLocalPy from '../macos/scripts/install-local.py?raw';
import mainC from '../macos/src/main.c?raw';
import telemetryH from '../macos/src/telemetry.h?raw';
import telemetryC from '../macos/src/telemetry.c?raw';
import diegeticDrawH from '../macos/src/diegetic_draw.h?raw';
import diegeticDrawC from '../macos/src/diegetic_draw.c?raw';
import menubarM from '../macos/src/menubar.m?raw';
import borderH from '../macos/src/border.h?raw';
import borderC from '../macos/src/border.c?raw';
import windowsH from '../macos/src/windows.h?raw';
import windowsC from '../macos/src/windows.c?raw';
import eventsH from '../macos/src/events.h?raw';
import eventsC from '../macos/src/events.c?raw';
import hashtableH from '../macos/src/hashtable.h?raw';
import hashtableC from '../macos/src/hashtable.c?raw';
import externH from '../macos/src/misc/extern.h?raw';
import helpersH from '../macos/src/misc/helpers.h?raw';
import axH from '../macos/src/misc/ax.h?raw';
import windowH from '../macos/src/misc/window.h?raw';

export interface MacosSourceFile {
  path: string;
  language: 'c' | 'objc' | 'shell' | 'python' | 'makefile' | 'xml' | 'markdown';
  summary: string;
  content: string;
}

export const MACOS_FILES: MacosSourceFile[] = [
  {
    path: 'src/diegetic_draw.c',
    language: 'c',
    summary:
      'Pure CoreGraphics renderer for procedural & 8-bit pixel cobwebs, dangling spider, cast-iron heat waves, and dendritic edge frost.',
    content: diegeticDrawC,
  },
  {
    path: 'src/telemetry.c',
    language: 'c',
    summary:
      'Real macOS proc_pidinfo (PROC_PIDTASKINFO) CPU% & physical RAM sampler + >2h unfocused timer & focus brush-away trigger.',
    content: telemetryC,
  },
  {
    path: 'src/menubar.m',
    language: 'objc',
    summary:
      'Native macOS NSStatusBar menu-bar extra (LSUIElement) with per-app icon checklist, style switcher, cobweb delay, and live preview modes.',
    content: menubarM,
  },
  {
    path: 'src/main.c',
    language: 'c',
    summary:
      'Entry point connecting SkyLight WindowServer events, Accessibility focus tracking, 20Hz animation timer, and NSApplication loop.',
    content: mainC,
  },
  {
    path: 'src/border.c',
    language: 'c',
    summary:
      'Manages per-window transparent click-through SkyLight overlay windows (SLSNewWindowWithOpaqueShapeAndContext + SLSTransactionOrderWindow).',
    content: borderC,
  },
  {
    path: 'src/windows.c',
    language: 'c',
    summary:
      'Discovers windows across macOS Spaces, handles focus transitions (brushing cobwebs on click), and filters per-app bundle IDs.',
    content: windowsC,
  },
  {
    path: 'src/events.c',
    language: 'c',
    summary:
      'Subscribes to macOS WindowServer notifications (window move, resize, reorder, focus, hide, close, and Space changes).',
    content: eventsC,
  },
  {
    path: 'scripts/build-app.sh',
    language: 'shell',
    summary:
      'Compiles universal arm64 + x86_64 binary with clang, generates AppIcon.icns, packages Diegetic.app, and ad-hoc signs with codesign.',
    content: buildAppSh,
  },
  {
    path: 'scripts/install-local.py',
    language: 'python',
    summary:
      'Stops any running daemon, backs up existing bundle, installs Diegetic.app into ~/Applications, and launches it.',
    content: installLocalPy,
  },
  {
    path: 'Makefile',
    language: 'makefile',
    summary:
      'Universal clang build linking AppKit, Cocoa, CoreVideo, ApplicationServices, QuartzCore, and SkyLight.',
    content: makefileRaw,
  },
  {
    path: 'AppInfo.plist',
    language: 'xml',
    summary:
      'macOS bundle metadata with LSUIElement=true so Diegetic lives purely in the menu bar without a Dock icon.',
    content: appInfoPlist,
  },
  {
    path: 'README.md',
    language: 'markdown',
    summary: 'Native macOS build, Accessibility permissions, and uninstallation guide.',
    content: readmeRaw,
  },
  {
    path: 'src/telemetry.h',
    language: 'c',
    summary: 'Telemetry structs and configuration globals.',
    content: telemetryH,
  },
  {
    path: 'src/diegetic_draw.h',
    language: 'c',
    summary: 'CoreGraphics drawing header and canvas padding.',
    content: diegeticDrawH,
  },
  {
    path: 'src/border.h',
    language: 'c',
    summary: 'Border overlay window state struct.',
    content: borderH,
  },
  {
    path: 'src/windows.h',
    language: 'c',
    summary: 'Window lifecycle and focus management declarations.',
    content: windowsH,
  },
  {
    path: 'src/events.h',
    language: 'c',
    summary: 'SkyLight WindowServer event constants.',
    content: eventsH,
  },
  {
    path: 'src/hashtable.h',
    language: 'c',
    summary: 'Open-chaining hash table header.',
    content: hashtableH,
  },
  {
    path: 'src/hashtable.c',
    language: 'c',
    summary: 'Open-chaining hash table implementation.',
    content: hashtableC,
  },
  {
    path: 'src/misc/extern.h',
    language: 'c',
    summary: 'SkyLight private framework C declarations.',
    content: externH,
  },
  {
    path: 'src/misc/window.h',
    language: 'c',
    summary: 'Click-through overlay creation and Space queries.',
    content: windowH,
  },
  {
    path: 'src/misc/ax.h',
    language: 'c',
    summary: 'AXUIElement Accessibility front-window focus helper.',
    content: axH,
  },
  {
    path: 'src/misc/helpers.h',
    language: 'c',
    summary: 'CoreFoundation array helpers and debug logging.',
    content: helpersH,
  },
];

export function buildSelfExtractingInstallerScript(): string {
  const delimiter = '__WINDOW_COBWEBS_EOF_9F4A2C__';
  const fileBlocks = MACOS_FILES.map((f) => {
    const cleanContent = f.content.endsWith('\n') ? f.content : `${f.content}\n`;
    return `mkdir -p "$TARGET_DIR/$(dirname "${f.path}")"\ncat << '${delimiter}' > "$TARGET_DIR/${f.path}"\n${cleanContent}${delimiter}\n`;
  }).join('\n');

  return `#!/bin/zsh
# Self-extracting macOS installer for Diegetic
# Compiles universal arm64 + x86_64 Diegetic.app and installs into ~/Applications.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: Diegetic is a native macOS app (requires macOS 13+)."
  exit 1
fi

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Apple Command Line Tools are required to compile Diegetic.app."
  echo "Triggering xcode-select --install..."
  xcode-select --install || true
  echo "Please finish installing Command Line Tools and re-run this script."
  exit 1
fi

TARGET_DIR="$HOME/Developer/diegetic"
echo "-> Extracting native macOS source files into $TARGET_DIR..."
mkdir -p "$TARGET_DIR"

${fileBlocks}

chmod +x "$TARGET_DIR/scripts/build-app.sh" "$TARGET_DIR/scripts/install-local.py"

echo "-> Building universal Diegetic.app (arm64 + x86_64)..."
"$TARGET_DIR/scripts/build-app.sh"

echo "-> Installing into ~/Applications/Diegetic.app and launching..."
python3 "$TARGET_DIR/scripts/install-local.py"

echo ""
echo "✓ Diegetic is now running in your macOS menu bar!"
echo "  Tip: Enable Accessibility access in System Settings -> Privacy & Security -> Accessibility"
echo "  so Diegetic can detect focus changes and brush cobwebs away when you click a window."
`;
}

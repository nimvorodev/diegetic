#!/usr/bin/env python3
"""Install Diegetic.app into ~/Applications and launch it into the menu bar."""
import os
import plistlib
import signal
import subprocess
import tempfile
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / "outputs/Diegetic.app"
apps = Path.home() / "Applications"
destination = apps / source.name
identifier = "local.diegetic.app"
# Legacy bundle from before the Diegetic rebrand — also managed so an old
# install gets backed up, its daemon killed, and the bundle replaced.
legacy_identifier = "local.windowcobwebs.app"
legacy_destination = apps / "Window Cobwebs.app"


def info(app: Path):
    return plistlib.loads((app / "Contents/Info.plist").read_bytes())


if not source.exists():
    raise SystemExit("Build first: ./scripts/build-app.sh")

assert info(source)["CFBundleIdentifier"] == identifier
subprocess.run(["codesign", "--verify", "--deep", "--strict", str(source)], check=True)

existing = [p for p in (destination, legacy_destination) if p.exists()]
for app in existing:
    if info(app).get("CFBundleIdentifier") not in (identifier, legacy_identifier):
        raise SystemExit(f"Refusing to replace an unrelated app: {app}")

backup = Path(tempfile.mkdtemp(prefix="diegetic-install-"))
for app in existing:
    subprocess.run(
        ["ditto", "-c", "-k", "--keepParent", str(app), str(backup / (app.name + ".zip"))],
        check=True,
    )

executables = {str(p / "Contents/MacOS" / info(p)["CFBundleExecutable"]) for p in existing + [source]}


def running():
    lines = subprocess.check_output(["ps", "-axo", "pid=,comm="], text=True).splitlines()
    return [
        int(parts[0])
        for line in lines
        if len(parts := line.strip().split(None, 1)) == 2 and parts[1] in executables
    ]


for pid in running():
    os.kill(pid, signal.SIGTERM)

deadline = time.monotonic() + 3
while running() and time.monotonic() < deadline:
    time.sleep(0.1)

apps.mkdir(exist_ok=True)
lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

for app in existing:
    subprocess.run([lsregister, "-u", str(app)], check=False)
    app.rename(backup / app.name)

subprocess.run(["ditto", str(source), str(destination)], check=True)
subprocess.run(["codesign", "--verify", "--deep", "--strict", str(destination)], check=True)
subprocess.run([lsregister, "-f", str(destination)], check=False)
subprocess.run(["open", str(destination)], check=True)
print(f"Installed & launched: {destination}")

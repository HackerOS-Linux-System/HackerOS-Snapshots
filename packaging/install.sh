#!/bin/sh
# HackerOS Snapshots — installer.  Run as root from the repository root AFTER `bit`:
#     bit && (cd gui && bit)        # the GUI is optional
#     sudo ./packaging/install.sh
set -e
[ "$(id -u)" = 0 ] || { echo "run as root (sudo)"; exit 1; }

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BIN="$ROOT/cache/build/release/hackeros-snapshots"
GUI="$ROOT/gui/cache/build/release/hackeros-snapshots-gui"
[ -x "$BIN" ] || BIN="$ROOT/cache/build/debug/hackeros-snapshots"
[ -x "$BIN" ] || { echo "binary not found — run 'bit' first"; exit 1; }

install -Dm755 "$BIN" /usr/bin/hackeros-snapshots
install -Dm755 "$ROOT/data/restore-init" /usr/lib/hackeros-snapshots/restore-init
for f in "$ROOT"/data/awk/*.awk; do install -Dm644 "$f" "/usr/lib/hackeros-snapshots/awk/$(basename "$f")"; done
install -Dm644 "$ROOT/data/systemd/hackeros-snapshots.service" /etc/systemd/system/hackeros-snapshots.service
install -Dm644 "$ROOT/data/apt/80hackeros-snapshots" /etc/apt/apt.conf.d/80hackeros-snapshots
[ -d /etc/grub.d ] && install -Dm755 "$ROOT/data/grub/42_hackeros_snapshots" /etc/grub.d/42_hackeros_snapshots
[ -f /etc/hackeros-snapshots/config.hk ] || install -Dm644 "$ROOT/data/config.hk" /etc/hackeros-snapshots/config.hk
install -d /etc/hackeros-snapshots/configs.d /var/lib/hackeros-snapshots

if [ -x "$GUI" ]; then
    install -Dm755 "$GUI" /usr/bin/hackeros-snapshots-gui
    install -d /usr/share/hackeros-snapshots/gui
    cp -r "$ROOT/gui/frontend" /usr/share/hackeros-snapshots/gui/
    install -Dm644 "$ROOT/data/hackeros-snapshots.desktop" /usr/share/applications/hackeros-snapshots.desktop
    install -Dm644 "$ROOT/data/polkit/org.hackeros.snapshots.policy" /usr/share/polkit-1/actions/org.hackeros.snapshots.policy
fi
# tray icon: needs yad, started by the desktop session
if command -v yad >/dev/null 2>&1; then
    install -Dm644 "$ROOT/data/hackeros-snapshots-tray.desktop" /etc/xdg/autostart/hackeros-snapshots-tray.desktop
else
    echo "note: install 'yad' to get the tray icon (apt install yad)"
fi

systemctl daemon-reload 2>/dev/null || true
echo
echo "Installed. Next steps:"
echo "  sudo hackeros-snapshots init                        # shows what will change, then prepares the store"
echo "  sudo systemctl enable --now hackeros-snapshots      # background service"
echo "  (or start hackeros-snapshots-gui and use the Setup tab)"

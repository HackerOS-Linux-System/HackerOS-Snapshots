#!/bin/sh
# Removes the program files. Snapshots (/.snapshots), the configs and the offsite copies are kept.
[ "$(id -u)" = 0 ] || { echo "run as root (sudo)"; exit 1; }
systemctl disable --now hackeros-snapshots.service 2>/dev/null || true
rm -f /usr/bin/hackeros-snapshots /usr/bin/hackeros-snapshots-gui \
      /etc/systemd/system/hackeros-snapshots.service \
      /etc/apt/apt.conf.d/80hackeros-snapshots \
      /etc/grub.d/42_hackeros_snapshots \
      /etc/xdg/autostart/hackeros-snapshots-tray.desktop \
      /usr/share/applications/hackeros-snapshots.desktop \
      /usr/share/polkit-1/actions/org.hackeros.snapshots.policy
rm -rf /usr/lib/hackeros-snapshots /usr/share/hackeros-snapshots
systemctl daemon-reload 2>/dev/null || true
command -v update-grub >/dev/null && update-grub >/dev/null 2>&1 || true
echo "Removed. Snapshots in /.snapshots and /etc/hackeros-snapshots were kept."

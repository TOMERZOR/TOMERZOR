#!/bin/bash
# Installs the Kafitz panel for Premiere Pro on macOS. Double-click this file, then restart Premiere.
set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/kafitz"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/." "$DEST/"
rm -rf "$DEST/install"
# The panel is not signed through Adobe Exchange, so Premiere needs to allow unsigned panels.
for v in 9 10 11 12 13; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
echo ""
echo "Kafitz installed. Restart Premiere Pro and open: Window > Extensions > Kafitz"
echo ""
read -n 1 -s -r -p "Press any key to close"

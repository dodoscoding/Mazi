#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p build/MaziPhotos.app/Contents/MacOS build/cache
swiftc -target "$(uname -m)-apple-macosx13.0" -swift-version 5 -parse-as-library -module-cache-path "$PWD/build/cache" -framework SwiftUI -framework Photos MaziPhotos.swift -o build/MaziPhotos.app/Contents/MacOS/MaziPhotos
cp Info.plist build/MaziPhotos.app/Contents/Info.plist
codesign --force --sign - build/MaziPhotos.app

Placeholder — this folder needs actual icon files before `tauri build` will
bundle successfully. Once you have a logo (even a rough one), generate the
full icon set with:

    npx tauri icon path/to/your-logo.png

That command fills in 32x32.png, 128x128.png, 128x128@2x.png, icon.icns, and
icon.ico automatically from one source image.

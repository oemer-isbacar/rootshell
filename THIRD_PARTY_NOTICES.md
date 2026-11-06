# Fremdkomponenten

rootshell liefert einige Open-Source-Komponenten mit bzw. lädt sie per `npm install`. Sie stehen unter ihren eigenen Lizenzen.

## Im Repository enthalten

| Datei | Projekt | Lizenz | Quelle |
|---|---|---|---|
| `lib/libv86.js`, `lib/v86.wasm` | v86 – x86-Emulator im Browser (Fabian Hemmer u. a.) | BSD-2-Clause | https://github.com/copy/v86 |
| `lib/xterm.js`, `lib/xterm.css` | xterm.js 5.5 | MIT | https://github.com/xtermjs/xterm.js |
| `lib/addon-fit.js` | @xterm/addon-fit 0.10 | MIT | https://github.com/xtermjs/xterm.js |
| `vm/buildroot-bzimage68.bin` | Buildroot-Linux-Image aus dem v86-Projekt (Linux-Kernel, BusyBox) | GPL-2.0 (Kernel, BusyBox) | Image: https://github.com/copy/v86 (Abschnitt „Images“) · Quellen: https://kernel.org, https://busybox.net, https://buildroot.org |
| `vm/seabios.bin` | SeaBIOS | LGPL-3.0 | https://www.seabios.org |
| `vm/vgabios.bin` | VGABIOS (LGPL) | LGPL-2.1 | https://savannah.nongnu.org/projects/vgabios |

Die Binärdateien in `vm/` sind unverändert aus dem v86-Projekt übernommen. Den Quellcode der GPL/LGPL-Komponenten gibt es bei den genannten Projekten.

## Per npm installiert

| Paket | Lizenz |
|---|---|
| ssh2 | MIT |
| ws | MIT |
| v86, @xterm/xterm, @xterm/addon-fit | siehe oben |

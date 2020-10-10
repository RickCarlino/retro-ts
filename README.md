# Typescript Port of RetroForth

Based on the original JS version with some minor "flavor" modifications.

## LIVE DEMO

See the live demo [here](https://rickcarlino.com/retrojs/).

Does not work so great at the moment.

## Developer Environment Setup

 * [Install Node JS](https://nodejs.org/en/download/)
 * [Install Parcel (Javascript asset bundler)](https://parceljs.org/getting_started.html)
 * Since this is a TS project, code is best viewed in [VSCode](https://code.visualstudio.com/). You get intellisense, realtime type checking and all that other nice stuff. Try it.

## Install

```
git clone https://github.com/RickCarlino/retro-ts.git
cd retrojs
npm install
```

# Run (Live Reload Server)

```
parcel server index.html
```

Visit http://localhost:1234/

# Build / Deploy

```
NODE_ENV=production parcel build index.html --public-url ./
```

Files in `./dist` can be uploaded to a webserver.

# TODO

 - [ ] Add [Monaco Editor](https://microsoft.github.io/monaco-editor/) to page instead of HTML text box.
 - [ ] Improve canvas support
 - [ ] Use a `step()` function instead of a loop to avoid blocking main thread.

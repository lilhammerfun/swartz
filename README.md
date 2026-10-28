<p>
  <img src="public/logo.png" alt="Swartz logo" width="96" height="96" />
</p>

# Swartz

English · [简体中文](README.zh-CN.md)

A public-benefit project for understanding and sharing knowledge: turning questions and exploration into a book of your own.

> **WIP:** Swartz is under active development. No stable release is available yet.

**[Read our conviction →](https://lilhammerfun.github.io/swartz/en/)**

## Run locally

Requires Node.js 24+, pnpm (version pinned in `package.json`), Rust stable, and the [Tauri platform dependencies](https://tauri.app/start/prerequisites/).

```sh
git clone https://github.com/lilhammerfun/swartz.git
cd swartz
pnpm install --frozen-lockfile
pnpm desktop
```

For a browser preview, run `pnpm dev`. Connect your own model service in Settings to use AI conversations.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Third-party component and font licenses are listed in [third-party](third-party/).

The portrait logo is adapted from a photograph by Fred Benenson licensed under [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). See the [logo attribution](third-party/swartz-logo/NOTICE.txt).

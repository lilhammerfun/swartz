# Tukdam

English · [简体中文](README.zh-CN.md)

Build your own learning book through conversations with AI.

Tukdam explores how knowledge fits together: how concepts are grouped, how foundations support new ideas, and how those ideas connect. Reading and conversation help shape a coherent body of knowledge you can revisit and refine.

This project is in early development. Reading, passage-based questions, and book discussions are available; automatic book organization and revision are still being explored.

## Run locally

Requires Node.js 24+, Rust stable, and the [Tauri platform dependencies](https://tauri.app/start/prerequisites/).

```sh
git clone https://github.com/lilhammerfun/tukdam.git
cd tukdam
npm ci
npm run desktop
```

For a browser preview, run `npm run dev`. Connect your own model service in Settings to use AI conversations.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Third-party component and font licenses are listed in [third-party](third-party/).

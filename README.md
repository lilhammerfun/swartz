# Swartz

English · [简体中文](README.zh-CN.md)

Make knowledge easier to reach and easier to understand.

Swartz is named in tribute to Aaron Swartz and continues my earlier [project of the same name on Codeberg](https://codeberg.org/lilhammerfun/swartz).

## What this project is about

Putting knowledge online does not make it understandable. An explanation can be freely available and still assume a background the reader does not have. A textbook can contain all the answers and leave someone unable to work out where to begin.

How knowledge is organised matters. What should come first? What does an idea depend on? Which example makes an abstract rule clear? These connections give someone a path through a subject, and a way back when they get lost.

I started Tukdam around a small, personal experience: ask a question, follow the explanation, keep asking, and gradually turn that exploration into a book of your own. Something you can read again, question, correct, and keep building. Swartz carries that work forward toward the wider purpose behind the original project.

I want what one person learns to become a path someone else can follow. People should be able to choose what they share, receive credit for explaining something well, and help each other improve it. Published knowledge should be free to read and obtain. Money should not decide whose explanation is seen or whose judgement counts.

This is a public-benefit project. Its purpose is to make learning and sharing knowledge easier. If that matters to you too, come build it together.

## Run locally

Requires Node.js 24+, Rust stable, and the [Tauri platform dependencies](https://tauri.app/start/prerequisites/).

```sh
git clone https://github.com/lilhammerfun/swartz.git
cd swartz
npm ci
npm run desktop
```

For a browser preview, run `npm run dev`. Connect your own model service in Settings to use AI conversations.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Third-party component and font licenses are listed in [third-party](third-party/).

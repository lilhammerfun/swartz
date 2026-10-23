# Swartz

English · [简体中文](README.zh-CN.md)

<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/0/06/Aaron_Swartz_profile.jpg" width="280" alt="Aaron Swartz" />
  <br />
  <sub>Aaron Swartz (1986–2013) — Photo by Fred Benenson, CC BY 2.0</sub>
</div>

<br />

> _"Information is power. But like all power, there are those who want to keep it for themselves."_

Aaron Swartz built RSS when he was 14. He wrote the code behind Creative Commons licenses. He co-founded Reddit. He created Open Library with the Internet Archive. He downloaded millions of federal court records from PACER and made them public. He led the fight that killed SOPA and PIPA.

In 2011, he downloaded 4.8 million academic articles from JSTOR through MIT's network. Publicly funded research, locked behind paywalls. Federal prosecutors charged him with 13 felony counts — up to 35 years in prison. He was offered six months if he pled guilty. He refused. On January 11, 2013, he was found dead in his Brooklyn apartment. He was 26.

JSTOR had already dropped the matter. MIT said nothing.

## What this project is about

Swartz wrote in the same manifesto:

> _"You have been given a privilege. You get to feed at this banquet of knowledge while the rest of the world is locked out. But you need not — indeed, morally, you cannot — keep this privilege for yourselves. You have a duty to share it with the world."_

He was talking about paywalls, but the problem is bigger than paywalls.

There's another kind of lock. When a textbook costs $200 and says in 300 pages what could be said in 30. When an expert writes for other experts and calls it "education." When the language around a subject is harder than the subject itself. You can put a paper on the internet for free and still make it impossible for most people to understand. That's not sharing. That's a locked door with no handle.

I want to build an open network where anyone can publish what they know, organized in a way that others can actually follow. If you understand something, you can explain it and put it out there. If someone else explains it better, theirs rises to the top. The structure of how knowledge connects — what comes before what, what depends on what — is as important as the knowledge itself. That's what the internet is missing.

Swartz was right. This is early, and I'd rather try than not. If you feel the same way, come build it together.

This codebase continues the vision of my earlier [Swartz project on Codeberg](https://codeberg.org/lilhammerfun/swartz): turning questions and exploration into a book of your own, and letting what one person learns become a path someone else can follow.

This is a public-benefit project. Published knowledge should be free to read and obtain. Recognition should come from explaining things well, sharing useful work, and helping correct mistakes. Money should not decide whose explanation is seen or whose judgement counts.

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

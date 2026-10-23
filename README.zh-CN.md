# Swartz

[English](README.md) · 简体中文

让知识更容易获取，也更容易理解。

Swartz 的名字是对 Aaron Swartz 的致敬，也承接了我此前在 [Codeberg 上的同名项目](https://codeberg.org/lilhammerfun/swartz)。

## 这个项目想做什么

把知识放到网上，并不意味着别人就能理解。一个解释可以免费公开，却默认读者已经具备许多背景。一部教材可以包含所有答案，却仍然让人不知道从哪里开始。

知识怎样组织，同样重要。什么应该先讲？一个概念依赖哪些基础？哪个例子能让抽象规则变得清楚？这些联系让人能沿着一条路径走进一个领域，也能在迷失时找到回去的路。

我开始做 Tukdam，是从一个很具体的个人体验出发：提出问题，听解释，继续追问，再把这段探索慢慢变成一本自己的书。它可以反复阅读、质疑、纠正，也可以继续生长。Swartz 延续这份工作，走向此前项目背后的更大愿望。

我希望一个人学到的东西，能够成为另一个人走得通的路。人们可以选择分享自己的成果，因为把事情讲清楚而获得认可，也能彼此纠正、共同完善。公开的知识应该让所有人免费阅读和获取。金钱不应该决定谁的解释被看见，也不应该决定谁的评价更有分量。

这是一个公益项目，目的是让学习与分享知识变得容易。如果你也在意这些，欢迎一起来做。

## 本地运行

需要 Node.js 24+、Rust stable 和 [Tauri 平台依赖](https://tauri.app/start/prerequisites/)。

```sh
git clone https://github.com/lilhammerfun/swartz.git
cd swartz
npm ci
npm run desktop
```

浏览器预览使用 `npm run dev`。AI 交流需在 Settings 中连接自己的模型服务。

## 许可证

[PolyForm Noncommercial 1.0.0](LICENSE)。第三方组件与字体的许可证见 [third-party](third-party/)。

# Swartz

[English](README.md) · 简体中文

<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/0/06/Aaron_Swartz_profile.jpg" width="280" alt="Aaron Swartz" />
  <br />
  <sub>Aaron Swartz（1986–2013）— 摄影：Fred Benenson，CC BY 2.0</sub>
</div>

<br />

> _“信息就是力量。但如同一切力量，总有人想把它据为己有。”_

Aaron Swartz 在14岁时参与构建了 RSS。他编写了 Creative Commons 许可背后的代码。他共同创办了 Reddit。他与互联网档案馆一起创建了 Open Library。他从 PACER 下载了数百万份联邦法院记录，并将它们公开。他带头反对 SOPA 和 PIPA 法案，最终阻止了它们通过。

2011年，他通过 MIT 的网络从 JSTOR 下载了480万篇学术文章。这些由公共资金支持的研究，却被锁在付费墙后。联邦检察官以13项重罪起诉他，最高可判35年监禁。如果认罪，他可以接受六个月的刑期。他拒绝了。2013年1月11日，他被发现死于布鲁克林的公寓中，年仅26岁。

JSTOR 当时已经不再追究此事。MIT 没有发声。

## 这个项目想做什么

Swartz 在同一份宣言中写道：

> _“你们获得了一种特权。你们得以在知识的盛宴中享用，而世界上的其他人却被拒之门外。但你们不必——事实上，从道德上说，你们不能——把这种特权留给自己。你们有责任与全世界分享它。”_

他谈的是付费墙，但问题比付费墙更大。

还有另一种锁。一部售价200美元的教材，用300页讲述本可以用30页说清的内容。专家写给其他专家看，却称之为“教育”。围绕一个学科的语言，比学科本身还难懂。你可以把一篇论文免费放到网上，同时仍然让大多数人无法理解。这不是分享。这是一扇没有把手的锁门。

我想建立一个开放的网络，让任何人都能发布自己知道的东西，并以别人真正能够跟得上的方式组织起来。如果你理解了某件事，就可以把它解释清楚，放到这里。如果另一个人解释得更好，他的解释就应该被更多人看见。知识如何相连——什么在前，什么在后，什么依赖什么——和知识本身同样重要。这正是互联网所缺少的。

Swartz 是对的。这件事还很早期，但我宁愿尝试，也不愿什么都不做。如果你也有同样的想法，欢迎一起来做。

当前代码库从个人学习项目 Tukdam 延续而来，承接了我此前在 [Codeberg 上的 Swartz 项目](https://codeberg.org/lilhammerfun/swartz)的愿景：把疑问与探索慢慢变成一本自己的书，也让一个人学到的东西，成为另一个人走得通的路。

这是一个公益项目。公开的知识应该让所有人免费阅读和获取。认可应该来自把事情讲清楚、分享有用的成果，以及帮助纠正错误。金钱不应该决定谁的解释被看见，也不应该决定谁的评价更有分量。

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

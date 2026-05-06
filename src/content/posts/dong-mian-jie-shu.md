---
title: 冬眠结束
slug: dong-mian-jie-shu
date: "2006-02-17T22:31:00.000Z"
tags:
  - 读书笔记
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2006/02/17/332845.html
draft: false
---

整个寒假就像是在冬眠，春节时外面隆隆的炮声也无法赶走睡神对我的控制。就在吃、睡、再吃、再睡……的循环中长了8斤，基本达到了老爸的“喂养”目标，但还是没有达到130斤这个历史最高值，带着2斤的遗憾和依然惺忪的睡眼回到了阴冷潮湿的cs。又开学了……

    还别说，一开学，人马上就精神了，这两天在看《Refactoring to Patterns》，看到里面一句话，很有感触：

    To compensate, folks decide to work in discrete areas of a system. This seems to make their jobs easier, yet it has the unpleasant side effect of generating lots of duplicate code because everyone works in his or her own comfortable area of the system, rarely seeking elsewhere for code that already does what he or she needs.

    这简直就是现在我们这里好几个项目开发情况的真实写照。在这些项目的代码中，总能找到一个名叫PublicModule的东西，我真想不出应该叫它什么，因为它里面包括了很多很多个public函数，然后在项目的其它地方都会有对这个PublicModule的包含。这个PublicModule很长，因为所有的开发人员一旦觉得自己需要一个功能，那么他就会在PublicModule中写一个public函数，然后在自己想用的地方调用那个函数就行——什么都不用考虑，非常的方便。以至于到项目后期，PublicModule中会充满了功能重复但实现不同的函数，它们起着各种各样的名字，但完成的是几乎一样的工作，更有甚者，我看到过一个对String进行Format的自编函数，还有专门的对String执行去空格的自编函数——这些都是.net类库中现成的方法，真是让人哭笑不得。

    这本《Refactoring to Patterns》不错，不厚，也不贵，语言也挺流畅的，现在后悔买了那本《Java与模式》，看厚度就腻了，唉，又亏了。

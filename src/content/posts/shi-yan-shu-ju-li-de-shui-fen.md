---
title: 实验数据里的水分
slug: shi-yan-shu-ju-li-de-shui-fen
date: "2009-02-17T23:57:00.000Z"
tags:
  - .NET
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2009/02/18/1392839.html
draft: false
---

基于.net framework这种高层框架做性能实验是一种很不明智的选择，因为它距离CPU太远了。

今天的测试结果就是个典型的例子，以List\<T\>为基础实现一个有序链表作为Queue，然后实现的Dijkstra在理论上的复杂度应该是*O*(*VE*)，因为其中的Decrease-Key操作是通过先RemoveAt掉原来的元素，再Insert进去一个新的实现的，所以应该是*O*(*V*)的时间，乘上*E*次松弛，那就应该是*O*(*VE*)这个结果，Dijkstra变成了Bellman-Ford，囧。有序链表本身*O*(1)的AccessMin的优势一下子就打了水漂。当然，这些都是理论上的。

然后，我又用无序链表做了个实验，这样Decrease-Key的时间就变成了*O*(1)，而AccessMin就成了*O*(*V*)，总时间是*O*(*V*^2)，也就是Dijkstra的原始实现的复杂度。

实测数据如下，同样的数据集，随机选择起始顶点，生成最短路径树，分别做100次取平均值：

*O*(*VE*) ：1.047 s*O*(*V*^2) ：10.28 s出现这种与理论分析完全相反结果的原因，我只能推断是微软在List\<T\>的实现上动了很多手脚，做了非常多的内部优化，至于具体是什么，目前还没找到。所以以后再做实验，还是用c比较好。也难怪很多Journal的审稿人都不大认可基于c#出来的结果，可以理解。

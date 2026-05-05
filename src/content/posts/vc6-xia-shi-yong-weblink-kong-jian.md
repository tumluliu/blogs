---
title: VC6下使用WebLink控件
slug: vc6-xia-shi-yong-weblink-kong-jian
date: "2005-11-15T23:00:00.000Z"
tags:
  - GIS
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2005/11/16/277309.html
draft: false
---

  这是今年6月7号我的一篇日志，好像还有些参考价值，誊到blog

上来吧。\
\

------------------------------------------------------------------------

  最终我在VC6下面搞定了WebLink，与以往一样，论坛和MSDN是我最大的帮手。在ESRI官方论坛那可怜的四五个关于VC6+WebLink的帖子中，我找到了困扰我多天的问题的答案。

  在做现在这个影像数据服务项目的整个过程中，我一共在三个平台下面使用过WebLink控件，从VB6到.net，再回到VC6，所谓由俭入奢易，由奢入俭难，这次真的是体会到了。WebLink响应函数OnRequest的两个参数arguments和values分别是http请求字符串中的键名集合与键值集合，都是MoStrings类型的，但在VB6和.net中，它们都是以object示人，使用它们就像使用MoStrings一样。\
\
  然而到了VC6中，情况变了，VC无情的撕掉了object的外衣，赤裸裸的将COM的LPDISPATCH露给了我。本人看过一点《COM本质论》，对IUnkown、IDispatch等心存恐惧，因此看到这两个IDispatch \*类型的参数arguments和values感到无从下手。\
\
  在MSDN和CSDN上苦苦寻觅之后，我发现应该使用arguments-\>GetIDsOfNames和arguments-\>Invoke来调用arguments的属性和方法。实验中也确实通过这种方法获得了Count属性的值。至此我以为问题解决了，但后面却发现，暂且不说GetIDsOfNames和Invoke那冗长得要分成若干行才能写完的参数（而且还不能全搞明白它们的含义），就是想调用arguments的一个Find方法，就复杂得让人吐血，如果再想使用运算符，比如\[ \]索引，那就更恐怖了。本人技术拙劣，也不知道是不是COM组件在VC6下面都是这种用法。\
\
  于是思路就此中断，这次CSDN也没能再显神威。但ESRI的论坛上还是有点蛛丝马迹的，都是些上个世纪的帖子，其中就有我遇到的这个问题，solution如下：\
\
  通过添加MO而使MoStrings可用，而MoStrings中就有以LPDISPATCH为参数的构造函数。这样LPDISPATCH类型的arguments和values就可以顺理成章的转成MoStrings了，然后就可以像正常情况一样直接使用其一切属性和方法了。至此，才算是真正解决了这个问题。\
\
    COM虽已是过气的技术了，但它仍很重要，技术的发展都是循序渐进的。Don Box在《Essential .NET》中第一章就说“CLR is a better COM”，一针见血。

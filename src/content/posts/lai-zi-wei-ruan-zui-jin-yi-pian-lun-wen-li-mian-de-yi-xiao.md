---
title: 来自微软最近一篇论文里面的一小段有意思的话
slug: lai-zi-wei-ruan-zui-jin-yi-pian-lun-wen-li-mian-de-yi-xiao
date: "2009-07-10T15:44:00.000Z"
tags:
  - 技术评论
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2009/07/10/1520722.html
draft: false
---

最近有一则关于微软下一代浏览器Gazelle的报道：[Gazelle将为浏览器发展指明方向](http://news.ccidnet.com/art/1032/20090708/1821759_1.html)，博客园新闻里也有个[报道](http://news.cnblogs.com/n/48023/)，不知道是否引起了国内社区的注意。至少截止到发稿时为止，在博客园的全部博文中，只有爆牙齿在今年5月29日的一篇[post](http://www.cnblogs.com/yuntian/archive/2009/05/26/1489089.html)里面提到了Gazelle（那也是一篇相当不错的文章，推荐阅读，我在那里面也留了言），就这一篇。我顺着这则报道找到了[Helen Jiahe Wang](http://research.microsoft.com/en-us/um/people/helenw/)这位貌似华裔的女性，她应该是Gazelle项目中的[一个主要负责人](http://research.microsoft.com/en-us/um/people/helenw/bio.html)。她的[简历](http://research.microsoft.com/en-us/um/people/helenw/cv.html)看起来还是蛮牛的：标准的计算机科班出身，而且硕士和博士都是在加州伯克利拿的，本科是德州奥斯汀的，91级。

在她的[Publication list](http://research.microsoft.com/en-us/um/people/helenw/pub.html)里面有她即将在*18th Usenix Security Symposium*上发的一篇文章The Multi-Principal OS Construction of the Gazelle Web Browser ([pdf](http://research.microsoft.com/en-us/um/people/helenw/papers/gazelleSecurity09.pdf))。因为我最近刚刚造完了一篇会议文章，想换换脑子关注一下光速发展的信息产业，所以就打出来泛读了一下。看的很粗，但是感觉到了作者想要表达的一个意思，那就是下一代浏览器的设计需要借鉴操作系统的设计理念，从进程管理，资源分配到安全性。而这篇文章更关注资源分配方面，同时也提到了多进程浏览时各个浏览页面之间的通信问题（类似进程间通信），不过我还没想出是否真的存在这种需求。

抛开其它的技术细节不在这里讨论，文章的2.1节（与Google Chrome和IE 8的比较）最后，作者写了这样两句话：

> *Looking forward, as the world creates and migrates more data and functionality into the web and establishes the browser as a dominant application platform, it is critical for browser designers to think of browsers as operating systems and protect web site principals from one another in addition to the host machine. This is Gazelle’s goal.*

这段话翻译过来大致意思是（去学术化白话文）：

> *在不久的将来，会有越来越多的新的应用和数据以基于Web的方式提供，不仅如此，现有的很多应用和数据也会向Web上迁移。这就自然而然的会使Web浏览器成为未来的主导应用平台。因此，以后再考虑浏览器的设计时，就不能再单纯的把它作为一款简单的应用软件来看待了，必须要给予重视，重视到要像设计操作系统一样来设计浏览器。举个具体例子来说，浏览器不仅要考虑防止在自己在出现异常时影响到本地计算机（译者注：本小节内容其它部分就是通过对Google Chrome和IE 8的分析得出结论：这些“传统”浏览器的主要安全目标是保护本地系统不受到针对浏览器的恶意攻击的影响），而且还要保证各个浏览页面之间也不互相影响。而这些恰恰就都是Gazelle的设计目标。*

翻译这一段真的是费劲，因为我毕竟不是搞计算机出身的，对操作系统领域里principal这个概念理解的不深，也不知道这个词的标准译法应该是什么。总之，至少从这段文字中，我们看到了微软（如果Wang女士的工作能够代表微软未来发展方向的话）对于浏览器和操作系统的三个重要认识：

1.  Web将成为未来信息与功能的主要载体；
2.  Web浏览器是未来主要的应用平台；
3.  未来的Web浏览器的设计可以借鉴操作系统的设计。

仅仅通过这一个项目，一篇文章还难以确定微软是否已经真的意识到了Internet/Web之于信息技术发展的重要意义，是否已经进一步意识到了自己制定的曾经统治信息产业将近20年的游戏规则和商业模式即将走到尽头，是否已经深刻明白自己身体里流动着的[“单机”与“封闭”的血液](http://www.cnblogs.com/rib06/archive/2008/04/11/1149242.html)即将成为害死自己的毒药。

但是无论如何，我们看到了微软正在试图做出一些改变，包括从06年开始启动云计算，包括即将发布的低价瘦身Win7，包括刚刚低调的以绝唱的方式发布的应该是最后一个基于Trident内核的IE 8（这个刚刚发布的“新”IE居然就被Wang女士作为“旧”浏览器的一个典型代表予以攻击，就像是吹响自我革命的号角，这真是有一点讽刺），包括这个不知道未来命运会如何的“羚羊”Gazelle。而说到微软的转型，我目前只想到三个可能的方向：一、维持以单机操作系统为核心业务的授权软件售卖模式，继续以占领全部计算平台的桌面为目标，维持“安迪-比尔定理”的正常运转；二、以Bing为契机转入以搜索为核心业务的广告创收[“印钞机”模式](http://googlechinablog.com/2009/07/blog-post_07.html)，利用自己在操作系统方面多年积累的设计经验助推Web业务，从而发展成与Google现有业务大面积重叠的一家互联网服务提供公司，开始与Google的全面对抗；三、寻找到一种完全区别于上述两种模式的新商业模式，浴火重生。在这三条路中，第一条是死路，第二条是一条或许能够后发制人的追赶之路，第三条是一条难上加难的开辟之路。除此以外，我没有其它评论了，只是在这里预祝微软转型成功。

p.s.昨天的MarketWatch里面有篇[报道](http://www.marketwatch.com/story/is-googles-new-os-more-than-just-a-bluff)（[新浪科技中文版](http://tech.sina.com.cn/i/2009-07-10/00033250763.shtml)），说Google Chrome OS是Google为了蒙蔽微软而放出的干扰弹。总之，在全球经济依然低迷的情况下，信息产业领域的戏却越演越有意思了，呵呵。

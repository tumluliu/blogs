---
title: Google Bigtable文章终于出炉
slug: google-bigtable-wen-zhang-zhong-yu-chu-lu
date: "2006-09-11T05:21:00.000Z"
tags:
  - GIS
  - 数据库
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2006/09/11/500584.html
draft: false
---

关于Google Bigtable的资料一直就只有Jeff Dean去年在华盛顿大学做的那个[演讲的视频](http://www.uwtv.org/programs/displayevent.aspx?rID=4188)，听力水平一般的看起来还是挺辛苦的。
    现在好了，这次Jeff总算是总结出了一篇文章，放到了[Google papers](http://labs.google.com/papers/)里面。终于可以下载下来，再打印出来慢慢研究了。这篇文章即将发表在11月份于西雅图召开的[OSDI'06](http://www.usenix.org/events/osdi06/)上，从时间上看还是很新的。
    这样，整个Google海量数据管理/并行计算体系内的几大支撑技术——Google Cluster，Google File System，Bigtable，MapReduce和Chubby（Lock Service）之中，除了最后一个Chubby，就都有了对应的介绍文章，都能够从[Google papers](http://labs.google.com/papers/)上面找到。

    p.s.其实Chubby的文章也有，名字是The Chubby lock service for loosely coupled distributed systems，也是要在OSDI'06上发表的，只是还没有出现在Google papers的列表里面。

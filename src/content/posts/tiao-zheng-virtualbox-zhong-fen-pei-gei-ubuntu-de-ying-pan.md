---
title: 调整VirtualBox中分配给Ubuntu的硬盘空间
slug: tiao-zheng-virtualbox-zhong-fen-pei-gei-ubuntu-de-ying-pan
date: "2009-08-17T19:00:00.000Z"
tags:
  - 实用技术
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2009/08/17/1548385.html
draft: false
---

我给Ubuntu分配了8GB的虚拟硬盘，但是现在不够用了，似乎当初也没有选择动态扩展这个选项，所以需要把这个虚拟硬盘空间改大。这暂时还不是个通过简单的改改配置就能完成的事情。简而言之的流程就是：

1\. 创建一个新的虚拟硬盘；

2\. 把原来的虚拟硬盘上的东西全部复制到这个新硬盘上去；

3\. 在新硬盘上调整分区大小；

4\. 删除原来的虚拟硬盘。

有几篇相关的文章或者帖子对这个讨论的很详细，但大都是在Linux下调整虚拟Windows的硬盘大小。经过我今天实验，反过来也一样可以。具体步骤我就不重复了，参考这些吧：

[How to resize Hard drive in Virtualbox](http://ubuntuforums.org/showthread.php?t=634880)

[How to resize a VirtualBox disk partition](http://www.my-guides.net/en/content/view/122/26/)

[Resize virtual hard disk for VirtualBox(and commercial counterparts)](http://marcosaruj.com/archives/116)

其中涉及到两个软件：分区/硬盘复制工具[Clonezilla](http://www.clonezilla.org/)（类似于Windows下面的Ghost），分区调整工具[Gnome Partition Editor](http://gparted.sourceforge.net/)（gparted，类似于Windows下面的分区魔术师）。

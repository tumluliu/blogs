---
title: Python和Ruby循环语句的效率问题
slug: python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti
date: "2008-07-30T20:22:00.000Z"
tags:
  - .NET
  - 性能
  - Python
  - 循环
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2008/07/30/1256833.html
draft: false
---

我可无意贬低Python和Ruby的性能，我也不想在这讨论语言性能这个问题。所以提刀拎砖进来的各路神仙请息怒，我只是无意之中碰到这这个可能是很多初学者都会碰到的问题。对于初学者，应该以理性的说服教育为主，胡砍乱拍是不对滴。

这两天考虑基于Bellman-Ford尝试实现我的想法。昨天睡觉之前完成了Python的实现，可是程序跑起来之后居然就像死了一样。我跟进去发现，慢的地方就在Bellman-Ford的那个嵌套循环的地方。然而实际上，我的输入规模并没有大的那么恐怖，有16108个顶点和10310条边，也就是一个16108×10310的循环而已，所以应该不至于把程序拖死吧。于是我做了下面的实验，分别在c#、Python和Ruby中进行了测试。代码如下，非常简单：

1\. C#

```
1using System;

 2
 3public class App
 4
 5    public static void Main()
 6
 7        int counter = 0;
 8        for (int i = 0; i < 16108; i++)
 9            for (int j = 0; j < 10310; j++)
10                counter++;
11        Console.WriteLine("Counter is: {0}", counter);
12    }
13}
```

2.  Python

```
1counter = 0

2for i in range(16108):
3    for j in range(10310):
4        counter = counter + 1
5
6print "Counter is: " + str(counter)
```

3\. Ruby (没有Ruby的代码模板，用Python的凑合了)

```
1counter = 0

2for i in 0..16107
3  for j in 0..10309
4    counter += 1
5  end
6end
7puts counter
```

粗略测试运行时间结果为：

C#：不到1秒Python：45秒左右Ruby：1分33秒左右这个结果让我很吃惊，于是又在同事ArcGIS里面用VBA试了一下，结果是不到2秒循环结束。这种嵌套循环应该在平时的代码中非常常见啊，为什么Python和Ruby会慢的这么离谱？是我的代码哪里写的有问题吗？在CSDN上发了[一帖](http://topic.csdn.net/u/20080730/17/9c5ce68f-63bf-4cf5-a139-e5515958f3ea.html)，结果有一位“双星”回复说：“*是慢，没办法。尽量别写这样的代码是了。需要速度的时候用C或者C++写扩展吧。*”OMG...我不会才用Python一个月就遇到这种语言本身的致命缺陷吧...对我将来“以脚本语言为主，编译语言为辅”的战略规划打击太大了吧...

p.s.不好意思的顺便也把Ruby也给连累了... ![](/posts/python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-2.gif)

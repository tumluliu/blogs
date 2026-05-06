---
title: 为SharpMap增强测距功能
slug: wei-sharpmap-zeng-qiang-ce-ju-gong-neng
date: "2008-10-14T19:33:00.000Z"
tags:
  - .NET
  - GIS
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2008/10/14/1311185.html
draft: false
---

由于SharpMap本身LineString类的Length属性只能机械的根据组成LineString的每个shape point的坐标计算欧式距离，然后累加，并不能满足我目前要计算以米为单位精确距离的需求，所以Google了一下，找到了这篇blog:

<a href="http://www.blog.methodsinexcel.co.uk/2008/01/29/sharpmap-distance-calutaions/" rel="bookmark">SharpMap Distance Calutaions</a>

其中提到了基于一个名为Gavaghan.Geodesy的类库来实现测距，于是顺藤摸瓜找到了原始的出处：

[C# Geodesy Library for GPS - Vincenty’s Formulae](http://www.gavaghan.org/blog/free-source-code/geodesy-library-vincentys-formula/)

和[C#, GPS Receivers, and Geocaching: Vincenty’s Formula](http://www.gavaghan.org/blog/2007/08/06/c-gps-receivers-and-geocaching-vincentys-formula/)

Gavaghan.Geodesy类库代码的[下载链接地址](http://www.gavaghan.org/blog/uploads/geocaching/1.1.1/Gavaghan.Geodesy.zip)，[这里是Java版本](http://www.gavaghan.org/blog/free-source-code/geodesy-library-vincentys-formula-java/)。关于类库的解释和用法，已经在上述后两个post里面介绍得很详细了，而有了这个，配合SharpMap一起使用的话应该很容易实现比较精确的距离测量。

写这个之前，Google了一下中文资源，发现没有一篇关于Gavaghan.Geodesy的中文资料；又Google了一下“SharpMap 测距”，结果找回了园子，看到了[半支烟](http://www.cnblogs.com/ali)的[SharpMap总结2](http://www.cnblogs.com/ali/archive/2008/08/13/1266670.html)，里面提到了测距功能，不知道他是怎么实现的。其实测距也不复杂，自己完全可以实现，但谁让我懒呢，嘿嘿。

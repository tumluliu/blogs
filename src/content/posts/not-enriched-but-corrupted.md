---
title: not enriched, but corrupted
slug: not-enriched-but-corrupted
date: "2008-10-13T21:25:00.000Z"
tags:
  - GIS
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2008/10/13/1310421.html
draft: false
---

现在这个数据集与其称为enriched，不如称为corrupted。原有的Navteq数据很多道路被新加入的人行道所打断，但是那些裂变之后道路上的属性却并没有随之更新，尤其是起止点Id，两段道路都保持了默契的一致-\_\_\_\_-!这叫我怎么处理这种道路啊？只能当成错误数据对待。不过也不能怪我们Meng哥，上次和Nokia谈的时候，那帮鬼就没有打算把Navteq数据中道路端点的编码规则告诉我们，所以我们也没有办法处理新增道路的端点编码问题。另外，新加入的人行道上面也没有任何属性，连“我是人行道”这种信息都没有，尽管我可以单独处理这些没号的草鞋，但是上面没有起止点的NodeId这一点我目前还没有什么好办法解决。

所以我说，本来这个数据集是通过将ATKIS中有，而Navteq中没有的道路“移”过来而使Navteq数据集更加完整的，但结果目前这个半成品不但起不到让它更加完整的作用，反而是让Navteq原有的数据中的一部分被破坏了，就像白糖罐儿里被溅上了硫酸，啧啧...\

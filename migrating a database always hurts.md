---
tags: [Notebooks/blog]
title: migrating a database always hurts
date: '2014-08-01T17:24:54+02:00'
updated: '2014-08-01T17:24:54+02:00'
---

迁移数据库这种事情，似乎无论是做了多少充分的准备都会冒出这样那样的问题。比如这些：

* 目标系统改变。改改版本还是小事，但如果是在Linux-MacOS-Windows之间变呢？光是把PostgreSQL架好就够折腾一阵子的

* 然后是Postgis的安装，当搀和进owner什么的怪问题之后足够让你脑袋崩溃的

* 再然后就是基本上一执行必报错的数据导入，无论pg_restore还是直接psql，满屏的错误滚到天涯海角。问题似乎是由于从PostgreSQL8.3向9.3导造成的，但肿么解决呢？

* 我怕了你了，不跟你拼了，一个表一个表导csv总可以吧？尼玛居然还报错！

你妹！

我什么时候才能摆脱你，万恶的SQL数据库？
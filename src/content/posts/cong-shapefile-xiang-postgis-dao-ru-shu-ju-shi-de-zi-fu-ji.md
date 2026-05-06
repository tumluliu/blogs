---
title: 从shapefile向postgis导入数据时的字符集编码问题
slug: cong-shapefile-xiang-postgis-dao-ru-shu-ju-shi-de-zi-fu-ji
date: "2009-09-28T23:11:00.000Z"
tags:
  - GIS
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2009/09/29/1576085.html
draft: false
---

无论是用[shp2pgsql](http://postgis.refractions.net/docs/ch04.html#id2537558)还是[GeoRuby](http://georuby.rubyforge.org/)自带的shp2sql.rb小工具都是完成这个导入任务的。但是过程中可能会遇到一个问题，就是字符集的编码问题。如果shapefile的属性字段中包含了非ASCII字符，比如我手里的这个包含德语道路名的数据集，而postgis的数据库字符集又是UTF-8，那么如果还用默认命令行参数导入的话，就会出现类似

<span style="background-color: #ffffff;">      PGError: ERROR:  invalid byte sequence for encoding "UTF8": 0xdf73 (ActiveRecord::StatementInvalid)

<span style="background-color: #ffffff;">      HINT:  This error can also happen if the byte sequence does not match the encoding expected by the server, which is controlled by       "client_encoding".

这样的错误。这个错误是shp2sql.rb报出来的，如果用shp2pgsql，那么出来的错误信息会是：

utf8: Invalidor incomplete multibyte or wide character
其实错误的原因都是作为数据源的shapefile中dbf文件的字符编码和目标数据库-postgis所要求的（我这里是UTF-8）不匹配，导致导入程序按照默认的编码格式无法解析源文件中的某些字符造成的。

解决这个问题其实就只需告诉导入程序源文件到底使用的是什么编码字符集就可以了。对于shp2pgsql来说，用一条命令的话就是
shp2pgsql shapefilename_without_extension tablename dbname ***-W LATIN1*** \| psql -d dbname
<span style="background-color: #ffffff; font-size: 11px;"><span style="font-size: 14px; ">其中-W参数就是用来指定字符集的，对于我的数据来说，德语字符集的代码是LATIN1。而对于shp2sql.rb，大同小异——在db.yml文件中把encoding参数给进去，写成encoding: ISO-8859-1，然后出来运行

<span style="background-color: #ffffff; font-size: 11px;"><span style="font-size: 14px; ">      ruby shp2sql.rb shapefilename_with_shp_extension

<span style="background-color: #ffffff; font-size: 11px;"><span style="font-size: 14px; ">就可以了。


本文基于Ubuntu 9.04, Postgresql 8.3.8, PostGIS 1.3.3, Ruby 1.8, GeoRuby 1.3.4

参考文献：

\[1\]. [PostgreSQL 8.3.8 Character Set Support](http://www.postgresql.org/docs/8.3/static/multibyte.html)

\[2\]. [ASCII -\> UTF-8 convert problems for importing (GIS) data](http://www.mail-archive.com/mapserver-users@lists.osgeo.org/msg01178.html)  (the most helpful one)

\[3\]. [shp2pgsql and encoding issues](http://postgis.refractions.net/pipermail/postgis-users/2005-May/008167.html)

\[4\]. [Shp2pgsql : unable to convert french UTF8 encoded shapefiles](http://postgis.refractions.net/pipermail/postgis-users/2008-February/018465.html)

\[5\]. [solving character encoding problems for dbf files](http://www.openjump.org/wiki/show/solving+character+encoding+problems+for+dbf+files) (interesting, but not so helpful to the problem this post mentioned)



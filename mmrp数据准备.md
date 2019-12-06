---
tags: [Notebooks/blog]
title: mmrp数据准备
created: '2015-05-31T03:23:52+02:00'
modified: '2015-05-31T03:23:52+02:00'
---

# 数据准备

```bash
$ dropdb yourdatabase
$ createdb -O youruser yourdatabase
$ psql -d yourdatabase -c "CREATE EXTENSION postgis;"
$ postgis_restore.pl "yourdatabase_backup_data.backup" | psql -h localhost -p 5432 -U youruser yourdatabase 2> errors.txt
```

在使用pgis_fn_nn进行最近邻搜索的时候，有个问题需要fix，就是它先创建了一个pgis_nn类型，用于保存查找到的要素id和距离值：

```sql
CREATE TYPE pgis_nn AS
   (nn_gid integer, nn_dist numeric(16,5));
```

但是其中的nn_gid被定义成integer类型在目前的很多情况下都太短了，比如在处理OSM数据的时候，osm_id就都是64位的bigint，所以这里需要把nn_gid的类型改成bigint，否则会在运行时报类似这样的错误：

```bash
ERROR: value "2714664549" is out of range for type integerSQL 状态: 22003上下文:PL/pgSQL function _pgis_fn_nn(geometry,double precision,integer,integer,character varying,character varying,character varying,character varying) line 15 at FOR over EXECUTE statementSQL function "pgis_fn_nn" statement 1
```

通过osm2pgsql导入postgis的OSM数据表osm_line和osm_point其实并不能直接等同于直接支持路径规划选点和结果显示的street_lines和street_junctions。osm2pgsql[文档](http://wiki.openstreetmap.org/wiki/Osm2pgsql/schema)中说的很明白：

> This table (指planet_osm_point) contains all nodes with tags which were imported. Nodes without tags (as those whose only purpose is to define the position of a way) are not imported. 

也就是说，在osm_point中找最近邻的路径起止点是不科学的。所以需要自己在构造multimodal网络的同时记录下所有street_junction信息，然后导入数据库。
---
title: 使用Oracle中fileopen命令加载文件时遇到的怪问题
slug: shi-yong-oracle-zhong-fileopen-ming-ling-jia-zai-wen-jian
date: "2005-09-06T09:19:00.000Z"
tags:
  - 数据库
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2005/09/06/231000.html
draft: false
---

打算把一个磁盘上的小图片存到oracle的BLOB字段中，很常见吧，但对我来说是第一次。

     上网找了几个例子，其中有园子里surprise的blog，我ctrl+c/v了上面的例子，如下：

在Oracle中写存储过程



```
1create or replace procedure update_student_clob (

 2              id in number,
 3              file_name in varchar2)
 4       is
 5              b_lob  BLOB;
 6              f_lob   BFILE;
 7       BEGIN
 8              --首先把SPHOTO数据插入空值
 9              Update student set SPHOTO=empty_blob() where STUDENTID=id;
10              --通过SELECT命令查询得到先前插入的记录并锁定
11              SELECT SPHOTO INTO b_lob from student where STUDENTID=id for update;
12              --读取图片文件对象
13              f_lob:=bfilename('bb_images', file_name);
14              --打开图片文件对象
15              dbms_lob.fileopen(f_lob,dbms_lob.file_readonly);
16              --把图片文件对象写入Blob数据中
17              dbms_lob.loadfromfile(b_lob,f_lob,dbms_lob.getlength(f_lob));
18              dbms_lob.fileclose(f_lob);
19
20       END;
```

其中：id代表关键字段id，file_name代表文件名　       bb_images代表目录对象，目录对象创建如下       create directory bb_images as 'd:\kk';

     我把这段存储过程改编成下面的PL/SQL段：

```
1create or replace directory bb_images as 'd:\images';

 2declare
 3  b_lob  BLOB;
 4  f_lob  BFILE := BFILENAME('bb_images','1.bmp');
 5BEGIN
 6  Update IMAGETABLE set IMAGECOL=empty_blob() where IMGID=1;
 7  --通过SELECT命令查询得到先前插入的记录并锁定
 8  SELECT IMAGECOL INTO b_lob from IMAGETABLE where IMGID=1 for update;
 9  --打开图片文件对象
10  dbms_lob.fileopen(f_lob, dbms_lob.file_readonly);
11  --把图片文件对象写入Blob数据中
12  dbms_lob.loadfromfile(b_lob, f_lob, dbms_lob.getlength(f_lob));
13  dbms_lob.fileclose(f_lob);
14END;
```

     结果正如大家所预料的：失败。报错如下：

declare
\*
ERROR 位于第 1 行:
ORA-22285: 对不存在的目录或文件进行FILEOPEN操作
ORA-06512: 在"SYS.DBMS_LOB", line 504
ORA-06512: 在line 10     这个错误，就像编程中其它编译器经常报告大部分错误一样毫无道理，我给的目录和文件当然是存在的。那么问题到底出在哪呢？
     上网找了一下，google上找到了类似的问题，但没有权威的回答，csdn上也是一样，问的就很少，答的更是没有。
     但是我找到了一个号称是可以运行的相同功能PL/SQL段：

```
--------------ORACLE 保存图片
grant create any directory to scott;
grant create any library to scott;
create or replace directory utllobdir as 'd:\oracle';
create table bfile_tab (bfile_column BFILE);
create table utl_lob_test (blob_column BLOB);

set serveroutput on

--然后执行下面语句
--就将d:\oracle目录下的Azul.jpg存入到
--utl_lob_test表中的blob_column字段中了。

declare
   a_blob  BLOB;
   a_bfile BFILE := BFILENAME('UTLLOBDIR','Azul.jpg');
begin
   insert into bfile_tab values (a_bfile)
     returning bfile_column into a_bfile;
   insert into utl_lob_test values (empty_blob())
     returning blob_column into a_blob;
   dbms_lob.fileopen(a_bfile);
   dbms_lob.loadfromfile(a_blob, a_bfile, dbms_lob.getlength(a_bfile));
   dbms_lob.fileclose(a_bfile);
   commit;
end;
```

     这段代码来自csdn，3186489号帖子一位叫freddy2003的回复。令我感到以外又兴奋的是这段代码可以执行成功！多好的代码呀，可是帖主居然就一分都没给freddy2003😞，没错，csdn中的有些发帖者就是这么怪异:-\$     这样我就开始解剖freddy2003的这段代码，缩减、改编到最后变成：

```
1create or replace directory utllobdir as 'd:\images';

 2declare
 3   a_blob  BLOB;
 4   a_bfile BFILE := BFILENAME('UTLLOBDIR','1.bmp');
 5begin
 6   insert into bfile_tab values (a_bfile)
 7     returning bfile_column into a_bfile;
 8   insert into utl_lob_test values (empty_blob())
 9     returning blob_column into a_blob;
10   dbms_lob.fileopen(a_bfile);
11   dbms_lob.loadfromfile(a_blob, a_bfile, dbms_lob.getlength(a_bfile));
12   dbms_lob.fileclose(a_bfile);
13   commit;
14end;
```

     点下执行，居然还是成功！

     再下来的修改就一针刺中要害了：我把第4行中的UTLLOBDIR改成utllobdir，再执行，结果立即变成那个原始的无理由的错误：对不存在的目录或文件进行FILEOPEN操作。

     接下来尝试了将create directory语句中的目录对象名改成大写，没问题。但就是只要在bfilename中使用目录对象的时候如果不用大写就一定会出错。这就怪了，Oracle里PL/SQL语句不是大小写不敏感的么？各位看官能不能帮小弟解释一下这个现象？我也无法认定这到底是Oracle中PL/SQL的一个bug还是一个我不知道的规则。

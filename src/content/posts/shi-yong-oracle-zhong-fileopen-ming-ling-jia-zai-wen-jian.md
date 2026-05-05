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

打算把一个磁盘上的小图片存到oracle的BLOB字段中，很常见吧，但对我来说是第一次。\
\
     上网找了几个例子，其中有园子里surprise的blog，我ctrl+c/v了上面的例子，如下：\
\
<span style="COLOR: #00ccff">在Oracle中写存储过程\
</span>

<div style="BORDER-RIGHT: windowtext 0.5pt solid; PADDING-RIGHT: 5.4pt; BORDER-TOP: windowtext 0.5pt solid; PADDING-LEFT: 5.4pt; BACKGROUND: #e6e6e6; PADDING-BOTTOM: 4px; BORDER-LEFT: windowtext 0.5pt solid; WIDTH: 98%; WORD-BREAK: break-all; PADDING-TOP: 4px; BORDER-BOTTOM: windowtext 0.5pt solid">

<div>

<span style="COLOR: #008080"> 1</span><img src="/Images/OutliningIndicators/None.gif" data-align="top" /><span style="COLOR: #0000ff">create</span><span style="COLOR: #000000"> </span><span style="COLOR: #808080">or</span><span style="COLOR: #000000"> </span><span style="COLOR: #ff00ff">replace</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">procedure</span><span style="COLOR: #000000"> update_student_clob (\
</span><span style="COLOR: #008080"> 2</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />              id </span><span style="COLOR: #808080">in</span><span style="COLOR: #000000"> </span><span style="FONT-WEIGHT: bold; COLOR: #000000">number</span><span style="COLOR: #000000">,\
</span><span style="COLOR: #008080"> 3</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />              </span><span style="COLOR: #ff00ff">file_name</span><span style="COLOR: #000000"> </span><span style="COLOR: #808080">in</span><span style="COLOR: #000000"> </span><span style="FONT-WEIGHT: bold; COLOR: #000000">varchar2</span><span style="COLOR: #000000">)\
</span><span style="COLOR: #008080"> 4</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />       </span><span style="COLOR: #0000ff">is</span><span style="COLOR: #000000"> \
</span><span style="COLOR: #008080"> 5</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />              b_lob  BLOB;\
</span><span style="COLOR: #008080"> 6</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />              f_lob   BFILE;\
</span><span style="COLOR: #008080"> 7</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />       </span><span style="COLOR: #0000ff">BEGIN</span><span style="COLOR: #000000">\
</span><span style="COLOR: #008080"> 8</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />              </span><span style="COLOR: #008080">--</span><span style="COLOR: #008080">首先把SPHOTO数据插入空值</span><span style="COLOR: #008080">\
</span><span style="COLOR: #008080"> 9</span><span style="COLOR: #008080"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #000000">              </span><span style="COLOR: #0000ff">Update</span><span style="COLOR: #000000"> student </span><span style="COLOR: #0000ff">set</span><span style="COLOR: #000000"> SPHOTO</span><span style="COLOR: #808080">=</span><span style="COLOR: #000000">empty_blob() </span><span style="COLOR: #0000ff">where</span><span style="COLOR: #000000"> STUDENTID</span><span style="COLOR: #808080">=</span><span style="COLOR: #000000">id;\
</span><span style="COLOR: #008080">10</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />              </span><span style="COLOR: #008080">--</span><span style="COLOR: #008080">通过SELECT命令查询得到先前插入的记录并锁定</span><span style="COLOR: #008080">\
</span><span style="COLOR: #008080">11</span><span style="COLOR: #008080"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #000000">              </span><span style="COLOR: #0000ff">SELECT</span><span style="COLOR: #000000"> SPHOTO </span><span style="COLOR: #0000ff">INTO</span><span style="COLOR: #000000"> b_lob </span><span style="COLOR: #0000ff">from</span><span style="COLOR: #000000"> student </span><span style="COLOR: #0000ff">where</span><span style="COLOR: #000000"> STUDENTID</span><span style="COLOR: #808080">=</span><span style="COLOR: #000000">id </span><span style="COLOR: #0000ff">for</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">update</span><span style="COLOR: #000000">;\
</span><span style="COLOR: #008080">12</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />              </span><span style="COLOR: #008080">--</span><span style="COLOR: #008080">读取图片文件对象</span><span style="COLOR: #008080">\
</span><span style="COLOR: #008080">13</span><span style="COLOR: #008080"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #000000">              f_lob:</span><span style="COLOR: #808080">=</span><span style="COLOR: #000000">bfilename(</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #ff0000">bb_images</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #000000">, </span><span style="COLOR: #ff00ff">file_name</span><span style="COLOR: #000000">);\
</span><span style="COLOR: #008080">14</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />              </span><span style="COLOR: #008080">--</span><span style="COLOR: #008080">打开图片文件对象</span><span style="COLOR: #008080">\
</span><span style="COLOR: #008080">15</span><span style="COLOR: #008080"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #000000">              dbms_lob.fileopen(f_lob,dbms_lob.file_readonly);\
</span><span style="COLOR: #008080">16</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />              </span><span style="COLOR: #008080">--</span><span style="COLOR: #008080">把图片文件对象写入Blob数据中</span><span style="COLOR: #008080">\
</span><span style="COLOR: #008080">17</span><span style="COLOR: #008080"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #000000">              dbms_lob.loadfromfile(b_lob,f_lob,dbms_lob.getlength(f_lob));\
</span><span style="COLOR: #008080">18</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />              dbms_lob.fileclose(f_lob);\
</span><span style="COLOR: #008080">19</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />\
</span><span style="COLOR: #008080">20</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />       </span><span style="COLOR: #0000ff">END</span><span style="COLOR: #000000">;</span>

</div>

</div>

其中：id代表关键字段id，file_name代表文件名　

       bb_images代表目录对象，目录对象创建如下

       create directory bb_images as 'd:\kk';

     我把这段存储过程改编成下面的PL/SQL段：

<div style="BORDER-RIGHT: windowtext 0.5pt solid; PADDING-RIGHT: 5.4pt; BORDER-TOP: windowtext 0.5pt solid; PADDING-LEFT: 5.4pt; BACKGROUND: #e6e6e6; PADDING-BOTTOM: 4px; BORDER-LEFT: windowtext 0.5pt solid; WIDTH: 98%; WORD-BREAK: break-all; PADDING-TOP: 4px; BORDER-BOTTOM: windowtext 0.5pt solid">

<div>

<span style="COLOR: #008080"> 1</span><img src="/Images/OutliningIndicators/None.gif" data-align="top" /><span style="COLOR: #0000ff">create</span><span style="COLOR: #000000"> </span><span style="COLOR: #808080">or</span><span style="COLOR: #000000"> </span><span style="COLOR: #ff00ff">replace</span><span style="COLOR: #000000"> directory bb_images </span><span style="COLOR: #0000ff">as</span><span style="COLOR: #000000"> </span><span style="COLOR: #ff0000">'</span><span style="COLOR: #ff0000">d:\images</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #000000">;\
</span><span style="COLOR: #008080"> 2</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">declare</span><span style="COLOR: #000000">\
</span><span style="COLOR: #008080"> 3</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />  b_lob  BLOB;\
</span><span style="COLOR: #008080"> 4</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />  f_lob  BFILE :</span><span style="COLOR: #808080">=</span><span style="COLOR: #000000"> BFILENAME(</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #ff0000">bb_images</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #000000">,</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #ff0000">1.bmp</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #000000">);\
</span><span style="COLOR: #008080"> 5</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">BEGIN</span><span style="COLOR: #000000">\
</span><span style="COLOR: #008080"> 6</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />  </span><span style="COLOR: #0000ff">Update</span><span style="COLOR: #000000"> IMAGETABLE </span><span style="COLOR: #0000ff">set</span><span style="COLOR: #000000"> IMAGECOL</span><span style="COLOR: #808080">=</span><span style="COLOR: #000000">empty_blob() </span><span style="COLOR: #0000ff">where</span><span style="COLOR: #000000"> IMGID</span><span style="COLOR: #808080">=</span><span style="FONT-WEIGHT: bold; COLOR: #800000">1</span><span style="COLOR: #000000">;\
</span><span style="COLOR: #008080"> 7</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />  </span><span style="COLOR: #008080">--</span><span style="COLOR: #008080">通过SELECT命令查询得到先前插入的记录并锁定</span><span style="COLOR: #008080">\
</span><span style="COLOR: #008080"> 8</span><span style="COLOR: #008080"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #000000">  </span><span style="COLOR: #0000ff">SELECT</span><span style="COLOR: #000000"> IMAGECOL </span><span style="COLOR: #0000ff">INTO</span><span style="COLOR: #000000"> b_lob </span><span style="COLOR: #0000ff">from</span><span style="COLOR: #000000"> IMAGETABLE </span><span style="COLOR: #0000ff">where</span><span style="COLOR: #000000"> IMGID</span><span style="COLOR: #808080">=</span><span style="FONT-WEIGHT: bold; COLOR: #800000">1</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">for</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">update</span><span style="COLOR: #000000">;\
</span><span style="COLOR: #008080"> 9</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />  </span><span style="COLOR: #008080">--</span><span style="COLOR: #008080">打开图片文件对象</span><span style="COLOR: #008080">\
</span><span style="COLOR: #008080">10</span><span style="COLOR: #008080"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #000000">  dbms_lob.fileopen(f_lob, dbms_lob.file_readonly);\
</span><span style="COLOR: #008080">11</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />  </span><span style="COLOR: #008080">--</span><span style="COLOR: #008080">把图片文件对象写入Blob数据中</span><span style="COLOR: #008080">\
</span><span style="COLOR: #008080">12</span><span style="COLOR: #008080"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #000000">  dbms_lob.loadfromfile(b_lob, f_lob, dbms_lob.getlength(f_lob));\
</span><span style="COLOR: #008080">13</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />  dbms_lob.fileclose(f_lob);\
</span><span style="COLOR: #008080">14</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">END</span><span style="COLOR: #000000">;</span>

</div>

</div>

\
     结果正如大家所预料的：失败。报错如下：

declare\
\*\
ERROR 位于第 1 行:\
ORA-22285: 对不存在的目录或文件进行FILEOPEN操作\
ORA-06512: 在"SYS.DBMS_LOB", line 504\
ORA-06512: 在line 10\
\
     这个错误，就像编程中其它编译器经常报告大部分错误一样毫无道理，我给的目录和文件当然是存在的。那么问题到底出在哪呢？\
     上网找了一下，google上找到了类似的问题，但没有权威的回答，csdn上也是一样，问的就很少，答的更是没有。\
     但是我找到了一个号称是可以运行的相同功能PL/SQL段：\
\

<div style="BORDER-RIGHT: windowtext 0.5pt solid; PADDING-RIGHT: 5.4pt; BORDER-TOP: windowtext 0.5pt solid; PADDING-LEFT: 5.4pt; BACKGROUND: #e6e6e6; PADDING-BOTTOM: 4px; BORDER-LEFT: windowtext 0.5pt solid; WIDTH: 98%; WORD-BREAK: break-all; PADDING-TOP: 4px; BORDER-BOTTOM: windowtext 0.5pt solid">

<div>

<img src="/Images/OutliningIndicators/None.gif" data-align="top" /><span style="COLOR: #008080">--</span><span style="COLOR: #008080">------------ORACLE 保存图片</span><span style="COLOR: #008080">\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">grant</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">create</span><span style="COLOR: #000000"> </span><span style="COLOR: #808080">any</span><span style="COLOR: #000000"> directory </span><span style="COLOR: #0000ff">to</span><span style="COLOR: #000000"> scott;\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">grant</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">create</span><span style="COLOR: #000000"> </span><span style="COLOR: #808080">any</span><span style="COLOR: #000000"> library </span><span style="COLOR: #0000ff">to</span><span style="COLOR: #000000"> scott;\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">create</span><span style="COLOR: #000000"> </span><span style="COLOR: #808080">or</span><span style="COLOR: #000000"> </span><span style="COLOR: #ff00ff">replace</span><span style="COLOR: #000000"> directory utllobdir </span><span style="COLOR: #0000ff">as</span><span style="COLOR: #000000"> </span><span style="COLOR: #ff0000">'</span><span style="COLOR: #ff0000">d:\oracle</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #000000">;\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">create</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">table</span><span style="COLOR: #000000"> bfile_tab (bfile_column BFILE);\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">create</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">table</span><span style="COLOR: #000000"> utl_lob_test (blob_column BLOB);\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">set</span><span style="COLOR: #000000"> serveroutput </span><span style="COLOR: #0000ff">on</span><span style="COLOR: #000000">\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #008080">--</span><span style="COLOR: #008080">然后执行下面语句</span><span style="COLOR: #008080">\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />--</span><span style="COLOR: #008080">就将d:\oracle目录下的Azul.jpg存入到</span><span style="COLOR: #008080">\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />--</span><span style="COLOR: #008080">utl_lob_test表中的blob_column字段中了。</span><span style="COLOR: #008080">\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #000000">\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">declare</span><span style="COLOR: #000000">\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />   a_blob  BLOB;\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />   a_bfile BFILE :</span><span style="COLOR: #808080">=</span><span style="COLOR: #000000"> BFILENAME(</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #ff0000">UTLLOBDIR</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #000000">,</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #ff0000">Azul.jpg</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #000000">);\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">begin</span><span style="COLOR: #000000">\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />   </span><span style="COLOR: #0000ff">insert</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">into</span><span style="COLOR: #000000"> bfile_tab </span><span style="COLOR: #0000ff">values</span><span style="COLOR: #000000"> (a_bfile)\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />     returning bfile_column </span><span style="COLOR: #0000ff">into</span><span style="COLOR: #000000"> a_bfile;\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />   </span><span style="COLOR: #0000ff">insert</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">into</span><span style="COLOR: #000000"> utl_lob_test </span><span style="COLOR: #0000ff">values</span><span style="COLOR: #000000"> (empty_blob())\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />     returning blob_column </span><span style="COLOR: #0000ff">into</span><span style="COLOR: #000000"> a_blob;\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />   dbms_lob.fileopen(a_bfile);\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />   dbms_lob.loadfromfile(a_blob, a_bfile, dbms_lob.getlength(a_bfile));\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />   dbms_lob.fileclose(a_bfile);\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" />   </span><span style="COLOR: #0000ff">commit</span><span style="COLOR: #000000">;\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">end</span><span style="COLOR: #000000">;</span>

</div>

</div>

     这段代码来自csdn，3186489号帖子一位叫freddy2003的回复。令我感到以外又兴奋的是这段代码可以执行成功！多好的代码呀，可是帖主居然就一分都没给freddy2003<img src="/Emoticons/emsad.gif" data-align="absMiddle" data-border="0" />，没错，csdn中的有些发帖者就是这么怪异:-\$\
\
     这样我就开始解剖freddy2003的这段代码，缩减、改编到最后变成：\

<div style="BORDER-RIGHT: windowtext 0.5pt solid; PADDING-RIGHT: 5.4pt; BORDER-TOP: windowtext 0.5pt solid; PADDING-LEFT: 5.4pt; BACKGROUND: #e6e6e6; PADDING-BOTTOM: 4px; BORDER-LEFT: windowtext 0.5pt solid; WIDTH: 98%; WORD-BREAK: break-all; PADDING-TOP: 4px; BORDER-BOTTOM: windowtext 0.5pt solid">

<div>

<span style="COLOR: #008080"> 1</span><img src="/Images/OutliningIndicators/None.gif" data-align="top" /><span style="COLOR: #0000ff">create</span><span style="COLOR: #000000"> </span><span style="COLOR: #808080">or</span><span style="COLOR: #000000"> </span><span style="COLOR: #ff00ff">replace</span><span style="COLOR: #000000"> directory utllobdir </span><span style="COLOR: #0000ff">as</span><span style="COLOR: #000000"> </span><span style="COLOR: #ff0000">'</span><span style="COLOR: #ff0000">d:\images</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #000000">;\
</span><span style="COLOR: #008080"> 2</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">declare</span><span style="COLOR: #000000">\
</span><span style="COLOR: #008080"> 3</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />   a_blob  BLOB;\
</span><span style="COLOR: #008080"> 4</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />   a_bfile BFILE :</span><span style="COLOR: #808080">=</span><span style="COLOR: #000000"> BFILENAME(</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #ff0000">UTLLOBDIR</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #000000">,</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #ff0000">1.bmp</span><span style="COLOR: #ff0000">'</span><span style="COLOR: #000000">);\
</span><span style="COLOR: #008080"> 5</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">begin</span><span style="COLOR: #000000">\
</span><span style="COLOR: #008080"> 6</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />   </span><span style="COLOR: #0000ff">insert</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">into</span><span style="COLOR: #000000"> bfile_tab </span><span style="COLOR: #0000ff">values</span><span style="COLOR: #000000"> (a_bfile)\
</span><span style="COLOR: #008080"> 7</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />     returning bfile_column </span><span style="COLOR: #0000ff">into</span><span style="COLOR: #000000"> a_bfile;\
</span><span style="COLOR: #008080"> 8</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />   </span><span style="COLOR: #0000ff">insert</span><span style="COLOR: #000000"> </span><span style="COLOR: #0000ff">into</span><span style="COLOR: #000000"> utl_lob_test </span><span style="COLOR: #0000ff">values</span><span style="COLOR: #000000"> (empty_blob())\
</span><span style="COLOR: #008080"> 9</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />     returning blob_column </span><span style="COLOR: #0000ff">into</span><span style="COLOR: #000000"> a_blob;\
</span><span style="COLOR: #008080">10</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />   dbms_lob.fileopen(a_bfile);\
</span><span style="COLOR: #008080">11</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />   dbms_lob.loadfromfile(a_blob, a_bfile, dbms_lob.getlength(a_bfile));\
</span><span style="COLOR: #008080">12</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />   dbms_lob.fileclose(a_bfile);\
</span><span style="COLOR: #008080">13</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" />   </span><span style="COLOR: #0000ff">commit</span><span style="COLOR: #000000">;\
</span><span style="COLOR: #008080">14</span><span style="COLOR: #000000"><img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span><span style="COLOR: #0000ff">end</span><span style="COLOR: #000000">;</span>

</div>

</div>

\
     点下执行，居然还是成功！\
\
     再下来的修改就一针刺中要害了：我把第4行中的UTLLOBDIR改成utllobdir，再执行，结果立即变成那个原始的无理由的错误：对不存在的目录或文件进行FILEOPEN操作。

     接下来尝试了将create directory语句中的目录对象名改成大写，没问题。但就是只要在bfilename中使用目录对象的时候如果不用大写就一定会出错。这就怪了，Oracle里PL/SQL语句不是大小写不敏感的么？各位看官能不能帮小弟解释一下这个现象？我也无法认定这到底是Oracle中PL/SQL的一个bug还是一个我不知道的规则。\

---
title: vc6下使用MOIMS的IMSUtil类型库
slug: vc6-xia-shi-yong-moims-de-imsutil-lei-xing-ku
date: "2005-11-15T23:12:00.000Z"
tags:
  - GIS
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2005/11/16/277320.html
draft: false
---

一般不大愿意转载，但今天这个确实帮了我大忙。\
\
        <a href="http://www.gisworkshop.com/vc_ims_tutorial.html" style="COLOR: #008080">http://www.gisworkshop.com/vc_ims_tutorial.html</a>\
\
    一直在使用VC6+MOIMS开发CGI模式的WebGIS系统，但却始终不知道在vc6中如何使用IMSUtil.dll类型库。今天出现了一个很怪异的问题：我写的mapservice单独运行一切正常，静态测试完全通过，但将其拖入IMS Admin中却会失败，连启动时的静态测试代码都过不去，真是诡异至极。分析原因大概是从配置文件appconfig.ini中读取一些参数的时候出的问题，当程序中的GetPrivateProfileString(...)传入appconfig.ini的绝对完整路径时，就不会出现问题，而把路径改为".\\appconfig.ini"相对路径就会完蛋，又不能动态调试，所以十分郁闷，无奈之下考虑使用IMSUtil。过去一直以为vc6下面用不了这个东西，今天上ESRI论坛翻腾了一下，找到了上面那个链接，把问题解决了。不过这个例子是for ArcIMS的，使用MOIMS的时候要稍微改一下：\
\

<div style="BORDER-RIGHT: #cccccc 1px solid; PADDING-RIGHT: 5px; BORDER-TOP: #cccccc 1px solid; PADDING-LEFT: 4px; FONT-SIZE: 13px; PADDING-BOTTOM: 4px; BORDER-LEFT: #cccccc 1px solid; WIDTH: 98%; WORD-BREAK: break-all; PADDING-TOP: 4px; BORDER-BOTTOM: #cccccc 1px solid; BACKGROUND-COLOR: #eeeeee">

<img src="/Images/OutliningIndicators/None.gif" data-align="top" /><span style="COLOR: #000000">m_regparams.SetHostURL(</span><span style="COLOR: #000000">"</span><span style="COLOR: #000000">http://\<your IP\>/scripts/esrimap.dll</span><span style="COLOR: #000000">"</span><span style="COLOR: #000000">);\
<img src="/Images/OutliningIndicators/None.gif" data-align="top" /></span>

</div>

\
    就可以了

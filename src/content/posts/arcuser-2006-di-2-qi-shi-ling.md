---
title: ArcUser 2006第2期拾零
slug: arcuser-2006-di-2-qi-shi-ling
date: "2006-09-10T18:27:00.000Z"
tags:
  - GIS
  - 读书笔记
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2006/09/10/500380.html
draft: false
---

前天收到了上半年的两期ArcUser，其中第二期的主题是Imagery In GIS。这一期的“聚焦”是“Using Imagery”，其中包含5篇文章：

<span style="FONT-SIZE: 10pt; FONT-FAMILY: Comic Sans MS">**Leverage Imagery in ArcGIS

Mobile GIS and Digital Photomapping
The Key to the Present is the Past
Understanding Remotely Sensed Data
CASI Data Provides Better Picture of Coral Reef Threats**</span>

    这里拣里面的三篇大致介绍一下：

<span style="FONT-FAMILY: Comic Sans MS">**    Leverage Imagery in ArcGIS**</span>用6段文字介绍了一些关于栅格影像数据的基本知识，剩下的全部篇幅就都是介绍如何利用ArcGIS平台中的各个组件来存储、管理、处理、分析和发布影像数据，讲的都不深入，点到为止。其中只有一句话引起我的注意：“ArcGIS improves data management by storing raster and vector data types within the same framework.”我还不太清楚是不是在最新的ArcGIS9.x中已经实现了在“同一个框架内存储栅格和矢量数据”，但看文章最后提到的进一步参考里面，有“Storing Raster Data in an ArcSDE Geodatabase”这么个东西，开始我还以为是篇文章，后来找到ESRI Virtual Campus上才发现这是个3小时的视频课程，需要\$30才能看。而在课程简介中提到的软件需求是ArcEditor/ArcInfo8.2以上和ArcSDE8.2以上，这我就觉得奇怪了，我一直用的是ArcSDE8.3，它的确能够管理影像数据，但绝对达不到说是能够达到与矢量数据采用“同一个框架”的程度。是ESRI又在吹牛吗？矢栅一体化的路还很长啊。

<span style="FONT-FAMILY: Comic Sans MS">**    The Key to the Present is the Past**</span>针对影像数据多时相的特点，介绍了一个在Pierce County, Washington应用的名为“Ortho Viewer”的WebGIS系统，其主要看点就是能够对同一区域不同时间的影像进行浏览，可以方便的看出一个地点历史的变迁，用于支持政府的决策等。

    Pierce County这个县拥有超过700个地理数据集，其中大部分都是影像数据。这些覆盖同一个区域，但却具有不同年份，不同波段，不同拍摄高度和拍摄焦距，不同分辨率以及不同地形模型（包括Lidar和30米USGS DEM）的影像数据需要被有效集成，然后在一个统一的界面上进行发布。
文章分别介绍了Ortho Viewer的界面设计、开发原型和一部分具体实现细节。
这个系统下面采用ArcSDE for SQL Server存储影像数据，中间是ColdFusion MX作为应用服务器，最上是ArcIMS发布地图。它的ArcIMS9运行在IBM的刀片服务器上以保证性能。基于ColdFusion MX的Web应用采用了Mach-II框架，使得软件的架构更加简洁和可维护。业务逻辑的代码被编写为可重用的ColdFusion组件。此外，系统采用了ESRI Java Connector实现在ColdFusion MX应用服务器和ArcIMS之间的通信。
    这篇文章算是给出了一个采用ESRI产品的以发布影像数据为主要功能的WebGIS设计案例，可惜它不是个Internet应用，而只是个Intranet应用，所以见不到它的真面目。个人觉得这个系统中的影像数据量应该不算大，不知道如果数据量上到百GB～TB，这个架构还能不能用。

<span style="FONT-FAMILY: Comic Sans MS">**    Understanding Remotely Sensed Data**</span>是个豆腐块广告，推荐的是ESRI Press出版的《Remote Sensing for GIS managers》。这本书作者Stan Aronoff，2005年出版，524页，里面有大量的彩色遥感影像插图，所以估计价格不菲。

    广告中说这本书从GIS的角度出发，介绍了遥感的方法、历史及其在农业、林业、商业、军事和城市规划等领域的应用。此外，它还以真实的案例讲解了遥感技术是如何支持城市建设，资源编目与管理，国家安全以及其它学科的研究。
    从广告上看，这是本偏重于对应用层介绍的书，对原理和机制的深入探讨恐怕不多。

    ArcUser所有文章全文都能够从ESRI的网站上在线阅读，这一期在[这里](http://www.esri.com/news/arcuser/0506/spring2006.html)。其实现在[第三期](http://www.esri.com/news/arcuser/0706/summer2006.html)也已经上线。

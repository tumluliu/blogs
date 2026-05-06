---
title: 浅入浅出Oracle Spatial GeoRaster 10g影像数据管理(1)——数据模型
slug: qian-ru-qian-chu-oracle-spatial-georaster-10g-ying-xiang
date: "2006-04-13T21:39:00.000Z"
tags:
  - Oracle10g GeoRaster影像数据管理
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/articles/374754.html
draft: false
---

GeoRaster是Oracle Spatial在升级到10g之后新增的一个部分。它使得Oracle Spatial具有了存储、索引、查询、分析和发布栅格数据的能力。GeoRaster数据在Oracle的文档中定义为栅格影像（raster image）和网格数据（gridded data），以及与它们相关联的元数据（metadata）。GeoRaster提供了Oracle Spatial的数据类型和实体－关系模式（object-relational schema）。用户可以直接使用这些数据类型和模式对象来存储带有地理坐标的栅格数据。GeoRaster还提供了一系列非常丰富的配套函数以支持对影像的处理。
    所以可以说GeoRaster使得Oracle具备了在不用ArcSDE这种空间数据引擎的情况下也能存储和处理栅格数据的能力。那么GeoRaster是如何管理存储在其中的栅格数据，特别是海量遥感影像数据的呢？它采用了什么策略？基于什么数据结构？构建了什么形式的索引？与ArcSDE相比，有什么区别和改进？效率如何？有多少提高？我就是带着这些问题开始研究GeoRaster的。
    要研究只能得先看看Oracle官方的文档，具体到本文，就是[Oracle Spatial GeoRaster, 10g Release 2 (10.2) User's Guide and Reference](http://www.oracle.com/technology/documentation/spatial.html)，文档编号B14254-01，发布时间为2005年6月。这份文档240多页，后面大部分都是函数手册，所以主要看前面80页就够了，再刨去前言版权等等废话，需要精读的部分一共59页。本文可以看作是这59页的读书笔记，纯是纸上谈兵，因为Oracle 10g我虽然下下来了，但还没装……
这个系列的文章打算写“数据模型”、“物理存储”、“地理参考”和“索引结构”最后会再做两个实验放上来，重点在比较基于GeoRaster和基于ArcSDE for Oracle之间的差别。另外为了方便，也是因为专业关系，顺口起见，本文中“栅格数据”（raster data）有时可能也会称为“影像数据”（image data，geoimage data，geoimagery data），they are interchangeable in this article.
    OK，言归正传

------------------------------------------------------------------------

**0.基本概念**

矢量数据（vector data）和栅格数据（raster data）：空间数据（spatial data）的两种表现形式，除了他俩以外，其实还有不规则三角网数据（TIN data）、网络数据（network data）以及拓扑数据（topology data）
栅格数据的来源：遥感（Remote Sensing，RS），摄影测量（photogrammetry），地理信息系统（GIS），制图学（cartography），数字图像处理（digital image processing），地质学（geology），地球物理学（geophysics），地球化学（geochemistry）

**1.基本数据结构**

    栅格数据的基本数据结构就是像素矩阵，它应该具备下面六个基本要素（或其中的几个）
·像素
·空间范围（或地理覆盖范围，覆盖区）
·空间、时间、波段参考信息
·像素属性
·元数据
·处理数据和地图支撑数据（processing data and map support data）
    GeoRaster使用的仍然是这种一般的、通用的栅格数据模型，但在文档中，Oracle说GeoRaster的模型是基于构件的（component-based，component译为“构件”，下同）、逻辑上分层的（logically layered）和多维的（multidimentional）。刚开始看的时候，我只能理解后两点。他说GeoRaster是基于component的，我就不明白了，是指在使用它的时候可以像使用COM或者JavaBeans一样？还是指GeoRaster的开发用到了JavaBeans？后来在后面终于找到了出处，具体解释放在下面关于元数据的讨论中。另外，关于“多维”的理解，看过后面之后觉得他指的就是除去行、列以外的波段（或者说层次、时相）这个维度。
    矩阵中的像素具有深度值，它定义了每个像素的数据长度，并且对矩阵中的每一个像素，这个值是一致的。这种基本数据结构决定了栅格数据集可以被分块，数据存储和提取的最优化都会用到分块。这里其实道出了处理海量影像数据的一个基本策略，就是“分块，再分块”，这其实源于“分治”（divide and conquer）的思想。因为在实际应用中恐怕没有哪个用户会动辄使用成百上千个GB的原始影像，更多的应用一般都是关注于一个相对较小的区域甚至是某个重要目标的某个时刻的、某种类型的某种分辨率的图像。因此拼接（mosaic）这种动作并不应该出现在基础数据库的构建时刻，而是应该推迟到响应查询的时刻再进行。

**2.逻辑分层的结构**

    栅格数据可以在逻辑上划分成若干个层（layer）。GeoRaster之所以要提供这种结构作为数据模型的一部分是因为实际应用中的栅格数据可能会有多个波段（band），例如多通道遥感影像就包含了许多个波段，“层”就是为了应对多波段栅格数据而设计的。在这个版本的GeoRaster中，每个层就是一个二维像素矩阵。层是逻辑上的概念，而波段是物理上的概念。~~但是这里要注意，一个波段未必就对应一个层，有可能是多个波段的数据被包含在一个层中，这不是死的，可以根据实际需要在数据入库的时候自己决定。~~最常见的情况是可见光全色影像数据，分为R、G、B三个波段，以三个不同的层存储，如图1所示：

<img src="/posts/qian-ru-qian-chu-oracle-spatial-georaster-10g-ying-xiang/img-1.jpg" data-border="0" width="330" height="292" />

    图1

**3.元数据**

    GeoRaster数据的每个层都可以有自己的元数据和属性。那什么是元数据呢？文档中说：“在GeoRaster的数据模型中，除了像素数据以外的其它数据就是GeoRaster元数据”。然后它又说：“GeoRaster的元数据被进一步的分解为许多不同的构件（component）”，并在这里打个括号做出解释：and is thus called component-based，这就是前面说GeoRaster数据模型是“基于构件”的原因，但我还是觉得比较牵强，暂且认为它这里的component和面向对象软件重用中的component的概念不同吧。
    栅格数据的左上角（upper-left corner, or ULTCoordinate）像素坐标不一定是像素坐标的原点（0,0），它的具体值是通过元数据中给出的。像素矩阵中任一像素的坐标都是相对于原点的，不是相对于ULTCoordinate的。这我也有个问题：那么对一幅影像而言哪里才是像素坐标原点呢？另外，原文在这里还说：如果存在波段分量，那么ULTCoordinate的值就总是（row,column,0）。这又是为什么？波段坐标分量怎么能“总是”0呢？
    GeoRaster元数据包含以下六类信息：
·对象信息
·栅格信息
·空间参考系信息
·时间参考系信息
·波段参考系信息
·每层的层信息
    基于这种数据模型，GeoRaster对象就可以由GeoRaster的元数据XML schema来描述。在这个schema中包含了很多的所谓构件和子构件，它们有的是必须的，有的是可选的。如果要开发基于GeoRaster的应用，比如loader，exporter等等就一定要懂这个schema。此外，这个XML schema还可以扩展，加入自己定义的元数据，“X”ML嘛，理所应当具备eXtensible的能力。当然，扩展也要符合规范，俗话说“纪律是块铁，谁碰谁流血”，SDO_GEOR.validateGeoraster函数就是用来检验元数据有效性的。

**4.两种坐标系**

    像素坐标系（在原文中对应cell/pixel coorinate system，或raster space，都是一个意思）和地理坐标系（在原文中对应model/ground coordinate system，或model space，也都是一个意思）。前者是像素在像素矩阵中的位置，依次包含行、列和波段三个坐标分量；后者是与像素对应的实际地理位置的大地坐标，地理坐标系并不唯一，可能是经纬度，也可能是其它能与Oracle SRID值对应上的某种坐标系，它依次包含X和Y两个坐标分量。地理坐标系的X和Y分别对应于像素坐标系中的列和行，逻辑层对应于波段。这里有个问题，看原文的描述给人感觉好像“逻辑层”应该是地理坐标系中的概念，而实际却并不是这样。引入层和波段的概念，或者说为矩阵加入第三个坐标分量的目的应该是能更灵活的处理多波段、多时相的影像，而这个所谓“band dimension”的坐标轴既可以表示波段，也可以表示时间，就看实际需要了。

<img src="/posts/qian-ru-qian-chu-oracle-spatial-georaster-10g-ying-xiang/img-2.jpg" data-border="0" />

        图2
    这个图是从原文档中copy过来的，很能说明问题：右边的大矩形是实际地理区域，左边Image下面的矩形是右边地理区域的影像，图中清楚的表示出了它们各自的坐标系统以及要素之间的对应关系。应该不需要太多解释吧。
    栅格数据的左上角（upper-left corner, or ULTCoordinate）像素坐标不一定是像素坐标的原点（0,0），它的具体值是通过元数据中给出的。像素矩阵中任一像素的坐标都是相对于原点的，不是相对于ULTCoordinate的。这我也有个问题：那么对一幅影像而言哪里才是像素坐标原点呢？另外，原文在这里还说：如果存在波段分量，那么ULTCoordinate的值就总是（row,column,0）。这又是为什么？波段坐标分量怎么能“总是”0呢？
    对于二维单层的栅格数据，像素坐标系的列坐标取向右为正方向，行坐标取向下为正方向（如图1所示），一个像素点的坐标就以它的整数的行号和列号来表示（column, row）。对于多波段影像，如果应用需要对其中单个波段的数据进行处理，那么这时利用GeoRaster提供的波段坐标轴将原始影像建模成多层像素矩阵就是很自然的事情。但是，谁也没说多波段影像就必须得拆成多层来存储，更没有谁说过多层模型就是专为多波段影像准备的。对于多时相的影像，同样可以利用这第三个坐标轴来为其构件多层模型（如图2所示）。

<img src="/posts/qian-ru-qian-chu-oracle-spatial-georaster-10g-ying-xiang/img-3.jpg" data-border="0" />

        图3    其实就我的经验，就算原始影像是多波段的，而如果应用需求中根本不需要提取其中的单个波段数据，那么这时仍然将它强行拆成多层存储就是一件很愚蠢的事情，会给后面的数据提取带来很多麻烦，我过去做基于ArcSDE的应用就是这个感觉。所以在从这点来看，GeoRaster似乎要比ArcSDE Raster Map/Catalog灵活一点。
    目前这个版本的GeoRaster只能支持带有行、列和波段三个维度，三个坐标轴的像素坐标系，这对于大部分应用来说应该也够了。而对于多波段、多时相，而且各个波段要分开处理的影像，GeoRaster的数据模型虽然并没有直接提供支持这种四维影像的基础数据结构，但也是能够应付的，只是会复杂一些。
    对于地理坐标系，GeoRaster目前也只支持二维的。像素坐标系与地理坐标系之间的映射通过GeoRaster定义的三种参考系来实现，这里只简单列举一下，详细的映射算法放到地理参考（Georeferencing）一节来说。
·空间参考系（spatial reference system, SRS）
·时间参考系（temporal reference system, TRS）
·波段参考系（band reference system, BRS）
    这些参考系都在GeoRaster元数据XML schema中有完整的或部分的定义。原文在这里再次强调目前GeoRaster的SRS只支持二维坐标映射，也就是从地理的（X,Y）到像素的（column, row），或反过来。TRS和BRS都是可以用的。

**5.小结**

    GeoRaster为栅格数据建立的模型仍然是传统的像素矩阵模型，但它为像素的行、列以外的第三个坐标分量赋予了更灵活的职责，它既可以作为多波段影像的波段分量，也可以作为多时相数据的时间分量。

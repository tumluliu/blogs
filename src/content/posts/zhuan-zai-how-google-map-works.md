---
title: "[转载]How Google Map Works"
slug: zhuan-zai-how-google-map-works
date: "2007-02-11T15:59:00.000Z"
tags:
  - GIS
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2007/02/11/647561.html
draft: false
---

一篇介绍Google Map工作原理的文章，很不错，从[老马](http://www.3snews.net/?mars)的blog上翻出来的，特此致谢！<span id="intelliTXT">  </span>

### Introduction

This is my analyse about how <a href="javascript:;" onclick="javascript:tagshow(event, &#39;google&#39;);" target="_self"><u><strong>google</strong></u></a> <a href="javascript:;" onclick="javascript:tagshow(event, &#39;map&#39;);" target="_self"><u><strong>map</strong></u></a> works, et specially how the tiles are encoded. Google map uses pre-rendered tiles that can be obtained with a simple url. This article explains how to build the url for a tile from its geo coordinates (latitude/longitude)

### Map Tile Encoding

Google map uses two differents algorithms to encode the location of the tiles.

For Google map, the url of a tile looks like : http://mt1.google.com/mt?n=404&v=w2.12&x=130&y=93&zoom=9 using x and Y for the tile coordinates, and a zoom factor. The zoom factor goes from 17 (fully zoomed out) to 0 (maximum definition). At a factor 17, the whole earth is in one tile where x=0 and y=0. At a factor 16, the earth is divided in 2x2 parts, where 0\<=x\<=1 and 0\<=y\<=1. and at each zoom step, each tile is divided into 4 parts. So at a zoom factor Z, the number of horizontal and vertical tiles is 2^(17-z)

#### Algorithm : to find a tile from a latitude, a longitude and a zoom factor :

```
//correct the latitude to go from 0 (north) to 180 (south),
// instead of 90(north) to -90(south)
latitude=90-latitude;

//correct the longitude to go from 0 to 360
longitude=180+longitude;

//find tile size from zoom level
double latTileSize=180/(pow(2,(17-zoom)));
double longTileSize=360/(pow(2,(17-zoom)));

//find the tile coordinates
int tilex=(int)(longitude/longTileSize);
int tiley=(int)(latitude/latTileSize);
```

In fact this algorithm is theorical as the covered zone doesn't match the whole globe.

#### Servers :

google uses 4 servers to balance the load. these are mt0, mt1, mt2 and mt3.

#### Tile size :

each tile is a 256x256 png picture.

### For satellite Images, the encoding is a bit different.

the url looks like : <http://kh0.google.com/kh?n=404&v=8(rib06注：这里已经可以是14了)&t=trtqtt> the 't' parametres encodes the image location. The length of the parametre indicates a zoom level.

To see the whole globe, just use 't=t'. This gives a single tile representing the earth. For the next zoom level, this tile is divided into 4 quadrants, called, clockwise from top left : 'q' 'r' 's' and 't'. To see a quadrant, just append the letter of that quadrant to the image you are viewing. For example :'t=tq' will give the upper left quadrant of the 't' image. And so on at each zoom level...

#### algorithm : to find a tile from a latitude, a longitude and a zoom factor :

<div id="premain1" class="smallText" style="WIDTH: 100%">

<img src="http://www.codeproject.com/images/minus.gif" title="点击图片可在新窗口打开" id="preimg1" style="CURSOR: pointer" data-preid="1" width="9" height="9" /><span id="precollapse1" style="MARGIN-BOTTOM: 0pt" nd="10" preid="1"> Collapse</span>

</div>

```
//initialise the variables;
double xmin=-180;
double xmax=180;
double ymin=-90;
double ymax=90;
double xmid=0;
double ymid=0;

string location="t";

//google use a latitude divided by 2;
double halflat = latitude / 2;
for (int i = 0; i < zoom; i++)
    {
        xmoy = (xmax + xmin) / 2;
        ymoy = (ymax + ymin) / 2;
        if (halflat > ymoy) //upper part (q or r)
            {
            ymin = ymoy;
            if (longitude < xmoy)
            { /*q*/
                location+= "q";
                xmax = xmoy;
            }
            else
            {/*r*/
                location+= "r";
                xmin = xmoy;
            }
        }
        else //lower part (t or s)
        {
            ymax = ymoy;
            if (longitude < xmoy)
            { /*t*/
                location+= "t";
                xmax = xmoy;
            }
            else
            {/*s*/
                location+= "s";
                xmin = xmoy;
            }
        }
    }
//here, the location should contains the string corresponding to the tile...
```

again, this algorithm is quite theorical, as the covered zone doesn't match the full globe.

#### Servers :

Google uses 4 servers to balance the load. these are kh0, kh1, kh2 and kh3.

#### Tile size :

each tile is a 256x256 jpg picture.

### Mercator projection

Due to the Mercator projection, the above algorithm have to be modified. In mercator projection, the spacing between to parallels is not constant. So the angle describe by a tile depends on it's vertical position.

### Covered zone :

thoerically, latitude should go from -90 to 90, but in fact due to the Mercator projection which sends the poles to the infinites, the covered zone is a bit less than -90 to 90. In fact the maximum latitude is the one that give PI (3.1415926) on the Mercator projection, using the formula Y = 1/2((1+sin(lat))/(1-sin(lat))) (see the link in the Mercator paragraph)

### Protection :

Google map uses a protection mechanism to keep a good quality of service. If one makes too much requests, google map will add its IP address to a blacklist, and send a nice message :

**Google Error**

We're sorry... ... but your query looks similar to automated requests from a computer virus or spyware application. To protect our users, we can't process your request right now. We'll restore your access as quickly as possible, so try again soon. In the meantime, if you suspect that your computer or network has been infected, you might want to run a virus checker or spyware remover to make sure that your systems are free of viruses and other spurious software. We apologize for the inconvenience, and hope we'll see you again on Google.

To avoid being backlisted, developpers should to use a caching mecanism if possible...

<div>

### Sat Examples :

see the whole globe at http://kh0.google.com/kh?n=404&v=8&t=t

<img src="http://kh0.google.com/kh?n=404&amp;v=8&amp;t=t" title="点击图片可在新窗口打开" style="CURSOR: pointer" />

and the four corresponding quadrants : (note the 4 servers name to balance the load)

- http://kh0.google.com/kh?n=404&v=8&t=tq
- http://kh1.google.com/kh?n=404&v=8&t=tr
- http://kh2.google.com/kh?n=404&v=8&t=ts
- http://kh3.google.com/kh?n=404&v=8&t=tt
  |  |  |
  |----|----|
  | <img src="http://kh0.google.com/kh?n=404&amp;v=8&amp;t=tq" title="点击图片可在新窗口打开" style="CURSOR: pointer" /> | <img src="http://kh1.google.com/kh?n=404&amp;v=8&amp;t=tr" title="点击图片可在新窗口打开" style="CURSOR: pointer" /> |
  | <img src="http://kh2.google.com/kh?n=404&amp;v=8&amp;t=tt" title="点击图片可在新窗口打开" style="CURSOR: pointer" /> | <img src="http://kh3.google.com/kh?n=404&amp;v=8&amp;t=ts" title="点击图片可在新窗口打开" style="CURSOR: pointer" /> |

</div>

<div>

### Map Examples :

see the whole globe at http://mt1.google.com/mt?n=404&v=w2.37&x=0&y=0&zoom=17

<img src="http://mt1.google.com/mt?n=404&amp;v=w2.37&amp;x=0&amp;y=0&amp;zoom=17" title="点击图片可在新窗口打开" style="CURSOR: pointer" />

and the four corresponding quadrants :

- http://mt0.google.com/mt?n=404&v=w2.37&x=0&y=0&zoom=16
- http://mt1.google.com/mt?n=404&v=w2.37&x=1&y=0&zoom=16
- http://mt2.google.com/mt?n=404&v=w2.37&x=0&y=1&zoom=16
- http://mt3.google.com/mt?n=404&v=w2.12&x=1&y=1&zoom=16
  |  |  |
  |----|----|
  | <img src="http://mt0.google.com/mt?n=404&amp;v=w2.37&amp;x=0&amp;y=0&amp;zoom=16" title="点击图片可在新窗口打开" style="CURSOR: pointer" /> | <img src="http://mt1.google.com/mt?n=404&amp;v=w2.37&amp;x=1&amp;y=0&amp;zoom=16" title="点击图片可在新窗口打开" style="CURSOR: pointer" /> |
  | <img src="http://mt2.google.com/mt?n=404&amp;v=w2.37&amp;x=0&amp;y=1&amp;zoom=16" title="点击图片可在新窗口打开" style="CURSOR: pointer" /> | <img src="http://mt3.google.com/mt?n=404&amp;v=w2.37&amp;x=1&amp;y=1&amp;zoom=16" title="点击图片可在新窗口打开" style="CURSOR: pointer" /> |

</div>

nice isn't it ?

*Edited : Google map has changed the v parameter for the maps. It was 2.12 when I wrote this article, but it's now 2.37. I suppose that this is a version number or something like that...*

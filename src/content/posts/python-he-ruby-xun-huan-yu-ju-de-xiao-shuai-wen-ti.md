---
title: Python和Ruby循环语句的效率问题
slug: python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti
date: "2008-07-30T20:22:00.000Z"
tags:
  - .NET
  - 性能
  - Python
  - 循环
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2008/07/30/1256833.html
draft: false
---

我可无意贬低Python和Ruby的性能，我也不想在这讨论语言性能这个问题。所以提刀拎砖进来的各路神仙请息怒，我只是无意之中碰到这这个可能是很多初学者都会碰到的问题。对于初学者，应该以理性的说服教育为主，胡砍乱拍是不对滴。\

 

这两天考虑基于Bellman-Ford尝试实现我的想法。昨天睡觉之前完成了Python的实现，可是程序跑起来之后居然就像死了一样。我跟进去发现，慢的地方就在Bellman-Ford的那个嵌套循环的地方。然而实际上，我的输入规模并没有大的那么恐怖，有16108个顶点和10310条边，也就是一个16108×10310的循环而已，所以应该不至于把程序拖死吧。于是我做了下面的实验，分别在c#、Python和Ruby中进行了测试。代码如下，非常简单：

 

1\. C#\

<div class="cnblogs_code">

<span style="color: #008080;"> 1</span><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" /><span style="color: #0000ff;">using</span><span style="color: #000000;"> System;\
</span><span style="color: #008080;"> 2</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" />\
</span><span style="color: #008080;"> 3</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" /></span><span style="color: #0000ff;">public</span><span style="color: #000000;"> </span><span style="color: #0000ff;">class</span><span style="color: #000000;"> App\
</span><span style="color: #008080;"> 4</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-2.gif" id="Codehighlighter1_32_220_Open_Image" onclick="this.style.display=&#39;none&#39;; document.getElementById(&#39;Codehighlighter1_32_220_Open_Text&#39;).style.display=&#39;none&#39;; document.getElementById(&#39;Codehighlighter1_32_220_Closed_Image&#39;).style.display=&#39;inline&#39;; document.getElementById(&#39;Codehighlighter1_32_220_Closed_Text&#39;).style.display=&#39;inline&#39;;" data-align="top" /><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-3.gif" id="Codehighlighter1_32_220_Closed_Image" style="display: none;" onclick="this.style.display=&#39;none&#39;; document.getElementById(&#39;Codehighlighter1_32_220_Closed_Text&#39;).style.display=&#39;none&#39;; document.getElementById(&#39;Codehighlighter1_32_220_Open_Image&#39;).style.display=&#39;inline&#39;; document.getElementById(&#39;Codehighlighter1_32_220_Open_Text&#39;).style.display=&#39;inline&#39;;" data-align="top" /></span><span id="Codehighlighter1_32_220_Closed_Text" style="border: 1px solid #808080; background-color: #ffffff; display: none;">![](./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif)</span><span id="Codehighlighter1_32_220_Open_Text"><span style="color: #000000;">{\
</span><span style="color: #008080;"> 5</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-4.gif" data-align="top" />    </span><span style="color: #0000ff;">public</span><span style="color: #000000;"> </span><span style="color: #0000ff;">static</span><span style="color: #000000;"> </span><span style="color: #0000ff;">void</span><span style="color: #000000;"> Main()\
</span><span style="color: #008080;"> 6</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-5.gif" id="Codehighlighter1_62_218_Open_Image" onclick="this.style.display=&#39;none&#39;; document.getElementById(&#39;Codehighlighter1_62_218_Open_Text&#39;).style.display=&#39;none&#39;; document.getElementById(&#39;Codehighlighter1_62_218_Closed_Image&#39;).style.display=&#39;inline&#39;; document.getElementById(&#39;Codehighlighter1_62_218_Closed_Text&#39;).style.display=&#39;inline&#39;;" data-align="top" /><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-6.gif" id="Codehighlighter1_62_218_Closed_Image" style="display: none;" onclick="this.style.display=&#39;none&#39;; document.getElementById(&#39;Codehighlighter1_62_218_Closed_Text&#39;).style.display=&#39;none&#39;; document.getElementById(&#39;Codehighlighter1_62_218_Open_Image&#39;).style.display=&#39;inline&#39;; document.getElementById(&#39;Codehighlighter1_62_218_Open_Text&#39;).style.display=&#39;inline&#39;;" data-align="top" />    </span><span id="Codehighlighter1_62_218_Closed_Text" style="border: 1px solid #808080; background-color: #ffffff; display: none;">![](./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif)</span><span id="Codehighlighter1_62_218_Open_Text"><span style="color: #000000;">{\
</span><span style="color: #008080;"> 7</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-4.gif" data-align="top" />        </span><span style="color: #0000ff;">int</span><span style="color: #000000;"> counter </span><span style="color: #000000;">=</span><span style="color: #000000;"> </span><span style="color: #800080;">0</span><span style="color: #000000;">;\
</span><span style="color: #008080;"> 8</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-4.gif" data-align="top" />        </span><span style="color: #0000ff;">for</span><span style="color: #000000;"> (</span><span style="color: #0000ff;">int</span><span style="color: #000000;"> i </span><span style="color: #000000;">=</span><span style="color: #000000;"> </span><span style="color: #800080;">0</span><span style="color: #000000;">; i </span><span style="color: #000000;">\<</span><span style="color: #000000;"> </span><span style="color: #800080;">16108</span><span style="color: #000000;">; i</span><span style="color: #000000;">++</span><span style="color: #000000;">)\
</span><span style="color: #008080;"> 9</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-4.gif" data-align="top" />            </span><span style="color: #0000ff;">for</span><span style="color: #000000;"> (</span><span style="color: #0000ff;">int</span><span style="color: #000000;"> j </span><span style="color: #000000;">=</span><span style="color: #000000;"> </span><span style="color: #800080;">0</span><span style="color: #000000;">; j </span><span style="color: #000000;">\<</span><span style="color: #000000;"> </span><span style="color: #800080;">10310</span><span style="color: #000000;">; j</span><span style="color: #000000;">++</span><span style="color: #000000;">)\
</span><span style="color: #008080;">10</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-4.gif" data-align="top" />                counter</span><span style="color: #000000;">++</span><span style="color: #000000;">;\
</span><span style="color: #008080;">11</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-4.gif" data-align="top" />        Console.WriteLine(</span><span style="color: #800000;">"</span><span style="color: #800000;">Counter is: {0}</span><span style="color: #800000;">"</span><span style="color: #000000;">, counter);\
</span><span style="color: #008080;">12</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-7.gif" data-align="top" />    }</span></span><span style="color: #000000;">\
</span><span style="color: #008080;">13</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-8.gif" data-align="top" />}</span></span>

</div>

 

2.  Python\

<div class="cnblogs_code">

<span style="color: #008080;">1</span><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" /><span style="color: #000000;">counter </span><span style="color: #000000;">=</span><span style="color: #000000;"> 0\
</span><span style="color: #008080;">2</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" /></span><span style="color: #0000ff;">for</span><span style="color: #000000;"> i </span><span style="color: #0000ff;">in</span><span style="color: #000000;"> range(</span><span style="color: #000000;">16108</span><span style="color: #000000;">):\
</span><span style="color: #008080;">3</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" />    </span><span style="color: #0000ff;">for</span><span style="color: #000000;"> j </span><span style="color: #0000ff;">in</span><span style="color: #000000;"> range(</span><span style="color: #000000;">10310</span><span style="color: #000000;">):\
</span><span style="color: #008080;">4</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" />        counter </span><span style="color: #000000;">=</span><span style="color: #000000;"> counter </span><span style="color: #000000;">+</span><span style="color: #000000;"> </span><span style="color: #000000;">1</span><span style="color: #000000;">\
</span><span style="color: #008080;">5</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" />        \
</span><span style="color: #008080;">6</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" /></span><span style="color: #0000ff;">print</span><span style="color: #000000;"> </span><span style="color: #800000;">"</span><span style="color: #800000;">Counter is: </span><span style="color: #800000;">"</span><span style="color: #000000;"> </span><span style="color: #000000;">+</span><span style="color: #000000;"> str(counter)</span>

</div>

\

3\. Ruby (没有Ruby的代码模板，用Python的凑合了)\

<div class="cnblogs_code">

<span style="color: #008080;">1</span><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" /><span style="color: #000000;">counter </span><span style="color: #000000;">=</span><span style="color: #000000;"> 0\
</span><span style="color: #008080;">2</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" /></span><span style="color: #0000ff;">for</span><span style="color: #000000;"> i </span><span style="color: #0000ff;">in</span><span style="color: #000000;"> 0..</span><span style="color: #000000;">16107</span><span style="color: #000000;">\
</span><span style="color: #008080;">3</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" />  </span><span style="color: #0000ff;">for</span><span style="color: #000000;"> j </span><span style="color: #0000ff;">in</span><span style="color: #000000;"> 0..</span><span style="color: #000000;">10309</span><span style="color: #000000;">\
</span><span style="color: #008080;">4</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" />    counter </span><span style="color: #000000;">+=</span><span style="color: #000000;"> </span><span style="color: #000000;">1</span><span style="color: #000000;">\
</span><span style="color: #008080;">5</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" />  end\
</span><span style="color: #008080;">6</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" />end\
</span><span style="color: #008080;">7</span><span style="color: #000000;"><img src="./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-1.gif" data-align="top" />puts counter</span>

</div>

 

粗略测试运行时间结果为：\

C#：不到1秒\

Python：45秒左右

Ruby：1分33秒左右\

 

这个结果让我很吃惊，于是又在同事ArcGIS里面用VBA试了一下，结果是不到2秒循环结束。这种嵌套循环应该在平时的代码中非常常见啊，为什么Python和Ruby会慢的这么离谱？是我的代码哪里写的有问题吗？在CSDN上发了[一帖](http://topic.csdn.net/u/20080730/17/9c5ce68f-63bf-4cf5-a139-e5515958f3ea.html)，结果有一位“双星”回复说：“*是慢，没办法。尽量别写这样的代码是了。需要速度的时候用C或者C++写扩展吧。*”OMG...我不会才用Python一个月就遇到这种语言本身的致命缺陷吧...对我将来“以脚本语言为主，编译语言为辅”的战略规划打击太大了吧...

 

p.s.不好意思的顺便也把Ruby也给连累了... ![](./python-he-ruby-xun-huan-yu-ju-de-xiao-shuai-wen-ti/img-2.gif)

其实重构[mmspa](https://github.com/tumluliu/mmspa)的想法早已有之，因为那是我2009年4月份开始写的库，后面在2010年集中开发Multimodal Route Planning System for Munich的时候基本就不再动它了，主要是有一种怕一碰就不能用了的心理在作怪。直到去年把上层的wrapper重新用Python写成[pymmrouting](https://github.com/tumluliu/pymmrouting)的时候都没敢大动mmspa的代码，只是稍微添加了几个函数。但实际上，它的代码已经too(不) ugly(忍) to(直) read(视)了，而且现在又有了个改进效率的想法作为契机，那就做个大扫除吧。

之前的代码问题很多，要列清单可以列很长，这里就不详述了，当自己重构的动作提起速度来的时候也是脑子中几条线同时前进，有的问题随着发现就随着解决了，可能都没来得及反映到commit comments中。这里只提纲挈领的记几个要点：

1. 之前的代码组织主要是分成了`parser`（负责从数据库里读取数据并装配multimodal graph set）、`multimodal-twoq`（负责最短路径算法）和`mmspa4pg`（一个...大杂烩，里面既有routing plan的创建，还有最终路径的获取与销毁函数）。这样的组织显然混乱，所以把代码打散并重新组织成了`routingplan`、`routingresult`、`graphassembler`、`mmtwoq`和`mmspa4pg`这几个部分，数据结构主要都定义在`modegraph.h`中。结构比之前清晰了很多
2. 消灭了`graphassembler`，也就是之前`parser`中的几个超长函数，提取出了一票小函数
3. 更加合理的使用`extern`、`static`等，用以理清全局、局部、公有和私有的关系
4. 规范化命名约定，并且专门写了一个文件，记录Coding standards

这次的重构过程也是一次对C的再学习，[《K&R》](http://www.wikiwand.com/en/The_C_Programming_Language)和[《C Interfaces and Implementations》](http://www.amazon.com/Interfaces-Implementations-Techniques-Creating-Reusable/dp/0201498413)帮了很大的忙。特别是K&R，尽管只是薄薄一本，但其实信息密度很高，在里面总能找到自己的C知识短板。

重构后的版本作为[1.1](https://github.com/tumluliu/mmspa/releases/tag/v1.1)发布了，当然距离一个真正好用的库还差很远，不过总归是迈出了有意义的一步。

下一步，就是2.0。它最大的特点就是会比之前的库快，效率的提升会主要体现在Multimodal Route Planner for Munich的[demo](http://luliu.me/projects/mmrp/)中。敬请期待。
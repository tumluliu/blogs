---
tags: [Notebooks/blog]
title: 多模式路径规划服务API上线
created: '2015-06-14T05:21:27+02:00'
modified: '2015-06-14T05:21:27+02:00'
---

在对OpenStreetMap数据、UnitedMaps数据还有我自己采集的数据进行一系列处理之后，把去年写的pymmrouting进行了大幅修正，然后又基于flask-jsonrpc实现了JSON RPC风格的API service，现在多模式路径规划API服务mmrp-jsonapi已经上线了，就在我的这个网站上，地址为：

http://luliu.me/mmrp/api/v1

与之相关的项目有这些：

- [mmspa](https://github.com/tumluliu/mmspa)
- [pymmrouting](https://github.com/tumluliu/pymmrouting)
- [mmgraphdb-builder](https://github.com/tumluliu/mmgraphdb-builder)
- [mmrp-jsonrpc](https://github.com/tumluliu/mmrp-jsonrpc)

API服务的使用方法可以在mmrp-jsonrpc的README中找到，我这里再贴一份：

### 对 `mmrp.index`接口的范例请求

通过curl发送POST请求:

```bash
curl -i -X POST  -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "method": "mmrp.index", "params": {}, "id": "1"}' http://luliu.me/mmrp/api/v1
```

响应:

```bash
HTTP/1.1 200 OK
Date: Sat, 13 Jun 2015 10:55:30 GMT
Server: Apache/2.4.7 (Ubuntu)
Content-Type: application/json
Content-Length: 111

{
  "id": "1", 
  "jsonrpc": "2.0", 
  "result": "Welcome using Multimodal Route Planner (mmrp) JSON-RPC API"
}
```

### 对`mmrp.findMultimodalPaths`接口的范例请求

同样也可以通过curl来发送POST请求，但无论是请求还是响应都比较长，不写在这里了，大家可以参考[mmrp-jsonrpc](https://github.com/tumluliu/mmrp-jsonrpc)中的`sample_request.sh`和`sample_response.json`。在响应中包含了搜索到的多模式路径座标序列（以GeoJSON表示），以及不同模式路径之间的切换点（switch point）信息。

## *特别注意*

1. 目前后端的测试数据集是慕尼黑市及周边部分地区，具体范围为：11.360796,48.061602,11.722875,48.248220。所以注意你送进去的source和target，超出了这个范围是肯定没结果的
2. 如果你试用了mmrp的这个API服务，那么恐怕最大的感受就是“慢”。没错，它就是*慢，慢，慢*，重要的事情说三遍。因为在数据层面，我还没做任何优化，所以每次计算路径的时候装配多模式网络的时间会比较长，对于每个路径搜索计划，大约需要3到5秒左右，然后计算路径的时间在0.5秒以内，而且又因为每次搜索路径很可能包括多个搜索计划，所以总体感觉会比较慢，但最差的情况1分钟之内是会有结果的
3. 交通规则暂时没有考虑
4. 公交系统中暂时只有S-bahn（suburban，轻轨）、U-bahn（underground，ditie）和Tram（有轨电车）。Bus（公交车）线路数据尚未提取和纳入规划范围
5. 公交系统的时刻表数据尚未采集处理
6. 只有U-bahn（underground，地铁）系统可以具体到站台和线路，S-bahn（suburban，轻轨）和Tram（有轨电车）的站台数据尚未采集

是的，它很慢，而且功能十分有限。但即便如此，目前全网之内都还找不到一个能实现真正给出诸如“先开车，然后停在某个停车场，再步行到目的地”，或者“考虑到汽车的剩余油量只能跑10公里，那么就先开到一个临近的P+R，停在那里，换乘公交系统到目的地，当然还要保证回来的时候汽车还有剩油能开走”，或者“我不是司机，别人开车把我送到一个Kiss+R的地方，我去坐地铁前往目的地，然后他开走”这样规划结果的实用系统。所以我只能把自己博士论文的东西重新整理，然后全部以开源项目的形式发布。

我后面可能会考虑对性能进行优化，对功能进行扩展，融合更详细的数据以及时刻表等动态信息，但暂时没有详细的日程表。现在，我正在实现一个web前端作为demo，估计一个月之内可以与大家见面。

这篇post我会再写份英文版的。

I will write an English version of this post to introduce mmrp (multimodal route planner) related projects.

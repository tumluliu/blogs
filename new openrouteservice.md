---
tags: [Notebooks/blog]
title: new openrouteservice
created: '2017-04-29T14:11:30+02:00'
modified: '2017-04-29T14:11:30+02:00'
---

![New OpenRouteService.org](http://k1z.blog.uni-heidelberg.de/files/2017/04/screen-shot-2017-04-29-at-091645.png)

跟之前的版本相比，最大的变化应该是这次终于向开发者开放了API，目前共四个：

- **Geocoding** 地理编/解码
- **Directions** 路径规划，支持驾车（包括货车和特种车等子类）、自行车（包括普通车和山地车等子类）、步行等模式。每种模式都还包含了更多的约束和选项
- **Isochrones** 可达性分析，支持多种交通工具
- **Places** 搜索周边，支持在点、线和多边形附近搜索兴趣点，比如说找到一条路径之后沿途搜索加油站这种场景

API的使用目前只提供一个免费套餐（Free plan），以后还会有其它套餐推出，敬请期待。需要使用API的话，请先在[开发中心][3]注册，然后申请免费套餐的API key。申请提交之后，API key会发回到申请邮箱。**请注意保管好这个key**，一旦遗失我们也没办法找回来，只能重新注册一个新用户再申请。这个版本还有一个比较大的变化就是彻底抛弃了反人类的XML，而改用JSON/GeoJSON作为请求和响应的基本格式。

更多关于这版OpenRouteService (ORS)的详细信息，请参见[官方声明（英文）][1]，如果有任何关于客户端或者是API使用的问题，欢迎随时与我或项目组[联系](https://developers.openrouteservice.org/portal/contact)。这里我想补充一点，对于想在中国大陆地区使用ORS的用户来说，路径规划的服务质量会低于欧洲、北美、日本、港台等地区，原因很简单：ORS是基于OpenStreetMap (OSM)数据的，而中国大陆地区的OSM数据质量目前只能呵呵。有朝一日，在有理想有能力的青年科学家们的推动下，中国大陆地区OSM数据质量有质的飞跃之后，ORS的服务质量也会随之大幅提高。相信这一天会很快到来。

- 新版ORS地址：[https://openrouteservice.org][2]
- 开发中心：[https://developers.openrouteservice.org/portal][3]
- API文档：[https://app.swaggerhub.com/apis/OpenRouteService/ors-api/][4]
- 旧版的ORS还会继续运行到五月底，但地址已改：[http://legacy.openrouteservice.org][5]

btw，ORS的web前端是开源的，github仓库地址是[https://github.com/GIScience/openrouteservice-ng/][6] 。如果有关于前端的问题在这里开issue也没有问题。欢迎吐槽拍砖 ：）

[1]:	http://k1z.blog.uni-heidelberg.de/2017/04/29/openrouteservice-with-new-api-functions-and-look/
[2]:	https://openrouteservice.org "OpenRouteService"
[3]:	https://developers.openrouteservice.org/portal "OpenRouteService Developer Center"
[4]:	https://app.swaggerhub.com/apis/OpenRouteService/ors-api/ "OpenRouteService API Documentation"
[5]:	http://legacy.openrouteservice.org "Old version of OpenRouteService"
[6]:	https://github.com/GIScience/openrouteservice-ng/ "openrouteservice web app on Github"
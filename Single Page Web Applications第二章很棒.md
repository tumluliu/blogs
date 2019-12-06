[Single Page Web Applications](http://www.amazon.com/Single-Page-Applications-end---end/dp/1617290750/ref=sr_1_1?ie=UTF8&qid=1434811679&sr=8-1&keywords=Single+Page+Web+Applications&pebp=1434811687611&perid=0QVGE5WWTYMDZNT4JG6C)

![SPA](http://ecx.images-amazon.com/images/I/51KT4qErFaL.jpg)

在第二章中把JavaScript中的几个我认为最基本、最重要、最容易让人混淆和出现理解偏差的地方讲的都很清楚，包括变量的作用域、上下文对象、作用域链、基于原型的对象、原型链、函数、闭包等等，基本上每个都直戳我的痛点。这一章非常值得反复阅读。

这里记一个对象创建的最佳实践，利用了`Object.create`和工厂函数：

```javascript
var proto = {
  sentence: 4,
  probation: 2,
};
var makePrisoner = function( name, id ) {
  var prisoner = Object.create( proto );
  prisoner.name = name;
  prisoner.id = id;
  return prisoner;
};
var firstPrisoner = makePrisoner( 'Joe', '12A' );
var secondPrisoner = makePrisoner( 'Sam', '2BC' );
```
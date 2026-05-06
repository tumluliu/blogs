---
title: 老师讲的抽象工厂，错了一点点
slug: lao-shi-jiang-de-chou-xiang-gong-chang-cuo-le-yi-dian-dian
date: "2006-03-30T21:31:00.000Z"
tags:
  - Design Patterns
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2006/03/30/363139.html
draft: false
---

    他也有讲错的时候，虽然只是一点点，但还是被我抓到了，呵呵。而且通过对错误地方分析可以知道，错因是他对OOD基本原则的理解以及对Abstract Factory的理解似乎还不是十分到位。
    看得出，他讲《设计模式》的蓝本是英文版的GoF《Design Patterns》，课件上都是清一色的英文，对每一个DP的介绍模式也都是按照GoF那本书来的。但是他今天在讲到抽象工厂局限性的时候，用红色字体打出：
    difficult to ... new kinds of objects（p.s.原话记不清了）
    然后解释说：抽象工厂的局限性就在于当有新的产品线3需要加入系统的时候，不但要新建继承自AbstractProcuctA的ProductA3类，新建继承自AbstractProcuctB的ProductB3类，"这倒没有什么"，而且还要新建一个集成自AbstractFactory的ConcreteFactory3，"这就不行了"。从他的语气中可以知道他认为新建类，特别是要新建一个具体工厂是"不好"的。
    然而就我目前对DP的理解，情况却不是这样的。当有产品线3需要加入系统时，正好是抽象工厂显示威力的时候。新增加的三个派生类ProductA3、ProductB3和ConcreteFactory3很好的展示了抽象工厂模式符合"开放－封闭原则"的特点——新的需求没有对原有的设计和结构，特别是AbstractFactory和AbstractProductX接口做任何的修改，只是对现有系统进行了扩展，就实现了新的需求。而对"增加新的产品线/族/系列"这个轴线上的需求变化的应对自如也正是抽象工厂的力量所在。
    那么对于GoF书中的那句"difficult to ... new kinds of objects"怎么理解呢？
    抽象工厂的局限性应该是当需求变化的轴线在于"增加组成系统的新产品/对象"的时候，就力不从心了。
    这里就拿老师上课举的例子来说明。他的例子是构建一个迷宫游戏（Maze Game），组成迷宫（Maze）的基本元素有三个——房间（room）、墙壁（wall）和门（door）。游戏分为不同的~~难度等级，比如easy/normal/hard，对应于不同的难度，房间、墙壁和门是不同的，比如hard模式的门可能是带有密码锁的。其实这个例子看起来并不十分恰当，因为通常应该觉得迷宫的难度等级应该按照其内部的复杂度来划分，而不是按照他的这种方式来划分，这个暂且不管，就先用他的划分方式吧。~~场景，比如丛林迷宫、楼房迷宫等等。在这些不同的场景下，房间、墙壁和门的风格当然也是不同的，所以这里应用抽象工厂是一个合适的选择。

```csharp
// AbstractFactory
public abstract class MazeFactory
{
    abstract Room CreateRoom();
    abstract Wall CreateWall();
    abstract Door CreateDoor();
}
// ConcreteFactory1
public class JungleMazeFactory : MazeFactory
{
    public override Room CreateRoom() {}
    public override Wall CreateWall() {}
    public override Door CreateDoor() {}
}
// ConcreteFactory2
public class BuildingMazeFactory : MazeFactory
{
    public override Room CreateRoom() {}
    public override Wall CreateWall() {}
    public override Door CreateDoor() {}
}

// AbstractProductA
public abstract class Room {}

// AbstractProductB
public abstract class Wall {}

// AbstractProductC
public abstract class Door {}

// ProductA1
public class JungleRoom : Room {}

// ProductA2
public class BuildingRoom : Room {}

// ProductB1
public class JungleWall : Wall {}

// ProductB2
public class BuildingWall : Wall {}

// ProductC1
public class JungleDoor : Door {}

// ProductC2
public class BuildingDoor : Door {}
```

    现在如果需求发生变化，需要一种新的迷宫场景，比如海底迷宫（SeabedMaze），而迷宫的基本组成元素仍然是房间、墙壁和门，那么我只需要对原有系统做如下**扩展**：

```csharp
// ConcreteFactory3
public class SeabedMazeFactory : MazeFactory
{
    public override Room CreateRoom() {}
    public override Wall CreateWall() {}
    public override Door CreateDoor() {}
}

// ProductA3
public class SeabedRoom : Room {}

// ProductB3
public class SeabedWall : Wall {}

// ProductC3
public class SeabedDoor : Door {}
```

    然后client就可以生成通过传入SeabedMazeFactory的对象实例来创建这个海底场景的迷宫了，原有的逻辑都可以不动，这样就算是再来几个空中迷宫、地下迷宫什么的，只要是迷宫的基本组成三要素——房间、墙壁和门不变，我就可以通过不断的对现有系统进行扩展来达到目的，哈，太完美了。
    但是，如果这时需求朝着另一个方向变化——迷宫中需要加入新的元素，比如陷阱、楼梯、地道……——那就完蛋了。如果还是单单通过扩展现有系统就达不到目的了。原因就在于ProductA、ProductB...增加了，而AbstractFactory，或者说是MazeFactory中只有CreateRoom()、CreateWall()和CreateDoor()抽象方法，而如果要加入对陷阱、楼梯、地道……的支持，则必须要修改MazeFactory这个AbstractFactory的接口，而这显然是不希望看到的，也是违背"开－闭原则"的。
    抽象工厂的局限性就在于此。

    那GoF的话说错了吗？请注意，人家说的可是"new kinds of objects"，而不是"new families of objects"，一字之差，含义完全不同。老师把GoF的意思理解成了后者，而后者不但不是抽象工厂的劣势，反而恰恰是其优势所在。前者才真正是抽象工厂的软肋。

    这里又想到一个事情，我还是觉得GoF那本书不太适合做入门读物，更不太适合做教材，但是这学期的课上老师推荐的书只有三本，第一本就是这个，唉~~我觉得这本小册子会挡住很多对DP有热情但又缺乏实践经验的初学者的。

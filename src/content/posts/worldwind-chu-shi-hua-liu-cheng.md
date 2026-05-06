---
title: WorldWind初始化流程
slug: worldwind-chu-shi-hua-liu-cheng
date: "2007-03-01T23:05:00.000Z"
tags: []
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2007/03/02/660921.html
draft: false
---

这篇post是基于ww1.3.5.0的代码写的，1.4的代码如有变化我会及时更新程序入口：WorldWind.cs中MainApplication类static void Main()方法。其主要步骤如下：

1.  <div style="TEXT-ALIGN: justify">

    创建程序版本号（通过Version类）

    </div>

2.  <div style="TEXT-ALIGN: justify">

    保证只有一个WorldWind实例在运行    </div>

3.  <div style="TEXT-ALIGN: justify">

    读取初始化配置文件（C:\Documents and Settings\\user\>\ApplicationData\NASA\WorldWind\1.3.5.0\WorldWind.xml），读取的方法是利用XML反序列化实现的    </div>

4.  <div style="TEXT-ALIGN: justify">

    添加线程异常事件处理函数Application_ThreadException    </div>

5.  <div style="TEXT-ALIGN: justify">

    创建MainApplication实例    </div>

    5.1. 判断是否需要运行配置向导    5.2. 创建启动画面（Splash类，是一个Form的派生类）

    5.3. 配置缓存    5.4. 设置配置文件路径并读取配置文件    5.5. 将读出的配置信息写入菜单项    5.6. <span style="COLOR: red">OpenStartupWorld </span>

    5.6.1. 确定应该打开哪个星球的视图    5.6.2. <span style="COLOR: red">OpenWorld("星球配置文件"); </span>

    5.6.2.1. 判断是否已有打开的星球，以及一系列资源是否已存在    5.6.2.2. 2567行：WorldWindow.CurrentWorld = WorldWind.ConfigurationLoader.Load(worldXmlFile, worldWindow.Cache); 其中CurrentWorld是World类型，这句话就是让WorldWindow控件知道该显示哪个星球（还可能是月球或火星等）

    5.6.2.3. 初始化插件编译器，加载初始插件    5.6.2.4. AddLayer MenuButtons(…)，添加图层控制框中的按钮    5.6.2.5. 添加工具栏按钮，工具栏类型为MenuBar，包含在WorldWindow中    5.7. (?) "Set up vertical exaggeration sub-menu" 作用应该是在设置放大倍数子菜单中指定的放大倍数前打勾    5.8. 将初始化配置反映到菜单中    <span style="COLOR: red; BACKGROUND-COLOR: yellow">5.9.</span><span style="BACKGROUND-COLOR: yellow"> <span style="COLOR: red">worldWindow.Render();</span></span> （注：render意为"渲染"，指的就是绘制动作）强制WorldWindow控件重绘    5.10. 将窗口位置置于屏幕中间6．添加Applicationde的Idle事件处理程序

<span style="COLOR: red; BACKGROUND-COLOR: yellow">7．Application.Run(app);</span> 执行该语句后，WorldWind主窗体出现

8．保存当前星球配置9．保存程序配置（放大/缩小的处理函数在CameraBase类中，ZoomStepped方法，调用方法是WorldWindow控件类中的OnMouseWheel事件处理和OnKeyDown()-\>HandleKeyDown事件处理，但没有找到鼠标双击事件处理。）

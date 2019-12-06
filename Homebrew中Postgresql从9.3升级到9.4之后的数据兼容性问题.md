Homebrew中Postgresql从9.3升级到9.4之后的数据兼容性问题

今天早上看到Hao Zhang发来的微信说帮忙写个SQL语句。倒啊，我的SQL渣成啥样啊，而且我无比厌恶SQL他居然不知道。没办法，准备打开Pgadmin让它帮忙生成个建表语句然后发给他，结果突然发现我本地的postgresql又起不来了。google出了用brew安装的postgresql的服务启动方法（不好意思，总是记不住这个launchctl命令。。）：

'' 
'' launchctl start ~/Library/LaunchAgents/homebrew.mxcl.postgresql.plist
'' 

但好像毫无反应。看了一眼server.log，才发现已经被下面这个错误刷屏了：

'' 
'' FATAL:  database files are incompatible with server
'' DETAIL:  The data directory was initialized by PostgreSQL version 9.3, which is not compatible with this version 9.4.0.
'' 

很清楚的错误提示。那就看看怎么处理吧，继续google，找到了pg_upgrade，但文档上说除非是大版本号升级，否则一般不需要执行pg_upgrade。但是既然都已经报错了，那还是得处理，继续google，直接用错误内容作关键字，找到了[这个靠谱的帖子](http://stackoverflow.com/questions/24379373/how-to-upgrade-postgres-from-9-3-to-9-4-without-losing-data)，其实就是pg_upgrade的一个具体使用例子，只不过原问题和我遇到的情况几乎一样。

问题解决。现在跟我一起念：google大法好，stackoverflow保平安。
---
title: GeographicLib安装
tags:
- 讲课/学习
---

这个库叽里呱啦，我们简成GLib,下面讲述如何在VS 2022中安装。

~~这个库具体的全部功能还不熟悉~~

首先是下下来

![下载地址](https://sourceforge.net/projects/geographiclib/files/distrib-C++/)

下了之后安装，要添加到系统环境变量。

然后在VS环境里添加include目录和lib目录

添加附加依赖项，打开Lib文件夹，可以看到GeographicLib.lib、GeographicLib-i.lib、GeographicLib_d.lib、GeographicLib_d-i.lib四项。

如果是Debug模式，添加GeographicLib_d.lib、GeographicLib_d-i.lib两项到附加依赖项中，Release模式添加GeographicLib.lib、GeographicLib-i.lib两项到附加依赖项中。

在预处理器中定义：GEOGRAPHICLIB_SHARED_LIB=1

参考：
https://blog.csdn.net/weixin_44272195/article/details/134101109

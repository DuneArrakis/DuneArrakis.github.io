# Zhang Zhoutao · 个人学术主页

基于 Jekyll / GitHub Pages 的中英双语学术主页，包含个人简介、研究方向、学术成果、教育经历和文章归档。使用本地模板与样式，无需前端打包。现有域名及文章日期路径保持不变。

## 中英文与栏目显示

中文首页为 `/`，英文首页为 `/en/`，通过顶部的「中文 / English」链接切换，无需 JavaScript。两种语言共享首页模板，各自有独立网址、页面语言和搜索引擎描述。内页顶部的语言入口指向对应语言的学术首页；现有博客文章及归档保留中文，英文首页的文章入口已标注 Chinese。

中文资料维护在 `_data/academic.yml`，英文简介、身份、机构、地点及各栏目维护在 `_data/academic_en.yml`。姓名、头像、邮箱、社交链接和 `updating` 开关共用中文文件中的配置。新增研究方向、成果、动态或经历时，请同步填写两个内容文件；界面文字在 `_data/translations.yml`。

项目栏目及侧栏入口已隐藏，原始数据保留。需要重新显示时，将 `_config.yml` 中的 `show_projects` 改为 `true`。

## 填写主页内容

日常更新只需编辑 **`_data/academic.yml`**，不必修改 HTML。文件中的中文注释提供了每类条目的示例。

| 字段 | 内容 |
| --- | --- |
| `profile` | 姓名、中文名、身份、机构、地点、头像、联系方式、个人简介 |
| `news` | 最新动态（留空时整栏隐藏） |
| `research` | 研究方向、描述与关键词 |
| `publications` | 论文标题、作者、期刊/会议、年份、论文与代码链接 |
| `projects` | 项目名称、时间、说明与链接 |
| `experience` | 教育背景、科研经历或学术服务 |

空栏目会显示「待补充」，不会生成虚构成果。Scholar、ORCID、CV 等链接留空时自动隐藏。补齐内容后，将 `profile.updating` 改为 `false`，即可隐藏首页的完善提示。各列表按填写顺序展示，建议新内容写在最前面。

添加条目时，**把对应的 `[]` 替换为列表**，不要保留它。例如：

```yaml
research:
  - title: "你的研究方向"
    description: "简要说明关注的问题与方法。"
    keywords: ["关键词一", "关键词二"]
```

YAML 用空格缩进，不使用 Tab。时间、含冒号或特殊符号的内容建议加引号；多段正文使用 `|` 换行。`intro`、`description`、动态的 `text` 支持 Markdown；其他短字段按纯文本显示。论文作者按所填顺序展示，链接可填写站内 `/file/...` 路径或完整网址。

上传简历到 `file/cv.pdf`，再把 `profile.cv` 改为 `/file/cv.pdf`；替换 `avatar.jpg` 或修改 `profile.avatar` 即可换头像。更改姓名后，也请同步更新 `_config.yml` 的 `title`、`author`、`description`，用于搜索引擎。

## 继续写文章

原有文章仍放在 `_posts/`。新建 `YYYY-MM-DD-标题.md`：

```markdown
---
title: 文章标题
tags:
  - 学习笔记
---

在这里写正文。
```

文章会自动出现在 `/archive/`、`/tags/` 与首页的最新文章中。归档支持标题/标签搜索与标签组合筛选，关闭 JavaScript 仍能浏览全部文章。文章支持 Markdown、代码高亮、公式、Mermaid、可横向滚动的表格和自动目录。公式与 Mermaid 按需从 CDN 加载；加载失败时仍保留原始文字/代码。

原来的归档、标签和 404 是放在 `_posts` 内的功能页；现在迁移到了根目录，`/archive/`、`/tags/` 和 `/404` 入口继续可用，GitHub Pages 的错误页使用 `/404.html`。这些功能页不再被计作文章。真正的文章正文和文件名没有修改。

## 本地预览与发布

安装 Ruby 与 Bundler 后（Windows 建议使用 RubyInstaller 的 Ruby+Devkit 版本），在仓库目录运行：

```sh
bundle install
bundle exec jekyll serve --host 127.0.0.1
```

打开终端显示的本地地址（默认 `http://127.0.0.1:4000`）。检查静态构建：

```sh
bundle exec jekyll build
```

`Gemfile` 使用与 GitHub Pages 一致的 `github-pages` 依赖集，避免单独指定依赖版本导致线上与本地环境不一致。Windows 时区数据仅在 Windows 安装。

继续使用仓库已有的 GitHub Pages 发布方式。`CNAME` 保留 `dune-arrakis.cn`，不需要新增托管平台。若使用仓库现有的自动提交脚本，提交前请先检查改动；脚本会提交并推送仓库中的改动。

若发布长时间停留在处理中，先在仓库 Actions 的 `pages build and deployment` 中查看各阶段：`Build with Jekyll` 失败时按日志修正源码；构建和上传成功、但 `deploy` 排队或取消时，应重试部署并检查 GitHub 服务状态，不能仅根据等待时间判断为页面代码错误。

## 文件结构

```text
_data/academic.yml          主页内容
index.html / en/index.html  中文 / 英文学术首页入口
_data/academic_en.yml       英文主页内容
_data/translations.yml      中英文界面文字
_includes/home.html         共享学术首页模板
archive.html / tags.html   文章索引
_posts/                    原有文章与新文章
_layouts/                  全站、文章和通用页面模板
_includes/                 个人资料、图标、成果链接
assets/css/academic.css    桌面、手机与打印样式
assets/js/academic.js      归档筛选、目录、公式与图表
file/                      原有附件和简历等文件
```

原站重要文章入口：

- [关于这个网站](https://dune-arrakis.cn/2025/02/07/关于这个网站/)
- [杭电数学建模各类赛事指南](https://dune-arrakis.cn/2025/02/09/杭电数学建模各类赛事指南/)
- [Markdown 语法](https://dune-arrakis.cn/2025/02/08/markdown语法/)

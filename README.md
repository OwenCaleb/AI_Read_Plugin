# Coze工作流API调用程序

这是一个简单的浏览器扩展，用于调用Coze工作流API。

## 功能

- 提示用户输入一个URL（自动获取当前标签页URL）
- 调用Coze工作流API
- 显示API返回的结果或错误信息

## 安装浏览器扩展

### Microsoft Edge浏览器

1. 打开Edge浏览器
2. 在地址栏输入 `edge://extensions/`
3. 打开右上角的"开发人员模式"
4. 点击左上角"加载解压缩的扩展"
5. 选择本项目文件夹
6. 扩展程序已安装完成，可以在工具栏看到图标

### Chrome浏览器（也兼容）

1. 打开Chrome浏览器
2. 在地址栏输入 `chrome://extensions/`
3. 打开右上角的"开发者模式"
4. 点击左上角"加载已解压的扩展程序"
5. 选择本项目文件夹
6. 扩展程序已安装完成，可以在工具栏看到图标

## 使用方法

1. 点击浏览器工具栏上的扩展图标
2. 输入框中会自动填充当前标签页的URL
3. 点击"提交"按钮
4. 等待API调用完成
5. 查看返回结果

## 技术细节

- 使用Chrome扩展API进行浏览器交互
- 使用Fetch API进行HTTP请求
- 完整的错误处理和日志输出
- 支持异步操作
- 使用JSDoc注释提供代码文档

## API参数说明


程序将用户输入的URL作为`article_url`参数发送给Coze工作流API。

## 注意事项

- 请确保输入的URL是有效的
- 程序会自动处理中文编码 
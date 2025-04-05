/**
 * @fileoverview 插件弹出窗口的JavaScript文件
 * @author AI助手
 * @version 1.0.0
 */

document.addEventListener('DOMContentLoaded', function() {
  const urlInput = document.getElementById('url-input');
  const submitBtn = document.getElementById('submit-btn');
  const resultArea = document.getElementById('result');
  const loadingElem = document.getElementById('loading');
  const errorElem = document.getElementById('error');
  
  // 简单的Markdown转HTML函数，避免依赖window.marked
  function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    // 处理标题
    markdown = markdown.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    markdown = markdown.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    markdown = markdown.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // 处理粗体和斜体
    markdown = markdown.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
    markdown = markdown.replace(/\*(.*)\*/gim, '<em>$1</em>');
    
    // 处理链接
    markdown = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>');
    
    // 处理代码块
    markdown = markdown.replace(/```([^`]*?)```/gims, '<pre><code>$1</code></pre>');
    
    // 处理行内代码
    markdown = markdown.replace(/`([^`]+)`/gim, '<code>$1</code>');
    
    // 处理段落
    markdown = markdown.replace(/\n\n/g, '</p><p>');
    
    // 最终包装
    return '<p>' + markdown + '</p>';
  }
  
  // 获取当前活动标签页的URL并填入输入框
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs[0] && tabs[0].url) {
      urlInput.value = tabs[0].url;
    }
  });

  // 提交按钮点击事件
  submitBtn.addEventListener('click', function() {
    const url = urlInput.value.trim();
    
    if (!url) {
      showError('请输入有效的URL');
      return;
    }
    
    // 显示加载状态
    loadingElem.style.display = 'block';
    resultArea.style.display = 'none';
    errorElem.style.display = 'none';
    
    // 发送消息给后台脚本处理API调用
    chrome.runtime.sendMessage({
      action: 'callCozeAPI',
      url: url
    }, function(response) {
      loadingElem.style.display = 'none';
      
      if (response.error) {
        showError(response.error);
      } else {
        showResult(response.data);
      }
    });
  });
  
  /**
   * 显示错误信息
   * @param {string} message - 错误信息
   */
  function showError(message) {
    errorElem.textContent = message;
    errorElem.style.display = 'block';
    resultArea.style.display = 'none';
  }
  
  /**
   * 从JSON提取文本内容
   * @param {Object} data - API返回数据
   * @returns {string} 提取的文本内容
   */
  function extractContent(data) {
    try {
      console.log('处理API返回数据:', data);
      
      // 检查是否为成功的响应
      if (data && data.code === 0) {
        // 提取文章内容
        if (data.data) {
          // 方式1: 通常的内容结构
          if (data.data.content_type === 1 && data.data.data) {
            console.log('提取到内容(方式1)');
            return data.data.data;
          }
          
          // 方式2: 直接是字符串
          if (typeof data.data === 'string') {
            console.log('提取到内容(方式2)');
            return data.data;
          }
          
          // 方式3: 在data字段中的其他地方
          if (typeof data.data === 'object') {
            // 查找任何可能包含文章内容的属性
            for (const key in data.data) {
              if (typeof data.data[key] === 'string' && data.data[key].length > 100) {
                console.log('提取到内容(方式3)', key);
                return data.data[key];
              }
            }
          }
        }
        
        // 无法找到实际内容，返回格式化的完整响应
        console.log('未找到内容，显示完整响应');
        return `# 请求成功\n\n${data.msg || 'Success'}\n\n## 详细信息\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
      }
      
      // 非成功响应，返回格式化的完整响应
      return `# API调用结果\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
    } catch (error) {
      console.error('处理返回数据时出错:', error);
      // 处理过程中发生错误
      return `# 处理结果时出错\n\n${error.message}\n\n## 原始数据\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\``;
    }
  }
  
  /**
   * 显示API调用结果
   * @param {Object} data - API返回数据
   */
  function showResult(data) {
    try {
      // 提取内容
      const content = extractContent(data);
      console.log('提取的内容长度:', content.length);
      
      // 直接使用内部函数转换Markdown到HTML
      resultArea.innerHTML = markdownToHtml(content);
      resultArea.style.display = 'block';
      
      console.log('内容显示完成');
    } catch (error) {
      console.error('显示结果时出错:', error);
      // 出错时直接显示原始JSON
      resultArea.innerHTML = '<p style="color:red;">显示结果时出错: ' + error.message + '</p>' + 
                            '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
      resultArea.style.display = 'block';
    }
  }
}); 
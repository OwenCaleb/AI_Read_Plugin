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
  const closeBtn = document.getElementById('close-btn');
  const popupContainer = document.getElementById('popup-container');
  const debugSection = document.getElementById('debug-section');
  const debugInfo = document.getElementById('debug-info');
  const streamingStatus = document.getElementById('streaming-status');
  
  // 存储流式响应的累积内容
  let accumulatedContent = '';
  // 流式更新状态
  let isStreaming = false;
  
  // 阻止点击事件冒泡
  popupContainer.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  
  // 防止链接点击关闭弹窗
  document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A') {
      e.preventDefault();
      e.stopPropagation();
      chrome.tabs.create({ url: e.target.href });
    }
  }, true);
  
  // 添加关闭按钮功能
  closeBtn.addEventListener('click', function() {
    window.close();
  });
  
  // 保持Markdown格式的HTML转换
  function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    try {
      // 安全处理：转义HTML特殊字符
      function escapeHtml(text) {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
      
      // 首先对整个内容进行HTML转义
      markdown = escapeHtml(markdown);
      
      // 分步处理，保持原始格式
      
      // 首先处理代码块，避免其内容被错误格式化
      let codeBlocks = [];
      markdown = markdown.replace(/```([\s\S]*?)```/gm, function(match, code) {
        const escapedCode = code.trim();
        codeBlocks.push(escapedCode);
        return "___CODE_BLOCK_" + (codeBlocks.length - 1) + "___";
      });
      
      // 处理行内代码
      let inlineCodes = [];
      markdown = markdown.replace(/`([^`]+)`/gm, function(match, code) {
        inlineCodes.push(code);
        return "___INLINE_CODE_" + (inlineCodes.length - 1) + "___";
      });
      
      // 处理标题
      markdown = markdown.replace(/^### (.*$)/gim, '<h3>$1</h3>');
      markdown = markdown.replace(/^## (.*$)/gim, '<h2>$1</h2>');
      markdown = markdown.replace(/^# (.*$)/gim, '<h1>$1</h1>');
      
      // 处理无序列表
      let listMatches = markdown.match(/^[*\-+] (.*)$/gm);
      if (listMatches) {
        let listItems = listMatches.map(item => '<li>' + item.substring(2) + '</li>');
        for (let i = 0; i < listMatches.length; i++) {
          markdown = markdown.replace(listMatches[i], "___LIST_ITEM_" + i + "___");
        }
        // 合并相邻的列表项
        markdown = markdown.replace(/(___LIST_ITEM_\d+___\s*)+/g, function(match) {
          const indices = match.match(/\d+/g);
          return '<ul>' + indices.map(i => listItems[parseInt(i)]).join('') + '</ul>';
        });
      }
      
      // 处理有序列表
      let orderedListMatches = markdown.match(/^\d+\.\s(.*)$/gm);
      if (orderedListMatches) {
        let listItems = orderedListMatches.map(item => {
          const content = item.replace(/^\d+\.\s/, '');
          return '<li>' + content + '</li>';
        });
        for (let i = 0; i < orderedListMatches.length; i++) {
          markdown = markdown.replace(orderedListMatches[i], "___ORDERED_LIST_ITEM_" + i + "___");
        }
        // 合并相邻的列表项
        markdown = markdown.replace(/(___ORDERED_LIST_ITEM_\d+___\s*)+/g, function(match) {
          const indices = match.match(/\d+/g);
          return '<ol>' + indices.map(i => listItems[parseInt(i)]).join('') + '</ol>';
        });
      }
      
      // 处理粗体和斜体
      markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      // 处理链接
      markdown = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, text, url) {
        // 确保URL安全
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url.replace(/^\/\//, '');
        }
        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>';
      });
      
      // 处理图片
      markdown = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, src) {
        return '<img src="' + src + '" alt="' + alt + '" style="max-width:100%;">';
      });
      
      // 处理表格 (简单支持)
      const tableRegex = /\|(.+)\|[\s]*\n\|([-:]+[-| :]*)\|[\s]*\n(\|.+\|[\s]*\n)+/g;
      markdown = markdown.replace(tableRegex, function(table) {
        // 分割表格行
        const rows = table.trim().split('\n');
        
        // 提取表头
        const headerRow = rows[0];
        const headers = headerRow.split('|').slice(1, -1);
        
        // 忽略分隔符行
        
        // 提取数据行
        const dataRows = rows.slice(2);
        
        // 构建HTML表格
        let htmlTable = '<table border="1" cellpadding="5" style="border-collapse:collapse;">\n';
        
        // 添加表头
        htmlTable += '<thead><tr>';
        for (let header of headers) {
          htmlTable += '<th>' + header.trim() + '</th>';
        }
        htmlTable += '</tr></thead>\n';
        
        // 添加表内容
        htmlTable += '<tbody>';
        for (let row of dataRows) {
          htmlTable += '<tr>';
          const cells = row.split('|').slice(1, -1);
          for (let cell of cells) {
            htmlTable += '<td>' + cell.trim() + '</td>';
          }
          htmlTable += '</tr>\n';
        }
        htmlTable += '</tbody></table>';
        
        return htmlTable;
      });
      
      // 处理段落（双空行分隔）
      markdown = markdown.replace(/\n\n+/g, '</p><p>');
      
      // 处理单行换行
      markdown = markdown.replace(/\n/g, '<br>');
      
      // 恢复代码块，使用高亮样式
      for (let i = 0; i < codeBlocks.length; i++) {
        markdown = markdown.replace(
          "___CODE_BLOCK_" + i + "___", 
          '<pre><code class="code-block">' + codeBlocks[i] + '</code></pre>'
        );
      }
      
      // 恢复行内代码
      for (let i = 0; i < inlineCodes.length; i++) {
        markdown = markdown.replace(
          "___INLINE_CODE_" + i + "___", 
          '<code class="inline-code">' + inlineCodes[i] + '</code>'
        );
      }
      
      // 最终包装并返回
      return '<div class="markdown-content"><p>' + markdown + '</p></div>';
    } catch (error) {
      console.error('Markdown转HTML出错:', error);
      return '<pre>' + escapeHtml(markdown) + '</pre>';
    }
  }
  
  // 获取当前活动标签页的URL并填入输入框
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs[0] && tabs[0].url) {
      urlInput.value = tabs[0].url;
    }
  });

  // 监听来自background.js的流式更新消息
  chrome.runtime.onMessage.addListener(function(message) {
    if (message.action === 'streamUpdate' && message.data) {
      // 处理流式数据更新
      handleStreamUpdate(message.data);
    } else if (message.action === 'streamComplete') {
      // 流式处理完成
      console.log('流式处理完成');
      showStreamingStatus(false);
    }
  });
  
  /**
   * 处理流式数据更新
   * @param {Object} data - 流式数据片段
   */
  function handleStreamUpdate(data) {
    try {
      console.log('收到流式更新:', data);
      
      // 处理流式响应格式
      let contentChunk = '';
      
      // 检查是否是API返回的流式格式
      if (data && typeof data === 'object') {
        // 首先检查是否有解析好的嵌套数据
        if (data.parsedData) {
          // 处理已解析的嵌套JSON
          const parsedData = data.parsedData;
          if (parsedData.content_type === 1 && typeof parsedData.data === 'string') {
            contentChunk = parsedData.data;
            console.log('从parsedData中提取content_type=1格式的data:', contentChunk);
          } else if (parsedData.data) {
            contentChunk = typeof parsedData.data === 'string' ? parsedData.data : JSON.stringify(parsedData.data);
            console.log('从parsedData中提取data字段:', contentChunk);
          }
        }
        // 如果parsedData没有提供有效内容，继续检查content字段
        else if (data.content) {
          // 直接使用content字段的内容
          contentChunk = data.content;
          console.log('从content字段提取到内容片段:', contentChunk);
        } 
        // 如果数据具有data字段，可能是嵌套结构
        else if (data.data) {
          try {
            // 检查data字段是否是字符串形式的JSON
            if (typeof data.data === 'string') {
              const innerData = JSON.parse(data.data);
              if (innerData && innerData.data) {
                // 提取内嵌JSON中的data字段
                contentChunk = innerData.data;
                console.log('从嵌套data.data字段提取到内容:', contentChunk);
              } else if (innerData && innerData.content) {
                // 或者content字段
                contentChunk = innerData.content;
                console.log('从嵌套data.content字段提取到内容:', contentChunk);
              }
            } else if (typeof data.data === 'object' && data.data.data) {
              // 直接嵌套的对象结构
              contentChunk = data.data.data;
              console.log('从直接嵌套的data.data字段提取到内容:', contentChunk);
            }
          } catch (e) {
            console.warn('解析嵌套JSON出错:', e);
            // 如果解析失败，尝试直接使用data字段
            contentChunk = typeof data.data === 'string' ? data.data : '';
          }
        }
      }
      
      // 如果上述方法都未能提取内容，尝试使用通用提取方法
      if (!contentChunk) {
        contentChunk = extractDataContentOnly(data);
      }
      
      if (contentChunk) {
        // 累积内容
        accumulatedContent += contentChunk;
        
        // 更新界面
        resultArea.innerHTML = markdownToHtml(accumulatedContent);
        resultArea.style.display = 'block';
        
        // 确保滚动到底部以显示最新内容
        resultArea.scrollTop = resultArea.scrollHeight;
        
        // 隐藏加载状态，因为我们已经开始显示内容
        loadingElem.style.display = 'none';
        // 显示流式状态
        showStreamingStatus(true);
      }
    } catch (error) {
      console.error('处理流式更新出错:', error);
    }
  }
  
  /**
   * 显示或隐藏流式状态指示器
   * @param {boolean} show - 是否显示
   */
  function showStreamingStatus(show) {
    streamingStatus.style.display = show ? 'block' : 'none';
    
    // 如果完成流式响应，隐藏加载状态
    if (!show) {
      loadingElem.style.display = 'none';
      isStreaming = false;
    }
  }

  // 提交按钮点击事件
  submitBtn.addEventListener('click', function() {
    const url = urlInput.value.trim();
    
    if (!url) {
      showError('请输入有效的URL');
      return;
    }
    
    // 重置累积内容和流式状态
    accumulatedContent = '';
    isStreaming = false;
    showStreamingStatus(false);
    
    // 显示加载状态
    loadingElem.style.display = 'block';
    resultArea.style.display = 'none';
    errorElem.style.display = 'none';
    debugSection.style.display = 'none';
    
    // 发送消息给后台脚本处理API调用
    chrome.runtime.sendMessage({
      action: 'callCozeAPI',
      url: url
    }, function(response) {
      // 流式响应已经通过事件处理，这里处理最终状态
      showStreamingStatus(false); // 关闭流式状态
      loadingElem.style.display = 'none';
      debugInfo.innerHTML = ''; // 清除之前的调试信息
      
      if (response && response.error) {
        showError(response.error);
        // 显示调试信息
        debugSection.style.display = 'block';
        
        if (response.errorDetail) {
          addDebugInfo('API URL', response.errorDetail.url);
          addDebugInfo('工作流ID', response.errorDetail.workflowId);
          addDebugInfo('时间', response.errorDetail.time);
          addDebugInfo('详细错误', response.errorDetail.detail);
        } else {
          addDebugInfo('错误详情', response.error);
        }
        addDebugInfo('请求URL', url);
      } else if (!accumulatedContent) {
        // 如果没有通过流式更新收到内容，显示完整响应
        showResult(response.data);
      }
    });
  });
  
  /**
   * 显示错误信息
   * @param {string} message - 错误信息
   */
  function showError(message) {
    // 为了安全起见，处理长消息
    const maxLength = 150;
    let displayMessage = message;
    
    if (message.length > maxLength) {
      // 提取最重要的错误信息部分
      if (message.includes('HTTP错误')) {
        // 提取HTTP错误部分
        const match = message.match(/(HTTP错误 \d+:[^-]*)-(.*)/);
        if (match) {
          const statusPart = match[1].trim();
          let detailPart = match[2].trim();
          
          // 检查是否有JSON错误详情
          try {
            const jsonStart = detailPart.indexOf('{');
            if (jsonStart !== -1) {
              const jsonPart = detailPart.substring(jsonStart);
              const errorObj = JSON.parse(jsonPart);
              if (errorObj.code && errorObj.message) {
                detailPart = `${errorObj.code}: ${errorObj.message}`;
              }
            }
          } catch (e) {
            // JSON解析失败，使用原始错误信息
            console.log('无法解析错误详情JSON:', e);
          }
          
          displayMessage = `${statusPart} - ${detailPart}`;
        }
      } else {
        // 截断普通长消息
        displayMessage = message.substring(0, maxLength) + '...';
      }
    }
    
    console.error('显示错误:', displayMessage);
    errorElem.textContent = displayMessage;
    errorElem.style.display = 'block';
    resultArea.style.display = 'none';
  }
  
  /**
   * 处理文本中的转义字符
   * @param {string} text - 需要处理的文本
   * @returns {string} 处理后的文本
   */
  function unescapeText(text) {
    if (!text || typeof text !== 'string') return text;
    
    // 替换常见的转义序列
    return text
      .replace(/\\"/g, '"')     // 双引号
      .replace(/\\'/g, "'")     // 单引号
      .replace(/\\n/g, '\n')    // 换行
      .replace(/\\r/g, '\r')    // 回车
      .replace(/\\t/g, '\t')    // 制表符
      .replace(/\\\\/g, '\\');  // 反斜杠
  }
  
  /**
   * 递归寻找并提取JSON对象中的data字段
   * 优先提取最深层的data字段的值
   * @param {Object} obj - JSON对象
   * @returns {string|null} 找到的data值或null
   */
  function findDataValue(obj) {
    // 如果不是对象，返回null
    if (!obj || typeof obj !== 'object') return null;
    
    // 递归函数，帮助深入查找data字段
    function recursiveFind(currentObj, path = []) {
      let results = [];
      
      // 如果当前对象有data字段
      if (currentObj.hasOwnProperty('data')) {
        const dataValue = currentObj.data;
        if (typeof dataValue === 'string') {
          results.push({
            path: [...path, 'data'],
            value: dataValue,
            depth: path.length + 1
          });
        } else if (dataValue && typeof dataValue === 'object') {
          // 如果data字段的值是对象，继续递归查找
          const nestedResults = recursiveFind(dataValue, [...path, 'data']);
          results = results.concat(nestedResults);
        }
      }
      
      // 查找所有字段
      for (const key in currentObj) {
        if (key !== 'data' && currentObj[key] && typeof currentObj[key] === 'object') {
          const nestedResults = recursiveFind(currentObj[key], [...path, key]);
          results = results.concat(nestedResults);
        }
      }
      
      return results;
    }
    
    // 执行递归查找
    const allDataFields = recursiveFind(obj);
    
    // 如果找到data字段，按深度排序，优先返回最深的
    if (allDataFields.length > 0) {
      allDataFields.sort((a, b) => b.depth - a.depth);
      return allDataFields[0].value;
    }
    
    return null;
  }
  
  /**
   * 从API响应中提取纯内容，仅保留data字段内容
   * @param {Object|string} apiResponse - API返回数据
   * @returns {string} 提取的纯内容
   */
  function extractDataContentOnly(apiResponse) {
    try {
      console.log('原始API响应:', apiResponse);
      
      // 如果响应是字符串，尝试解析为JSON
      let data = apiResponse;
      if (typeof apiResponse === 'string') {
        try {
          data = JSON.parse(apiResponse);
        } catch(e) {
          // 不是合法的JSON，直接返回
          return apiResponse;
        }
      }
      
      // 直接处理content_type格式的情况
      if (data && typeof data === 'object') {
        // 特殊处理 content_type 为 1 的情况，这是最常见的格式
        if (data.content_type === 1 && typeof data.data === 'string') {
          console.log('找到content_type=1格式的数据');
          return unescapeText(data.data);
        }
        
        // 提取JSON结构中的content_type和data格式
        if (typeof data === 'string' && data.includes('content_type') && data.includes('data')) {
          try {
            const parsedData = JSON.parse(data);
            if (parsedData.content_type === 1 && typeof parsedData.data === 'string') {
              return unescapeText(parsedData.data);
            }
          } catch (e) {
            // 解析失败，继续下一步
          }
        }
        
        // 尝试用递归方式找到data字段
        const dataContent = findDataValue(data);
        if (dataContent) {
          // 检查是否是JSON字符串，可能包含content_type和data
          if (typeof dataContent === 'string' && 
              (dataContent.includes('"content_type"') || dataContent.includes('"data"'))) {
            try {
              const parsedContent = JSON.parse(dataContent);
              // 如果有content_type和data字段
              if (parsedContent.content_type === 1 && typeof parsedContent.data === 'string') {
                return unescapeText(parsedContent.data);
              }
              // 如果只有data字段
              if (typeof parsedContent.data === 'string') {
                return unescapeText(parsedContent.data);
              }
            } catch (e) {
              // JSON解析失败，继续使用原始内容
              return unescapeText(dataContent);
            }
          }
          
          // 处理转义字符
          return unescapeText(dataContent);
        }
        
        // 退回标准方式：code-data-data结构
        if (data.code === 0 && data.data) {
          // 如果data.data包含content_type和data
          if (data.data.content_type === 1 && typeof data.data.data === 'string') {
            return unescapeText(data.data.data);
          }
          
          if (typeof data.data === 'string') {
            // 检查data.data是否是JSON字符串
            try {
              const parsedDataData = JSON.parse(data.data);
              if (parsedDataData.content_type === 1 && typeof parsedDataData.data === 'string') {
                return unescapeText(parsedDataData.data);
              }
            } catch (e) {
              // 不是JSON，使用原文
              return unescapeText(data.data);
            }
          }
        }
      }
      
      // 最后尝试直接解析原始JSON字符串
      if (typeof apiResponse === 'string') {
        // 尝试提取JSON字符串中的data字段
        const dataMatch = apiResponse.match(/"data"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (dataMatch && dataMatch[1]) {
          return unescapeText(dataMatch[1]);
        }
      }
      
      // 如果无法找到data，返回友好提示
      return "无法提取有效内容，请检查API响应或更换URL。";
    } catch (error) {
      console.error('提取内容出错:', error);
      return `提取内容时出错: ${error.message}`;
    }
  }
  
  /**
   * 显示API调用结果
   * @param {Object} data - API返回数据
   */
  function showResult(data) {
    try {
      // 仅提取data内容
      const pureContent = extractDataContentOnly(data);
      console.log('提取后的纯内容:', pureContent);
      
      // 渲染为HTML
      resultArea.innerHTML = markdownToHtml(pureContent);
      resultArea.style.display = 'block';
      
      console.log('渲染完成');
    } catch (error) {
      console.error('显示结果时出错:', error);
      resultArea.innerHTML = '<div style="color:red;">渲染失败: ' + error.message + '</div>';
      resultArea.style.display = 'block';
    }
  }
  
  /**
   * 添加调试信息
   * @param {string} label - 信息标签
   * @param {string} content - 信息内容
   */
  function addDebugInfo(label, content) {
    const contentStr = typeof content === 'object' ? 
      JSON.stringify(content, null, 2) : String(content);
    
    const debugEntry = document.createElement('div');
    debugEntry.innerHTML = `<strong>${label}:</strong> <span>${contentStr}</span>`;
    debugInfo.appendChild(debugEntry);
  }
}); 
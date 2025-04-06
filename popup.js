/**
 * @fileoverview 扩展的弹出界面脚本
 * @author AI助手
 * @version 1.0.0
 */

document.addEventListener('DOMContentLoaded', function() {
  // 知识库ID常量
  const COZE_KNOWLEDGE_ID = '7490072439570546722';
  
  const urlInput = document.getElementById('url-input');
  const submitBtn = document.getElementById('submit-btn');
  const saveToKnowledgeBtn = document.getElementById('save-to-knowledge-btn');
  const resultArea = document.getElementById('result');
  const loadingElem = document.getElementById('loading');
  const errorElem = document.getElementById('error');
  const closeBtn = document.getElementById('close-btn');
  const popupContainer = document.getElementById('popup-container');
  const debugSection = document.getElementById('debug-section');
  const debugInfo = document.getElementById('debug-info');
  const streamingStatus = document.getElementById('streaming-status');
  const knowledgeSaveStatus = document.getElementById('knowledge-save-status');
  const knowledgeSaveMessage = document.getElementById('knowledge-save-message');
  const viewKnowledgeBtn = document.getElementById('view-knowledge-btn');
  
  // 存储流式响应的累积内容
  let accumulatedContent = '';
  // 流式更新状态
  let isStreaming = false;
  
  // 重置知识库状态
  if (knowledgeSaveStatus) {
    knowledgeSaveStatus.style.display = 'none';
  }
  
  if (viewKnowledgeBtn) {
    viewKnowledgeBtn.style.display = 'none';
  }
  
  // 初始时重置界面状态
  resetUI();
  
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
  
  // 获取当前活动标签页的URL并填入输入框
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs[0] && tabs[0].url) {
      urlInput.value = tabs[0].url;
    }
  });

  // 监听来自background.js的流式更新消息
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('收到消息:', message.action, message);
    
    const resultArea = document.getElementById('result');
    const loadingElem = document.getElementById('loading');
    
    if (message.action === 'streamUpdate' && message.data) {
      // 处理流式数据更新
      isStreaming = true;
      handleStreamUpdate(message.data);
    } 
    else if (message.action === 'streamComplete' || message.action === 'streamEnd') {
      // 流式处理完成
      console.log('流式处理完成');
      isStreaming = false;
      showStreamingStatus(false);
      
      // 隐藏加载状态
      if (loadingElem) loadingElem.style.display = 'none';
      console.log('流式处理结束，累积内容:', accumulatedContent);
    } 
    else if (message.action === 'knowledgeSaveResult') {
      console.log('收到知识库保存结果:', message);
      
      // 处理不同的保存状态
      if (message.status === 'processing') {
        // 处理中状态
        showKnowledgeStatus('正在提交到知识库，请稍候...', false);
      } else if (message.success) {
        // 成功状态
        let successMsg = '保存到知识库成功！可以在Coze平台查看。';
        
        // 如果有更详细的信息，添加到消息中
        if (message.detail && message.detail.message) {
          successMsg = message.detail.message;
        }
        
        showKnowledgeStatus(successMsg, false);
        
        // 添加调试信息
        const debugSection = document.getElementById('debug-section');
        const debugInfo = document.getElementById('debug-info');
        
        if (debugSection && debugInfo && typeof addDebugInfo === 'function') {
          debugSection.style.display = 'block';
          debugInfo.innerHTML = ''; // 清除之前的信息
          
          addDebugInfo('知识库保存', '成功');
          
          if (message.detail && message.detail.documentInfo) {
            const docInfo = message.detail.documentInfo;
            addDebugInfo('文档ID', docInfo.documentId);
            addDebugInfo('文档名称', docInfo.name);
            addDebugInfo('文档状态', docInfo.status);
            addDebugInfo('创建时间', docInfo.createTime);
          }
        }
      } else {
        // 错误状态
        const errorMsg = message.error || '未知错误';
        showKnowledgeStatus(`保存到知识库失败: ${errorMsg}`, true);
      }
    } 
    else if (message.action === 'error') {
      if (loadingElem) loadingElem.style.display = 'none';
      
      // 在结果区域显示错误
      if (resultArea) {
        resultArea.innerHTML = `<p class="error">错误: ${message.error || '未知错误'}</p>`;
        resultArea.style.display = 'block';
      }
      
      // 同时在错误区域显示错误
      const errorElem = document.getElementById('error');
      if (errorElem) {
        errorElem.textContent = message.error || '未知错误';
        errorElem.style.display = 'block';
      }
      
      isStreaming = false;
      showStreamingStatus(false);
      
      // 添加调试信息
      if (message.errorDetail) {
        const debugSection = document.getElementById('debug-section');
        const debugInfo = document.getElementById('debug-info');
        if (debugSection && debugInfo) {
          debugSection.style.display = 'block';
          debugInfo.innerHTML = '';
          
          if (typeof addDebugInfo === 'function') {
            addDebugInfo('API URL', message.errorDetail.url);
            addDebugInfo('工作流ID', message.errorDetail.workflowId);
            addDebugInfo('时间', message.errorDetail.time);
            addDebugInfo('详细错误', message.errorDetail.detail);
          }
        }
      }
    }
    
    // 确保响应
    if (sendResponse) {
      sendResponse({ received: true });
    }
    return true; // 保持通道开放用于异步响应
  });

  // 提交按钮点击事件
  submitBtn.addEventListener('click', function() {
    const url = urlInput.value.trim();
    
    if (!url) {
      showError('请输入有效的URL');
      return;
    }
    
    // 重置界面状态
    resetUI();
    
    // 显示加载状态
    loadingElem.style.display = 'block';
    
    // 发送消息给后台脚本处理API调用
    chrome.runtime.sendMessage({
      action: 'callCozeAPI',
      url: url
    }, function(response) {
      // 流式响应已经通过事件处理，这里处理最终状态或错误
      if (response && response.error) {
        showError(response.error);
        
        // 显示调试信息
        debugSection.style.display = 'block';
        debugInfo.innerHTML = ''; // 清除之前的调试信息
        
        if (response.errorDetail) {
          addDebugInfo('API URL', response.errorDetail.url);
          addDebugInfo('工作流ID', response.errorDetail.workflowId);
          addDebugInfo('时间', response.errorDetail.time);
          addDebugInfo('详细错误', response.errorDetail.detail);
        } else {
          addDebugInfo('错误详情', response.error);
        }
        addDebugInfo('请求URL', url);
      } else if (!accumulatedContent && response && response.data) {
        // 如果没有通过流式更新收到内容，显示完整响应
        showResult(response.data);
      }
    });
  });
  
  // 保存到知识库按钮点击事件
  saveToKnowledgeBtn.addEventListener('click', function() {
    const url = urlInput.value.trim();
    
    if (!url) {
      showError('请输入有效的URL');
      return;
    }
    
    console.log('====== 开始保存到知识库流程 ======');
    console.log('请求URL:', url);
    
    // 添加初始调试信息
    addDebugInfo('操作', '正在保存到知识库');
    addDebugInfo('请求URL', url);
    addDebugInfo('请求时间', new Date().toLocaleString());
    addDebugInfo('状态', '正在发送请求...');
    
    // 在结果区域显示处理状态
    if (resultArea) {
      resultArea.innerHTML = '<p>正在提交网页到知识库，请稍候...</p>';
      resultArea.style.display = 'block';
    }
    
    // 显示"正在处理"状态
    if (knowledgeSaveStatus) {
      knowledgeSaveStatus.className = 'knowledge-save-status info';
      knowledgeSaveStatus.style.display = 'block';
    }
    
    if (knowledgeSaveMessage) {
      knowledgeSaveMessage.textContent = '正在保存URL到知识库...';
    }
    
    if (viewKnowledgeBtn) {
      viewKnowledgeBtn.style.display = 'none';
    }
    
    console.log('发送saveToKnowledge请求:', url);
    
    // 直接发送URL到知识库
    chrome.runtime.sendMessage({
      action: 'saveToKnowledge',
      url: url
    }, function(response) {
      console.log('收到saveToKnowledge响应:', response);
      
      // 添加响应调试信息
      addDebugInfo('收到响应', new Date().toLocaleString());
      addDebugInfo('响应数据', JSON.stringify(response || {无响应: true}));
      
      // 如果没有收到响应，显示错误
      if (!response) {
        const errorMsg = '与扩展后台通信失败，请重试。';
        console.error(errorMsg);
        addDebugInfo('知识库保存', '失败');
        addDebugInfo('错误详情', errorMsg);
        addDebugInfo('时间', new Date().toLocaleString());
        
        showKnowledgeStatus(errorMsg, true);
        
        if (resultArea) {
          resultArea.innerHTML = `<p class="error">保存失败：${errorMsg}</p>`;
        }
        
        return;
      }
      
      // 根据响应结果显示成功或失败信息
      if (response.success) {
        let successMsg = '保存到知识库成功！可以在Coze平台查看。';
        if (response.detail && response.detail.message) {
          successMsg = response.detail.message;
        }
        
        console.log('保存成功:', successMsg);
        addDebugInfo('知识库保存', '成功');
        addDebugInfo('成功信息', successMsg);
        addDebugInfo('时间', new Date().toLocaleString());
        
        showKnowledgeStatus(successMsg, false);
        
        if (resultArea) {
          resultArea.innerHTML = `<p class="success">✓ ${successMsg}</p>`;
        }
        
        // 如果有文档信息，添加到调试区域
        if (response.detail && response.detail.documentInfo) {
          const info = response.detail.documentInfo;
          addDebugInfo('文档ID', info.documentId || '未提供');
          addDebugInfo('文档名称', info.name || '未提供');
          addDebugInfo('状态', info.status || '未提供');
        }
        
        // 显示查看知识库按钮
        if (viewKnowledgeBtn) {
          viewKnowledgeBtn.href = `https://www.coze.cn/space/7489827677814276132/knowledge/${COZE_KNOWLEDGE_ID}`;
          viewKnowledgeBtn.style.display = 'inline-block';
        }
      } else {
        // 失败情况
        const errorMsg = response.error || '未知错误';
        console.error('保存失败:', errorMsg);
        
        addDebugInfo('知识库保存', '失败');
        addDebugInfo('错误详情', `保存到知识库失败: ${errorMsg}`);
        addDebugInfo('时间', new Date().toLocaleString());
        
        addDebugInfo('操作结果', '失败');
        addDebugInfo('错误消息', errorMsg);
        addDebugInfo('时间', new Date().toLocaleString());
        
        showKnowledgeStatus(`保存到知识库失败: ${errorMsg}`, true);
        
        if (resultArea) {
          resultArea.innerHTML = `<p class="error">保存失败：${errorMsg}</p>`;
          resultArea.style.display = 'block'; // 确保显示
        }
      }
    });
  });
});

/**
 * 显示或隐藏流式处理状态
 * @param {boolean} isStreaming - 是否正在流式处理
 */
function showStreamingStatus(isStreaming) {
  const statusElem = document.getElementById('streaming-status');
  if (!statusElem) return;
  
  if (isStreaming) {
    statusElem.textContent = '正在接收回答...';
    statusElem.style.display = 'block';
  } else {
    statusElem.textContent = '响应完成';
    statusElem.style.display = 'none';
  }
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息
 */
function showError(message) {
  const errorElem = document.getElementById('error');
  const resultArea = document.getElementById('result');
  
  if (!errorElem) return;
  
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
  if (resultArea) resultArea.style.display = 'none';
}

/**
 * 显示API调用结果
 * @param {Object} data - API返回数据
 */
function showResult(data) {
  try {
    const resultArea = document.getElementById('result');
    if (!resultArea) return;
    
    // 仅提取data内容
    const pureContent = extractDataContentOnly(data);
    console.log('提取后的纯内容:', pureContent);
    
    // 渲染为HTML
    resultArea.innerHTML = markdownToHtml(pureContent);
    resultArea.style.display = 'block';
    
    console.log('渲染完成');
  } catch (error) {
    console.error('显示结果时出错:', error);
    const resultArea = document.getElementById('result');
    if (resultArea) {
      resultArea.innerHTML = '<div style="color:red;">渲染失败: ' + error.message + '</div>';
      resultArea.style.display = 'block';
    }
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

/**
 * 从数据中提取内容文本的通用方法
 * @param {Object} data - 数据对象
 * @returns {string} 提取的文本内容
 */
function extractDataContentOnly(data) {
  if (!data) return '';
  
  // 如果是字符串，直接返回
  if (typeof data === 'string') return data;
  
  // 如果是对象，遍历所有可能包含内容的属性
  if (typeof data === 'object') {
    // 优先检查可能包含内容的常见字段
    const contentFields = ['content', 'data', 'text', 'message', 'result'];
    
    for (const field of contentFields) {
      if (data[field]) {
        if (typeof data[field] === 'string') {
          return data[field];
        } else if (typeof data[field] === 'object') {
          // 递归检查嵌套对象
          const nestedContent = extractDataContentOnly(data[field]);
          if (nestedContent) return nestedContent;
        }
      }
    }
    
    // 如果没有找到内容，尝试将整个对象转为字符串
    try {
      return JSON.stringify(data);
    } catch (e) {
      console.warn('无法将对象转为字符串:', e);
    }
  }
  
  return '';
}

/**
 * 将Markdown格式转换为HTML
 * @param {string} markdown - Markdown格式的文本
 * @returns {string} 转换后的HTML
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';
  
  // 简单的Markdown到HTML转换
  let html = markdown
    // 代码块
    .replace(/```(\w*)([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 标题
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // 粗体
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // 列表项
    .replace(/^\s*[\-*+]\s+(.*)/gm, '<li>$1</li>')
    // 段落
    .replace(/^(?!<[h|l|p|u])(.*$)/gm, '<p>$1</p>')
    // 清理空段落
    .replace(/<p><\/p>/g, '');
    
  return html;
}

/**
 * 显示或隐藏知识库保存状态
 * @param {string} status - 状态消息
 * @param {boolean} isError - 是否为错误状态
 */
function showKnowledgeStatus(status, isError = false) {
  console.log('更新知识库状态:', status, '是否错误:', isError);
  
  const statusElem = document.getElementById('knowledge-save-status');
  const messageElem = document.getElementById('knowledge-save-message');
  const viewBtn = document.getElementById('view-knowledge-btn');
  
  if (!statusElem || !messageElem) {
    console.error('找不到知识库状态元素');
    return;
  }
  
  // 设置消息内容
  messageElem.textContent = status;
  
  // 显示状态区域
  statusElem.style.display = 'block';
  
  // 根据状态设置颜色和类名
  if (isError) {
    console.log('显示错误状态');
    statusElem.className = 'knowledge-save-status error';
    if (viewBtn) viewBtn.style.display = 'none';
    
    // 添加更多调试信息
    const debugSection = document.getElementById('debug-section');
    const debugInfo = document.getElementById('debug-info');
    
    if (debugSection && debugInfo && typeof addDebugInfo === 'function') {
      debugSection.style.display = 'block';
      // 添加基本错误信息
      addDebugInfo('知识库保存', '失败');
      addDebugInfo('错误详情', status);
      addDebugInfo('时间', new Date().toLocaleString());
    }
  } else if (status.includes('处理') || status.includes('正在')) {
    console.log('显示处理中状态');
    // 处理中状态
    statusElem.className = 'knowledge-save-status info';
    if (viewBtn) viewBtn.style.display = 'none';
  } else {
    console.log('显示成功状态');
    // 成功状态
    statusElem.className = 'knowledge-save-status success';
    if (viewBtn && status.includes('成功')) {
      viewBtn.style.display = 'inline-block';
      
      // 设置查看按钮点击动作
      viewBtn.onclick = function() {
        // 打开Coze知识库页面
        chrome.tabs.create({ url: 'https://www.coze.cn/space/datasets' });
      };
    }
  }
}

/**
 * 重置界面状态
 */
function resetUI() {
  // 获取所有UI元素
  const resultArea = document.getElementById('result');
  const loadingElem = document.getElementById('loading');
  const errorElem = document.getElementById('error');
  const debugSection = document.getElementById('debug-section');
  const debugInfo = document.getElementById('debug-info');
  const knowledgeStatus = document.getElementById('knowledge-save-status');
  const viewKnowledgeBtn = document.getElementById('view-knowledge-btn');
  const streamingStatusElem = document.getElementById('streaming-status');
  
  // 重置结果区域
  if (resultArea) {
    resultArea.innerHTML = '';
    resultArea.style.display = 'none';
  }
  
  // 重置加载状态
  if (loadingElem) {
    loadingElem.style.display = 'none';
  }
  
  // 重置错误显示
  if (errorElem) {
    errorElem.textContent = '';
    errorElem.style.display = 'none';
  }
  
  // 重置调试区域
  if (debugSection) {
    debugSection.style.display = 'none';
  }
  
  if (debugInfo) {
    debugInfo.innerHTML = '';
  }
  
  // 重置知识库状态
  if (knowledgeStatus) {
    knowledgeStatus.style.display = 'none';
  }
  
  if (viewKnowledgeBtn) {
    viewKnowledgeBtn.style.display = 'none';
  }
  
  // 重置流式状态
  if (streamingStatusElem) {
    streamingStatusElem.style.display = 'none';
  }
  
  // 重置内容变量
  accumulatedContent = '';
  isStreaming = false;
}

/**
 * 处理流式数据更新
 * @param {Object} data - 流式数据片段
 */
function handleStreamUpdate(data) {
  try {
    console.log('收到流式更新:', data);
    const resultArea = document.getElementById('result');
    const loadingElem = document.getElementById('loading');
    
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
    
    if (contentChunk && resultArea) {
      // 累积内容
      accumulatedContent += contentChunk;
      
      // 更新界面
      resultArea.innerHTML = markdownToHtml(accumulatedContent);
      resultArea.style.display = 'block';
      
      // 确保滚动到底部以显示最新内容
      resultArea.scrollTop = resultArea.scrollHeight;
      
      // 隐藏加载状态，因为我们已经开始显示内容
      if (loadingElem) loadingElem.style.display = 'none';
      // 显示流式状态
      showStreamingStatus(true);
    }
  } catch (error) {
    console.error('处理流式更新出错:', error);
  }
}

// 定义打开调试区域功能
function showDebugSection() {
  const debugSection = document.getElementById('debug-section');
  if (debugSection) {
    debugSection.style.display = 'block';
  }
}

// 添加调试信息的函数
function addDebugInfo(label, value) {
  const debugInfo = document.getElementById('debug-info');
  const debugSection = document.getElementById('debug-section');
  
  if (!debugInfo || !debugSection) return;
  
  // 确保调试区域可见
  debugSection.style.display = 'block';
  
  // 创建新的调试信息行
  const row = document.createElement('div');
  row.style.marginBottom = '5px';
  row.innerHTML = `<strong>${label}:</strong> ${value}`;
  
  // 添加到调试信息区域
  debugInfo.appendChild(row);
  
  // 滚动到底部
  debugInfo.scrollTop = debugInfo.scrollHeight;
} 
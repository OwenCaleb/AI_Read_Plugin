/**
 * @fileoverview 浏览器扩展的后台脚本，处理API调用
 * @author AI助手
 * @version 1.0.0
 */

/**
 * Coze工作流API配置
 * @constant {Object}
 */
const COZE_API_CONFIG = {
  url: 'https://api.coze.cn/v1/workflow/stream_run', // 修改为流式API接口
  headers: {
    'Authorization': 'Bearer pat_C43TGnOQyJa5MGC8WBVa2ViAvivmKUF6mRezemey9SOFnCkV7WGTIkqeVK6dY7I7', // 根据官方示例，正确格式应为"Bearer pat_"开头
    'Content-Type': 'application/json'
  },
  workflowId: '7489832031674204211' // 修改为您的实际workflow_id
};

/**
 * Coze知识库API配置
 * @constant {Object}
 */
const COZE_KNOWLEDGE_API_CONFIG = {
  datasetId: '7490072439570546722', // 默认知识库ID
  // API配置 - 使用正确的API端点
  url: 'https://api.coze.cn/open_api/knowledge/document/create',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pat_T28phnNmB3HXWuhSUIfMJI5odyE5g4jzVklTTO28RH8lf0Jneb6djeKSIvhTwZ3M', // 知识库专用授权码
    'Agw-Js-Conv': 'str'
  }
};

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
 * 调用Coze工作流流式API
 * @async
 * @param {string} articleUrl - 用户输入的URL
 * @param {Object} context - 调用上下文，包含发送者信息
 * @returns {Promise<Object>} API返回的结果
 * @throws {Error} 请求失败时抛出错误
 */
async function callCozeWorkflow(articleUrl, context = {}) {
  try {
    console.log('正在调用Coze工作流流式API...', articleUrl);
    
    // 验证URL格式
    try {
      new URL(articleUrl);
    } catch (e) {
      throw new Error('无效的URL格式，请检查输入');
    }
    
    const requestData = {
      workflow_id: COZE_API_CONFIG.workflowId,
      parameters: {
        article_url: articleUrl
        // 如果工作流需要其他参数，可以在这里添加
        // user_id: "12345", // 示例参数
        // user_name: "User" // 示例参数
      }
    };
    
    console.log('请求数据:', JSON.stringify(requestData));
    console.log('发送请求到:', COZE_API_CONFIG.url);
    console.log('请求头:', JSON.stringify(COZE_API_CONFIG.headers));
    
    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时，流式响应可能需要更长时间
    
    try {
      const response = await fetch(COZE_API_CONFIG.url, {
        method: 'POST',
        headers: COZE_API_CONFIG.headers,
        body: JSON.stringify(requestData),
        signal: controller.signal,
        mode: 'cors' // 显式设置CORS模式
      });
      
      clearTimeout(timeoutId); // 清除超时
      
      console.log('API响应状态:', response.status);
      console.log('API响应头:', JSON.stringify([...response.headers]));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP错误响应:', errorText);
        throw new Error(`HTTP错误 ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      // 检查是否支持流式读取
      if (response.body) {
        // 获取响应体的reader
        const reader = response.body.getReader();
        let fullResponseText = '';
        let isDone = false;
        let accumulatedChunks = [];
        
        // 读取流式数据
        while (!isDone) {
          const { done, value } = await reader.read();
          isDone = done;
          
          if (done) {
            break;
          }
          
          // 处理二进制数据
          const chunk = new TextDecoder().decode(value);
          accumulatedChunks.push(chunk);
          fullResponseText += chunk;
          
          // 尝试提取当前批次数据中的完整事件
          try {
            // 解析SSE格式的事件流
            // SSE格式通常是 "id: X\nevent: Y\ndata: Z\n\n"
            const events = fullResponseText.split(/\n\n/);
            
            // 处理除最后一个可能不完整的事件外的所有事件
            for (let i = 0; i < events.length - 1; i++) {
              const event = events[i].trim();
              if (!event) continue;
              
              // 提取data字段
              const dataMatch = event.match(/^data: (.+)$/m);
              if (dataMatch && dataMatch[1]) {
                try {
                  // 解析JSON数据
                  const eventData = JSON.parse(dataMatch[1]);
                  
                  // 尝试解析嵌套的JSON结构
                  if (eventData && typeof eventData.data === 'string' && 
                      (eventData.data.includes('{') || eventData.data.includes('}'))) {
                    try {
                      // 尝试解析data字段中的JSON
                      const innerData = JSON.parse(eventData.data);
                      // 如果成功解析，将解析后的对象作为data字段的值
                      eventData.parsedData = innerData;
                      console.log('解析到嵌套JSON数据:', innerData);
                    } catch (innerJsonError) {
                      console.warn('内部JSON解析失败，使用原始data字段');
                    }
                  }
                  
                  // 通知前端更新，直接传递解析后的data对象
                  chrome.runtime.sendMessage({
                    action: 'streamUpdate',
                    data: eventData
                  });
                  
                  console.log('发送流式更新:', eventData);
                } catch (jsonError) {
                  console.warn('解析事件JSON数据失败:', jsonError);
                }
              }
            }
            
            // 保留最后一个可能不完整的事件
            const lastEvent = events[events.length - 1];
            fullResponseText = lastEvent ? lastEvent : '';
            
          } catch (e) {
            console.warn('处理数据流事件时出错:', e);
          }
        }
        
        // 处理最后可能剩余的数据
        if (fullResponseText && fullResponseText.trim()) {
          // 检查是否是完整的事件
          const dataMatch = fullResponseText.match(/^data: (.+)$/m);
          if (dataMatch && dataMatch[1]) {
            try {
              // 解析JSON数据
              const eventData = JSON.parse(dataMatch[1]);
              
              // 尝试解析嵌套的JSON结构
              if (eventData && typeof eventData.data === 'string' && 
                  (eventData.data.includes('{') || eventData.data.includes('}'))) {
                try {
                  // 尝试解析data字段中的JSON
                  const innerData = JSON.parse(eventData.data);
                  // 如果成功解析，将解析后的对象作为data字段的值
                  eventData.parsedData = innerData;
                  console.log('解析到嵌套JSON数据:', innerData);
                } catch (innerJsonError) {
                  console.warn('内部JSON解析失败，使用原始data字段');
                }
              }
              
              // 通知前端更新
              chrome.runtime.sendMessage({
                action: 'streamUpdate',
                data: eventData
              });
              
              console.log('发送最终流式更新:', eventData);
            } catch (jsonError) {
              console.warn('解析最终事件JSON数据失败:', jsonError);
            }
          }
        }
        
        // 通知前端流式处理已完成
        chrome.runtime.sendMessage({
          action: 'streamComplete'
        });
        
        // 返回完整的响应
        const completeResponse = accumulatedChunks.join('');
        try {
          // 如果可以解析为单个完整的JSON，则解析
          return JSON.parse(completeResponse);
        } catch (e) {
          // 否则返回原始文本
          return completeResponse;
        }
      } else {
        // 回退到非流式方式处理
        const responseText = await response.text();
        console.log('API原始响应:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('JSON解析错误:', parseError);
          // 如果无法解析为JSON，直接返回原始文本
          return responseText;
        }
        
        console.log('API返回数据结构:', Object.keys(data));
        return data;
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('API调用失败:', error);
    throw error;
  }
}

/**
 * 将数据保存到Coze知识库
 * @async
 * @param {string} url - 文章URL
 * @returns {Promise<Object>} API返回结果
 * @throws {Error} 请求失败时抛出错误
 */
async function saveToCozeKnowledge(url) {
  try {
    console.log('===== 保存到Coze知识库 =====');
    
    const knowledgeId = COZE_KNOWLEDGE_API_CONFIG.datasetId;
    const authToken = COZE_KNOWLEDGE_API_CONFIG.headers.Authorization.replace('Bearer ', '');
    const apiUrl = COZE_KNOWLEDGE_API_CONFIG.url;
    
    console.log('API地址:', apiUrl);
    console.log('知识库ID:', knowledgeId);
    console.log('要保存的URL:', url);
    
    // 与测试工具完全一致的请求数据格式
    const requestData = {
      "dataset_id": knowledgeId,
      "document_bases": [
        {
          "name": `网页内容: ${url}`,
          "source_info": {
            "web_url": url,
            "document_source": 1
          },
          "update_rule": {
            "update_type": 1, 
            "update_interval": 24
          }
        }
      ],
      "chunk_strategy": {
        "separator": "\n\n", 
        "max_tokens": 800,
        "remove_extra_spaces": false,
        "remove_urls_emails": false,
        "chunk_type": 1
      }
    };
    
    console.log('请求数据:', JSON.stringify(requestData, null, 2));
    
    // 与测试工具完全一致的请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Agw-Js-Conv': 'str'
    };
    
    console.log('请求头:', {
      'Content-Type': headers['Content-Type'],
      'Authorization': '(隐藏敏感信息)',
      'Agw-Js-Conv': headers['Agw-Js-Conv']
    });
    
    // 完全使用与测试工具一致的fetch调用
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestData)
    });
    
    console.log('API响应状态:', response.status, response.statusText);
    
    // 获取响应文本
    const responseText = await response.text();
    console.log('API响应文本:', responseText);
    
    // 解析JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('解析的响应数据:', data);
    } catch (e) {
      console.error('解析响应数据失败:', e);
      throw new Error(`解析响应失败: ${e.message}`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);
    }
    
    // 通知前端保存成功
    chrome.runtime.sendMessage({
      action: 'knowledgeSaveResult',
      success: true,
      detail: {
        documentInfo: {
          documentId: data.document_id || data.id || '未知',
          name: requestData.document_bases[0].name,
          status: 'saved'
        }
      }
    });
    
    return {
      success: true,
      message: 'API调用成功!',
      documentInfo: {
        documentId: data.document_id || data.id || '未知',
        name: requestData.document_bases[0].name,
        status: 'saved'
      }
    };
  } catch (error) {
    console.error('保存到Coze知识库失败:', error);
    
    // 通知前端出错
    chrome.runtime.sendMessage({
      action: 'knowledgeSaveResult',
      success: false,
      error: error.message || '未知错误'
    });
    
    throw error;
  }
}

// 处理知识库配置设置请求
function handleSetKnowledgeBaseConfig(request, sender, sendResponse) {
  try {
    console.log('正在设置知识库配置...', request.config);
    
    // 验证知识库ID
    if (!request.config.datasetId) {
      throw new Error('缺少知识库ID');
    }
    
    // 设置知识库ID
    COZE_KNOWLEDGE_API_CONFIG.datasetId = request.config.datasetId;
    
    console.log('知识库配置已更新:', {
      datasetId: COZE_KNOWLEDGE_API_CONFIG.datasetId,
      url: COZE_KNOWLEDGE_API_CONFIG.url,
      authHeader: COZE_KNOWLEDGE_API_CONFIG.headers.Authorization.substring(0, 20) + '...'
    });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('设置知识库配置失败:', error);
    sendResponse({ success: false, message: error.message });
  }
}

// 处理工作流API配置设置请求
function handleSetApiConfig(request, sender, sendResponse) {
  try {
    console.log('正在设置工作流API配置...', request.config);
    
    // 验证必要的字段
    if (!request.config.workflowId) {
      throw new Error('缺少工作流ID');
    }
    if (!request.config.apiKey) {
      throw new Error('缺少API Key');
    }
    
    // 设置API配置
    COZE_API_CONFIG.workflowId = request.config.workflowId;
    COZE_API_CONFIG.headers.Authorization = `Bearer ${request.config.apiKey}`;
    
    console.log('工作流API配置已更新:', {
      workflowId: COZE_API_CONFIG.workflowId,
      url: COZE_API_CONFIG.url
    });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('设置工作流API配置失败:', error);
    sendResponse({ success: false, message: error.message });
  }
}

// 消息处理主函数
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('接收到消息:', request.action);
  
  // 判断消息类型并处理
  if (request.action === 'callCozeWorkflow') {
    callCozeWorkflow(request.content, request.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // 异步响应
  } 
  else if (request.action === 'setApiConfig') {
    handleSetApiConfig(request, sender, sendResponse);
    return false; // 同步响应
  }
  else if (request.action === 'setKnowledgeBaseConfig') {
    handleSetKnowledgeBaseConfig(request, sender, sendResponse);
    return false; // 同步响应
  }
  else if (request.action === 'saveToKnowledge') {
    // 处理保存到知识库的请求
    console.log('收到保存到知识库请求:', request.url);
    
    // 验证URL格式
    try {
      new URL(request.url);
    } catch (e) {
      console.error('无效的URL格式:', request.url, e);
      sendResponse({ success: false, error: '无效的URL格式，请检查输入' });
      return true;
    }
    
    // 直接使用默认的知识库ID
    if (!COZE_KNOWLEDGE_API_CONFIG.datasetId) {
      console.log('未找到配置的知识库ID，使用默认ID');
      COZE_KNOWLEDGE_API_CONFIG.datasetId = '7490072439570546722';
    }
    
    console.log('使用知识库ID:', COZE_KNOWLEDGE_API_CONFIG.datasetId);
    console.log('使用知识库授权头:', COZE_KNOWLEDGE_API_CONFIG.headers.Authorization.substring(0, 20) + '...');
    
    // 检查授权头是否为空或格式不正确
    if (!COZE_KNOWLEDGE_API_CONFIG.headers.Authorization || 
        !COZE_KNOWLEDGE_API_CONFIG.headers.Authorization.startsWith('Bearer ')) {
      const errorMsg = '知识库授权头格式错误或为空';
      console.error(errorMsg);
      
      // 发送错误响应
      chrome.runtime.sendMessage({
        action: 'knowledgeSaveResult',
        success: false, 
        error: errorMsg
      });
      
      sendResponse({ success: false, error: errorMsg });
      return true;
    }
    
    console.log('开始保存URL到知识库');
    
    // 发送初始响应，表示开始处理
    chrome.runtime.sendMessage({
      action: 'knowledgeSaveResult',
      success: true,
      status: 'processing',
      message: '正在提交到知识库...'
    });
    
    // 直接保存URL到知识库
    saveToCozeKnowledge(request.url)
      .then(saveResult => {
        console.log('保存到知识库成功:', saveResult);
        
        // 通知前端更新状态
        chrome.runtime.sendMessage({
          action: 'knowledgeSaveResult',
          success: true,
          detail: saveResult
        });
        
        sendResponse({ success: true, detail: saveResult });
      })
      .catch(error => {
        console.error('保存到知识库失败:', error);
        
        // 通知前端更新状态
        chrome.runtime.sendMessage({
          action: 'knowledgeSaveResult',
          success: false,
          error: error.message
        });
        
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // 异步响应
  }
  else if (request.action === 'callCozeAPI') {
    console.log('收到API调用请求:', request.url);
    
    // 创建上下文对象保存发送者信息，用于流式更新通知
    const context = {
      senderId: sender.id,
      senderTabId: sender.tab ? sender.tab.id : null,
      senderFrameId: sender.frameId
    };
    
    // 调用API并发送响应
    callCozeWorkflow(request.url, context)
      .then(data => {
        console.log('API调用成功，返回数据类型:', typeof data);
        sendResponse({data: data});
      })
      .catch(error => {
        console.error('发送API调用错误:', error);
        // 构建更详细的错误信息
        let errorMessage = `调用Coze工作流API失败: ${error.message}`;
        let errorInfo = {
          message: errorMessage,
          url: COZE_API_CONFIG.url,
          workflowId: COZE_API_CONFIG.workflowId,
          time: new Date().toISOString(),
          detail: error.toString()
        };
        
        sendResponse({
          error: errorMessage, 
          errorDetail: errorInfo
        });
      });
    
    // 返回true表示将异步发送响应
    return true;
  }
});

/**
 * 从流式事件中提取文章摘要内容
 * @param {Array} chunks - 流式响应的原始数据块
 * @returns {string} 提取的摘要内容
 */
function extractSummaryContent(chunks) {
  // 处理流式事件数据
  const contentLines = [];
  const rawContent = chunks.join('');
  const events = rawContent.split(/\n\n/);
  
  for (const event of events) {
    const dataMatch = event.match(/^data: (.+)$/m);
    if (dataMatch && dataMatch[1]) {
      try {
        const eventData = JSON.parse(dataMatch[1]);
        if (eventData && eventData.content) {
          contentLines.push(eventData.content);
        }
      } catch (e) {
        // 解析失败，忽略此事件
      }
    }
  }
  
  // 合并内容并格式化
  const finalContent = contentLines.join('');
  
  // 如果内容太短，可能是出错了
  if (finalContent.length < 10) {
    console.warn('提取的内容太短，可能出现了问题');
    return null;
  }
  
  return finalContent;
}

/**
 * 处理Coze知识库文档创建响应
 * @param {Object} responseData - API返回数据
 * @returns {Object} 格式化的响应信息
 */
function processDocumentCreateResponse(responseData) {
  try {
    console.log('处理文档创建响应:', responseData);
    
    // 检查是否是成功响应
    if (responseData && (responseData.code === 0 || responseData.ret_code === 0)) {
      const result = {
        success: true,
        message: '网页URL已成功提交到知识库'
      };
      
      // 检查不同格式的文档信息
      let documentInfos = null;
      
      if (responseData.document_infos && responseData.document_infos.length > 0) {
        documentInfos = responseData.document_infos;
      } else if (responseData.data && responseData.data.document_infos) {
        documentInfos = responseData.data.document_infos;
      } else if (responseData.data && responseData.data.length > 0) {
        documentInfos = responseData.data;
      }
      
      // 如果有文档信息，添加到结果中
      if (documentInfos && documentInfos.length > 0) {
        const docInfo = documentInfos[0];
        result.documentInfo = {
          documentId: docInfo.document_id || docInfo.id || '未知ID',
          name: docInfo.name || '未命名文档',
          status: docInfo.status || 0,
          createTime: docInfo.create_time ? 
            new Date(docInfo.create_time * 1000).toISOString() : 
            new Date().toISOString(),
          updateTime: docInfo.update_time ? 
            new Date(docInfo.update_time * 1000).toISOString() : 
            new Date().toISOString()
        };
        
        // 更新消息添加文档ID
        const shortId = result.documentInfo.documentId.substring(0, 8);
        result.message += `，文档ID: ${shortId}...`;
      }
      
      return result;
    } else {
      // 处理API返回的错误信息
      const errorMsg = responseData.msg || responseData.message || responseData.error || '未知错误';
      const errorCode = responseData.code || responseData.ret_code || -1;
      
      return {
        success: false,
        message: `API错误: ${errorMsg}`,
        errorCode: errorCode
      };
    }
  } catch (error) {
    console.error('处理文档创建响应出错:', error);
    return {
      success: false,
      message: `处理响应出错: ${error.message}`
    };
  }
}

// 格式化知识库请求数据
function formatKnowledgeRequestData(url, datasetId) {
  // 使用curl示例中的格式
  return {
    "dataset_id": datasetId,
    "document_bases": [
      {
        "name": `网页内容: ${url}`,
        "source_info": {
          "web_url": url,
          "document_source": 1
        },
        "update_rule": {
          "update_type": 1, 
          "update_interval": 24
        }
      }
    ],
    "chunk_strategy": {
      "separator": "\n\n", 
      "max_tokens": 800,
      "remove_extra_spaces": false,
      "remove_urls_emails": false,
      "chunk_type": 1
    }
  };
} 

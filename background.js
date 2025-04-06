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

// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'callCozeAPI') {
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

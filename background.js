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
    'Authorization': 'Bearer pat_C43TGnOQyJa5MGC8WBVa2ViAvivmKUF6mRezemey9SOFnCkV7WGTIkqeVK6dY7I7', // 修改为您的实际token
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
        
        // 创建中间步骤的通知函数，用于发送流式更新
        const notifyProgress = (chunk) => {
          if (chunk && chunk.length > 0) {
            try {
              // 尝试解析JSON
              const chunkData = JSON.parse(chunk);
              // 通知前端更新
              chrome.runtime.sendMessage({
                action: 'streamUpdate',
                data: chunkData
              });
            } catch (e) {
              console.warn('无法解析流式数据片段:', e);
            }
          }
        };
        
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
          
          // 尝试提取当前批次数据中的完整JSON对象
          try {
            // 分割数据流，处理可能包含多个JSON对象的情况
            const lines = fullResponseText.split('\n');
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i].trim();
              if (line) {
                notifyProgress(line);
              }
            }
            // 保留最后一行，可能是不完整的
            fullResponseText = lines[lines.length - 1];
          } catch (e) {
            console.warn('处理数据流时出错:', e);
          }
        }
        
        // 处理最后可能剩余的数据
        if (fullResponseText && fullResponseText.trim()) {
          notifyProgress(fullResponseText.trim());
        }
        
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

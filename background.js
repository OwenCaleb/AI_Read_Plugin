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
  url: 'https://api.coze.cn/v1/workflow/run',
  headers: {
    'Authorization': 'Bearer pat_Gh8ZaR7fj7EbGSAzSCXhcSbl11JE5fjuUU6BDaeTfAffUavL9OnPBlXHilRvJ4bR',
    'Content-Type': 'application/json'
  },
  workflowId: '7489832031674204211'
};

/**
 * 调用Coze工作流API
 * @async
 * @param {string} articleUrl - 用户输入的URL
 * @returns {Promise<Object>} API返回的结果
 * @throws {Error} 请求失败时抛出错误
 */
async function callCozeWorkflow(articleUrl) {
  try {
    console.log('正在调用Coze工作流API...', articleUrl);
    
    const requestData = {
      workflow_id: COZE_API_CONFIG.workflowId,
      parameters: {
        article_url: articleUrl
      }
    };
    
    console.log('请求数据:', JSON.stringify(requestData));
    
    const response = await fetch(COZE_API_CONFIG.url, {
      method: 'POST',
      headers: COZE_API_CONFIG.headers,
      body: JSON.stringify(requestData)
    });
    
    console.log('API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);
    }
    
    const responseText = await response.text();
    console.log('API原始响应:', responseText.substring(0, 200) + '...');
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      throw new Error(`响应不是有效的JSON: ${parseError.message}`);
    }
    
    console.log('API返回数据结构:', Object.keys(data));
    return data;
  } catch (error) {
    console.error('API调用失败:', error);
    throw error;
  }
}

// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'callCozeAPI') {
    console.log('收到API调用请求:', request.url);
    
    // 调用API并发送响应
    callCozeWorkflow(request.url)
      .then(data => {
        console.log('API调用成功，返回数据');
        sendResponse({data: data});
      })
      .catch(error => {
        console.error('发送API调用错误:', error);
        sendResponse({error: `调用Coze工作流API失败: ${error.message}`});
      });
    
    // 返回true表示将异步发送响应
    return true;
  }
}); 
/**
 * @fileoverview 调用Coze工作流API的Node.js程序
 * @author AI助手
 * @version 1.0.0
 */

const axios = require('axios');
const readlineSync = require('readline-sync');

// 设置控制台编码
process.stdin.setEncoding('utf8');
process.stdout.setEncoding('utf8');

/**
 * Coze工作流API配置
 * @constant {Object}
 */
const COZE_API_CONFIG = {
  url: 'https://api.coze.cn/v1/workflow/run',
  headers: {
    'Authorization': 'pat_C43TGnOQyJa5MGC8WBVa2ViAvivmKUF6mRezemey9SOFnCkV7WGTIkqeVK6dY7I7',
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
    console.log('正在调用Coze工作流API...');
    
    const requestData = {
      workflow_id: COZE_API_CONFIG.workflowId,
      parameters: {
        article_url: articleUrl
      }
    };
    
    const response = await axios.post(
      COZE_API_CONFIG.url,
      requestData,
      { headers: COZE_API_CONFIG.headers }
    );
    
    return response.data;
  } catch (error) {
    console.error('API调用失败:', error.message);
    
    if (error.response) {
      console.error('错误状态码:', error.response.status);
      console.error('错误详情:', error.response.data);
    }
    
    throw new Error('调用Coze工作流API失败');
  }
}

/**
 * 主函数
 * @async
 */
async function main() {
  try {
    console.log('=== Coze工作流API调用程序 ===');
    
    // 获取用户输入的URL
    const articleUrl = readlineSync.question('请输入文章URL: ');
    
    if (!articleUrl) {
      console.error('错误: URL不能为空');
      return;
    }
    
    // 调用API
    const result = await callCozeWorkflow(articleUrl);
    
    // 显示结果
    console.log('\n=== API调用结果 ===');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error(`程序执行出错: ${error.message}`);
  }
}

// 执行主函数
main().catch(error => {
  console.error('程序异常终止:', error);
  process.exit(1);
}); 

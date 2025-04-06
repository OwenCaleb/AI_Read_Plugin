/**
 * 知识库API测试脚本
 */

// 知识库配置
const KNOWLEDGE_CONFIG = {
  datasetId: '7490072439570546722',
  url: 'https://api.coze.cn/open_api/knowledge/document/create',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pat_T28phnNmB3HXWuhSUIfMJI5odyE5g4jzVklTTO28RH8lf0Jneb6djeKSIvhTwZ3M',
    'Agw-Js-Conv': 'str'
  }
};

/**
 * 格式化知识库请求数据
 * @param {string} url - 文章URL
 * @returns {Object} 格式化后的请求数据
 */
function formatRequestData(url) {
  return {
    "dataset_id": KNOWLEDGE_CONFIG.datasetId,
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

/**
 * 测试知识库API的保存功能
 * @param {string} url - 要保存的URL
 */
async function testKnowledgeAPI(url) {
  try {
    console.log('===== 测试知识库API保存功能 =====');
    console.log('测试URL:', url);
    console.log('知识库ID:', KNOWLEDGE_CONFIG.datasetId);
    
    const requestData = formatRequestData(url);
    console.log('请求数据:', JSON.stringify(requestData, null, 2));
    
    console.log('发送请求到:', KNOWLEDGE_CONFIG.url);
    console.log('授权头:', KNOWLEDGE_CONFIG.headers.Authorization.substring(0, 20) + '...');
    
    // 发送请求
    const response = await fetch(KNOWLEDGE_CONFIG.url, {
      method: 'POST',
      headers: KNOWLEDGE_CONFIG.headers,
      body: JSON.stringify(requestData)
    });
    
    console.log('响应状态:', response.status);
    
    const responseText = await response.text();
    console.log('原始响应:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('解析后的响应:', data);
    } catch (e) {
      console.error('解析响应失败:', e);
    }
    
    if (!response.ok) {
      console.error('API请求失败:', response.status, response.statusText);
    } else {
      console.log('API请求成功!');
    }
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 主函数
async function main() {
  // 从命令行获取URL参数
  const url = process.argv[2] || 'https://news.qq.com/rain/a/20250328A082D300';
  
  if (!url) {
    console.error('请提供URL参数');
    process.exit(1);
  }
  
  console.log('开始测试URL:', url);
  await testKnowledgeAPI(url);
}

// 执行测试
main().catch(console.error); 
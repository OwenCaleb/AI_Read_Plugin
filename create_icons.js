/**
 * @fileoverview 创建扩展图标的脚本
 * @author AI助手
 */

const fs = require('fs');
const { createCanvas } = require('canvas');

/**
 * 在画布上绘制图标
 * @param {number} size - 图标尺寸
 * @returns {Buffer} 图标文件的二进制数据
 */
function createIconBuffer(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // 设置背景为蓝色
  ctx.fillStyle = '#4285f4';
  ctx.fillRect(0, 0, size, size);
  
  // 绘制白色字母'C'
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.7}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', size / 2, size / 2);
  
  return canvas.toBuffer('image/png');
}

// 创建图标目录
if (!fs.existsSync('./icons')) {
  fs.mkdirSync('./icons');
}

// 创建不同尺寸的图标
const sizes = [16, 48, 128];
sizes.forEach(size => {
  const iconBuffer = createIconBuffer(size);
  fs.writeFileSync(`./icons/icon${size}.png`, iconBuffer);
  console.log(`创建了图标: icon${size}.png`);
});

console.log('所有图标已创建完成！'); 
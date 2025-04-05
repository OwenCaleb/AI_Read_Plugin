/**
 * 创建简单图标的脚本
 */
const fs = require('fs');
const path = require('path');

// 确保图标目录存在
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// 创建16x16图标 - 空白图标
const icon16 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAQElEQVQ4T2NkIAAY' +
  'CagjtAlGDSBsBqMGEDYDwuoZoTFgC8SZBEIpWbkRmgtHDSBsBqMGEDYDwuqHWRgg' +
  'kJJJigUAodYDu3pxEeYAAAAASUVORK5CYII=',
  'base64'
);

// 创建48x48图标 - 空白图标
const icon48 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAA2ElEQVRoQ+2YMQ7C' +
  'MAxFXcQOYoWteQbOwNQTwNgjMHIKzkDPBazAzkKR2gptUChyYgbb387vlyQ/cbNw' +
  '8mVOHj9cQO2ORgesg1Ogdgdqj991wDpgHajdgdrjdx04fQduaG/SPDnHMYL7GE0P' +
  '5s5bHzP2ER2QOwHGehegZYFc4DPrXYALQGLwyPWxTYy5XkAXIGhUQO76mPELUAG1' +
  'C0hdH2v+Pw64ABcAf49ywMEsihm/fI9P9J7QXg4u+6v/AwAKrHVPd8BrwXXXuABd' +
  'D3XX65ymvRa0PVD7/gVZUycx4UwANAAAAABJRU5ErkJggg==',
  'base64'
);

// 创建128x128图标 - 空白图标
const icon128 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAA+klEQVR4nO3cMQ0A' +
  'IRAEwcPgX1kfNvAWZiaowTQNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAr70xacYU' +
  'AFIBIBUAUgEgFQBSASAVAFIBIBUAUgEgFQBSASAVAFIBIBUAUgEgFQBSASAVAFIB' +
  'IBUAUgEgFQBSASAVAFIBIBUAUgEgFQBSASAVAFIBIBUAUgEgFQBSASAVAFIBIBUA' +
  'UgEgFQBSASAVAFIBIBUAUgEgFQBSASAVAFIBIBUAUgEgFQBSASAVAFIBIBUAUgEg' +
  'FQBSASAVAFIBIBUAUgEgFQBSASAVAFIBIBUAUgEg9cYA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAADDOAiwXBhvXdQYcAAAAAElFTkSuQmCC',
  'base64'
);

// 写入文件
fs.writeFileSync(path.join(iconsDir, 'icon16.png'), icon16);
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), icon48);
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), icon128);

console.log('简单图标创建完成！'); 
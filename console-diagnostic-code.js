// 🔍 贴纸链接诊断代码
// 复制下面所有内容（从这行到最后），然后粘贴到控制台

console.log('========== 贴纸链接诊断 ==========');

const testUrl = 'baxs://sticker.baxs.com/addstickers/#pack_id=9acc9e8aba563d26a4994e69263e3b25&pack_key=5a6dff3948c28efb9b7aaf93ecc375c69fc316e78077ed26867a14d10a0f6a12';

// 1. 测试 URL 解析
console.log('1️⃣ 测试 URL:', testUrl);
const urlObj = new URL(testUrl);
console.log('   Protocol:', urlObj.protocol);
console.log('   Hostname:', urlObj.hostname);
console.log('   Pathname:', urlObj.pathname);
console.log('   Hash:', urlObj.hash);

// 2. 提取参数
const params = new URLSearchParams(urlObj.hash.substring(1));
const packId = params.get('pack_id');
const packKey = params.get('pack_key');
console.log('2️⃣ 提取的参数:');
console.log('   Pack ID:', packId);
console.log('   Pack Key:', packKey);

// 3. 检查应用状态
console.log('3️⃣ 应用状态检查:');
console.log('   已注册:', window.textsecure?.storage?.user ? '✅ 是' : '❌ 否');
console.log('   window.Events 存在:', window.Events ? '✅ 是' : '❌ 否');
console.log('   showStickerPack 存在:', window.Events?.showStickerPack ? '✅ 是' : '❌ 否');
console.log('   reduxActions 存在:', window.reduxActions ? '✅ 是' : '❌ 否');

// 4. 手动触发显示贴纸包
console.log('4️⃣ 尝试手动显示贴纸包...');
if (packId && packKey) {
  try {
    // 方法1: 使用 Events
    if (window.Events?.showStickerPack) {
      window.Events.showStickerPack(packId, packKey);
      console.log('   ✅ 通过 Events.showStickerPack 调用成功');
    }

    // 方法2: 使用 Redux
    if (window.reduxActions?.globalModals?.showStickerPackPreview) {
      window.reduxActions.globalModals.showStickerPackPreview(packId, packKey);
      console.log('   ✅ 通过 reduxActions.globalModals.showStickerPackPreview 调用成功');
    }
  } catch (error) {
    console.error('   ❌ 调用失败:', error);
  }
} else {
  console.log('   ❌ 参数提取失败');
}

console.log('========================================');
console.log('如果上面的手动调用成功打开了贴纸界面，');
console.log('说明功能正常，问题在于深层链接的传递。');
console.log('========================================');

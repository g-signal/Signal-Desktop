// 诊断脚本：测试贴纸链接解析
console.log('========================================');
console.log('贴纸链接诊断脚本');
console.log('========================================');
console.log('');

// 测试链接
const testUrl = 'baxs://sticker.baxs.com/addstickers/#pack_id=9acc9e8aba563d26a4994e69263e3b25&pack_key=5a6dff3948c28efb9b7aaf93ecc375c69fc316e78077ed26867a14d10a0f6a12';

console.log('测试链接:', testUrl);
console.log('');

// 步骤 1: 检查路由是否能被解析
console.log('[步骤 1] 检查路由解析...');
try {
  // 需要在应用环境中运行
  if (typeof require !== 'undefined') {
    const { parseSignalRoute } = require('./ts/util/signalRoutes');

    const result = parseSignalRoute(testUrl);

    if (result) {
      console.log('✅ 路由解析成功！');
      console.log('  Route key:', result.key);
      console.log('  Pack ID:', result.args.packId);
      console.log('  Pack Key:', result.args.packKey);

      if (result.key === 'artAddStickers') {
        console.log('✅ 路由类型正确');
      } else {
        console.log('❌ 路由类型错误，应该是 artAddStickers');
      }
    } else {
      console.log('❌ 路由解析失败 - 链接格式不匹配');
      console.log('');
      console.log('可能原因：');
      console.log('1. 没有重新编译代码（运行 pnpm run build:esbuild）');
      console.log('2. 路由配置错误');
    }
  } else {
    console.log('⚠️ 此脚本需要在 Node.js 环境中运行');
    console.log('');
    console.log('请在应用的开发者工具控制台运行以下代码：');
    console.log('');
    console.log(`
// 在应用控制台中运行
const testUrl = '${testUrl}';
const { parseSignalRoute } = window.SignalContext;
const result = parseSignalRoute(testUrl);
console.log('解析结果:', result);
    `.trim());
  }
} catch (error) {
  console.log('❌ 解析出错:', error.message);
}

console.log('');
console.log('========================================');
console.log('[步骤 2] 手动测试完整流程');
console.log('========================================');
console.log('');
console.log('在应用的开发者工具控制台运行以下代码：');
console.log('');
console.log(`
// 1. 测试路由解析
const testUrl = '${testUrl}';
console.log('1️⃣ 测试 URL:', testUrl);

// 2. 解析链接
const urlObj = new URL(testUrl);
console.log('2️⃣ URL 对象:', {
  protocol: urlObj.protocol,
  hostname: urlObj.hostname,
  pathname: urlObj.pathname,
  hash: urlObj.hash,
});

// 3. 提取参数
const params = new URLSearchParams(urlObj.hash.substring(1));
const packId = params.get('pack_id');
const packKey = params.get('pack_key');
console.log('3️⃣ 提取的参数:', { packId, packKey });

// 4. 检查是否已注册
if (window.textsecure && window.textsecure.storage) {
  console.log('4️⃣ ✅ 应用已注册');
} else {
  console.log('4️⃣ ❌ 应用未注册');
}

// 5. 手动触发显示贴纸包
if (packId && packKey) {
  console.log('5️⃣ 尝试显示贴纸包...');

  // 方法1: 直接调用 Events
  if (window.Events && window.Events.showStickerPack) {
    window.Events.showStickerPack(packId, packKey);
    console.log('✅ 调用 showStickerPack 成功');
  } else {
    console.log('❌ window.Events.showStickerPack 不存在');
  }

  // 方法2: 通过 Redux
  if (window.reduxActions && window.reduxActions.globalModals) {
    window.reduxActions.globalModals.showStickerPackPreview(packId, packKey);
    console.log('✅ 调用 showStickerPackPreview 成功');
  } else {
    console.log('❌ window.reduxActions.globalModals 不存在');
  }
}
`.trim());

console.log('');
console.log('========================================');
console.log('故障排查清单');
console.log('========================================');
console.log('');
console.log('□ 1. 已重新编译代码（pnpm run build:esbuild）');
console.log('□ 2. 已重启应用');
console.log('□ 3. 应用窗口已完全加载');
console.log('□ 4. 用户已登录');
console.log('□ 5. 开发者工具已打开');
console.log('□ 6. 从浏览器或命令行测试了链接');
console.log('');

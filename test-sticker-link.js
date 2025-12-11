// Test sticker link parsing
const { parseSignalRoute } = require('./ts/util/signalRoutes');

const testUrl = 'baxs://sticker.baxs.com/addstickers/#pack_id=9acc9e8aba563d26a4994e69263e3b25&pack_key=5a6dff3948c28efb9b7aaf93ecc375c69fc316e78077ed26867a14d10a0f6a12';

console.log('Testing sticker link parsing');
console.log('========================================');
console.log('URL:', testUrl);
console.log('');

try {
  const result = parseSignalRoute(testUrl);

  if (result) {
    console.log('✅ Link matched successfully!');
    console.log('');
    console.log('Route key:', result.key);
    console.log('Pack ID:', result.args.packId);
    console.log('Pack Key:', result.args.packKey);
    console.log('');
    console.log('Next: The app should show the sticker pack preview');
  } else {
    console.log('❌ Link did not match any route');
    console.log('');
    console.log('Possible reasons:');
    console.log('1. Route pattern not configured');
    console.log('2. URL format incorrect');
    console.log('3. Need to rebuild the app');
  }
} catch (error) {
  console.error('❌ Error parsing link:', error.message);
}

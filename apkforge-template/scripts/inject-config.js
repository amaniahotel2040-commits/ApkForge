// inject-config.js
// কাজ: GitHub Actions থেকে আসা environment variables নিয়ে
// template Android project-এর ভিতরে app name, package, icon, URL ইত্যাদি বসিয়ে দেওয়া

const fs = require('fs');
const path = require('path');

const APP_NAME = process.env.APP_NAME || 'My App';
const PACKAGE_NAME = process.env.PACKAGE_NAME || 'com.apkforge.myapp';
const SOURCE_TYPE = process.env.SOURCE_TYPE || 'url';
const WEBSITE_URL = process.env.WEBSITE_URL || '';
const HTML_CONTENT = process.env.HTML_CONTENT || '';
const VERSION_NAME = process.env.VERSION_NAME || '1.0';
const VERSION_CODE = process.env.VERSION_CODE || '1';
const STATUS_BAR_COLOR = process.env.STATUS_BAR_COLOR || '#e0282e';
const APP_ICON = process.env.APP_ICON || '';
const SPLASH_LOGO = process.env.SPLASH_LOGO || '';
const SPLASH_BG_COLOR = process.env.SPLASH_BG_COLOR || '#0b0b0e';
const BRANDING_TEXT = process.env.BRANDING_TEXT || '';
const SETTINGS = JSON.parse(process.env.SETTINGS_JSON || '{}');

console.log('--- ApkForge Config Injection শুরু ---');
console.log('App Name:', APP_NAME);
console.log('Package:', PACKAGE_NAME);
console.log('Source Type:', SOURCE_TYPE);

// ----------------------------------------------------
// 1. build.gradle আপডেট (package name, version)
// ----------------------------------------------------
const buildGradlePath = path.join(__dirname, '../app/build.gradle');
let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

buildGradle = buildGradle
  .replace(/applicationId ".*"/, `applicationId "${PACKAGE_NAME}"`)
  .replace(/versionName ".*"/, `versionName "${VERSION_NAME}"`)
  .replace(/versionCode \d+/, `versionCode ${VERSION_CODE}`);

fs.writeFileSync(buildGradlePath, buildGradle);

// ----------------------------------------------------
// 2. strings.xml আপডেট (app name, branding text)
// ----------------------------------------------------
const stringsPath = path.join(__dirname, '../app/src/main/res/values/strings.xml');
let strings = fs.readFileSync(stringsPath, 'utf8');

strings = strings
  .replace(/<string name="app_name">.*<\/string>/, `<string name="app_name">${escapeXml(APP_NAME)}</string>`)
  .replace(/<string name="branding_text">.*<\/string>/, `<string name="branding_text">${escapeXml(BRANDING_TEXT)}</string>`)
  .replace(/<string name="target_url">.*<\/string>/, `<string name="target_url">${escapeXml(WEBSITE_URL)}</string>`)
  .replace(/<string name="onesignal_app_id">.*<\/string>/, `<string name="onesignal_app_id">${escapeXml(process.env.ONESIGNAL_APP_ID || 'REPLACE_ME')}</string>`);

fs.writeFileSync(stringsPath, strings);

// ----------------------------------------------------
// 3. colors.xml আপডেট (status bar, splash background)
// ----------------------------------------------------
const colorsPath = path.join(__dirname, '../app/src/main/res/values/colors.xml');
let colors = fs.readFileSync(colorsPath, 'utf8');

colors = colors
  .replace(/<color name="status_bar_color">.*<\/color>/, `<color name="status_bar_color">${STATUS_BAR_COLOR}</color>`)
  .replace(/<color name="splash_bg_color">.*<\/color>/, `<color name="splash_bg_color">${SPLASH_BG_COLOR}</color>`);

fs.writeFileSync(colorsPath, colors);

// ----------------------------------------------------
// 4. App Icon বসানো (base64 → PNG ফাইল)
// ----------------------------------------------------
if (APP_ICON) {
  const iconBuffer = Buffer.from(APP_ICON, 'base64');
  const iconSizes = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
  iconSizes.forEach(folder => {
    const dir = path.join(__dirname, `../app/src/main/res/${folder}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), iconBuffer);
  });
  console.log('✅ App icon বসানো হয়েছে');
}

// ----------------------------------------------------
// 5. Splash Logo বসানো
// ----------------------------------------------------
if (SPLASH_LOGO) {
  const splashBuffer = Buffer.from(SPLASH_LOGO, 'base64');
  const drawableDir = path.join(__dirname, '../app/src/main/res/drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });
  fs.writeFileSync(path.join(drawableDir, 'splash_logo.png'), splashBuffer);
  console.log('✅ Splash logo বসানো হয়েছে');
}

// ----------------------------------------------------
// 6. Source type অনুযায়ী HTML ফাইল বসানো বা URL সেট করা
// ----------------------------------------------------
const assetsDir = path.join(__dirname, '../app/src/main/assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

if (SOURCE_TYPE === 'html' && HTML_CONTENT) {
  // HTML content base64 হয়ে আসে frontend থেকে
  const htmlBuffer = Buffer.from(HTML_CONTENT, 'base64');
  fs.writeFileSync(path.join(assetsDir, 'index.html'), htmlBuffer);
  console.log('✅ HTML ফাইল assets-এ বসানো হয়েছে (local load হবে)');
} else {
  // URL mode: কোনো local file লাগবে না, MainActivity সরাসরি WEBSITE_URL load করবে
  console.log('✅ Website URL mode — WebView সরাসরি URL load করবে');
}

// ----------------------------------------------------
// 7. App Settings (toggles) → config.json বসানো, যেটা MainActivity পড়বে
// ----------------------------------------------------
const config = {
  sourceType: SOURCE_TYPE,
  websiteUrl: WEBSITE_URL,
  hideTitleBar: SETTINGS.hideTitleBar !== false,
  fullscreen: !!SETTINGS.fullscreen,
  loadingSpinner: SETTINGS.loadingSpinner !== false,
  pullToRefresh: SETTINGS.pullToRefresh !== false,
  mediaAutoplay: !!SETTINGS.mediaAutoplay,
  cameraAccess: !!SETTINGS.cameraAccess,
  microphoneAccess: !!SETTINGS.microphoneAccess,
  pushNotifications: SETTINGS.pushNotifications !== false
};

fs.writeFileSync(
  path.join(assetsDir, 'app_config.json'),
  JSON.stringify(config, null, 2)
);

console.log('--- Config Injection সম্পন্ন ✅ ---');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

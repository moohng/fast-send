import fs from 'fs';
import path from 'path';

const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = rootPkg.version;

// 1. 同步到 Android build.gradle
const gradlePath = 'packages/client/android/app/build.gradle';
if (fs.existsSync(gradlePath)) {
    let content = fs.readFileSync(gradlePath, 'utf8');
    // 更新 versionName "1.0.0"
    content = content.replace(/versionName "[^"]+"/, `versionName "${version}"`);
    // 更新 versionCode (基于时间戳或简单的自增逻辑)
    const newCode = Math.floor(Date.now() / 100000);
    content = content.replace(/versionCode \d+/, `versionCode ${newCode}`);
    fs.writeFileSync(gradlePath, content);
    console.log(`✅ Android version updated to ${version} (${newCode})`);
}

console.log('🚀 Version sync complete.');

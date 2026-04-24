import fs from 'fs';
import path from 'path';

// 优先从命令行参数获取版本号 (例如: node sync-version.js v0.0.1)
// 如果没有参数，则回退到从 package.json 读取
let version = process.argv[2];

if (!version) {
    const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    version = rootPkg.version;
}

// 去掉版本号开头的 'v' (v0.0.1 -> 0.0.1)
const cleanVersion = version.startsWith('v') ? version.substring(1) : version;

console.log(`🚀 Syncing version to: ${cleanVersion}`);

// 1. 同步到根目录 package.json
const rootPkgPath = 'package.json';
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
rootPkg.version = cleanVersion;
fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');

// 2. 同步到 Android build.gradle
const gradlePath = 'packages/client/android/app/build.gradle';
if (fs.existsSync(gradlePath)) {
    let content = fs.readFileSync(gradlePath, 'utf8');
    // 更新 versionName
    content = content.replace(/versionName "[^"]+"/, `versionName "${cleanVersion}"`);

    // 更新 versionCode (必须是整数)
    // 方案：将 0.0.1 转换为 1, 1.2.3 转换为 10203 (常用算法)
    const parts = cleanVersion.split('.').map(Number);
    const newCode = (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
    content = content.replace(/versionCode \d+/, `versionCode ${newCode}`);

    fs.writeFileSync(gradlePath, content);
    console.log(`✅ Android version updated to ${cleanVersion} (${newCode})`);
}

// 3. 同步到前端 package.json (可选，保持一致性)
const clientPkgPath = 'packages/client/package.json';
if (fs.existsSync(clientPkgPath)) {
    const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
    clientPkg.version = cleanVersion;
    fs.writeFileSync(clientPkgPath, JSON.stringify(clientPkg, null, 2) + '\n');
}

// 4. 同步到 winres.json (用于 Windows Exe 详细信息)
const winresPath = 'packages/server-go/winres/winres.json';
if (fs.existsSync(winresPath)) {
    const winres = JSON.parse(fs.readFileSync(winresPath, 'utf8'));
    const v = cleanVersion.includes('.') ? cleanVersion : `${cleanVersion}.0.0`;
    // 确保是 x.x.x.x 格式
    const versionParts = v.split('.');
    while (versionParts.length < 4) versionParts.push('0');
    const fullV = versionParts.join('.');

    if (winres.RT_VERSION && winres.RT_VERSION["#1"]) {
        const info = winres.RT_VERSION["#1"]["0000"];
        info.fixed.file_version = fullV;
        info.fixed.product_version = fullV;
        info.info["0409"].FileVersion = fullV;
        info.info["0409"].ProductName = "FastSend";
        info.info["0409"].ProductVersion = fullV;
    }
    fs.writeFileSync(winresPath, JSON.stringify(winres, null, 2) + '\n');
    console.log(`✅ Winres version updated to ${fullV}`);
}

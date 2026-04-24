import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 从命令行参数获取构建类型 (debug 或 release，默认为 debug)
const buildType = process.argv[2] === 'release' ? 'release' : 'debug';

const outDir = path.resolve('out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const clientDir = path.resolve('packages/client');
const androidDir = path.join(clientDir, 'android');

// 从 package.json 获取版本号
const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = rootPkg.version;

console.log(`🤖 Starting Android ${buildType} build for v${version}...`);

try {
  // 1. 同步 Capacitor
  console.log('🔄 Syncing Capacitor projects...');
  execSync('npx cap sync android', { cwd: clientDir, stdio: 'inherit' });

  // 2. 执行 Gradle 构建
  const isWin = process.platform === 'win32';
  const gradleCmd = isWin ? 'gradlew.bat' : './gradlew';
  const task = buildType === 'release' ? 'assembleRelease' : 'assembleDebug';

  // 在 Linux/macOS 上确保 gradlew 有执行权限
  if (!isWin) {
    try {
      console.log('🔐 Setting execution permission for gradlew...');
      execSync(`chmod +x ${path.join(androidDir, 'gradlew')}`, { stdio: 'inherit' });
    } catch (err) {
      console.warn('⚠️ Failed to set permission for gradlew, build might fail.');
    }
  }

  console.log(`🏗️ Running Gradle task: ${task}...`);
  execSync(`${gradleCmd} ${task} --no-daemon`, {
    cwd: androidDir,
    stdio: 'inherit',
    env: { ...process.env } // 继承环境变量（包括 KeyStore 密码等）
  });

  // 3. 复制并重命名产物
  const apkBaseDir = path.join(androidDir, 'app/build/outputs/apk', buildType);

  // 扫描 apk 目录下的所有文件
  const findApks = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(findApks(fullPath));
      } else if (file.endsWith('.apk')) {
        results.push(fullPath);
      }
    });
    return results;
  };

  const apks = findApks(apkBaseDir);

  if (apks.length === 0) {
    throw new Error(`No APK files found in ${apkBaseDir}`);
  }

  apks.forEach(apkPath => {
    const fileName = path.basename(apkPath);
    // 简化文件名，例如: app-arm64-v8a-release.apk -> FastSend_v1.0.0_android_arm64.apk
    let newName = `FastSend_v${version}_android`;

    if (fileName.includes('arm64-v8a')) newName += '_arm64';
    else if (fileName.includes('armeabi-v7a')) newName += '_armv7';
    else if (fileName.includes('universal')) newName += '_universal';
    else if (apks.length === 1) newName += `_${buildType}`; // 如果只有一个文件且没匹配到架构
    else newName += `_${fileName.replace('app-', '').replace('.apk', '')}`;

    const dest = path.join(outDir, `${newName}.apk`);
    fs.copyFileSync(apkPath, dest);
    console.log(`✅ Android APK built: ${dest}`);
  });

  console.log('\n✨ Android build completed!');
} catch (err) {
  console.error('\n❌ Android build failed:', err.message);
  process.exit(1);
}

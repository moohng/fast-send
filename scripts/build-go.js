import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const targets = [
  // Windows
  { goos: 'windows', goarch: 'amd64', label: 'win-x64', ext: '.exe' },
  { goos: 'windows', goarch: 'arm64', label: 'win-arm64', ext: '.exe' },
  { goos: 'windows', goarch: '386', label: 'win-x86', ext: '.exe' },
  // Linux
  { goos: 'linux', goarch: 'amd64', label: 'linux-x64', ext: '' },
  { goos: 'linux', goarch: 'arm64', label: 'linux-arm64', ext: '' },
  // macOS
  { goos: 'darwin', goarch: 'amd64', label: 'macos-x64', ext: '' },
  { goos: 'darwin', goarch: 'arm64', label: 'macos-arm64', ext: '' },
];

const outDir = path.resolve('out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const serverDir = path.resolve('packages/server-go');

console.log('📦 Starting multi-platform Go build...');

// 1. Prepare Windows resources (only if windows targets exist)
if (targets.some(t => t.goos === 'windows')) {
  try {
    console.log('🎨 Generating Windows resources...');
    execSync('go-winres make', { cwd: serverDir, stdio: 'inherit' });
  } catch (err) {
    console.warn('⚠️ go-winres failed, continuing without it (Windows metadata may be missing).');
  }
}

for (const { goos, goarch, label, ext } of targets) {
  console.log(`\n🚀 Building for ${goos}/${goarch} (${label})...`);

  const env = {
    ...process.env,
    GOOS: goos,
    GOARCH: goarch,
    CGO_ENABLED: '0' // Ensure static linking for maximum portability
  };

  const ldFlags = ['-s', '-w'];

  // CLI build
  try {
    const cliOut = path.join(outDir, `fast-send-cli-${label}${ext}`);
    execSync(`go build -ldflags="${ldFlags.join(' ')}" -o "${cliOut}"`, {
      cwd: serverDir,
      env,
      stdio: 'inherit'
    });
    console.log(`✅ CLI built: ${cliOut}`);
  } catch (err) {
    console.error(`❌ Failed to build CLI for ${label}:`, err.message);
  }

  // GUI build (Windows only features)
  if (goos === 'windows') {
    try {
      const guiOut = path.join(outDir, `fast-send-${label}${ext}`);
      const guiLdFlags = [...ldFlags, '-H windowsgui'];
      execSync(`go build -ldflags="${guiLdFlags.join(' ')}" -o "${guiOut}"`, {
        cwd: serverDir,
        env,
        stdio: 'inherit'
      });
      console.log(`✅ GUI built: ${guiOut}`);
    } catch (err) {
      console.error(`❌ Failed to build GUI for ${label}:`, err.message);
    }
  }
}

console.log('\n✨ All platforms build completed!');

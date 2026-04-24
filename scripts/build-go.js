import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const architectures = [
  { goarch: 'amd64', label: 'x64' },
  { goarch: 'arm64', label: 'arm64' },
  { goarch: '386', label: 'x86' },
];

const outDir = path.resolve('out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const serverDir = path.resolve('packages/server-go');

console.log('📦 Starting multi-architecture Go build...');

// 1. Prepare resources (winres)
try {
  console.log('🎨 Generating Windows resources...');
  execSync('go-winres make', { cwd: serverDir, stdio: 'inherit' });
} catch (err) {
  console.error('⚠️ go-winres failed, continuing without it...', err.message);
}

for (const { goarch, label } of architectures) {
  console.log(`\n🚀 Building for windows/${goarch} (${label})...`);

  const env = {
    ...process.env,
    GOOS: 'windows',
    GOARCH: goarch,
    CGO_ENABLED: '0' // Ensure static linking for portability
  };

  const commonLdFlags = '-s -w';

  // Build CLI version
  try {
    const cliOut = path.join(outDir, `fast-send-cli-${label}.exe`);
    execSync(`go build -ldflags="${commonLdFlags}" -o "${cliOut}"`, {
      cwd: serverDir,
      env,
      stdio: 'inherit'
    });
    console.log(`✅ CLI built: ${cliOut}`);
  } catch (err) {
    console.error(`❌ Failed to build CLI for ${label}:`, err.message);
  }

  // Build GUI version
  try {
    const guiOut = path.join(outDir, `fast-send-${label}.exe`);
    execSync(`go build -ldflags="${commonLdFlags} -H windowsgui" -o "${guiOut}"`, {
      cwd: serverDir,
      env,
      stdio: 'inherit'
    });
    console.log(`✅ GUI built: ${guiOut}`);
  } catch (err) {
    console.error(`❌ Failed to build GUI for ${label}:`, err.message);
  }
}

console.log('\n✨ All builds completed!');

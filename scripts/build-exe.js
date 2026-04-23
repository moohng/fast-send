const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function build() {
    const outDir = path.join(__dirname, '../out');
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outDir, { recursive: true });

    console.log('Building client...');
    execSync('npm run build --workspace=@fast-send/client', { stdio: 'inherit' });

    console.log('Copying client assets...');
    const clientDist = path.join(__dirname, '../packages/client/dist');
    const publicDir = path.join(outDir, 'public');
    fs.mkdirSync(publicDir, { recursive: true });

    // 递归拷贝文件夹
    function copyFolderSync(from, to) {
        if (!fs.existsSync(to)) fs.mkdirSync(to);
        fs.readdirSync(from).forEach(element => {
            if (fs.lstatSync(path.join(from, element)).isDirectory()) {
                copyFolderSync(path.join(from, element), path.join(to, element));
            } else {
                fs.copyFileSync(path.join(from, element), path.join(to, element));
            }
        });
    }
    copyFolderSync(clientDist, publicDir);

    console.log('Bundling server...');
    await esbuild.build({
        entryPoints: [path.join(__dirname, '../packages/server/src/index.ts')],
        bundle: true,
        platform: 'node',
        target: 'node20',
        outfile: path.join(outDir, 'index.cjs'),
        external: ['better-sqlite3', 'bonjour-service', 'open', 'express', 'socket.io', 'multer', 'qrcode', 'cors', 'archiver'],
        format: 'cjs',
        define: {
            'process.env.NODE_SEA': '"true"'
        }
    });

    console.log('Preparing SEA (Single Executable Application)...');
    const seaConfig = {
        main: path.join(outDir, 'index.cjs'),
        output: path.join(outDir, 'sea-prep.blob')
    };
    fs.writeFileSync(path.join(outDir, 'sea-config.json'), JSON.stringify(seaConfig));

    execSync(`node --experimental-sea-config ${path.join(outDir, 'sea-config.json')}`, { stdio: 'inherit' });

    const exeName = process.platform === 'win32' ? 'fastsend.exe' : 'fastsend';
    const targetExe = path.join(outDir, exeName);

    console.log(`Creating executable: ${exeName}`);
    fs.copyFileSync(process.execPath, targetExe);

    console.log('Injecting blob into executable...');
    // 使用 postject 注入 (如果是 Windows，需要特殊处理权限或工具路径)
    // 注意：Sentinel Fuse 随 Node.js 版本变化，v24.14.1 使用 fce680ab2cc467b6e072b8b5df1996b2
    try {
        execSync(`npx postject ${targetExe} NODE_SEA_BLOB ${path.join(outDir, 'sea-prep.blob')} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, { stdio: 'inherit' });
    } catch (e) {
        console.warn('Postject failed, you might need to run it manually with admin privileges.');
    }

    console.log('Copying native modules...');
    // 拷贝 better-sqlite3 的原生驱动
    const sqlitePath = path.join(__dirname, '../node_modules/better-sqlite3');
    if (fs.existsSync(sqlitePath)) {
        const destSqlite = path.join(outDir, 'node_modules/better-sqlite3');
        fs.mkdirSync(destSqlite, { recursive: true });
        copyFolderSync(sqlitePath, destSqlite);
    }

    // 拷贝 open 和 bonjour-service 的运行时依赖 (简便起见，生产环境建议更精简)
    const otherDeps = ['open', 'bonjour-service', 'express', 'socket.io', 'multer', 'qrcode', 'cors', 'archiver'];
    otherDeps.forEach(dep => {
        const depPath = path.join(__dirname, '../node_modules', dep);
        if (fs.existsSync(depPath)) {
            const destDep = path.join(outDir, 'node_modules', dep);
            fs.mkdirSync(destDep, { recursive: true });
            copyFolderSync(depPath, destDep);
        }
    });

    console.log('\nBuild complete! Output directory: out/');
    console.log(`Run ./${exeName} to start the application.`);
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});

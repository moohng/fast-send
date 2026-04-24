const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
    const iconPath = path.join(__dirname, 'icon.png');
    
    // 1. Web icon (public/favicon.ico, public/logo192.png, public/logo512.png)
    const publicDir = path.join(__dirname, 'packages/client/public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // We can also create a favicon.ico
    await sharp(iconPath).resize(64, 64).toFile(path.join(publicDir, 'favicon.ico'));
    await sharp(iconPath).resize(192, 192).toFile(path.join(publicDir, 'logo192.png'));
    await sharp(iconPath).resize(512, 512).toFile(path.join(publicDir, 'logo512.png'));
    
    // 2. PC Server Go icon (embed into config.go)
    // Create a 16x16 PNG for config.go IconData
    const smallIconBuffer = await sharp(iconPath).resize(16, 16).png().toBuffer();
    let configGoPath = path.join(__dirname, 'packages/server-go/internal/config/config.go');
    let configStr = fs.readFileSync(configGoPath, 'utf-8');
    
    let byteStr = '';
    for (let i = 0; i < smallIconBuffer.length; i++) {
        byteStr += '0x' + smallIconBuffer[i].toString(16).padStart(2, '0').toUpperCase();
        if (i !== smallIconBuffer.length - 1) {
            byteStr += ', ';
        }
        if ((i + 1) % 16 === 0) {
            byteStr += '\n\t';
        }
    }
    
    const iconDataRegex = /var IconData = \[\]byte\{[\s\S]*?\}/;
    const newIconData = `var IconData = []byte{\n\t${byteStr}\n}`;
    configStr = configStr.replace(iconDataRegex, newIconData);
    fs.writeFileSync(configGoPath, configStr);

    // 3. Setup Capacitor assets folder
    const assetsDir = path.join(__dirname, 'packages/client/assets');
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }
    // Capacitor requires 1024x1024 icon for generation
    await sharp(iconPath).resize(1024, 1024).toFile(path.join(assetsDir, 'icon.png'));
    
    // Create a splash image as well, say 2732x2732 centered icon
    await sharp({
        create: {
          width: 2732,
          height: 2732,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
      .composite([{ input: await sharp(iconPath).resize(512, 512).toBuffer(), gravity: 'center' }])
      .png()
      .toFile(path.join(assetsDir, 'splash.png'));
}

main().catch(console.error);

const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default;

async function main() {
    // 1. Generate ICO buffer
    // pngToIco expects an array of paths or buffers. We give it the 256x256 png we just created
    const buf = await pngToIco(path.join(__dirname, 'packages/server-go/winres/icon.png'));
    
    // 2. Format byte array for config.go
    let configGoPath = path.join(__dirname, 'packages/server-go/internal/config/config.go');
    let configStr = fs.readFileSync(configGoPath, 'utf-8');
    
    let byteStr = '';
    for (let i = 0; i < buf.length; i++) {
        byteStr += '0x' + buf[i].toString(16).padStart(2, '0').toUpperCase();
        if (i !== buf.length - 1) {
            byteStr += ', ';
        }
        if ((i + 1) % 16 === 0) {
            byteStr += '\n\t';
        }
    }
    
    // Ensure trailing comma for Go syntax
    if (!byteStr.endsWith(', ') && !byteStr.endsWith('\n\t')) {
        byteStr += ',';
    } else if (byteStr.endsWith('\n\t')) {
        // Find the last byte and add a comma before the newline
        byteStr = byteStr.trimEnd() + ',\n\t';
    } else if (byteStr.endsWith(', ')) {
        // It's fine
    }
    
    const iconDataRegex = /var IconData = \[\]byte\{[\s\S]*?\}/;
    const newIconData = `var IconData = []byte{\n\t${byteStr}\n}`;
    configStr = configStr.replace(iconDataRegex, newIconData);
    fs.writeFileSync(configGoPath, configStr);
    console.log("Updated config.go with ICO byte array.");
}

main().catch(console.error);

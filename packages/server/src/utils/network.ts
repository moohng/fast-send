import * as os from 'os';

/**
 * 识别并返回局域网 IPv4 地址。
 */
export function getLocalIP(): string {
    const interfaces = os.networkInterfaces();
    let fallbackIP: string | null = null;
    
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        if (!iface) continue;

        for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
                if (alias.address.startsWith('192.168.') || alias.address.startsWith('10.')) {
                    return alias.address;
                }
                fallbackIP = alias.address;
            }
        }
    }
    return fallbackIP || '127.0.0.1';
}

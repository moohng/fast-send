import * as os from 'os';

/**
 * 返回所有有效的局域网 IPv4 地址列表
 */
export function getAllLocalIPs(): string[] {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    for (const devName in interfaces) {
        const iface = interfaces[devName];
        if (!iface) continue;

        for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
                // 优先收集 192.168.x.x, 10.x.x.x, 172.16.x.x 等私有网段
                ips.push(alias.address);
            }
        }
    }
    // 排序：让 192.168 开头的排在前面，因为最常用
    return ips.sort((a, b) => {
        if (a.startsWith('192.168.')) return -1;
        if (b.startsWith('192.168.')) return 1;
        return 0;
    });
}

/**
 * 识别并返回一个最可能的局域网 IPv4 地址（向下兼容）。
 */
export function getLocalIP(): string {
    const ips = getAllLocalIPs();
    return ips.length > 0 ? ips[0] : '127.0.0.1';
}

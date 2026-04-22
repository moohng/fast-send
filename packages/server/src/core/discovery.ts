import { Bonjour } from 'bonjour-service';
import { getLocalIP } from '../utils/network.ts';

/**
 * mDNS 自动发现服务管理。
 */
class DiscoveryService {
    private bonjour: Bonjour;

    constructor() {
        this.bonjour = new Bonjour();
    }

    public startBroadcasting(port: number, deviceName: string) {
        const localIP = getLocalIP();
        this.bonjour.publish({
            name: `FastSend-${deviceName}`,
            type: 'fastsend',
            protocol: 'tcp',
            port: port,
            txt: {
                ip: localIP,
                version: '2.0.0'
            }
        });
        console.log(`[Discovery] mDNS 广播已启动: ${deviceName} (_fastsend._tcp)`);
    }

    public stop() {
        this.bonjour.unpublishAll();
        this.bonjour.destroy();
    }
}

export const discovery = new DiscoveryService();

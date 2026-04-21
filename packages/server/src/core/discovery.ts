import { Bonjour } from 'bonjour-service';
import { getLocalIP } from '../utils/network';

/**
 * mDNS 自动发现服务管理。
 * 负责在局域网内广播当前设备的存在。
 */
class DiscoveryService {
    private bonjour: Bonjour;

    constructor() {
        this.bonjour = new Bonjour();
    }

    /**
     * 启动广播
     * @param port 服务运行端口
     * @param deviceName 设备显示名称
     */
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

    /**
     * 停止广播
     */
    public stop() {
        this.bonjour.unpublishAll();
        this.bonjour.destroy();
    }
}

export const discovery = new DiscoveryService();

import { useState, useCallback, useEffect } from 'react';
import { Network } from '@capacitor/network';

export const useDiscovery = (baseUrl: string, setBaseUrl: (url: string) => void, fetchData: (url: string | any) => void, showToast: (m: string, t?: any) => void) => {
  const [isScanning, setIsScanning] = useState(false);

  const getPhoneSubnet = async (): Promise<string[]> => {
    const subnets: string[] = ['192.168.0', '192.168.1', '192.168.31', '10.0.0'];

    try {
      // 1. 尝试通过 Capacitor Network 插件获取信息 (虽然它不直接提供 IP，但可以感知状态)
      const status = await Network.getStatus();
      console.log('[Discovery] Network Status:', status);

      // 2. WebRTC 兜底 (在部分 Android 版本或 Electron 中依然有效)
      return new Promise((resolve) => {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        pc.onicecandidate = (ice) => {
          if (!ice || !ice.candidate) return;
          const match = ice.candidate.candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
          if (match) {
            const ip = match[1];
            const subnet = ip.split('.').slice(0, 3).join('.');
            if (!subnets.includes(subnet)) subnets.unshift(subnet);
            resolve(subnets);
          }
        };
        // 800ms 后超时返回已知列表
        setTimeout(() => resolve(subnets), 800);
      });
    } catch (e) {
      return subnets;
    }
  };

  const smartScan = async () => {
    console.log('[Discovery] Starting Smart Subnet Scan...');
    const subnetsToScan = await getPhoneSubnet();
    const scanned = new Set();
    const controller = new AbortController();
    let found = false;

    // 并发扫描多个可能网段
    for (const sn of subnetsToScan) {
      if (found || scanned.has(sn)) continue;
      scanned.add(sn);
      console.log(`[Discovery] Probing subnet: ${sn}.x`);

      // 分批次并发，避免阻塞移动端网络栈
      const batches = [];
      const range = 255;
      const step = 64;
      for (let i = 1; i < range; i += step) {
        batches.push(Array.from({ length: Math.min(step, range - i) }, (_, k) => i + k));
      }

      for (const batch of batches) {
        if (found) break;
        await Promise.all(batch.map(lastOctet => {
          const url = `http://${sn}.${lastOctet}:3000`;
          // 使用更短的 timeout
          const timeoutId = setTimeout(() => {}, 2000);

          return fetch(`${url}/api/config`, {
            signal: controller.signal,
            mode: 'cors',
            credentials: 'omit'
          }).then(async res => {
            if (res.ok && !found) {
              const data = await res.json();
              if (data.ip) {
                found = true;
                controller.abort();
                clearTimeout(timeoutId);
                const finalUrl = `http://${data.ip}:3000`;
                setBaseUrl(finalUrl);
                localStorage.setItem('fast_send_last_url', finalUrl);
                fetchData(finalUrl);
                showToast('已自动发现并连接设备');
              }
            }
          }).catch(() => {
            clearTimeout(timeoutId);
          });
        }));
        // 给系统喘息时间
        await new Promise(r => setTimeout(r, 30));
      }
    }
  };

  const scan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);

    // 优先尝试 Zeroconf (mDNS)
    const zeroconf = (window as any).cordova?.plugins?.zeroconf;
    if (zeroconf) {
      console.log('[Discovery] Zeroconf (mDNS) watching...');
      try {
        zeroconf.watch('_fastsend._tcp.', 'local.', (result: any) => {
          const action = result.action;
          const service = result.service;
          if (action === 'added' || action === 'resolved') {
            console.log('[Discovery] Zeroconf found:', service);
            const ip = service.ipv4Addresses?.[0] || service.host;
            if (ip && !ip.includes(':')) { // 排除 IPv6
              const url = `http://${ip}:${service.port || 3000}`;
              setBaseUrl(url);
              localStorage.setItem('fast_send_last_url', url);
              fetchData(url);
              showToast('通过 mDNS 发现设备');
              zeroconf.stop();
              setIsScanning(false);
            }
          }
        });
      } catch (e) {
        console.error('[Discovery] Zeroconf error:', e);
      }

      // 4秒后如果没有发现，启动 Smart Scan 作为备份
      setTimeout(() => {
        if (isScanning) {
          smartScan().finally(() => setIsScanning(false));
        }
      }, 4000);
    } else {
      await smartScan();
      setIsScanning(false);
    }
  }, [isScanning, setBaseUrl, fetchData, showToast]);

  useEffect(() => {
    const lastUrl = localStorage.getItem('fast_send_last_url');
    if (lastUrl) {
      // 验证上次的 URL 是否仍然有效
      fetch(`${lastUrl}/api/config`).then(res => {
        if (res.ok) fetchData(lastUrl);
        else scan();
      }).catch(() => scan());
    } else {
      scan();
    }
  }, []);

  return { scan, isScanning };
};

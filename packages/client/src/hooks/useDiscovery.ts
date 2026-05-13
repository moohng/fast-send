import { useState, useCallback, useEffect } from 'react'

export const useDiscovery = (
  baseUrl: string,
  setBaseUrl: (url: string) => void,
  fetchData: (url: string | any) => void,
  showToast: (m: string, t?: any) => void,
) => {
  const [isScanning, setIsScanning] = useState(false)

  const scan = useCallback(async (silent: boolean = false) => {
    if (isScanning) return
    setIsScanning(true)

    // 优先尝试 Zeroconf (mDNS) - 仅在 Cordova/Capacitor 环境下有效
    const zeroconf = (window as any).cordova?.plugins?.zeroconf
    if (zeroconf) {
      console.log('[Discovery] Zeroconf (mDNS) watching...')
      try {
        zeroconf.watch('_fastsend._tcp.', 'local.', (result: any) => {
          const action = result.action
          const service = result.service
          if (action === 'added' || action === 'resolved') {
            console.log('[Discovery] Zeroconf found:', service)
            const ip = service.ipv4Addresses?.[0] || service.host
            if (ip && !ip.includes(':')) {
              const url = `http://${ip}:${service.port || 5678}`
              setBaseUrl(url)
              localStorage.setItem('fast_send_last_url', url)
              fetchData(url)
              if (!silent) {
                showToast('通过 mDNS 发现设备')
              }
              zeroconf.stop()
              setIsScanning(false)
            }
          }
        })
      } catch (e) {
        console.error('[Discovery] Zeroconf error:', e)
        setIsScanning(false)
      }

      // 10秒后停止扫描，避免一直运行
      setTimeout(() => {
        if (isScanning) {
          zeroconf.stop()
          setIsScanning(false)
        }
      }, 10000)
    } else {
      console.log('[Discovery] mDNS not available in this environment')
      setIsScanning(false)
    }
  }, [isScanning, setBaseUrl, fetchData, showToast])

  useEffect(() => {
    // 如果已经在当前 baseUrl 成功连接（在 App.tsx 中会触发 fetchData），Web 环境下通常不需要再探测 lastUrl
    if (baseUrl && !baseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
        // 如果当前已经是指向某个具体 IP 的 baseUrl，且不是 localhost，说明已经有了明确目标
    }

    const lastUrl = localStorage.getItem('fast_send_last_url')
    if (lastUrl && lastUrl !== baseUrl) {
      fetch(`${lastUrl}/api/config`)
        .then((res) => {
          if (res.ok) fetchData(lastUrl)
          else scan(true)
        })
        .catch(() => scan(true))
    } else if (!lastUrl && !baseUrl) {
      scan(true)
    }
  }, [])

  return { scan, isScanning }
}

import type { CapacitorConfig } from '@capacitor/cli'
import { networkInterfaces } from 'os'

const getLocalIP = () => {
  const interfaces = networkInterfaces()
  const addresses: string[] = []

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address)
      }
    }
  }

  // 优先寻找 192.168. 开头的地址
  const preferred = addresses.find(addr => addr.startsWith('192.168.'))
  if (preferred) {
    console.log('本地热更新 IP (优先):', preferred)
    return preferred
  }

  // 其次寻找 10. 或 172. 开头的地址（也是常见的局域网段）
  const secondary = addresses.find(addr => addr.startsWith('10.') || addr.startsWith('172.'))
  if (secondary) {
    console.log('本地热更新 IP (备选):', secondary)
    return secondary
  }

  // 如果都没有，返回第一个非内网地址
  const first = addresses[0] || 'localhost'
  console.log('本地热更新 IP (兜底):', first)
  return first
}

const config: CapacitorConfig = {
  appId: 'com.fastsend.app',
  appName: 'FastSend',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['*'],
    // 调试模式下，设置 url 可开启 HMR。正式版构建时不设置此项。
    url: process.env.CAP_HMR === 'true' ? `http://${getLocalIP()}:5173` : undefined,
  },
}

export default config

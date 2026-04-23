import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.fastsend.app',
  appName: 'FastSend',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['*'],
    // 调试模式下，可以将此处的 url 设置为你电脑的局域网 IP
    // 例如: url: 'http://192.168.1.5:5173',
    // 注意：发布正式版时必须注释掉或删除 url，否则 App 无法离线运行
    url: 'http://192.168.0.112:5173',
  },
}

export default config

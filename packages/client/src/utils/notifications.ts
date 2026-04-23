import { Capacitor } from '@capacitor/core';

let localNotificationsPlugin: any = null;

// 预加载插件
if (Capacitor.isNativePlatform()) {
  import('@capacitor/local-notifications').then(m => {
    localNotificationsPlugin = m.LocalNotifications;
  });
}

export async function requestNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    localNotificationsPlugin = LocalNotifications;
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
    // 创建通知渠道（Android 8.0+ 必须）
    await LocalNotifications.createChannel({
      id: 'fast-send-notifications',
      name: 'FastSend Notifications',
      description: 'FastSend 消息通知',
      importance: 5, // 高重要性
      visibility: 1, // 公开
      vibration: true,
    });
  } else if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      await Notification.requestPermission();
    }
  }
}

export async function sendNotification(title: string, body: string) {
  if (Capacitor.isNativePlatform()) {
    const LocalNotifications = localNotificationsPlugin || (await import('@capacitor/local-notifications')).LocalNotifications;
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 1000000),
          channelId: 'fast-send-notifications',
          // 移除 100ms 延迟，尝试立即显示
          // schedule: { at: new Date(Date.now() + 100) },
          smallIcon: 'ic_stat_name', // 建议在 Android 项目中添加该图标
        },
      ],
    });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    // 即使在可见状态也尝试发送（部分浏览器可能会拦截）
    try {
      new Notification(title, { body });
    } catch (e) {
      console.error('Notification error:', e);
    }
  }
}

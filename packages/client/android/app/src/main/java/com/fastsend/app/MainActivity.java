package com.fastsend.app;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private WifiManager.MulticastLock multicastLock;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 显式开启多播锁，允许 mDNS (Zeroconf) 发现
        WifiManager wifi = (WifiManager) getSystemService(Context.WIFI_SERVICE);
        if (wifi != null) {
            multicastLock = wifi.createMulticastLock("fastSendLock");
            multicastLock.setReferenceCounted(true);
            multicastLock.acquire();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (multicastLock != null && multicastLock.isHeld()) {
            multicastLock.release();
        }
    }
}

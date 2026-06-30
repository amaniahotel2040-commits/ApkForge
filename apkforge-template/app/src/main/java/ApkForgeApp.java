package com.apkforge.template;

import android.app.Application;
import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;

// ApkForge App class — OneSignal push notification চালু করার কাজ
// build.gradle-এর "onesignal_app_id" placeholder build সময় বসিয়ে দেওয়া হবে
public class ApkForgeApp extends Application {

    @Override
    public void onCreate() {
        super.onCreate();

        // OneSignal init — App ID আসবে app_config.json থেকে (build সময় inject হবে)
        OneSignal.getDebug().setLogLevel(LogLevel.NONE);
        String oneSignalAppId = getString(R.string.onesignal_app_id);

        if (oneSignalAppId != null && !oneSignalAppId.isEmpty()
                && !oneSignalAppId.equals("REPLACE_ME")) {
            OneSignal.initWithContext(this, oneSignalAppId);
            OneSignal.getNotifications().requestPermission(true, null);
        }
    }
}

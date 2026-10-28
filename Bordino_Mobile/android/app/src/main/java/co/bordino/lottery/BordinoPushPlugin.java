package co.bordino.lottery;

import android.Manifest;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.core.app.NotificationManagerCompat;
import co.pushe.plus.Pushe;
import co.pushe.plus.notification.PusheNotification;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * «مدیریت اعلان‌ها» inside the app: Android has no Web Push in a WebView, so notifications come
 * through Pushe. The site asks this plugin for permission and for Pushe's device id, and registers
 * that id with the server (apps/notifications), which sends through Pushe's API.
 */
@CapacitorPlugin(
    name = "BordinoPush",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class BordinoPushPlugin extends Plugin {

    private static final long REGISTRATION_WAIT_MS = 20000;

    private String permission() {
        if (Build.VERSION.SDK_INT >= 33) {
            PermissionState state = getPermissionState("notifications");
            if (state != PermissionState.GRANTED) return state == PermissionState.DENIED ? "denied" : "prompt";
        }
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled() ? "granted" : "denied";
    }

    private static String deviceId() {
        try {
            return Pushe.isRegistered() ? Pushe.getDeviceId() : null;
        } catch (Throwable t) {
            return null;
        }
    }

    private static void setShown(boolean shown) {
        try {
            PusheNotification notifications = Pushe.getPusheService(PusheNotification.class);
            if (notifications == null) return;
            if (shown) notifications.enableNotifications();
            else notifications.disableNotifications();
        } catch (Throwable ignored) {
            // Pushe not started (no token): nothing to switch.
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", BuildConfig.PUSHE_ENABLED);
        result.put("permission", permission());
        String id = BuildConfig.PUSHE_ENABLED ? deviceId() : null;
        result.put("registered", id != null);
        result.put("deviceId", id);
        call.resolve(result);
    }

    /** Asks for permission (Android 13+), waits for Pushe's registration, returns { deviceId }. */
    @PluginMethod
    public void enable(PluginCall call) {
        if (!BuildConfig.PUSHE_ENABLED) {
            call.reject("Pushe is not configured in this build", "UNAVAILABLE");
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterPermission");
            return;
        }
        finishEnable(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("Notifications not allowed", "DENIED");
            return;
        }
        finishEnable(call);
    }

    private void finishEnable(PluginCall call) {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            call.reject("Notifications are off for this app in Android settings", "DENIED");
            return;
        }
        setShown(true);
        String id = deviceId();
        if (id != null) {
            resolveWith(call, id);
            return;
        }
        final boolean[] done = { false };
        Handler main = new Handler(Looper.getMainLooper());
        main.postDelayed(() -> {
            if (done[0]) return;
            done[0] = true;
            String late = deviceId();
            if (late != null) resolveWith(call, late);
            else call.reject("Pushe registration did not finish; check the connection", "TIMEOUT");
        }, REGISTRATION_WAIT_MS);
        try {
            Pushe.setRegistrationCompleteListener(() -> main.post(() -> {
                if (done[0]) return;
                String now = deviceId();
                if (now == null) return;
                done[0] = true;
                resolveWith(call, now);
            }));
        } catch (Throwable t) {
            // The timer above answers.
        }
    }

    private static void resolveWith(PluginCall call, String id) {
        JSObject result = new JSObject();
        result.put("deviceId", id);
        call.resolve(result);
    }

    /** This device stops showing notifications (sign-out, or the player turned them off). */
    @PluginMethod
    public void disable(PluginCall call) {
        setShown(false);
        JSObject result = new JSObject();
        result.put("deviceId", BuildConfig.PUSHE_ENABLED ? deviceId() : null);
        call.resolve(result);
    }
}

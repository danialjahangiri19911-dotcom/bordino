package co.bordino.lottery;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.adivery.sdk.Adivery;
import com.adivery.sdk.AdiveryListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The rewarded video of «دریافت امتیاز» (and before games) inside the app, through the Adivery SDK
 * (docs.adivery.com). The site starts a view on our server, then asks this plugin to show the ad
 * with that view's id as Adivery's user id; Adivery's server confirms the view to ours with it,
 * and only that confirmation pays. What this plugin reports («rewarded») just tells the site to
 * ask the server.
 */
@CapacitorPlugin(name = "BordinoAds")
public class BordinoAdsPlugin extends Plugin {

    private static final String TAG = "BordinoAds";
    private static final long LOAD_WAIT_MS = 20000;

    // One ad at a time for the whole app, and one listener for its lifetime (the SDK documents no
    // way to remove one): kept static, so a recreated plugin finds the ad that is showing.
    private static String configuredAppId = null;
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static PluginCall pending = null;
    private static String pendingPlacement = null;
    private static Runnable loadTimeout = null;
    private static boolean listening = false;

    private static final AdiveryListener listener = new AdiveryListener() {
        @Override
        public void onRewardedAdLoaded(String placementId) {
            // Asked to show while it was still loading: show now.
            if (pending != null && placementId.equals(pendingPlacement) && loadTimeout != null) {
                main.removeCallbacks(loadTimeout);
                loadTimeout = null;
                Adivery.showAd(placementId);
            }
        }

        @Override
        public void onRewardedAdClosed(String placementId, boolean isRewarded) {
            if (pending == null || !placementId.equals(pendingPlacement)) return;
            JSObject result = new JSObject();
            result.put("rewarded", isRewarded);
            finish(result, null);
        }

        @Override
        public void log(String placementId, String message) {
            Log.d(TAG, message);
        }
    };

    private static void finish(JSObject result, String error) {
        PluginCall call = pending;
        pending = null;
        pendingPlacement = null;
        if (loadTimeout != null) {
            main.removeCallbacks(loadTimeout);
            loadTimeout = null;
        }
        if (call == null) return;
        if (error != null) call.reject(error, error);
        else call.resolve(result);
    }

    private boolean configure(String appId) {
        if (appId == null || appId.isEmpty()) return false;
        if (!appId.equals(configuredAppId)) {
            Adivery.configure(getActivity().getApplication(), appId);
            configuredAppId = appId;
        }
        if (!listening) {
            Adivery.addGlobalListener(listener);
            listening = true;
        }
        return true;
    }

    /** Loads the rewarded ad ahead of the tap (Adivery reloads by itself after each view). */
    @PluginMethod
    public void prepare(PluginCall call) {
        String appId = call.getString("appId");
        String placementId = call.getString("placementId");
        if (placementId == null || placementId.isEmpty()) {
            call.reject("placementId missing", "bad_request");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (!configure(appId)) {
                call.reject("appId missing", "bad_request");
                return;
            }
            Adivery.prepareRewardedAd(getActivity(), placementId);
            JSObject result = new JSObject();
            result.put("loaded", Adivery.isLoaded(placementId));
            call.resolve(result);
        });
    }

    /**
     * Shows the rewarded ad for the view `userId` (our server's session id); resolves {rewarded}
     * when it closes, or rejects "no_fill" when no ad loads in time.
     */
    @PluginMethod
    public void show(PluginCall call) {
        String appId = call.getString("appId");
        String placementId = call.getString("placementId");
        String userId = call.getString("userId");
        if (placementId == null || placementId.isEmpty() || userId == null || userId.isEmpty()) {
            call.reject("placementId and userId are required", "bad_request");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (pending != null) {
                call.reject("an ad is already showing", "busy");
                return;
            }
            if (!configure(appId)) {
                call.reject("appId missing", "bad_request");
                return;
            }
            pending = call;
            pendingPlacement = placementId;
            // The id Adivery's server sends back to ours: this view, nothing about the player.
            Adivery.setUserId(userId);
            if (Adivery.isLoaded(placementId)) {
                Adivery.showAd(placementId);
                return;
            }
            Adivery.prepareRewardedAd(getActivity(), placementId);
            loadTimeout = () -> finish(null, "no_fill");
            main.postDelayed(loadTimeout, LOAD_WAIT_MS);
        });
    }

    @Override
    protected void handleOnDestroy() {
        // The page that asked is gone: its question ends here (the view itself is the server's).
        finish(null, "closed");
        super.handleOnDestroy();
    }
}

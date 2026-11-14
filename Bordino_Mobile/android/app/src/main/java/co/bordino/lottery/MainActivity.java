package co.bordino.lottery;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Native features the site (lottery.bordino.co) can call through window.Capacitor.Plugins.
        registerPlugin(BordinoPushPlugin.class);
        registerPlugin(BordinoAdsPlugin.class);
        super.onCreate(savedInstanceState);
        // Picked files reach the page as readable copies (see PickedFileChromeClient). Set here, while the
        // activity is still being created: the client registers its activity-result launchers.
        getBridge().getWebView().setWebChromeClient(new PickedFileChromeClient(getBridge()));
    }
}

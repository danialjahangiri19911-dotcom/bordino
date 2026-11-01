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
    }
}

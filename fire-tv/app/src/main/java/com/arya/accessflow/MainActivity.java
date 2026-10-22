package com.arya.accessflow;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * AccessFlow Fire TV wrapper.
 *
 * A single full-screen WebView that loads the AccessFlow web app bundled in
 * assets (file:///android_asset/index.html). The WebView is focusable and
 * focused on launch, so Fire TV remote D-pad presses and keyboard input are
 * delivered to the page as DOM key events (ArrowUp/Down/Left/Right, Enter),
 * which the app's existing keyboard handler consumes.
 *
 * The remote's Back button (KEYCODE_BACK) is translated into an Escape key
 * event for the page instead of exiting the app, matching the app's
 * keyboard-first navigation model (Escape/Backspace = go back in the app).
 */
public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep the TV awake while the app is in the foreground.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Assets are local; no network access is needed or wanted.
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);

        webView.setWebViewClient(new WebViewClient());

        setContentView(webView);
        webView.requestFocus();
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // Deliver Escape to the page so its own back-navigation runs.
            webView.dispatchKeyEvent(
                    new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ESCAPE));
            webView.dispatchKeyEvent(
                    new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ESCAPE));
            return true;
        }
        // Everything else (D-pad, DPAD_CENTER/Enter, Backspace, letters)
        // goes to the focused WebView through normal key dispatch.
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.requestFocus();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}

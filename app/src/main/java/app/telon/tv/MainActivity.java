package app.telon.tv;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private WebView web;
    private WebView embedView;
    private FrameLayout root;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#09090B"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#09090B"));
        root.addView(web, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setDatabaseEnabled(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);

        web.addJavascriptInterface(new TelonJS(), "TelonBridge");
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        WebView.setWebContentsDebuggingEnabled(true);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl("file:///android_asset/www/index.html");
        }
    }

    private class TelonJS {
        @android.webkit.JavascriptInterface
        public void setOrientation(final String mode) {}

        @android.webkit.JavascriptInterface
        public void openExternal(final String url) {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception e) { Log.e("TelonTV", "openExternal", e); }
            });
        }

        @android.webkit.JavascriptInterface
        public void downloadAndInstall(final String url) {
            openExternal(url);
        }

        @android.webkit.JavascriptInterface
        public void openEmbed(final String embedUrl, final String referrer) {
            runOnUiThread(() -> {
                closeEmbedInternal();
                embedView = new WebView(MainActivity.this);
                embedView.setBackgroundColor(Color.BLACK);
                WebSettings hs = embedView.getSettings();
                hs.setJavaScriptEnabled(true);
                hs.setDomStorageEnabled(true);
                hs.setMediaPlaybackRequiresUserGesture(false);
                hs.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                hs.setUserAgentString("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36");
                embedView.setWebViewClient(new WebViewClient() {
                    private boolean videoFound = false;
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        view.evaluateJavascript(
                            "document.querySelectorAll('header,footer,nav,.navbar,.sidebar,#comments,.episode-list,.ep-list,[class*=comment],[class*=disqus],[class*=footer],[class*=header],[class*=nav]').forEach(function(e){e.style.display='none'});" +
                            "var p=document.querySelector('iframe:not(#trailer-frame)');if(p){p.style.position='fixed';p.style.inset='0';p.style.width='100%';p.style.height='100%';p.style.zIndex='99999';document.body.style.overflow='hidden';document.body.style.margin='0';document.body.style.background='#000';}" +
                            "function _tlnSubs(){var v=document.querySelector('video');if(v&&v.textTracks){for(var i=0;i<v.textTracks.length;i++)v.textTracks[i].mode='showing';v.textTracks.addEventListener('addtrack',function(e){if(e.track)e.track.mode='showing';});}var cc=document.querySelector('button[data-plyr=captions],button.plyr__control--captions,.jw-icon-cc,.vjs-subs-caps-button,[aria-label*=ubtitle],[aria-label*=aption],[aria-label*=CC],.ytp-subtitles-button');if(cc&&cc.getAttribute('aria-pressed')!=='true'&&!cc.classList.contains('plyr__control--pressed'))cc.click();}" +
                            "_tlnSubs();setTimeout(_tlnSubs,2000);setTimeout(_tlnSubs,5000);",
                            null);
                    }
                    @Override
                    public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        String reqUrl = request.getUrl().toString();
                        if (!videoFound && (reqUrl.contains(".m3u8") || reqUrl.contains(".mp4"))) {
                            if (!reqUrl.contains("favicon") && !reqUrl.contains("thumbnail") && !reqUrl.contains(".js")) {
                                videoFound = true;
                                final String videoUrl = reqUrl;
                                runOnUiThread(() -> {
                                    closeEmbedInternal();
                                    web.evaluateJavascript(
                                        "window._embedVideoFound && window._embedVideoFound('" + videoUrl.replace("'", "\\'") + "')",
                                        null);
                                });
                            }
                        }
                        return super.shouldInterceptRequest(view, request);
                    }
                });
                embedView.setWebChromeClient(new WebChromeClient());
                root.addView(embedView, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

                Map<String, String> headers = new HashMap<>();
                if (referrer != null && !referrer.isEmpty()) {
                    headers.put("Referer", referrer);
                }
                embedView.loadUrl(embedUrl, headers);
                web.evaluateJavascript("window._embedOpened && window._embedOpened()", null);
            });
        }

        @android.webkit.JavascriptInterface
        public void closeEmbed() {
            runOnUiThread(() -> closeEmbedInternal());
        }
    }

    private void closeEmbedInternal() {
        if (embedView != null) {
            embedView.stopLoading();
            root.removeView(embedView);
            embedView.destroy();
            embedView = null;
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_STOP:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
            case KeyEvent.KEYCODE_MEDIA_NEXT:
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                web.evaluateJavascript("window._tvKey&&window._tvKey(" + keyCode + ")", null);
                return true;
            case KeyEvent.KEYCODE_BACK:
                return super.onKeyDown(keyCode, event);
            default:
                return super.onKeyDown(keyCode, event);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (embedView != null) {
            closeEmbedInternal();
            web.evaluateJavascript("window._embedClosed && window._embedClosed()", null);
            return;
        }
        web.evaluateJavascript("window.telonBack ? window.telonBack() : false", value -> {
            if (!"true".equals(value)) {
                MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("window.telonPause && window.telonPause()", null);
    }

    @Override
    protected void onDestroy() {
        closeEmbedInternal();
        if (web != null) web.destroy();
        super.onDestroy();
    }
}

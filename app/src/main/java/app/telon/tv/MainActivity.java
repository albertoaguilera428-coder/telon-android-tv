/*
Telón - Actividad principal (contenedor WebView)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

La app es una página web empaquetada en los assets; esta actividad solo la monta
en un WebView, le da un puente hacia Android (TelonBridge), le pasa las teclas del
control remoto y abre por encima un segundo WebView para los reproductores embebidos.
Funciona igual en celular, tablet y Android TV: la página pregunta isTv() y se adapta.
*/
package app.telon.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.UiModeManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
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
import org.json.JSONObject;
import java.util.Map;

public class MainActivity extends Activity {

    // ============================================================
    // CONSTANTES
    // ============================================================

    private static final String ETIQUETA_LOG = "TelonTV";
    private static final String PAGINA_INICIO = "file:///android_asset/www/index.html";
    private static final String NOMBRE_PUENTE_JS = "TelonBridge";
    // Mismo tono que --fondo en style.css, para que no haya un destello blanco mientras carga la página.
    private static final int COLOR_FONDO = Color.parseColor("#09090B");

    // Algunos reproductores embebidos no entregan el video si detectan un WebView;
    // con un user agent de Chrome móvil nos tratan como un navegador normal.
    private static final String AGENTE_USUARIO_EMBED =
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36";

    // Se inyecta en la página del embed: esconde menús, comentarios y demás ruido del sitio,
    // pone el iframe del reproductor a pantalla completa y fuerza los subtítulos, que en TV
    // no hay forma cómoda de activar con el control.
    private static final String SCRIPT_LIMPIEZA_EMBED =
        "document.querySelectorAll('header,footer,nav,.navbar,.sidebar,#comments,.episode-list,.ep-list,[class*=comment],[class*=disqus],[class*=footer],[class*=header],[class*=nav]').forEach(function(e){e.style.display='none'});" +
        "var p=document.querySelector('iframe:not(#trailer-frame)');if(p){p.style.position='fixed';p.style.inset='0';p.style.width='100%';p.style.height='100%';p.style.zIndex='99999';document.body.style.overflow='hidden';document.body.style.margin='0';document.body.style.background='#000';}" +
        "function _tlnSubs(){var v=document.querySelector('video');if(v&&v.textTracks){for(var i=0;i<v.textTracks.length;i++)v.textTracks[i].mode='showing';v.textTracks.addEventListener('addtrack',function(e){if(e.track)e.track.mode='showing';});}var cc=document.querySelector('button[data-plyr=captions],button.plyr__control--captions,.jw-icon-cc,.vjs-subs-caps-button,[aria-label*=ubtitle],[aria-label*=aption],[aria-label*=CC],.ytp-subtitles-button');if(cc&&cc.getAttribute('aria-pressed')!=='true'&&!cc.classList.contains('plyr__control--pressed'))cc.click();}" +
        "_tlnSubs();setTimeout(_tlnSubs,2000);setTimeout(_tlnSubs,5000);";

    private WebView vistaPrincipal;
    private WebView vistaEmbed;
    private FrameLayout contenedor;
    private boolean esTv;

    // ============================================================
    // CICLO DE VIDA
    // ============================================================

    // JavaScript es la app entera; sin él no hay nada que mostrar. El riesgo (XSS) se controla
    // del lado web escapando todo lo que viene de los addons.
    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle estadoGuardado) {
        super.onCreate(estadoGuardado);
        esTv = detectTv();
        contenedor = new FrameLayout(this);
        contenedor.setBackgroundColor(COLOR_FONDO);
        vistaPrincipal = new WebView(this);
        vistaPrincipal.setBackgroundColor(COLOR_FONDO);
        contenedor.addView(vistaPrincipal, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(contenedor);

        WebSettings ajustes = vistaPrincipal.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        // Sin esto el siguiente capítulo no arranca solo: el WebView exige un toque para reproducir.
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        // La página vive en file:// y consulta addons por HTTP; sin estos permisos el WebView
        // bloquea esas peticiones por CORS.
        ajustes.setAllowFileAccess(true);
        ajustes.setAllowFileAccessFromFileURLs(true);
        ajustes.setAllowUniversalAccessFromFileURLs(true);
        // Hay addons que corren en la red local por http (por ejemplo http://192.168.1.20:7000).
        ajustes.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ajustes.setUseWideViewPort(true);
        ajustes.setLoadWithOverviewMode(true);
        ajustes.setCacheMode(WebSettings.LOAD_DEFAULT);
        ajustes.setDatabaseEnabled(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(vistaPrincipal, true);
        vistaPrincipal.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);

        vistaPrincipal.addJavascriptInterface(new TelonJS(), NOMBRE_PUENTE_JS);
        vistaPrincipal.setWebViewClient(new WebViewClient());
        vistaPrincipal.setWebChromeClient(new WebChromeClient());
        // Depurar desde chrome://inspect solo en builds de debug: en release cualquiera con un
        // cable USB podría leer la sesión y los datos de la página.
        WebView.setWebContentsDebuggingEnabled(isDebugBuild());
        vistaPrincipal.setFocusable(true);
        vistaPrincipal.setFocusableInTouchMode(true);
        vistaPrincipal.requestFocus();

        if (estadoGuardado != null) {
            vistaPrincipal.restoreState(estadoGuardado);
        } else {
            vistaPrincipal.loadUrl(PAGINA_INICIO);
        }
    }

    // Un solo APK para todo: decidimos la interfaz (TV o táctil) según el modo del sistema.
    private boolean detectTv() {
        UiModeManager modoUi = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
        return modoUi != null && modoUi.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    private boolean isDebugBuild() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    @Override
    protected void onSaveInstanceState(Bundle estadoGuardado) {
        super.onSaveInstanceState(estadoGuardado);
        vistaPrincipal.saveState(estadoGuardado);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Le avisamos a la app web para que pause el video y guarde por dónde iba.
        vistaPrincipal.evaluateJavascript("window.telonPause && window.telonPause()", null);
    }

    @Override
    protected void onDestroy() {
        closeEmbedInternal();
        if (vistaPrincipal != null) vistaPrincipal.destroy();
        super.onDestroy();
    }

    // ============================================================
    // PUENTE JS → JAVA (window.TelonBridge)
    // ============================================================

    private class TelonJS {
        // platform.js lo consulta al arrancar para elegir la interfaz de TV o la táctil.
        @android.webkit.JavascriptInterface
        public boolean isTv() {
            return esTv;
        }

        // El reproductor pide horizontal para series y películas; al cerrar devuelve el control al usuario.
        @android.webkit.JavascriptInterface
        public void setOrientation(final String modo) {
            runOnUiThread(() -> setRequestedOrientation(PlaybackRules.orientationFor(modo, esTv)));
        }

        @android.webkit.JavascriptInterface
        public void openExternal(final String url) {
            if (!PlaybackRules.isSafeExternalUrl(url)) {
                Log.w(ETIQUETA_LOG, "openExternal rechazó un esquema no permitido");
                return;
            }
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (android.content.ActivityNotFoundException e) {
                    // En algunos televisores no hay navegador instalado; no hay nada más que hacer.
                    Log.e(ETIQUETA_LOG, "openExternal: no hay app para abrir el enlace", e);
                }
            });
        }

        // No instalamos APKs desde la app: abrimos el enlace y Android se encarga de la descarga.
        @android.webkit.JavascriptInterface
        public void downloadAndInstall(final String url) {
            openExternal(url);
        }

        @android.webkit.JavascriptInterface
        public void openEmbed(final String urlEmbed, final String referente) {
            runOnUiThread(() -> showEmbed(urlEmbed, referente));
        }

        @android.webkit.JavascriptInterface
        public void closeEmbed() {
            runOnUiThread(() -> closeEmbedInternal());
        }
    }

    // ============================================================
    // REPRODUCTOR EMBEBIDO
    // ============================================================

    @SuppressLint("SetJavaScriptEnabled")
    private void showEmbed(String urlEmbed, String referente) {
        closeEmbedInternal();
        vistaEmbed = new WebView(MainActivity.this);
        vistaEmbed.setBackgroundColor(Color.BLACK);
        WebSettings ajustesEmbed = vistaEmbed.getSettings();
        ajustesEmbed.setJavaScriptEnabled(true);
        ajustesEmbed.setDomStorageEnabled(true);
        ajustesEmbed.setMediaPlaybackRequiresUserGesture(false);
        ajustesEmbed.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ajustesEmbed.setUserAgentString(AGENTE_USUARIO_EMBED);
        vistaEmbed.setWebViewClient(new WebViewClient() {
            private boolean videoEncontrado = false;

            @Override
            public void onPageFinished(WebView vista, String url) {
                vista.evaluateJavascript(SCRIPT_LIMPIEZA_EMBED, null);
            }

            // El embed solo nos sirve para descubrir la URL real del video. En cuanto pide un
            // .m3u8 o .mp4 lo cerramos y le pasamos esa URL al <video> nativo de app.js, que sí
            // se maneja bien con el control remoto.
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView vista, WebResourceRequest peticion) {
                String urlPeticion = peticion.getUrl().toString();
                if (!videoEncontrado && PlaybackRules.isVideoRequest(urlPeticion)) {
                    videoEncontrado = true;
                    runOnUiThread(() -> {
                        closeEmbedInternal();
                        vistaPrincipal.evaluateJavascript(
                            "window._embedVideoFound && window._embedVideoFound(" + JSONObject.quote(urlPeticion) + ")",
                            null);
                    });
                }
                return super.shouldInterceptRequest(vista, peticion);
            }
        });
        vistaEmbed.setWebChromeClient(new WebChromeClient());
        contenedor.addView(vistaEmbed, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Varios sitios solo sirven el reproductor si el Referer es su propia web.
        Map<String, String> cabeceras = new HashMap<>();
        if (referente != null && !referente.isEmpty()) {
            cabeceras.put("Referer", referente);
        }
        vistaEmbed.loadUrl(urlEmbed, cabeceras);
        vistaPrincipal.evaluateJavascript("window._embedOpened && window._embedOpened()", null);
    }

    private void closeEmbedInternal() {
        if (vistaEmbed != null) {
            vistaEmbed.stopLoading();
            contenedor.removeView(vistaEmbed);
            vistaEmbed.destroy();
            vistaEmbed = null;
        }
    }

    // ============================================================
    // CONTROL REMOTO Y BOTÓN ATRÁS
    // ============================================================

    // Las teclas del control se las pasamos a JS: allá vive la navegación por foco y los
    // atajos del reproductor. Si dejáramos que el WebView las manejara, saltaría entre
    // elementos a su manera y no siguiendo las filas y grillas de la interfaz.
    @Override
    public boolean onKeyDown(int codigoTecla, KeyEvent evento) {
        switch (codigoTecla) {
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
                vistaPrincipal.evaluateJavascript("window._tvKey&&window._tvKey(" + codigoTecla + ")", null);
                return true;
            default:
                return super.onKeyDown(codigoTecla, evento);
        }
    }

    // Primero le preguntamos a la app web si tiene algo abierto que cerrar (reproductor,
    // detalle, búsqueda...). Solo si responde que no, dejamos que Android salga de la app.
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (vistaEmbed != null) {
            closeEmbedInternal();
            vistaPrincipal.evaluateJavascript("window._embedClosed && window._embedClosed()", null);
            return;
        }
        vistaPrincipal.evaluateJavascript("window.telonBack ? window.telonBack() : false", respuesta -> {
            if (!"true".equals(respuesta)) {
                MainActivity.super.onBackPressed();
            }
        });
    }
}

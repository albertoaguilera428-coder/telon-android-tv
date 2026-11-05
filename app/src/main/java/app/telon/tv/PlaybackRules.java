/*
Telón - Reglas puras del reproductor
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Decisiones que MainActivity toma sin necesitar un dispositivo: si una petición del embed
es el video que buscamos, qué orientación corresponde y qué enlaces se pueden abrir
afuera. Viven aparte para probarlas con JUnit en la JVM, sin emulador.
*/
package app.telon.tv;

import android.content.pm.ActivityInfo;
import java.util.Locale;

final class PlaybackRules {

    // ============================================================
    // CONSTANTES
    // ============================================================

    static final String ORIENTACION_HORIZONTAL = "landscape";

    private PlaybackRules() {}

    // ============================================================
    // REGLAS
    // ============================================================

    // El embed pide muchas cosas (scripts, miniaturas, íconos); solo nos interesa la lista de
    // reproducción o el archivo de video. Las exclusiones evitan confundir un ".mp4.js" o la
    // miniatura de un video con el video mismo.
    static boolean isVideoRequest(String url) {
        if (url == null) return false;
        if (!url.contains(".m3u8") && !url.contains(".mp4")) return false;
        return !url.contains("favicon") && !url.contains("thumbnail") && !url.contains(".js");
    }

    // En TV la pantalla no gira. En celular y tablet, horizontal sigue al sensor (para poder
    // voltear el teléfono) y cualquier otro modo devuelve el control al usuario.
    static int orientationFor(String modo, boolean esTv) {
        if (esTv) return ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
        return ORIENTACION_HORIZONTAL.equals(modo)
            ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
    }

    // La app web solo debería abrir páginas o descargas. Un intent:// o un esquema raro desde
    // JavaScript podría lanzar otras apps del dispositivo, así que lo rechazamos.
    static boolean isSafeExternalUrl(String url) {
        if (url == null) return false;
        String minusculas = url.trim().toLowerCase(Locale.ROOT);
        return minusculas.startsWith("https://") || minusculas.startsWith("http://");
    }
}

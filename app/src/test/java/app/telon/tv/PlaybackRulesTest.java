/*
Telón - Pruebas de las reglas del reproductor
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Corren en la JVM con ./gradlew test, sin emulador.
*/
package app.telon.tv;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.pm.ActivityInfo;
import org.junit.Test;

public class PlaybackRulesTest {

    // ============================================================
    // DETECCIÓN DEL VIDEO EN EL EMBED
    // ============================================================

    @Test
    public void reconoceListasM3u8YArchivosMp4() {
        assertTrue(PlaybackRules.isVideoRequest("https://cdn.x/hls/master.m3u8?token=1"));
        assertTrue(PlaybackRules.isVideoRequest("https://cdn.x/video.mp4"));
    }

    @Test
    public void ignoraScriptsMiniaturasEIconos() {
        assertFalse(PlaybackRules.isVideoRequest("https://cdn.x/player.mp4.js"));
        assertFalse(PlaybackRules.isVideoRequest("https://cdn.x/thumbnail/video.mp4"));
        assertFalse(PlaybackRules.isVideoRequest("https://cdn.x/favicon.mp4"));
    }

    @Test
    public void ignoraPeticionesSinVideoONulas() {
        assertFalse(PlaybackRules.isVideoRequest("https://cdn.x/style.css"));
        assertFalse(PlaybackRules.isVideoRequest(null));
    }

    // ============================================================
    // ORIENTACIÓN
    // ============================================================

    @Test
    public void enTvNuncaFuerzaOrientacion() {
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED, PlaybackRules.orientationFor("landscape", true));
    }

    @Test
    public void enCelularHorizontalSigueAlSensor() {
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE, PlaybackRules.orientationFor("landscape", false));
    }

    @Test
    public void enCelularCualquierOtroModoLiberaLaOrientacion() {
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED, PlaybackRules.orientationFor("portrait", false));
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED, PlaybackRules.orientationFor(null, false));
    }

    // ============================================================
    // ENLACES EXTERNOS
    // ============================================================

    @Test
    public void soloPermiteHttpYHttps() {
        assertTrue(PlaybackRules.isSafeExternalUrl("https://insanos.net/telon.apk"));
        assertTrue(PlaybackRules.isSafeExternalUrl(" HTTP://192.168.1.20/telon.apk"));
        assertFalse(PlaybackRules.isSafeExternalUrl("intent://scan/#Intent;scheme=zxing;end"));
        assertFalse(PlaybackRules.isSafeExternalUrl("javascript:alert(1)"));
        assertFalse(PlaybackRules.isSafeExternalUrl("file:///sdcard/x"));
        assertFalse(PlaybackRules.isSafeExternalUrl(null));
    }
}

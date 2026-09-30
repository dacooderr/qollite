// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ ca29290, mod/panorama/scripts/bettermap_log.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Console logging for the whole mod. Visible in the game console (-dev /
// con_logfile). Errors and one-line summaries always print; verbose tracing is
// gated behind DEBUG so players' consoles stay quiet - flip it (or call
// setDebug) when diagnosing in-game.
var QolLiteMapLog = (function () {
    var DEBUG = false;
    var PREFIX = "[BetterMap] ";

    function info(msg) { try { $.Msg(PREFIX + msg); } catch (e) {} }
    function error(msg) { try { $.Msg(PREFIX + "[ERROR] " + msg); } catch (e) {} }
    function log(msg) { if (DEBUG) { try { $.Msg(PREFIX + msg); } catch (e) {} } }

    return {
        info: info,
        error: error,
        log: log,
        setDebug: function (on) { DEBUG = !!on; },
        isDebug: function () { return DEBUG; }
    };
})();

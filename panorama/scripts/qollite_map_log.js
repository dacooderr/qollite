// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_log.js
"use strict";

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

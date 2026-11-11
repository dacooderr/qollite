// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_slider.js
"use strict";

var QolLiteMapSlider = (function () {
    var INNER_ID = { slider: "Slider", color: "ColorSlider" };
    var REASSERT_MAX = 3;
    var ECHO_WINDOW_MS = 1000;

    function _log(m) { QolLiteMapLog.log("slider: " + m); }

    function _isNum(v) { return typeof v === "number" && isFinite(v); }

    function bind(ctl, e, hooks) {
        var innerId = Object.prototype.hasOwnProperty.call(INNER_ID, e.type) ? INNER_ID[e.type] : null;
        var inner = innerId ? ctl.FindChildTraverse(innerId) : null;
        if (!inner) { return null; }
        if (!(e.max > e.min)) {
            QolLiteMapLog.error("slider: " + e.key + " has no range (max <= min), not bound");
            return null;
        }
        var range = e.max - e.min;
        var viaComposite = _isNum(ctl.min) && _isNum(ctl.max) && ctl.max > ctl.min;
        var hovered = false;
        var reasserts = 0;
        var echoUntil = 0;

        function typing() { return ctl.BHasDescendantKeyFocus(); }

        function readShown() {
            var span = inner.max - inner.min;
            if (!(span > 0)) { return undefined; }
            var shown = e.min + (inner.value - inner.min) / span * range;
            return isFinite(shown) ? shown : undefined;
        }

        function write(stored, reason) {
            var shown = QolLiteMapSchema.toShown(e, stored);
            var f = (shown - e.min) / range;
            echoUntil = Date.now() + ECHO_WINDOW_MS;
            if (viaComposite) {
                try {
                    ctl.value = ctl.min + f * (ctl.max - ctl.min);
                } catch (err) {
                    viaComposite = false;
                    QolLiteMapLog.error("slider: " + e.key + " composite value write threw - using the inner slider: " +
                        (err && err.message ? err.message : err));
                }
            }
            if (!viaComposite) {
                if (!(inner.max - inner.min > 0)) { return; }
                inner.value = inner.min + f * (inner.max - inner.min);
            }
            _log(e.key + " write shown=" + shown + " via=" + (viaComposite ? "composite" : "inner") + " (" + reason + ")");
        }

        function respond(stored) {
            if (reasserts < REASSERT_MAX) {
                reasserts++;
                write(stored, "reassert");
            } else if (reasserts === REASSERT_MAX) {
                reasserts++;
                QolLiteMapLog.error("slider: " + e.key + " keeps changing without the player - left as is, not sent");
            }
        }

        function shows(stored) {
            var shown = readShown();
            return shown !== undefined && QolLiteMapSchema.fromShown(e, shown) === stored;
        }

        function sync(stored, force, reason) {
            if (!viaComposite && !(inner.max - inner.min > 0)) { return; }
            if (!force && (hovered || typing())) { return; }
            if (shows(stored)) { return; }
            write(stored, reason || (force ? "force" : "sync"));
        }

        ctl.SetPanelEvent("onmouseover", function () { hovered = true; });
        ctl.SetPanelEvent("onmouseout", function () {
            hovered = false;
            var cur = hooks.current();
            if (!typing() && cur !== undefined) { sync(cur, false, "mouseout"); }
        });

        if (QolLiteMapLog.isDebug()) {
            _log(e.key + " bound: inner min=" + inner.min + " max=" + inner.max + " value=" + inner.value +
                " composite min=" + ctl.min + " max=" + ctl.max + " value=" + ctl.value + " (before any write)");
            _log(e.key + " writes via " + (viaComposite ? "composite" : "inner"));
        }

        inner.SetPanelEvent("onvaluechanged", function () {
            var shown = readShown();
            var cur = hooks.current();
            var armed = Date.now() < echoUntil;
            var isTyping = typing();
            var player = isTyping || (hovered && !armed);
            var ignored = !player && hovered;
            if (QolLiteMapLog.isDebug()) {
                _log(e.key + " changed inner=" + inner.value + " shown=" + (shown === undefined ? "n/a" : shown.toFixed(2)) +
                    " by=" + (player ? "player" : ignored ? "ignored" : "engine") + " hover=" + hovered +
                    " focus=" + isTyping + " armed=" + armed + " hud=" + cur);
            }
            if (shown === undefined || ignored) { return; }
            var stored = QolLiteMapSchema.fromShown(e, shown);
            if (player) {
                if (cur === undefined) { return; }
                if (stored !== cur) {
                    hooks.commit(stored);
                    reasserts = 0;
                }
                return;
            }
            if (cur === undefined) { return; }
            if (stored === cur) { return; }
            respond(cur);
        });

        return {
            sync: function (stored, force) { sync(stored, force); },
            shows: shows,
            describe: function () {
                return "inner min=" + inner.min + " max=" + inner.max + " value=" + inner.value +
                    " composite value=" + ctl.value + " via=" + (viaComposite ? "composite" : "inner");
            }
        };
    }

    return { bind: bind };
})();

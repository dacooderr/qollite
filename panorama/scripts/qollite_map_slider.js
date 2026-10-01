// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 8d87d86, mod/panorama/scripts/bettermap_slider.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Binds one of Valve's CitadelSettingsSlider / CitadelSettingsColorSlider composites without a convar (spec
// docs/specs/2026-10-01-native-settings.md §6.1). Runs in the settings popup.
//
// The composite is C++ (panorama/layout/popups/settings_slider.xml, build 6722):
// it owns its inner Slider#Slider and formats TextEntry#Value from the markup's
// min/max/snap/postfix. In-game run 1 saw every slider jump to 0.5 clamped into the
// range the old binding had written, and saved. Run 2 explained it: a convar-less
// composite holds its own value and pushes it back whenever its inner slider is
// written behind its back. So:
//   - the markup's range configures the composite; inner.min/max are never written;
//   - values are read through the inner slider's live range (run 2: 0..1 for every
//     slider), which holds whichever units it runs in;
//   - writes go through the composite's own `value`, converted through its own
//     min/max, whenever those are a usable range (run 2's member dump has them; Dota
//     reads the same members on its DOTASettingsSlider, popup_settings_reborn.js:22-25),
//     so there is nothing behind its back to push back. Their values are unmeasured,
//     and no Valve script writes `value`: the path is chosen at bind from what is
//     read, logged, and dropped for the inner slider if the write ever throws;
//   - a change counts only while the player is on the control: key focus in its text
//     entry, or the pointer over it outside the echo window. The C++ class "Dragging"
//     is not used: run 2 never saw it on our composite (drag=false in ~3000 events);
//   - a player's change is committed and never written back. v2 re-wrote it snapped;
//     each re-write re-armed the echo window, the rest of the drag was taken for the
//     engine's and put back (run 2: "keeps changing" x134). The markup's snap= snaps
//     the composite's own display;
//   - a hovered change inside the echo window is ignored, not fought: fighting it
//     re-armed the window and turned a drag started right after the open into a false
//     "keeps changing". Mouse-out, or the next state, repairs the display;
//   - any other change is put back to the HUD's value, a bounded number of times.
var QolLiteMapSlider = (function () {
    // The inner slider per schema type: settings_slider.xml CitadelSettingsSlider > Slider#Slider,
    // settings_color_slider.xml CitadelSettingsColorSlider > Slider#ColorSlider (0..1; the colour
    // composite has no value / min / max, research P3, so it always writes the inner slider).
    var INNER_ID = { slider: "Slider", color: "ColorSlider" };
    var REASSERT_MAX = 3;               // per control per window open: a fighting composite is logged, never looped
    // After we write, the composite may push its own position back asynchronously; run 1
    // saw that within the same second. While this window is open a hover alone does not
    // make a change the player's. It is armed only by our writes (sync, reset, engine
    // re-asserts, mouse-out), never by a drag, and only expires by time: our own matching
    // echo does not close it, because the push-back can follow the echo.
    // Accepted: for 1 s after our own write a hover-only click or drag on the track is
    // ignored, not sent; the drag is taken up once the window expires. Typing is unaffected.
    var ECHO_WINDOW_MS = 1000;

    function _log(m) { QolLiteMapLog.log("slider: " + m); }

    function _isNum(v) { return typeof v === "number" && isFinite(v); }

    // ctl: the composite; e: its schema entry (e.min/e.max in shown units).
    // hooks.current() -> the HUD's stored value (undefined before the first state); it must
    //   return the committed value as soon as commit() returns.
    // hooks.commit(stored) -> a player change, already snapped by the schema.
    // Returns null when the composite has no inner slider or the entry has no range.
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

        // reason: sync | force | reassert | mouseout (the DEBUG log only).
        function write(stored, reason) {
            var shown = QolLiteMapSchema.toShown(e, stored);
            var f = (shown - e.min) / range;
            // Armed first: the engine may fire onvaluechanged synchronously inside the setter.
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

        // A write made in answer to an engine change shares one budget per control. The
        // budget (and the once-only error with it) is refilled by each new value the player
        // commits: the cap stops a composite that keeps undoing ONE write, not the player's
        // next edit.
        function respond(stored) {
            if (reasserts < REASSERT_MAX) {
                reasserts++;
                write(stored, "reassert");
            } else if (reasserts === REASSERT_MAX) {
                reasserts++;
                QolLiteMapLog.error("slider: " + e.key + " keeps changing without the player - left as is, not sent");
            }
        }

        // shows(stored): the control's value snaps to stored.
        function shows(stored) {
            var shown = readShown();
            return shown !== undefined && QolLiteMapSchema.fromShown(e, shown) === stored;
        }

        // Show the HUD's value, unless the player is on the control right now: a late
        // state must not pull the thumb from under the pointer or the caret. force (a
        // reset the player asked for) writes regardless - a TextEntry that keeps key
        // focus after Enter, or a pointer resting on the slider, would otherwise keep
        // showing the old number.
        function sync(stored, force, reason) {
            if (!viaComposite && !(inner.max - inner.min > 0)) { return; }
            if (!force && (hovered || typing())) { return; }
            if (shows(stored)) { return; }
            write(stored, reason || (force ? "force" : "sync"));
        }

        // Valve's markup sets no mouse events on CitadelSettingsSlider, so these replace
        // nothing; the row's tooltip events live on the row, not on the composite.
        ctl.SetPanelEvent("onmouseover", function () { hovered = true; });
        ctl.SetPanelEvent("onmouseout", function () {
            hovered = false;
            // A state that arrived while the pointer rested here was skipped, and so was any
            // change ignored inside the echo window: the control may still show the
            // composite's own value. Show the HUD's now.
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
            var ignored = !player && hovered;    // hovered inside the echo window
            // The one line the in-game checklist reads (spec D16): who the module took
            // this change for, and why. Printed before any early return.
            if (QolLiteMapLog.isDebug()) {
                _log(e.key + " changed inner=" + inner.value + " shown=" + (shown === undefined ? "n/a" : shown.toFixed(2)) +
                    " by=" + (player ? "player" : ignored ? "ignored" : "engine") + " hover=" + hovered +
                    " focus=" + isTyping + " armed=" + armed + " hud=" + cur);
            }
            if (shown === undefined || ignored) { return; }
            var stored = QolLiteMapSchema.fromShown(e, shown);
            if (player) {
                // Before the first state there is no HUD value to compare with; a hover
                // alone must not turn the composite's own change into a commit.
                if (cur === undefined) { return; }
                if (stored !== cur) {
                    hooks.commit(stored);
                    reasserts = 0;
                }
                return;
            }
            if (cur === undefined) { return; }   // before the first state: nothing to put back
            // Our own write echoing back: the snapped compare absorbs float32 and any
            // quantisation of the real inner value.
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

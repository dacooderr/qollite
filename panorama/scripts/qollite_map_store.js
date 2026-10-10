// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 5ac7816, mod/panorama/scripts/bettermap_store.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Standalone persistence (spec docs/specs/2026-10-01-native-settings.md §5).
// Settings live in the localStorage of the game's embedded Chromium, behind our
// page https://gfkm.github.io/bettermap-storage/ (repo gfkm/bettermap-storage).
// They are reached through a hidden CitadelHTMLPanel: requests go out as the URL
// fragment, and answers come back as the page title (the HTMLTitle event).
// HUD-only: the HUD exists whenever Settings can open and outlives the settings
// window, so it is the only writer. When UMM is present it only reads once, for
// UMM's first register (spec §8.1), and never writes - UMM owns saving.
//
// Measured in-game (settings probe runs 3-4, docs/knowledge/panorama_notes.md "Browser storage channel"):
// every request reloads the page (a fresh "ready" each time), every answer
// arrives twice, and a 0x0 / opacity 0 panel still loads and answers. Deadlock
// needs a network connection to play at all, so "offline" means "GitHub Pages down".
var QolLiteMapStore = (function () {
    var PAGE_URL = "https://gfkm.github.io/bettermap-storage/";
    var PANEL_ID = "bm_store_bridge";
    var CACHE_ATTR = "bm_settings_cache";  // on the top root: survives a HUD re-init within one process
    var UNSAVED_ATTR = "bm_settings_unsaved";  // "1" while a write is not yet confirmed; lets a HUD re-init resend it
    var UMM_ROOT_ID = "UmmRoot";           // declared by UMM's base_hud.xml / base_dashboard.xml
    var REQUEST_TIMEOUT_SEC = 10;          // one request = one page load, measured ~0.5-1 s
    var RETRY_SEC = [5, 15, 45];           // spec §5.4; the last step repeats
    // D17 (owner, 2026-10-01: save "when we close the settings or similar, not
    // constantly"): a change is written when the window closes (flush) or after this
    // long without another change, so quitting with the window open loses at most this.
    var SAVE_IDLE_SEC = 3;

    var _bridge = null;
    var _ready = false;
    var _loaded = false;      // the initial get finished (or the session cache stood in for it)
    var _disabled = false;
    var _pending = null;      // { id, op, timer, record }
    var _queued = null;       // encoded record waiting to be written; the latest wins
    var _changed = false;     // a change not yet queued: it waits for the idle timer or a flush
    var _idleTimer = null;
    var _extra = {};          // unknown stored keys, written back untouched
    var _dirty = {};          // keys changed by the player before the initial get answered
    var _readOnly = false;    // stored record is from a newer version: never overwrite it this session
    var _readOnlyLogged = false;
    var _seq = 0;
    var _failures = 0;
    var _onLoaded = null;
    var _seeding = false;     // UMM is installed: one read-only get for its first register (spec §8.1)
    var _onSeed = null;

    function _own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function _log(m) { QolLiteMapLog.log("store: " + m); }
    function _root() { var r = $.GetContextPanel(); while (r && r.GetParent()) { r = r.GetParent(); } return r; }
    function _retryDelay() { return RETRY_SEC[Math.min(Math.max(_failures - 1, 0), RETRY_SEC.length - 1)]; }
    function _hasDirty() { for (var k in _dirty) { if (_own(_dirty, k)) { return true; } } return false; }
    function _encodeNow() { return QolLiteMapStoreCodec.encode(QolLiteMapState.values(), _extra); }
    function _writeCache() { _root().SetAttributeString(CACHE_ATTR, _encodeNow()); }
    function _markUnsaved() { _writeCache(); _root().SetAttributeString(UNSAVED_ATTR, "1"); }

    // Spec 5.4: the store never throws into other modules (or into the engine).
    function _guard(name, fn) {
        return function () {
            try { return fn.apply(null, arguments); }
            catch (e) { QolLiteMapLog.error("store: " + name + " threw: " + (e && e.message ? e.message : e)); }
        };
    }

    // Apply loaded values, except keys the player already changed this session.
    function _apply(values, source) {
        var patch = {};
        for (var k in values) { if (_own(values, k) && !_own(_dirty, k)) { patch[k] = values[k]; } }
        QolLiteMapState.patch(patch);
        // Own try: a feature that throws while re-applying must not skip the cache write / pump.
        if (_onLoaded) { _guard("onLoaded", _onLoaded)(source); }
    }

    // Hands the stored values (or null) to the UMM adapter once, then the store is off.
    function _finishSeed(values) {
        if (!_seeding) { return; }
        _seeding = false;
        var cb = _onSeed;
        _onSeed = null;
        disable("UMM is installed", true);
        if (cb) { _guard("onSeed", cb)(values); }
    }

    function _send(op, record) {
        var id = "r" + (++_seq);
        var timer = $.Schedule(REQUEST_TIMEOUT_SEC, _guard("timeout", function () { _onTimeout(id); }));
        _pending = { id: id, op: op, timer: timer, record: record };
        _bridge.SetURL(PAGE_URL + "#" + QolLiteMapStoreCodec.request(id, op, record));
    }

    function _retryLater(op, record) {
        if (_seeding) { _log(op + " failed - UMM gets no seed"); _finishSeed(null); return; }
        _failures++;
        if (op === "set" && _queued === null) { _queued = record; }
        var delay = _retryDelay();
        _log(op + " failed; retry in " + delay + "s");
        $.Schedule(delay, _guard("retry", function () { if (op === "get") { _sendGet(); } else { _pump(); } }));
    }

    function _onTimeout(id) {
        if (!_pending || _pending.id !== id) { return; }
        var p = _pending;
        _pending = null;
        _retryLater(p.op, p.record);
    }

    function _sendGet() {
        if (_disabled || _pending || _loaded) { return; }
        _send("get");
    }

    function _warnReadOnly() {
        if (_readOnlyLogged) { return; }
        _readOnlyLogged = true;
        QolLiteMapLog.error("store: stored settings are from a newer version - not saving this session");
    }

    function _pump() {
        if (_disabled || _seeding || !_ready || !_loaded || _pending || _queued === null) { return; }
        if (_readOnly) { _warnReadOnly(); _queued = null; return; }
        var record = _queued;
        _queued = null;
        _send("set", record);
    }

    function _onGetAnswer(raw) {
        if (_seeding) {
            var s = QolLiteMapStoreCodec.decode(raw);
            var seed = s.ok && !s.empty ? s.values : null;
            _log(seed ? "read for UMM's first register" : "nothing usable stored for UMM (" + (s.ok ? "empty" : s.reason) + ")");
            _finishSeed(seed);
            return;
        }
        var d = QolLiteMapStoreCodec.decode(raw);
        _loaded = true;
        if (!d.ok) {
            // A newer version's record fails closed: never overwritten. Malformed JSON is
            // overwritten by the player's next change.
            if (d.code === "version") { _readOnly = true; }
            QolLiteMapLog.error("store: stored settings unreadable (" + d.reason + ") - using defaults" + (_readOnly ? ", read-only" : ", not overwriting until a change"));
        } else {
            _extra = d.extra;
            _apply(d.values, "storage");
            _writeCache();
            _log(d.empty ? "nothing stored yet" : "loaded");
        }
        if (_hasDirty() && !_readOnly) { _queued = _encodeNow(); _markUnsaved(); }
        _pump();
    }

    function _onTitle(panel, title) {
        var msg = QolLiteMapStoreCodec.parseTitle(title);
        if (!msg || _disabled) { return; }
        if (msg.id === "ready") {
            // Every request reloads the page, so "ready" repeats; only the first matters.
            if (_ready) { return; }
            if (msg.ok !== true) {
                if (_seeding) { _finishSeed(null); return; }
                disable("the page reports no localStorage");
                return;
            }
            _ready = true;
            _failures = 0;
            _log("bridge ready");
            if (_loaded) { _pump(); } else { _sendGet(); }
            return;
        }
        if (!_pending || msg.id !== _pending.id) { return; }   // duplicate or stale answer
        var p = _pending;
        _pending = null;
        $.CancelScheduled(p.timer);
        if (msg.ok !== true) { _retryLater(p.op, p.record); return; }
        _failures = 0;
        if (p.op === "get") { _onGetAnswer(msg.value); }
        else {
            _writeCache();
            // A newer write may already be queued or waiting; it clears the flag when it lands.
            if (_queued === null && !_changed) { _root().SetAttributeString(UNSAVED_ATTR, ""); }
            _log("saved");
            _pump();
        }
    }

    function _loadPage() {
        if (_disabled || _ready) { return; }
        _bridge.SetURL(PAGE_URL);
        $.Schedule(REQUEST_TIMEOUT_SEC, _guard("page timeout", function () {
            if (_ready || _disabled) { return; }
            if (_seeding) { _log("page not ready - UMM gets no seed"); _finishSeed(null); return; }
            _failures++;
            _log("page not ready; retry in " + _retryDelay() + "s");
            $.Schedule(_retryDelay(), _guard("loadPage", _loadPage));
        }));
    }

    function _openBridge() {
        var ctx = $.GetContextPanel();
        var old = ctx.FindChildTraverse(PANEL_ID);
        if (old) { old.DeleteAsync(0); }
        _bridge = $.CreatePanel("CitadelHTMLPanel", ctx, PANEL_ID);
        if (!_bridge) { QolLiteMapLog.error("store: CreatePanel(CitadelHTMLPanel) returned null - no saving this session"); return false; }
        _bridge.hittest = false;
        _bridge.style.width = "0px";
        _bridge.style.height = "0px";
        _bridge.style.opacity = "0";
        $.RegisterEventHandler("HTMLTitle", _bridge, _guard("title", _onTitle));
        _guard("loadPage", _loadPage)();
        return true;
    }

    // onLoaded(source) runs after values were applied to QolLiteMapState;
    // source is "cache" or "storage". The caller re-applies the features.
    // onSeed(values|null) runs once when UMM is installed (spec §8.1).
    function _init(onLoaded, onSeed) {
        // Also covers init after disable(): under UMM the cache must not be applied.
        if (_disabled || (typeof QolLiteMapUmmAdapter !== "undefined" && QolLiteMapUmmAdapter.isPresent())) { return; }
        _onLoaded = onLoaded;
        if (_root().FindChildTraverse(UMM_ROOT_ID)) {
            // One read-only get, so UMM's first register can carry the standalone
            // values (one-time migration). Nothing is written while UMM is installed.
            _seeding = true;
            _onSeed = onSeed || null;
            _log("UMM is installed - one read-only get to seed it");
            if (!_openBridge()) { _finishSeed(null); }
            return;
        }
        var raw = _root().GetAttributeString(CACHE_ATTR, "");
        var cached = raw ? QolLiteMapStoreCodec.decode(raw) : null;
        if (cached && cached.ok && !cached.empty) {
            _extra = cached.extra;
            _loaded = true;
            // The last write never confirmed (HUD re-init mid-flight): resend it after ready.
            if (_root().GetAttributeString(UNSAVED_ATTR, "") === "1") { _queued = raw; }
            _apply(cached.values, "cache");
            _log("restored from the session cache");
        }
        if (!_openBridge()) { _disabled = true; }
    }

    function init(onLoaded, onSeed) {
        try { _init(onLoaded, onSeed); }
        catch (e) {
            QolLiteMapLog.error("store: init threw: " + (e && e.message ? e.message : e));
            // A throw mid-seed must still answer the adapter (its timer is only the backstop).
            if (_seeding) { _finishSeed(null); } else { disable("init threw"); }
        }
    }

    function _cancelIdle() {
        if (_idleTimer !== null) { $.CancelScheduled(_idleTimer); _idleTimer = null; }
    }

    // The waiting change becomes the queued record (the latest state) and goes out.
    function _commit() {
        _cancelIdle();
        if (!_changed) { return; }
        _changed = false;
        _queued = _encodeNow();
        _pump();
    }

    // changedKeys: the schema keys the player just changed (array).
    // Before the load, the changed keys are only marked: the get answer writes them.
    function _save(changedKeys) {
        if (_disabled || _seeding) { return; }
        if (_readOnly) { _warnReadOnly(); return; }
        if (!_loaded) {
            for (var i = 0; i < (changedKeys || []).length; i++) { _dirty[changedKeys[i]] = true; }
            // A keyless pre-load save must never queue the not-yet-loaded state.
            _queued = _hasDirty() ? _encodeNow() : null;
            return;
        }
        // The cache and the unsaved flag at once: a HUD re-init before the timer
        // fires resends the change from them (_init).
        _markUnsaved();
        _changed = true;
        _cancelIdle();
        _idleTimer = $.Schedule(SAVE_IDLE_SEC, _guard("idle save", function () { _idleTimer = null; _commit(); }));
    }
    var save = _guard("save", _save);

    // The settings window closed, or the player reset: write a waiting change now.
    // Disabled, seeding and read-only need no check here: _save never marks a
    // change in those states, and _pump refuses to write in them.
    var flush = _guard("flush", _commit);

    // clearCache: only when UMM is the reason - it owns the values then. Any other
    // reason (no localStorage, init threw) keeps the session cache and the unsaved flag.
    function _disable(reason, clearCache) {
        if (_disabled) { return; }
        _disabled = true;
        _queued = null;
        _changed = false;
        _cancelIdle();
        // An outside disable mid-seed (the adapter already registered, or will on its
        // timer): the read is abandoned and onSeed is never called.
        if (_seeding) { _seeding = false; _onSeed = null; }
        if (clearCache) {
            // A later HUD init without UMM must not restore values UMM owned.
            _root().SetAttributeString(CACHE_ATTR, "");
            _root().SetAttributeString(UNSAVED_ATTR, "");
        }
        if (_pending) { $.CancelScheduled(_pending.timer); _pending = null; }
        if (_bridge) { _bridge.DeleteAsync(0); _bridge = null; }
        QolLiteMapLog.info("store: off - " + reason);
    }

    var disable = _guard("disable", _disable);

    function isActive() { return !_disabled; }

    return { init: init, save: save, flush: flush, disable: disable, isActive: isActive };
})();

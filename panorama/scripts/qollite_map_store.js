// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_store.js
"use strict";

var QolLiteMapStore = (function () {
    var PAGE_URL = "https://gfkm.github.io/bettermap-storage/";
    var PANEL_ID = "bm_store_bridge";
    var CACHE_ATTR = "bm_settings_cache";
    var UNSAVED_ATTR = "bm_settings_unsaved";
    var UMM_ROOT_ID = "UmmRoot";
    var REQUEST_TIMEOUT_SEC = 10;
    var RETRY_SEC = [5, 15, 45];
    var SAVE_IDLE_SEC = 3;

    var _bridge = null;
    var _ready = false;
    var _loaded = false;
    var _disabled = false;
    var _pending = null;
    var _queued = null;
    var _changed = false;
    var _idleTimer = null;
    var _extra = {};
    var _dirty = {};
    var _readOnly = false;
    var _readOnlyLogged = false;
    var _seq = 0;
    var _failures = 0;
    var _onLoaded = null;
    var _seeding = false;
    var _onSeed = null;
    var _mirror = false;

    function _own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function _log(m) { QolLiteMapLog.log("store: " + m); }
    function _root() { return QolLiteMapHud.root(); }
    function _retryDelay() { return RETRY_SEC[Math.min(Math.max(_failures - 1, 0), RETRY_SEC.length - 1)]; }
    function _hasDirty() { for (var k in _dirty) { if (_own(_dirty, k)) { return true; } } return false; }
    function _encodeNow() { return QolLiteMapStoreCodec.encode(QolLiteMapState.values(), _extra); }
    function _writeCache() { _root().SetAttributeString(CACHE_ATTR, _encodeNow()); }
    function _markUnsaved() { _writeCache(); _root().SetAttributeString(UNSAVED_ATTR, "1"); }

    function _guard(name, fn) {
        return function () {
            try { return fn.apply(null, arguments); }
            catch (e) { QolLiteMapLog.error("store: " + name + " threw: " + (e && e.message ? e.message : e)); }
        };
    }

    function _apply(values, source) {
        var patch = {};
        for (var k in values) { if (_own(values, k) && !_own(_dirty, k)) { patch[k] = values[k]; } }
        QolLiteMapState.patch(patch);
        if (_onLoaded) { _guard("onLoaded", _onLoaded)(source); }
    }

    function _finishSeed(values, ok, extra) {
        if (!_seeding) { return; }
        _seeding = false;
        var cb = _onSeed;
        _onSeed = null;
        _root().SetAttributeString(CACHE_ATTR, "");
        _root().SetAttributeString(UNSAVED_ATTR, "");
        if (ok) {
            _mirror = true;
            _loaded = true;
            _extra = extra || {};
            _log("mirroring UMM's values");
        } else {
            disable("UMM is installed and our stored settings could not be read", true);
        }
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
            _finishSeed(seed, s.ok, s.ok ? s.extra : null);
            return;
        }
        var d = QolLiteMapStoreCodec.decode(raw);
        _loaded = true;
        if (!d.ok) {
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
        if (!_pending || msg.id !== _pending.id) { return; }
        var p = _pending;
        _pending = null;
        $.CancelScheduled(p.timer);
        if (msg.ok !== true) { _retryLater(p.op, p.record); return; }
        _failures = 0;
        if (p.op === "get") { _onGetAnswer(msg.value); }
        else {
            _writeCache();
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
        var root = _root();
        var old = root.FindChildTraverse(PANEL_ID);
        if (old) { old.DeleteAsync(0); }
        _bridge = $.CreatePanel("CitadelHTMLPanel", root, PANEL_ID);
        if (!_bridge) { QolLiteMapLog.error("store: CreatePanel(CitadelHTMLPanel) returned null - no saving this session"); return false; }
        _bridge.hittest = false;
        _bridge.style.width = "0px";
        _bridge.style.height = "0px";
        _bridge.style.opacity = "0";
        $.RegisterEventHandler("HTMLTitle", _bridge, _guard("title", _onTitle));
        _guard("loadPage", _loadPage)();
        return true;
    }

    function _init(onLoaded, onSeed) {
        if (_disabled || (typeof QolLiteMapUmmAdapter !== "undefined" && QolLiteMapUmmAdapter.isPresent())) { return; }
        _onLoaded = onLoaded;
        if (_root().FindChildTraverse(UMM_ROOT_ID)) {
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
            if (_seeding) { _finishSeed(null); } else { disable("init threw"); }
        }
    }

    function _cancelIdle() {
        if (_idleTimer !== null) { $.CancelScheduled(_idleTimer); _idleTimer = null; }
    }

    function _commit() {
        _cancelIdle();
        if (!_changed) { return; }
        _changed = false;
        _queued = _encodeNow();
        _pump();
    }

    function _save(changedKeys) {
        if (_disabled || _seeding) { return; }
        if (_readOnly) { _warnReadOnly(); return; }
        if (!_loaded) {
            for (var i = 0; i < (changedKeys || []).length; i++) { _dirty[changedKeys[i]] = true; }
            _queued = _hasDirty() ? _encodeNow() : null;
            return;
        }
        _markUnsaved();
        _changed = true;
        _cancelIdle();
        _idleTimer = $.Schedule(SAVE_IDLE_SEC, _guard("idle save", function () { _idleTimer = null; _commit(); }));
    }
    var save = _guard("save", _save);

    var flush = _guard("flush", _commit);

    function _disable(reason, clearCache) {
        if (_disabled) { return; }
        _disabled = true;
        _queued = null;
        _changed = false;
        _cancelIdle();
        if (_seeding) { _seeding = false; _onSeed = null; }
        if (clearCache) {
            _root().SetAttributeString(CACHE_ATTR, "");
            _root().SetAttributeString(UNSAVED_ATTR, "");
        }
        if (_pending) { $.CancelScheduled(_pending.timer); _pending = null; }
        if (_bridge) { _bridge.DeleteAsync(0); _bridge = null; }
        QolLiteMapLog.info("store: off - " + reason);
    }

    var disable = _guard("disable", _disable);

    function _ummPresent() {
        if (_seeding || _mirror || _disabled) { return; }
        _disable("UMM core answered", true);
    }
    var ummPresent = _guard("ummPresent", _ummPresent);

    function isActive() { return !_disabled; }

    return { init: init, save: save, flush: flush, disable: disable, ummPresent: ummPresent, isActive: isActive };
})();

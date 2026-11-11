// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_urn.js
"use strict";

var QolLiteMapUrn = (function () {
    var MAP_NAME = "dl_midtown";
    var MODE = "side";
    var FIRST_SPAWN_SEC = 600;
    var FIRST_SPAWN_SIDE = "left";
    var SPAWN_PERIOD = 300;
    var CLOCK_BACK_SLACK = 3;
    var DESCENT_SEC = 12;
    var POLL_SEC = 0.15;
    var ADV_THRESHOLD = 0.10;

    var _marker = null;
    var _markerVisible = false;
    var _anchorTime = null;
    var _anchorSide = null;
    var _anchorSlot = null;

    var _seenUrn = false;
    var _wasLive = false;
    var _lastLiveSide = null;
    var _lastIdolSig = "";
    var _readyForNewSpawn = true;

    var _descentMarker = null;
    var _descentVisible = false;
    var _descentStartT = null;
    var _descentUV = null;

    function _ctx() { return QolLiteMapHud.root(); }
    function _panel(id) { return QolLiteMapHud.find(id); }
    function _log(msg) { if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("urn: " + msg); } }
    function _info(msg) { if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.info("urn: " + msg); } }
    function _other(side) { return side === "left" ? "right" : "left"; }

    function _data() {
        return (typeof QolLiteMapUrnData !== "undefined" && QolLiteMapUrnData[MAP_NAME]) ? QolLiteMapUrnData[MAP_NAME] : null;
    }

    function _nextSlot(t) {
        if (t < FIRST_SPAWN_SEC) { return 0; }
        return Math.floor((t - FIRST_SPAWN_SEC) / SPAWN_PERIOD) + 1;
    }
    function _slotOfTime(t) { return Math.round((t - FIRST_SPAWN_SEC) / SPAWN_PERIOD); }
    function _spawnTime(slot) { return FIRST_SPAWN_SEC + slot * SPAWN_PERIOD; }
    function _sideOfSlot(slot) {
        var side = _anchorSide, at = _anchorSlot;
        if (side === null || at === null) { side = FIRST_SPAWN_SIDE; at = 0; }
        return ((slot - at) % 2 === 0) ? side : _other(side);
    }

    function _clockSeconds() {
        var label = _panel("GameTime");
        if (!label || typeof label.text !== "string") { return null; }
        var clean = label.text.replace(/<[^>]+>/g, "");
        var h = clean.match(/(\d+):(\d{2}):(\d{2})/);
        if (h) { return parseInt(h[1], 10) * 3600 + parseInt(h[2], 10) * 60 + parseInt(h[3], 10); }
        var mm = clean.match(/(\d+):(\d{2})/);
        return mm ? (parseInt(mm[1], 10) * 60 + parseInt(mm[2], 10)) : null;
    }

    function _networth(panelId) {
        var panel = _panel(panelId);
        if (!panel || !panel.FindChildrenWithClassTraverse) { return null; }
        var labels = panel.FindChildrenWithClassTraverse("ScoreLabel");
        if (!labels || !labels.length) { return null; }
        var txt = String(labels[0].text || "").replace(/<[^>]+>/g, "").toLowerCase();
        var mult = 1, last = txt.charAt(txt.length - 1);
        if (last === "k") { mult = 1000; txt = txt.slice(0, -1); }
        else if (last === "m") { mult = 1000000; txt = txt.slice(0, -1); }
        txt = txt.replace(/[^0-9.\-]/g, "");
        var v = parseFloat(txt);
        return isNaN(v) ? null : v * mult;
    }

    function _inverted() { return QolLiteMapMinimap.hasClassAbove("invert_map"); }
    function _detailView() {
        return QolLiteMapMinimap.hasClassAbove("gDetailView") || QolLiteMapMinimap.hasClassAbove("gScoreboardOpen");
    }

    function _isActive(p) {
        if (!p) { return false; }
        if (p.BHasClass && (p.BHasClass("active") || p.BHasClass("active_map_button"))) { return true; }
        var vis = p.style ? p.style.visibility : "";
        var op = p.style ? p.style.opacity : "";
        return !!(vis && vis !== "collapse" && op !== "0" && op !== "0.0");
    }

    function _sideOf(panel) {
        if (!panel || !panel.style) { return null; }
        var m = String(panel.style.position || "").match(/^\s*([0-9.+\-]+)%/);
        if (!m) { return null; }
        return parseFloat(m[1]) < 50 ? "left" : "right";
    }

    function _firstActiveOfClass(cls) {
        var ctx = _ctx();
        if (!ctx || !ctx.FindChildrenWithClassTraverse) { return null; }
        var found = ctx.FindChildrenWithClassTraverse(cls);
        if (found) {
            for (var i = 0; i < found.length; i++) {
                if (_isActive(found[i])) { return found[i]; }
            }
        }
        return null;
    }

    function _activeSpawnMarker() { return _firstActiveOfClass("idol_spawn"); }

    function _physicalUrn() {
        return _activeSpawnMarker() || _firstActiveOfClass("idol_dropping");
    }

    var _LIVE_CLASSES = ["idol_spawn", "idol_dropping", "idol_return", "idol_return_friendly", "idol_return_enemy"];
    function _liveUrn() {
        for (var c = 0; c < _LIVE_CLASSES.length; c++) {
            var p = _firstActiveOfClass(_LIVE_CLASSES[c]);
            if (p) { return p; }
        }
        return null;
    }

    function _idolSig() {
        var ctx = _ctx();
        if (!ctx || !ctx.FindChildrenWithClassTraverse) { return ""; }
        var parts = [];
        for (var c = 0; c < _LIVE_CLASSES.length; c++) {
            var found = ctx.FindChildrenWithClassTraverse(_LIVE_CLASSES[c]);
            if (found) {
                for (var i = 0; i < found.length; i++) {
                    if (_isActive(found[i])) { parts.push(_LIVE_CLASSES[c] + ":" + (_sideOf(found[i]) || "?")); }
                }
            }
        }
        return parts.join(" ");
    }

    function _fmt(sec) {
        if (sec === null) { return "--:--"; }
        if (sec < 0) { sec = 0; }
        var m = Math.floor(sec / 60), s = sec % 60;
        return m + ":" + (s < 10 ? "0" + s : s);
    }

    function _tierBand() {
        var f = _networth("TeamScoreFriendly"), e = _networth("TeamScoreEnemy");
        if (f === null || e === null || e === 0) { return "mid"; }
        var d = (f - e) / e;
        if (d > ADV_THRESHOLD) { return _inverted() ? "bottom" : "top"; }
        if (d < -ADV_THRESHOLD) { return _inverted() ? "top" : "bottom"; }
        return "mid";
    }

    function _predict(t) {
        if (t === null) { return null; }
        var data = _data();
        if (!data || !data.spawns) { return null; }
        var slot = _nextSlot(t);
        var side = _sideOfSlot(slot);
        if (!side) { return null; }
        var secs = _spawnTime(slot) - t;
        var band = (MODE === "tier") ? _tierBand() : "mid";
        var byBand = data.spawns[side];
        var pt = byBand && (byBand[band] || byBand.mid);
        if (!pt) { return null; }
        return { u: pt.u, v: pt.v, secs: secs, window: SPAWN_PERIOD, side: side };
    }

    function _applySize(m) {
        if (!m || !m.root) { return; }
        var want = QolLiteMapIcons.className("urnIconScalePct");
        if (want === m.sizeCls) { return; }
        if (m.sizeCls) { m.root.RemoveClass(m.sizeCls); }
        if (want) { m.root.AddClass(want); }
        m.sizeCls = want;
    }

    function _ensureMarker() {
        if (_marker && _marker.root && _marker.root.IsValid && _marker.root.IsValid()) { return _marker; }
        var host = _panel("minimap_urn_host");
        if (!host) { return null; }
        var root = $.CreatePanel("Panel", host, "bm_urn_marker");
        root.AddClass("bm_urn");
        root.style.horizontalAlign = "left";
        root.style.verticalAlign = "top";
        var backer = $.CreatePanel("Panel", root, "");
        backer.AddClass("bm_urn_backer");
        var ring = $.CreatePanel("Panel", root, "");
        ring.AddClass("bm_urn_ring");
        var icon = $.CreatePanel("Panel", root, "");
        icon.AddClass("bm_urn_icon");
        var timer = $.CreatePanel("Label", root, "");
        timer.AddClass("bm_urn_timer");
        _marker = { root: root, ring: ring, timer: timer, sizeCls: null };
        return _marker;
    }

    function _showMarker(pred, detail) {
        var m = _ensureMarker();
        if (!m) { if (!_markerVisible) { _info("show FAILED: minimap_urn_host / marker missing"); } return; }
        var at = QolLiteMapMinimap.toScreen(pred.u, pred.v);
        m.root.style.x = (at.u * 100).toFixed(3) + "%";
        m.root.style.y = (at.v * 100).toFixed(3) + "%";
        m.root.style.visibility = "visible";
        _applySize(m);
        var win = pred.window || SPAWN_PERIOD;
        var frac = 1 - Math.max(0, Math.min(1, pred.secs / win));
        if (m.ring) {
            try { m.ring.style.clip = "radial(50% 50%, 0deg, " + Math.round(frac * 360) + "deg)"; } catch (e) {}
        }
        if (m.timer) {
            m.timer.text = _fmt(pred.secs);
            m.timer.style.visibility = detail ? "visible" : "collapse";
        }
        if (!_markerVisible) {
            _markerVisible = true;
            _log("marker shown: u=" + pred.u.toFixed(3) + " v=" + pred.v.toFixed(3) +
                " next=" + pred.side + " in=" + Math.round(pred.secs) + "s");
        }
    }

    function _hideMarker() {
        if (_marker && _marker.root) { _marker.root.style.visibility = "collapse"; }
        _markerVisible = false;
    }

    function _lerp(a, b, k) { return Math.round(a + (b - a) * k); }
    function _h2(n) { n = n < 0 ? 0 : (n > 255 ? 255 : n); var s = n.toString(16); return s.length < 2 ? "0" + s : s; }
    function _descentColor(f) {
        if (f < 0) { f = 0; } if (f > 1) { f = 1; }
        var r, g, b;
        if (f < 0.5) { var k = f / 0.5; r = 255; g = _lerp(77, 210, k); b = 77; }
        else { var k2 = (f - 0.5) / 0.5; r = _lerp(255, 77, k2); g = _lerp(210, 224, k2); b = _lerp(77, 122, k2); }
        return "#" + _h2(r) + _h2(g) + _h2(b);
    }
    function _ensureDescentMarker() {
        if (_descentMarker && _descentMarker.root && _descentMarker.root.IsValid && _descentMarker.root.IsValid()) { return _descentMarker; }
        var host = _panel("minimap_urn_host");
        if (!host) { return null; }
        var root = $.CreatePanel("Panel", host, "bm_urn_descent_marker");
        root.AddClass("bm_urn");
        root.style.horizontalAlign = "left";
        root.style.verticalAlign = "top";
        var backer = $.CreatePanel("Panel", root, ""); backer.AddClass("bm_urn_backer");
        var ring = $.CreatePanel("Panel", root, ""); ring.AddClass("bm_urn_ring"); ring.AddClass("bm_urn_descent_ring");
        var icon = $.CreatePanel("Panel", root, ""); icon.AddClass("bm_urn_icon");
        var timer = $.CreatePanel("Label", root, ""); timer.AddClass("bm_urn_timer");
        _descentMarker = { root: root, ring: ring, timer: timer, sizeCls: null };
        return _descentMarker;
    }
    function _showDescent(elapsed) {
        var m = _ensureDescentMarker();
        if (!m || !_descentUV) { return; }
        var at = QolLiteMapMinimap.toScreen(_descentUV.u, _descentUV.v);
        m.root.style.x = (at.u * 100).toFixed(3) + "%";
        m.root.style.y = (at.v * 100).toFixed(3) + "%";
        m.root.style.visibility = "visible";
        _applySize(m);
        var frac = Math.max(0, Math.min(1, elapsed / DESCENT_SEC));
        if (m.ring) {
            try { m.ring.style.washColor = _descentColor(frac); } catch (e) {}
            try { m.ring.style.clip = "radial(50% 50%, 0deg, " + Math.round(frac * 360) + "deg)"; } catch (e) {}
        }
        if (m.timer) {
            m.timer.text = String(Math.max(0, Math.ceil(DESCENT_SEC - elapsed)));
            m.timer.style.visibility = "visible";
        }
        _descentVisible = true;
    }
    function _hideDescent() {
        if (_descentMarker && _descentMarker.root) { _descentMarker.root.style.visibility = "collapse"; }
        _descentVisible = false;
    }

    function _resetTracking() {
        _anchorTime = null; _anchorSide = null; _anchorSlot = null; _seenUrn = false;
        _wasLive = false; _lastLiveSide = null;
        _lastIdolSig = ""; _readyForNewSpawn = true;
        _descentStartT = null; _descentUV = null;
        _hideMarker(); _hideDescent();
    }

    function _poll() {
        var enabled = !!QolLiteMapState.get().urnTrackerEnabled;
        var t = _clockSeconds();
        var spawn = _activeSpawnMarker();
        var live = _liveUrn();

        if (t !== null && _anchorTime !== null && t + CLOCK_BACK_SLACK < _anchorTime) {
            _log("clock went backwards (t=" + t + " < anchor=" + _anchorTime + ") - reset tracking");
            _resetTracking();
        }

        if (typeof QolLiteMapLog !== "undefined" && QolLiteMapLog.isDebug()) {
            var sig = _idolSig();
            if (sig !== _lastIdolSig) {
                _lastIdolSig = sig;
                _log("idols[" + (t === null ? "?" : t) + "s]: " + (sig || "(none)"));
            }
            var phys = _physicalUrn();
            if (phys) { var ps = _sideOf(phys); if (ps) { _lastLiveSide = ps; } }
        }

        if (spawn && _readyForNewSpawn) {
            var side = _sideOf(spawn);
            if (side) {
                var slot = (t !== null) ? _slotOfTime(t) : _anchorSlot;
                var predicted = _sideOfSlot(slot);
                if (predicted && side !== predicted) {
                    _info("MISPREDICT: predicted " + predicted + " but urn spawned " + side +
                        " (slot " + slot + (_seenUrn ? "" : ", first-spawn seed") + ") - re-anchoring side");
                }
                _anchorSide = side;
                _anchorSlot = slot;
                _seenUrn = true;
                _readyForNewSpawn = false;
                if (t !== null) { _anchorTime = t; }
                _descentStartT = t;
                var _db = _data();
                var _dbside = _db && _db.spawns && _db.spawns[side];
                var _dpt = _dbside && _dbside.mid;
                _descentUV = _dpt ? { u: _dpt.u, v: _dpt.v } : null;
                _log("anchor(spawn): side=" + side + " slot=" + slot + " t=" + _anchorTime +
                    (QolLiteMapMinimap.isInverted() ? " (map inverted: drawn mirrored)" : ""));
            }
        }

        if (!live && _wasLive) {
            _readyForNewSpawn = true;
            _log("resolve lastLiveSide=" + _lastLiveSide);
        }
        _wasLive = live;

        if (live || !enabled) {
            _hideMarker();
        } else {
            var pred = _predict(t);
            if (pred) { _showMarker(pred, _detailView()); }
            else { _hideMarker(); }
        }

        if (enabled && live && _descentStartT !== null && t !== null &&
            (t - _descentStartT) >= 0 && (t - _descentStartT) < DESCENT_SEC) {
            _showDescent(t - _descentStartT);
        } else {
            _hideDescent();
        }
        $.Schedule(POLL_SEC, _poll);
    }

    function init() {
        _poll();
    }

    return { init: init };
})();

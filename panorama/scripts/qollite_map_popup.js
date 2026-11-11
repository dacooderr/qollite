// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_popup.js
"use strict";

var QolLiteMapPopup = (function () {
    var CTL_PREFIX = "bm_ctl_";
    var ROW_PREFIX = "bm_row_";
    var SHOW_ROW_PREFIX = "bm_row_show_on_screen_";
    var SHOW_BUTTON_PREFIX = "bm_show_on_screen_";
    var RESET_ROW_PREFIX = "bm_row_reset_";
    var RESET_ROW_BUTTON_PREFIX = "bm_reset_";
    var RESET_BUTTON_ID = "ResetSectionButton";
    var SECTION_TITLE_ID = "SectionTitleContainer";
    var TOOLTIP_STYLE = "SettingsMenuTooltip";
    var SHOW_TOOLTIP = "Fades this window for a few seconds so you can see the minimap against the game.";
    var RESET_TOOLTIP = "Restores every setting in this section to its default.";
    var ROW_RESET_CLASS = "SettingsRowResetButton";
    var ROW_MODIFIED_CLASS = "SettingsRowModified";
    var ROW_RESET_READ_BACK_SEC = [1, 3];
    var ROW_REASSERT_READ_BACK_SEC = [1];
    var TITLE_CONTAINER_CLASS = "TitleContainer";
    var LAYOUT_READ_BACK_SEC = [1];
    var UMM_ROOT_ID = "UmmRoot";
    var ECHO_GRACE_MS = 500;
    var GAME_WORLD_CLASS = "ShowGameWorld";
    var PEEK_HOLD_SEC = 3;
    var HIDDEN_CLASS = "Hidden";
    var LIFT_BEAT_SEC = 0.25;
    var READ_BACK_SEC = [1, 3];

    var _values = null;
    var _syncing = false;
    var _hidden = false;
    var _peekUntil = 0;
    var _sliders = {};
    var _rowResets = {};
    var _lastSent = {};
    var _lastSentAt = {};
    var _readBackDone = false;
    var _liftOn = false;
    var _scrollErrLogged = false;
    var _wasShown = false;
    var _resetPending = false;
    var _win = null;
    var _gen = 0;

    function _resetSession() {
        _values = null; _syncing = false; _hidden = false; _peekUntil = 0; _sliders = {}; _rowResets = {};
        _lastSent = {}; _lastSentAt = {}; _readBackDone = false; _liftOn = false; _scrollErrLogged = false;
        _wasShown = false; _resetPending = false;
    }

    function _live(gen) { return gen === _gen && !!_win && _win.IsValid(); }

    function _ctx() { return _win; }
    var _finder = null;
    function _find(id) { return _finder(id); }
    function _root() { return QolLiteMapHud.root(); }
    function _log(m) { QolLiteMapLog.log("popup: " + m); }
    function _groups() { return QolLiteMapSchema.groups(); }

    function _rowKeys(rowKey) {
        var out = [], list = QolLiteMapSchema.list();
        for (var i = 0; i < list.length; i++) { if ((list[i].row || list[i].key) === rowKey) { out.push(list[i].key); } }
        return out;
    }

    function _rowTooltip(rowKey) {
        var keys = _rowKeys(rowKey), parts = [];
        for (var i = 0; i < keys.length; i++) { parts.push(QolLiteMapSchema.byKey(keys[i]).tooltip); }
        return parts.join(" ");
    }

    function _subs() {
        var out = [], g = _groups();
        for (var i = 0; i < g.length; i++) { var s = _find(g[i].id); if (s) { out.push(s); } }
        return out;
    }

    function _send(msg) { QolLiteMapSettingsBus.request(msg); }

    function _tooltip(panel, text, onOver) {
        panel.SetPanelEvent("onmouseover", function () {
            if (onOver) { onOver(); }
            $.DispatchEvent("UIShowTextTooltipStyled", panel, text, TOOLTIP_STYLE);
        });
        panel.SetPanelEvent("onmouseout", function () { $.DispatchEvent("UIHideTextTooltip", panel); });
    }

    function _set(key, value) {
        _values[key] = value;
        _lastSent[key] = value;
        _lastSentAt[key] = Date.now();
        _log("set " + key + " = " + JSON.stringify(value));
        _send({ t: "set", key: key, value: value });
        _syncRowResets();
    }

    function _reset(group) {
        if (!_values || _hidden) { return; }
        _lastSent = {};
        _lastSentAt = {};
        _resetPending = true;
        _send({ t: "reset", group: group });
        _send({ t: "flush" });
    }

    function _inFlight(k) {
        return _lastSentAt[k] !== undefined && _lastSent[k] !== _values[k] && Date.now() - _lastSentAt[k] < ECHO_GRACE_MS;
    }

    function _shownValue(k) { return _inFlight(k) ? _lastSent[k] : _values[k]; }

    function _isModified(e, v, d) {
        return QolLiteMapSchema.isRanged(e) ? QolLiteMapSchema.toShown(e, v) !== QolLiteMapSchema.toShown(e, d) : v !== d;
    }

    function _syncRowResets() {
        if (!_values) { return; }
        var d = QolLiteMapSchema.defaults();
        for (var key in _rowResets) {
            if (!Object.prototype.hasOwnProperty.call(_rowResets, key)) { continue; }
            var r = _rowResets[key], on = false, known = false;
            for (var i = 0; i < r.keys.length; i++) {
                var k = r.keys[i];
                if (_values[k] === undefined) { continue; }
                known = true;
                if (_isModified(QolLiteMapSchema.byKey(k), _shownValue(k), d[k])) { on = true; }
            }
            if (!known || on === r.on) { continue; }
            r.on = on;
            r.row.SetHasClass(ROW_MODIFIED_CLASS, on);
            r.button.visible = on;
            _rowResetReadBackLater(key, "modified");
        }
    }

    function _reassertRowModified(key) {
        var r = _rowResets[key];
        if (!r || !r.on || r.row.BHasClass(ROW_MODIFIED_CLASS)) { return; }
        r.row.AddClass(ROW_MODIFIED_CLASS);
        _log("row-reset " + key + " re-asserted (C++ removed " + ROW_MODIFIED_CLASS + ")");
        _rowResetReadBackLater(key, "reasserted", ROW_REASSERT_READ_BACK_SEC);
    }

    function _rowResetReadBack(key, tag) {
        var r = _rowResets[key];
        if (!r || !r.button.IsValid() || !r.row.IsValid()) { return; }
        _log("row-reset " + key + " " + tag + " visible=" + r.button.visible +
            " size=" + r.button.actuallayoutwidth + "x" + r.button.actuallayoutheight +
            " modified=" + r.row.BHasClass(ROW_MODIFIED_CLASS));
    }

    function _rowResetReadBackLater(key, why, secs) {
        var at = secs || ROW_RESET_READ_BACK_SEC, gen = _gen;
        for (var i = 0; i < at.length; i++) {
            (function (sec) {
                $.Schedule(sec, function () {
                    if (!_live(gen)) { return; }
                    _rowResetReadBack(key, why + " +" + sec + "s");
                });
            })(at[i]);
        }
    }

    function _showToggle(ctl, v) {
        if (ctl.checked !== !!v) { ctl.SetSelected(!!v); }
    }

    function _showNow(e, v) {
        var ctl = _find(CTL_PREFIX + e.key);
        if (!ctl) { return; }
        _syncing = true;
        try {
            if (e.type === "toggle") { _showToggle(ctl, v); }
            else if (_sliders[e.key]) { _sliders[e.key].sync(v, true); }
        } finally {
            _syncing = false;
        }
    }

    function _resetRow(rowKey) {
        if (!_values || _hidden) { return; }
        var keys = _rowResets[rowKey].keys, d = QolLiteMapSchema.defaults();
        for (var i = 0; i < keys.length; i++) {
            var e = QolLiteMapSchema.byKey(keys[i]);
            if (_isModified(e, _shownValue(keys[i]), d[keys[i]])) { _set(keys[i], d[keys[i]]); }
            _showNow(e, d[keys[i]]);
        }
        _syncRowResets();
        _rowResetReadBackLater(rowKey, "click");
    }

    function _bindRowReset(e, row) {
        var found = row.FindChildrenWithClassTraverse(ROW_RESET_CLASS);
        if (!found.length) { QolLiteMapLog.error("popup: row-reset " + e.key + " - no " + ROW_RESET_CLASS + " in the row"); return; }
        var button = found[0];
        button.visible = false;
        button.SetPanelEvent("onactivate", function () { _resetRow(e.key); });
        _rowResets[e.key] = { row: row, button: button, on: false, keys: _rowKeys(e.key) };
        _rowResetReadBack(e.key, "bind");
        _rowResetReadBackLater(e.key, "bind");
    }

    function _collapseTitle(e, ctl) {
        var t = ctl.FindChildrenWithClassTraverse(TITLE_CONTAINER_CLASS);
        if (t.length) { t[0].visible = false; }
        else { QolLiteMapLog.error("popup: " + e.key + " has no ." + TITLE_CONTAINER_CLASS + " to collapse"); }
    }

    function _layoutReadBackLater(e) {
        var gen = _gen;
        for (var i = 0; i < LAYOUT_READ_BACK_SEC.length; i++) {
            (function (sec) {
                $.Schedule(sec, function () {
                    if (!_live(gen)) { return; }
                    var row = _find(ROW_PREFIX + e.row), tg = _find(CTL_PREFIX + e.row), c = _find(CTL_PREFIX + e.key);
                    if (!row || !tg || !c) { return; }
                    _log("layout " + e.key + " row=" + row.actuallayoutwidth + "x" + row.actuallayoutheight +
                        " toggle=" + tg.actuallayoutwidth + " color=" + c.actuallayoutwidth + "x" + c.actuallayoutheight +
                        " (+" + sec + "s)");
                });
            })(LAYOUT_READ_BACK_SEC[i]);
        }
    }

    function _bind(e) {
        var ctl = _find(CTL_PREFIX + e.key);
        if (!ctl) { QolLiteMapLog.error("popup: no control for " + e.key + " - not built (see the mount log)"); return; }
        if (e.type === "toggle") {
            ctl.SetPanelEvent("onactivate", function () {
                if (!_syncing && _values && !_hidden) { _set(e.key, !_values[e.key]); }
            });
        } else if (QolLiteMapSchema.isRanged(e)) {
            var b = QolLiteMapSlider.bind(ctl, e, {
                current: function () { return _values ? _values[e.key] : undefined; },
                commit: function (v) { if (_values && !_hidden) { _set(e.key, v); } }
            });
            if (!b) { QolLiteMapLog.error("popup: no inner slider for " + e.key); return; }
            _sliders[e.key] = b;
        }
        if (e.row) {
            _collapseTitle(e, ctl);
            _layoutReadBackLater(e);
            return;
        }
        var row = _find(ROW_PREFIX + e.key);
        if (!row) { QolLiteMapLog.error("popup: no row for " + e.key + " - not built (see the mount log)"); return; }
        _tooltip(row, _rowTooltip(e.key), function () { _reassertRowModified(e.key); });
        _bindRowReset(e, row);
    }

    function _sync() {
        _syncing = true;
        try {
            var list = QolLiteMapSchema.list();
            for (var i = 0; i < list.length; i++) {
                var e = list[i];
                try {
                    var ctl = _find(CTL_PREFIX + e.key), v = _values[e.key];
                    if (!ctl || v === undefined) { continue; }
                    if (_lastSentAt[e.key] !== undefined && _lastSent[e.key] === v) {
                        delete _lastSentAt[e.key];
                        delete _lastSent[e.key];
                    } else if (_inFlight(e.key)) {
                        continue;
                    }
                    if (e.type === "toggle") { _showToggle(ctl, v); }
                    else if (_sliders[e.key]) { _sliders[e.key].sync(v); }
                } catch (err) {
                    QolLiteMapLog.error("popup: sync failed for " + e.key + ": " + (err && err.message ? err.message : err));
                }
            }
        } finally {
            _syncing = false;
        }
    }

    function _readBack(tag) {
        if (!_values || !QolLiteMapLog.isDebug() || !_ctx() || !_ctx().IsValid()) { return; }
        for (var k in _sliders) {
            if (Object.prototype.hasOwnProperty.call(_sliders, k)) {
                _log("read-back " + tag + " " + k + " hud=" + _values[k] + " " + _sliders[k].describe() + " shows=" + _sliders[k].shows(_values[k]));
            }
        }
        var list = QolLiteMapSchema.list();
        for (var i = 0; i < list.length; i++) {
            if (list[i].type !== "toggle") { continue; }
            var ctl = _find(CTL_PREFIX + list[i].key);
            if (ctl) { _log("read-back " + tag + " " + list[i].key + " checked=" + ctl.checked + " hud=" + _values[list[i].key]); }
        }
    }

    function _startReadBack() {
        if (_readBackDone) { return; }
        _readBackDone = true;
        _readBack("+0s");
        var gen = _gen;
        for (var i = 0; i < READ_BACK_SEC.length; i++) {
            (function (sec) { $.Schedule(sec, function () { if (_live(gen)) { _readBack("+" + sec + "s"); } }); })(READ_BACK_SEC[i]);
        }
    }

    function _forceSliders() {
        for (var k in _sliders) {
            if (Object.prototype.hasOwnProperty.call(_sliders, k) && _values[k] !== undefined) { _sliders[k].sync(_values[k], true); }
        }
    }

    function _setEnabled(on) {
        var list = QolLiteMapSchema.list();
        for (var i = 0; i < list.length; i++) {
            var ctl = _find(CTL_PREFIX + list[i].key);
            if (ctl) { ctl.enabled = on; }
            if (_rowResets[list[i].key]) { _rowResets[list[i].key].button.enabled = on; }
        }
        var g = _groups();
        for (var j = 0; j < g.length; j++) {
            var ids = [SHOW_BUTTON_PREFIX + g[j].sfx, RESET_ROW_BUTTON_PREFIX + g[j].sfx];
            for (var k = 0; k < ids.length; k++) {
                var b = _find(ids[k]);
                if (b) { b.enabled = on; }
            }
        }
    }

    function _applyHidden() {
        var subs = _subs();
        for (var i = 0; i < subs.length; i++) { subs[i].visible = false; }
        var section = _find(QolLiteMapSchema.section().id);
        if (section) { section.visible = false; }
        QolLiteMapSettingsNav.hide();
    }

    function _hide(reason) {
        if (!_hidden) { _log("hidden - " + reason); }
        _hidden = true;
        _applyHidden();
    }

    function _bindSectionResets() {
        var groups = _groups();
        for (var i = 0; i < groups.length; i++) {
            (function (grp) {
                var sub = _find(grp.id), reset = sub ? sub.FindChildTraverse(RESET_BUTTON_ID) : null;
                if (reset) { reset.SetPanelEvent("onactivate", function () { _reset(grp.name); }); }
            })(groups[i]);
        }
        var section = _find(QolLiteMapSchema.section().id);
        var title = section ? section.FindChildTraverse(SECTION_TITLE_ID) : null;
        var all = title ? title.FindChildTraverse(RESET_BUTTON_ID) : null;
        if (all) { all.SetPanelEvent("onactivate", function () { _reset(undefined); }); }
    }

    function _peek() {
        if (!_values) { return; }
        var idle = Date.now() >= _peekUntil;
        _peekUntil = Date.now() + PEEK_HOLD_SEC * 1000;
        _send({ t: "peek" });
        if (idle) {
            _ctx().AddClass(GAME_WORLD_CLASS);
            _unpeekLater(_gen);
        }
    }

    function _unpeekLater(gen) {
        $.Schedule(0.25, function () {
            if (!_live(gen)) { return; }
            if (Date.now() < _peekUntil) { _unpeekLater(gen); return; }
            _ctx().RemoveClass(GAME_WORLD_CLASS);
        });
    }

    function _inView(sub) {
        try { return sub.BCanSeeInParentScroll(); }
        catch (err) {
            if (!_scrollErrLogged) { _scrollErrLogged = true; QolLiteMapLog.error("popup: BCanSeeInParentScroll threw - no lift: " + (err && err.message ? err.message : err)); }
            return false;
        }
    }

    function _anyInView() {
        var subs = _subs();
        for (var i = 0; i < subs.length; i++) { if (_inView(subs[i])) { return true; } }
        return false;
    }

    function _liftTick(gen) {
        if (!_live(gen)) { return; }
        var c = _ctx();
        if (!c.BHasClass(HIDDEN_CLASS)) { _wasShown = true; }
        var closing = _wasShown && c.BHasClass(HIDDEN_CLASS);
        var on = !!_values && !_hidden && !c.BHasClass(HIDDEN_CLASS) && _anyInView();
        if (on || _liftOn) { _send({ t: "lift", on: on }); }
        if (on !== _liftOn) { _log("lift " + (on ? "on" : "off") + (closing ? " (closing)" : "")); _liftOn = on; }
        if (closing) { _send({ t: "flush" }); return; }
        $.Schedule(LIFT_BEAT_SEC, function () { _liftTick(gen); });
    }

    function _onState(msg) {
        if (!_win || !_win.IsValid()) { return; }
        if (!msg || msg.t !== "state") { return; }
        _values = msg.values;
        if (msg.umm) { _hide("UMM owns the settings"); return; }
        if (!_hidden) { _setEnabled(true); }
        _sync();
        _syncRowResets();
        if (_resetPending) {
            _resetPending = false;
            _forceSliders();
            _readBack("reset");
        }
        _startReadBack();
    }

    function start(win) {
        _gen++;
        _win = win;
        _finder = QolLiteMapHud.finder(_ctx);
        _resetSession();
        if (_root().FindChildTraverse(UMM_ROOT_ID)) { _hide("UMM is installed"); }
        var list = QolLiteMapSchema.list();
        for (var i = 0; i < list.length; i++) { _bind(list[i]); }
        var groups = _groups();
        for (var j = 0; j < groups.length; j++) {
            (function (g) {
                var show = _find(SHOW_BUTTON_PREFIX + g.sfx);
                if (show) { show.SetPanelEvent("onactivate", _peek); }
                var showRow = _find(SHOW_ROW_PREFIX + g.sfx);
                if (showRow) { _tooltip(showRow, SHOW_TOOLTIP); }
                var reset = _find(RESET_ROW_BUTTON_PREFIX + g.sfx);
                if (reset) { reset.SetPanelEvent("onactivate", function () { _reset(g.name); }); }
                var resetRow = _find(RESET_ROW_PREFIX + g.sfx);
                if (resetRow) { _tooltip(resetRow, RESET_TOOLTIP); }
            })(groups[j]);
        }
        _setEnabled(false);
        _bindSectionResets();
        _send({ t: "get" });
        var gen = _gen;
        $.Schedule(LIFT_BEAT_SEC, function () { _liftTick(gen); });
    }

    function init() { QolLiteMapSettingsBus.subscribe(_onState); }

    return { init: init, start: start };
})();

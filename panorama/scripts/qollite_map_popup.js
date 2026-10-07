// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3ad1ca1, mod/panorama/scripts/bettermap_popup.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// BetterMap's subsections in Valve's settings window (spec
// docs/specs/2026-10-01-native-settings.md §6; one subsection per schema group and
// the per-row reset: docs/specs/2026-10-01-minimap-icon-sizes.md §5.6). Runs in the
// popup's own context, rebuilt on every open (the popup is destroyed on close). It
// never writes storage: it shows the HUD's live values (`get` -> `state`) and sends
// every change back (`set`); qollite_map_settings_bus.js in the HUD applies and saves.
// On close it sends `flush`, so the HUD writes the change now (D17).
// The controls are Valve's own, rendered from the schema by
// pipeline/build_popup_settings.py and bound here without convars, the way Valve's
// convar-less #EnableConsoleCheckbox works. Sliders bind through qollite_map_slider.js,
// which never sends a value the player did not set (D16).
// A colour setting shares its toggle's row (spec 2026-10-01-healing-apples-and-marker-colors.md C3):
// one tooltip, one modified mark and one reset button for the row, and that reset restores both
// the toggle and the colour (C7).
// The preview is the real minimap: while any of our subsections is on screen the HUD
// lifts it above this window (§6.2).
var QolLiteMapPopup = (function () {
    var CHANNEL = "ClientUI_FireOutput";
    var PROTOCOL = 1;
    var CTL_PREFIX = "bm_ctl_";
    var ROW_PREFIX = "bm_row_";
    // One of each per subsection, suffixed with its group's sfx (build_popup_settings.py).
    var SHOW_ROW_PREFIX = "bm_row_show_on_screen_";
    var SHOW_BUTTON_PREFIX = "bm_show_on_screen_";
    var RESET_ROW_PREFIX = "bm_row_reset_";
    var RESET_ROW_BUTTON_PREFIX = "bm_reset_";
    var NAV_ID = "SettingsNavigationButtonsContainer";
    var NAV_LABEL_CLASS = "SettingsNavigationButtonText";
    var RESET_BUTTON_ID = "ResetSectionButton";        // Valve's SettingsSubsection snippet (hover-only)
    var GAME_SECTION_TOKEN = "#citadel_settings_game";
    var NEW_CLASS = "HaveNewSettings";                 // Valve's purple "new" dot (popup_settings.css); persists (run 4)
    var TOOLTIP_STYLE = "SettingsMenuTooltip";         // as Valve's rows: UIShowTextTooltipStyled( ..., SettingsMenuTooltip )
    var SHOW_TOOLTIP = "Fades this window for a few seconds so you can see the minimap against the game.";
    var RESET_TOOLTIP = "Restores every setting in this section to its default.";
    // Valve's per-row reset (spec I10, §5.6.1): C++ gives every row a CitadelButton with
    // this class (client.dll, next to the row type classes) and hides it on a convar-less
    // row (in-game run 2: visible=false 0x0). popup_settings.css shows it only on a row
    // that carries ROW_MODIFIED_CLASS, and slides it in on hover. `visible = true` beats
    // the CSS's `visibility: collapse` (in-game run 1: 32x32 with the class gone), so
    // `visible` follows our own modified flag and never stands alone: an always-visible
    // button would sit at opacity 0 over every unmodified row's control and take clicks.
    // C++ strips ROW_MODIFIED_CLASS from our convar-less rows (run 1: every toggle, some
    // sliders), so the flag is ours (`on`), not the class: re-adding it on every state
    // fought C++ in a read-back storm. We re-assert the class when the pointer enters
    // the row, the one moment its :hover rule needs it.
    var ROW_RESET_CLASS = "SettingsRowResetButton";
    var ROW_MODIFIED_CLASS = "SettingsRowModified";
    var ROW_RESET_READ_BACK_SEC = [1, 3];              // DEBUG: what C++ does to the button and the class after a change
    var ROW_REASSERT_READ_BACK_SEC = [1];              // DEBUG: does a hover re-assert stick (one line per re-assert)
    // A colour slider shares its toggle's row (spec 2026-10-01-healing-apples-and-marker-colors.md
    // C3). Its own title is empty but would still take Valve's 280 px (settings_color_slider.css
    // #Title), so its container is collapsed - inferred, unmeasured: in-game run 1 reads the
    // widths back (DEBUG, LAYOUT_READ_BACK_SEC).
    var TITLE_CONTAINER_CLASS = "TitleContainer";      // settings_color_slider.xml
    var LAYOUT_READ_BACK_SEC = [1];
    var UMM_ROOT_ID = "UmmRoot";                       // UMM's base_hud.xml / base_dashboard.xml
    var STATE_TIMEOUT_SEC = 0.5;                       // bus round trip measured 0 ms (run 4)
    var RETRY_SEC = 0.25;                              // the layout and C++ nav are built around our start
    var RETRY_MAX = 40;
    var GET_RETRIES = 3;                               // extra `get` sends when no `state` arrives in STATE_TIMEOUT_SEC
    // The bus round trip measured 0 ms in run 4, but same-stack delivery is not
    // proven, so a late `state` must not drag the thumb back right after a change.
    var ECHO_GRACE_MS = 500;
    // Valve's own video-preview mode of this window: .ShowGameWorld { opacity: 0.5 }
    // and its .PopupBackground at 0 (compiled popup_settings.vcss_c, build 6722).
    var GAME_WORLD_CLASS = "ShowGameWorld";
    var PEEK_HOLD_SEC = 3;
    var HIDDEN_CLASS = "Hidden";                       // the popup root while it closes (run 2), then it is destroyed
    var LIFT_BEAT_SEC = 0.25;                          // the HUD drops a lift 0.75 s after the last beat (qollite_map_preview.js)
    var READ_BACK_SEC = [1, 3];                        // DEBUG proof of D16: after the composites' async re-assert

    var _values = null;
    var _syncing = false;
    var _hidden = false;
    var _navButtons = {};    // group name -> its C++ nav button
    var _gameNavButton = null;
    var _peekUntil = 0;
    var _tries = 0;
    var _sliders = {};       // key -> QolLiteMapSlider binding
    var _rowResets = {};     // row key -> { row, button, on: our modified flag, keys: the row's settings }
    var _lastSent = {};      // key -> value we sent
    var _lastSentAt = {};    // key -> Date.now() of that send
    var _readBackDone = false;
    var _liftOn = false;
    var _scrollErrLogged = false;
    var _wasShown = false;
    var _resetPending = false;   // the next state answers our reset: show it even over a focused TextEntry

    function _ctx() { return $.GetContextPanel(); }
    function _find(id) { return _ctx().FindChildTraverse(id); }
    function _root() { var r = _ctx(); while (r && r.GetParent()) { r = r.GetParent(); } return r; }
    function _log(m) { QolLiteMapLog.log("popup: " + m); }
    function _groups() { return QolLiteMapSchema.groups(); }

    // The settings that share one row (spec C3): the row's own setting and every setting
    // that names it in `row`, in schema order.
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

    // Our subsection panels that exist, in group order.
    function _subs() {
        var out = [], g = _groups();
        for (var i = 0; i < g.length; i++) { var s = _find(g[i].id); if (s) { out.push(s); } }
        return out;
    }

    function _send(msg) {
        msg.bm = PROTOCOL;
        $.DispatchEvent(CHANNEL, JSON.stringify(msg));
    }

    // A panel has one onmouseover, so a caller that also needs the hover passes `onOver`.
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

    // group: a schema group name - only that subsection's settings (spec I5).
    function _reset(group) {
        if (!_values || _hidden) { return; }
        _lastSent = {};
        _lastSentAt = {};
        _resetPending = true;
        _send({ t: "reset", group: group });
        _send({ t: "flush" });   // a reset is deliberate: write it now, not after the idle delay (D17)
    }

    // A value we sent that a state has not echoed yet, inside ECHO_GRACE_MS: the control
    // keeps showing it (_sync skips the key), so the row's mark must judge it too, or a
    // combined reset's first answer (toggle reset, old colour) re-marks the row.
    function _inFlight(k) {
        return _lastSentAt[k] !== undefined && _lastSent[k] !== _values[k] && Date.now() - _lastSentAt[k] < ECHO_GRACE_MS;
    }

    function _shownValue(k) { return _inFlight(k) ? _lastSent[k] : _values[k]; }

    function _isModified(e, v, d) {
        return QolLiteMapSchema.isRanged(e) ? QolLiteMapSchema.toShown(e, v) !== QolLiteMapSchema.toShown(e, d) : v !== d;
    }

    // Valve's CSS shows a row's reset button only while the row carries ROW_MODIFIED_CLASS;
    // the button's `visible` follows the same flag. Compared against our flag, not the
    // class C++ takes back (see ROW_RESET_CLASS). A row is modified while any of its
    // settings differs from its default (spec C7).
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

    // The pointer entered the row: put back the class C++ stripped, so Valve's
    // `.SettingsRowModified:hover` rule slides the button in.
    function _reassertRowModified(key) {
        var r = _rowResets[key];
        if (!r || !r.on || r.row.BHasClass(ROW_MODIFIED_CLASS)) { return; }
        r.row.AddClass(ROW_MODIFIED_CLASS);
        _log("row-reset " + key + " re-asserted (C++ removed " + ROW_MODIFIED_CLASS + ")");
        _rowResetReadBackLater(key, "reasserted", ROW_REASSERT_READ_BACK_SEC);
    }

    // DEBUG (spec §5.6.1): the revived button's `visible` and layout size, and whether the
    // row still carries ROW_MODIFIED_CLASS - after a bind, a click, a change of our flag,
    // or a hover re-assert. Run 1 measured that C++ strips the class; these lines show
    // whether it still does (the toggle-write guard, _showToggle) and whether a re-assert sticks.
    function _rowResetReadBack(key, tag) {
        var r = _rowResets[key];
        if (!r || !r.button.IsValid() || !r.row.IsValid()) { return; }
        _log("row-reset " + key + " " + tag + " visible=" + r.button.visible +
            " size=" + r.button.actuallayoutwidth + "x" + r.button.actuallayoutheight +
            " modified=" + r.row.BHasClass(ROW_MODIFIED_CLASS));
    }

    // Always scheduled: _log is DEBUG-gated when it runs, as the read-backs are.
    // `secs` defaults to ROW_RESET_READ_BACK_SEC.
    function _rowResetReadBackLater(key, why, secs) {
        var at = secs || ROW_RESET_READ_BACK_SEC;
        for (var i = 0; i < at.length; i++) {
            (function (sec) {
                $.Schedule(sec, function () {
                    if (!_ctx() || !_ctx().IsValid()) { return; }
                    _rowResetReadBack(key, why + " +" + sec + "s");
                });
            })(at[i]);
        }
    }

    // Writes a toggle only when it does not already show the value. Inferred, unmeasured
    // (spec §5.6.1): a redundant SetSelected on every state is what makes C++ strip
    // ROW_MODIFIED_CLASS - run 1 stripped it on every toggle but only sometimes on sliders,
    // and the slider sync already skips a value it shows. In-game run 2 tells.
    function _showToggle(ctl, v) {
        if (ctl.checked !== !!v) { ctl.SetSelected(!!v); }
    }

    // Shows a value at once, past the slider's hover gate: the pointer is on the row
    // while its reset button is clicked, and the HUD's answer must not be needed to move
    // the thumb.
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

    // Every setting of the row goes back to its default (spec C7: a colour's row resets
    // its toggle and its colour). Only a setting that differs is sent; each is shown.
    function _resetRow(rowKey) {
        if (!_values || _hidden) { return; }
        var keys = _rowResets[rowKey].keys, d = QolLiteMapSchema.defaults();
        for (var i = 0; i < keys.length; i++) {
            var e = QolLiteMapSchema.byKey(keys[i]);
            if (_isModified(e, _shownValue(keys[i]), d[keys[i]])) { _set(keys[i], d[keys[i]]); }
            _showNow(e, d[keys[i]]);
        }
        _syncRowResets();   // no set at all (nothing differed) still settles the mark
        _rowResetReadBackLater(rowKey, "click");
    }

    function _bindRowReset(e, row) {
        var found = row.FindChildrenWithClassTraverse(ROW_RESET_CLASS);
        if (!found.length) { QolLiteMapLog.error("popup: row-reset " + e.key + " - no " + ROW_RESET_CLASS + " in the row"); return; }
        var button = found[0];
        button.visible = false;   // until the row is modified (_syncRowResets)
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

    // DEBUG (spec §5.4): do a toggle and a colour slider fit one row.
    function _layoutReadBackLater(e) {
        for (var i = 0; i < LAYOUT_READ_BACK_SEC.length; i++) {
            (function (sec) {
                $.Schedule(sec, function () {
                    if (!_ctx() || !_ctx().IsValid()) { return; }
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
        if (!ctl) { QolLiteMapLog.error("popup: no control for " + e.key + " - regenerate popup_settings.vxml"); return; }
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
        // In a toggle's row (spec C3): the row, its tooltip and its reset belong to that toggle.
        if (e.row) {
            _collapseTitle(e, ctl);
            _layoutReadBackLater(e);
            return;
        }
        var row = _find(ROW_PREFIX + e.key);
        if (!row) { QolLiteMapLog.error("popup: no row for " + e.key + " - regenerate popup_settings.vxml"); return; }
        _tooltip(row, _rowTooltip(e.key), function () { _reassertRowModified(e.key); });
        _bindRowReset(e, row);
    }

    function _sync() {
        // A toggle's SetSelected may fire onactivate synchronously (unmeasured); the
        // flag keeps that echo from being sent back as a player's change.
        _syncing = true;
        try {
            var list = QolLiteMapSchema.list();
            for (var i = 0; i < list.length; i++) {
                var e = list[i];
                // One control throwing must not skip the others.
                try {
                    var ctl = _find(CTL_PREFIX + e.key), v = _values[e.key];
                    if (!ctl || v === undefined) { continue; }
                    if (_lastSentAt[e.key] !== undefined && _lastSent[e.key] === v) {
                        delete _lastSentAt[e.key];
                        delete _lastSent[e.key];
                    } else if (_inFlight(e.key)) {
                        // The slider's own sync gate also skips while hovered, typing or already
                        // showing the value. This window additionally covers the moment after
                        // the pointer leaves, and toggles: it keeps the player's value against a
                        // late state that differs - e.g. a combined row reset's first answer,
                        // which still carries the colour's old value.
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

    // DEBUG proof of D16 for the next in-game run (spec §11 session 2): after the
    // composites have had time to re-assert, every slider must show the HUD's value.
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
        for (var i = 0; i < READ_BACK_SEC.length; i++) {
            (function (sec) { $.Schedule(sec, function () { _readBack("+" + sec + "s"); }); })(READ_BACK_SEC[i]);
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
        for (var name in _navButtons) {
            if (!Object.prototype.hasOwnProperty.call(_navButtons, name)) { continue; }
            var holder = _navButtons[name].GetParent();   // NavigationAnimationContainer
            if (holder) { holder.visible = false; }
        }
        if (_gameNavButton) { _gameNavButton.RemoveClass(NEW_CLASS); }
    }

    function _hide(reason) {
        if (!_hidden) { _log("hidden - " + reason); }
        _hidden = true;
        _applyHidden();
    }

    // C++ labels a nav button "#<subsection id>" (no token, D7); after a retry it already
    // shows our title.
    function _groupForNavText(text) {
        var g = _groups();
        for (var i = 0; i < g.length; i++) {
            if (text === "#" + g[i].id || text === g[i].title) { return g[i]; }
        }
        return null;
    }

    // Titles, section resets, nav labels and the purple marks. The nav is built by C++
    // around our start, so retry until every one of our nav buttons is found; each
    // attempt repeats the idempotent steps, and hiding (UMM) never waits for the nav.
    function _decorate(attempt) {
        if (!_ctx() || !_ctx().IsValid()) { return; }   // the popup closed while we waited
        var groups = _groups();
        for (var i = 0; i < groups.length; i++) {
            (function (grp) {
                var sub = _find(grp.id);
                if (!sub) { return; }
                sub.SetDialogVariable("subsection_name", grp.title);
                var reset = sub.FindChildTraverse(RESET_BUTTON_ID);
                if (reset) { reset.SetPanelEvent("onactivate", function () { _reset(grp.name); }); }
            })(groups[i]);
        }
        var nav = _find(NAV_ID);
        if (nav && nav.GetChildCount() > 0) {
            var gameTitle = $.Localize(GAME_SECTION_TOKEN);
            var labels = nav.FindChildrenWithClassTraverse(NAV_LABEL_CLASS);
            for (var j = 0; j < labels.length; j++) {
                var l = labels[j], g = _groupForNavText(l.text);
                if (g) {
                    l.text = g.title;
                    _navButtons[g.name] = l.GetParent();
                    _navButtons[g.name].AddClass(NEW_CLASS);
                } else if (l.text === gameTitle) {
                    _gameNavButton = l.GetParent();
                    if (!_hidden) { _gameNavButton.AddClass(NEW_CLASS); }   // the mark would point at nothing of ours
                }
            }
        }
        if (_hidden) { _applyHidden(); }
        var missing = 0;
        for (var m = 0; m < groups.length; m++) { if (!_navButtons[groups[m].name]) { missing++; } }
        if (missing) {
            if (attempt < RETRY_MAX) { $.Schedule(RETRY_SEC, function () { _decorate(attempt + 1); }); }
            else { QolLiteMapLog.error("popup: " + missing + " of our nav buttons were not found"); }
        }
    }

    function _peek() {
        if (!_values) { return; }
        var idle = Date.now() >= _peekUntil;
        _peekUntil = Date.now() + PEEK_HOLD_SEC * 1000;
        _send({ t: "peek" });
        if (idle) {
            _ctx().AddClass(GAME_WORLD_CLASS);
            _unpeekLater();
        }
    }

    function _unpeekLater() {
        $.Schedule(0.25, function () {
            if (Date.now() < _peekUntil) { _unpeekLater(); return; }
            var c = _ctx();
            if (c && c.IsValid()) { c.RemoveClass(GAME_WORLD_CLASS); }
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

    // Heartbeat for the HUD's lift (spec §6.2): beats while any of our subsections is on
    // screen, one "off" on the transition, and stops for good once the window closes.
    function _liftTick() {
        var c = _ctx();
        if (!c || !c.IsValid()) { return; }
        // Valve's markup starts the popup root Hidden and C++ removes the class on open;
        // when it does is unmeasured. Hidden only means "closing" after it has been seen off,
        // else one early beat would stop the lift for the whole open.
        if (!c.BHasClass(HIDDEN_CLASS)) { _wasShown = true; }
        var closing = _wasShown && c.BHasClass(HIDDEN_CLASS);
        var on = !!_values && !_hidden && !c.BHasClass(HIDDEN_CLASS) && _anyInView();
        if (on || _liftOn) { _send({ t: "lift", on: on }); }
        if (on !== _liftOn) { _log("lift " + (on ? "on" : "off") + (closing ? " (closing)" : "")); _liftOn = on; }
        // The tick stops here, so this runs once: the HUD writes the waiting change now (D17).
        if (closing) { _send({ t: "flush" }); return; }
        $.Schedule(LIFT_BEAT_SEC, _liftTick);
    }

    function _onMessage(payload) {
        // Whether the popup's JS context outlives its panel is unknown, so guard it.
        if (!_ctx() || !_ctx().IsValid()) { return; }
        if (typeof payload !== "string" || payload.indexOf("\"bm\"") === -1) { return; }
        var msg;
        try { msg = JSON.parse(payload); } catch (e) { return; }
        if (!msg || msg.bm !== PROTOCOL || msg.t !== "state") { return; }
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

    function _requestState(attempt) {
        _send({ t: "get" });
        $.Schedule(STATE_TIMEOUT_SEC, function () {
            if (!_ctx() || !_ctx().IsValid()) { return; }   // the popup closed while we waited
            if (_values || _hidden) { return; }
            if (attempt < GET_RETRIES) { _requestState(attempt + 1); }
            else { QolLiteMapLog.error("popup: no answer from the HUD after " + (GET_RETRIES + 1) + " requests - controls stay disabled"); }
        });
    }

    function _allSubsPresent() {
        return _subs().length === _groups().length;
    }

    function init() {
        if (!_ctx() || !_ctx().IsValid()) { return; }   // the popup closed while we waited
        // Script load order is not guaranteed (panorama_notes.md): wait for our
        // dependencies and for the layout's panels instead of assuming them.
        var ready = typeof QolLiteMapLog !== "undefined" && typeof QolLiteMapSchema !== "undefined" &&
            typeof QolLiteMapSlider !== "undefined" && _allSubsPresent();
        if (!ready) {
            if (++_tries < RETRY_MAX) { $.Schedule(RETRY_SEC, init); }
            else { $.Msg("[BetterMap] [ERROR] popup: dependencies or layout never became ready"); }
            return;
        }
        $.RegisterForUnhandledEvent(CHANNEL, _onMessage);
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
        _setEnabled(false);   // until the HUD answers
        _decorate(0);
        _requestState(0);
        $.Schedule(LIFT_BEAT_SEC, _liftTick);
    }

    return { init: init };
})();

QolLiteMapPopup.init();

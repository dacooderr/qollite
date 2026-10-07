// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 5ac7816, mod/panorama/scripts/bettermap_settings_mount.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Mounts BetterMap's settings into Valve's settings window at runtime: our own section after
// Game, one subsection per schema group, its rows and controls built from the schema (spec
// docs/specs/2026-10-07-runtime-settings-injection.md). Valve's window is not overridden, so
// a game update that changes it cannot crash it through us: at worst our section is missing (R6).
// Every panel is made with $.CreatePanel from this (HUD) context: a C++ settings type in our own
// layout file was FATAL (probe run 1), while CreatePanel resolves Valve's snippets through the
// window (run 2). A missing snippet is fatal too, so the window must answer BHasLayoutSnippet
// for every one before anything is created.
// C++ builds the window on every open and destroys it on close (panorama_notes.md), so the
// mount repeats per instance; MOUNT_ATTR marks an instance already handled, whatever the outcome.
var QolLiteMapSettingsMount = (function () {
    var POPUP_TYPE = "PopupSettings";
    var POPUP_MANAGER_ID = "PopupManager";
    var BODY_ID = "SettingsBody";
    var NAV_ID = "SettingsNavigationButtonsContainer";
    var GAME_SECTION_ID = "citadel_settings_game";
    var FIRST_COLUMN_ID = "SettingsSubsectionFirstColumn";
    var ROW_CONTENT_ID = "SettingsRowContent";
    // Snippets of Valve's popup_settings.xml: loaded by the types created here
    // (PopupSettingsSettingsSection / Subsection / Row) and stamped by qollite_map_settings_nav.js.
    var SNIPPETS = ["SettingsSection", "SettingsSubsection", "SettingsRow", "SettingsSectionNavigationButton",
        "SettingsSubSectionNavigationContainer", "SettingsSubSectionNavigationButton"];
    // Valve's own postfix tokens (citadel_main_english.txt: " px", "%"), so a slider shows the
    // player's units (native-settings D12; creation properties apply, probe run 3). percentage="true"
    // is not used: in Valve's sliders it shows the position within the range, not the value.
    var POSTFIX = { px: "#citadel_settings_pixels_postfix", "%": "#citadel_settings_slider_percentage" };
    var RESET_TOKEN = "#citadel_settings_reset";
    var RESET_ICON = "s2r://panorama/images/icons/reset.vsvg";   // Valve's reset button (its SettingsSection snippet)
    var MOUNT_ATTR = "bm_mount";
    var POLL_SEC = 0.25;

    var _manager = null;
    var _lastError = null;

    function _log(m) { QolLiteMapLog.log("mount: " + m); }
    function _error(m) { QolLiteMapLog.error("mount: " + m); }
    function _msg(e) { return e && e.message ? e.message : String(e); }

    function _topRoot() { var r = $.GetContextPanel(); while (r && r.GetParent()) { r = r.GetParent(); } return r; }

    function _window() {
        if (!_manager || !_manager.IsValid()) {
            _manager = $.GetContextPanel().FindChildTraverse(POPUP_MANAGER_ID) || _topRoot().FindChildTraverse(POPUP_MANAGER_ID);
            if (!_manager) { return null; }
        }
        for (var i = 0; i < _manager.GetChildCount(); i++) {
            var c = _manager.GetChild(i);
            if (c.paneltype === POPUP_TYPE && c.IsValid()) { return c; }
        }
        return null;
    }

    function _row(column, id) {
        var row = $.CreatePanel("PopupSettingsSettingsRow", column, id);
        return row.FindChildTraverse(ROW_CONTENT_ID) || row;
    }

    // One setting's control, with the attributes the generated layout used to carry.
    function _control(e, content) {
        var id = "bm_ctl_" + e.key;
        if (e.type === "toggle") { return $.CreatePanel("CitadelSettingsToggle", content, id, { text: e.label }); }
        if (e.type === "slider") {
            if (!POSTFIX[e.unit]) { _error("no Valve postfix token for unit " + e.unit + " of " + e.key + " - left out"); return null; }
            return $.CreatePanel("CitadelSettingsSlider", content, id, {
                text: e.label, min: String(e.min), max: String(e.max), snap: String(e.step), percentage: "false",
                postfix: POSTFIX[e.unit], displayprecision: "0", textentry: "true" });
        }
        // A colour shares its toggle's row, whose label names it, so its own title stays empty
        // (healing-apples spec C3); qollite_map_popup.js collapses the empty title's width.
        if (e.type === "color") { return $.CreatePanel("CitadelSettingsColorSlider", content, id, { text: "" }); }
        _error("unknown type " + e.type + " of " + e.key + " - left out");
        return null;
    }

    // One group's rows in schema order: [{ head, members }]. An entry with `row` joins the row of
    // the toggle it names (spec C3); one naming anything else, and a colour without a row, is left
    // out with an error (tests/schema.test.js keeps the schema free of both).
    function _rows(entries) {
        var rows = [], at = {}, i;
        for (i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e.row) { continue; }
            if (e.type === "color") { _error("colour " + e.key + " has no row - left out"); continue; }
            at[e.key] = rows.length;
            rows.push({ head: e, members: [] });
        }
        for (i = 0; i < entries.length; i++) {
            var m = entries[i];
            if (!m.row) { continue; }
            if (!Object.prototype.hasOwnProperty.call(at, m.row) || rows[at[m.row]].head.type !== "toggle") {
                _error(m.key + " names row " + m.row + ", which is not a toggle in its group - left out");
                continue;
            }
            rows[at[m.row]].members.push(m);
        }
        return rows;
    }

    // Valve's InputButton markup, as the generated layout had it.
    function _showRow(column, g) {
        var content = _row(column, "bm_row_show_on_screen_" + g.sfx);
        $.CreatePanel("Label", content, "", { class: "SettingLabel AlignVerticalCenter", text: "Preview on Screen" });
        var button = $.CreatePanel("Button", content, "bm_show_on_screen_" + g.sfx, { class: "InputButton Fill" });
        $.CreatePanel("Panel", button, "", { class: "Bottom" });
        $.CreatePanel("Panel", button, "", { class: "Top" });
        $.CreatePanel("Label", $.CreatePanel("Panel", button, "", { class: "Content" }), "", { text: "Show on Screen" });
    }

    // Valve's visible reset button (its SettingsSection snippet), native-settings §6.4.
    function _resetRow(column, g) {
        var content = _row(column, "bm_row_reset_" + g.sfx);
        $.CreatePanel("Label", content, "", { class: "SettingLabel AlignVerticalCenter", text: "Reset to Defaults" });
        var holder = $.CreatePanel("Panel", content, "", { class: "ResetButtonContainer" });
        $.CreatePanel("CitadelButton", holder, "bm_reset_" + g.sfx,
            { class: "Small Fill ResetButton", text: $.Localize(RESET_TOKEN), imagesrc: RESET_ICON });
    }

    function _subsection(section, g) {
        var sub = $.CreatePanel("PopupSettingsSettingsSubsection", section, g.id);
        sub.SetDialogVariable("subsection_name", g.title);   // C++ would title it "#<id>": no token exists (D7)
        var column = sub.FindChildTraverse(FIRST_COLUMN_ID);
        if (!column) { _error("subsection " + g.id + " has no #" + FIRST_COLUMN_ID + " - its rows are not built"); return sub; }
        var list = QolLiteMapSchema.list(), entries = [];
        for (var i = 0; i < list.length; i++) { if (list[i].group === g.name) { entries.push(list[i]); } }
        var rows = _rows(entries);
        for (var j = 0; j < rows.length; j++) {
            var content = _row(column, "bm_row_" + rows[j].head.key);
            var all = [rows[j].head].concat(rows[j].members);
            for (var k = 0; k < all.length; k++) { _control(all[k], content); }
        }
        _showRow(column, g);
        _resetRow(column, g);
        return sub;
    }

    function _missing(win) {
        var out = [], anchors = [BODY_ID, NAV_ID, GAME_SECTION_ID], i;
        for (i = 0; i < anchors.length; i++) { if (!win.FindChildTraverse(anchors[i])) { out.push("#" + anchors[i]); } }
        for (i = 0; i < SNIPPETS.length; i++) { if (!win.BHasLayoutSnippet(SNIPPETS[i])) { out.push("snippet " + SNIPPETS[i]); } }
        return out;
    }

    function _mount(win) {
        win.SetAttributeString(MOUNT_ATTR, "1");
        if (QolLiteMapUmmAdapter.isPresent()) { _log("UMM owns the settings - nothing mounted"); return; }
        var missing = _missing(win);
        if (missing.length) { _error("Valve's settings window lacks " + missing.join(", ") + " - BetterMap's section is not added"); return; }
        var body = win.FindChildTraverse(BODY_ID), section = null, subs = [];
        try {
            section = $.CreatePanel("PopupSettingsSettingsSection", body, QolLiteMapSchema.section().id);
            body.MoveChildAfter(section, win.FindChildTraverse(GAME_SECTION_ID));
            section.SetDialogVariable("section_name", QolLiteMapSchema.section().title);
            var groups = QolLiteMapSchema.groups();
            for (var i = 0; i < groups.length; i++) { subs.push({ group: groups[i], panel: _subsection(section, groups[i]) }); }
        } catch (e) {
            _error("building our section threw: " + _msg(e));
            if (section) { section.DeleteAsync(0); }
            return;
        }
        _log("mounted " + subs.length + " subsections");
        try { QolLiteMapSettingsNav.mount(win, section, subs); } catch (e2) { _error("nav threw: " + _msg(e2)); }
        try { QolLiteMapPopup.start(win); } catch (e3) { _error("popup threw: " + _msg(e3)); }
    }

    function _tick() {
        var win = _window();
        if (!win || win.GetAttributeString(MOUNT_ATTR, "") !== "") { return; }
        var nav = win.FindChildTraverse(NAV_ID);
        if (nav && nav.GetChildCount() === 0) { return; }   // C++ fills the sidebar around the open
        _mount(win);
    }

    function _poll() {
        try { _tick(); }
        catch (e) {
            var m = "mount: tick threw: " + _msg(e);
            if (m !== _lastError) { _lastError = m; QolLiteMapLog.error(m); }
        }
        $.Schedule(POLL_SEC, _poll);
    }

    function init() { _poll(); }

    return { init: init };
})();

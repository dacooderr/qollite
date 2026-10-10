// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 5ac7816, mod/panorama/scripts/bettermap_settings_nav.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// BetterMap's entries in the sidebar of Valve's settings window, and what C++ does for its own
// sections but cannot do for ours, which it does not know (spec
// docs/specs/2026-10-07-runtime-settings-injection.md R5; probe runs 2-3):
//   - a section entry after Game's pair, then our own sub-navigation with one entry per
//     subsection, stamped from Valve's snippets (C++ clips anything added to its own, run 2);
//   - while our section is current (it crosses CURRENT_LINE of the viewport) our entry and the
//     current subsection's entry are selected, our sub-navigation is open and the one C++ opened
//     is collapsed. C++ keeps selecting the section it thinks current (run 3: 12 of 19 take-overs
//     lost), so this is re-applied every SYNC_SEC;
//   - when our section stops being current C++ does not select its entry again (run 3), so the
//     entry it last chose, and that entry's sub-navigation, are restored here;
//   - a click puts the title at the top of the viewport: ScrollToBottom, then
//     ScrollParentToMakePanelFit on the title (run 3: 249 -> 0 px; scrolloffset_y is read-only);
//   - the ActiveSection hover highlight on our subsections.
// One window at a time: mount() for a new window stops the old window's loop.
var QolLiteMapSettingsNav = (function () {
    var NAV_ID = "SettingsNavigationButtonsContainer";
    var BODY_ID = "SettingsBody";
    var GAME_LABEL_TOKEN = "#citadel_settings_game";
    var LABEL_CLASS = "SettingsNavigationButtonText";
    var SECTION_RADIO_CLASS = "SettingsNavigationButton";        // the RadioButton of SettingsSectionNavigationButton
    var SUBNAV_CLASS = "SettingsSectionSubNavigationContainer";
    var SECTION_SNIPPET = "SettingsSectionNavigationButton";
    var SUBNAV_SNIPPET = "SettingsSubSectionNavigationContainer";
    var SUBENTRY_SNIPPET = "SettingsSubSectionNavigationButton";
    var SECTION_RADIO_ID = "SectionButton";
    var SUB_RADIO_ID = "SubSectionButton";
    var ICON_ID = "SectionIcon";
    var SECTION_TITLE_ID = "SectionTitleContainer";
    var SUB_TITLE_CLASS = "SettingsSubsectionTitleContainer";
    var ICON = "s2r://panorama/images/icons/icon_lanes.vsvg";    // Valve's lanes icon (spec R9)
    var NEW_CLASS = "HaveNewSettings";                            // Valve's purple "new" dot; persists (native-settings run 4)
    var ACTIVE_CLASS = "ActiveSection";                           // Valve's subsection highlight (popup_settings.css)
    var CURRENT_LINE = 0.33;          // a part is current while it crosses this fraction of the viewport (run 3)
    var SYNC_SEC = 0.03;              // about two frames: run 3 lost the selection to C++ between 0.1 s ticks
    var FIT_BEHAVIOUR = 1;            // ScrollParentToMakePanelFit(1, false), run 3; the bare call throws (run 2)
    var FIT_DELAY_SEC = 0.05;         // after ScrollToBottom, as in run 3
    var COLLAPSED = "0px";

    var _gen = 0;
    var _s = null;

    function _log(m) { QolLiteMapLog.log("nav: " + m); }
    function _alive(p) { return !!p && p.IsValid(); }
    function _px(h) { var v = parseFloat(h); return isFinite(v) ? v : 0; }

    // The direct child of the sidebar that holds `p`.
    function _holder(nav, p) { while (p && p.GetParent() !== nav) { p = p.GetParent(); } return p; }

    // The sub-navigation right after a section entry's holder, if any.
    function _subnavAfter(nav, holder) {
        for (var i = 0; i < nav.GetChildCount() - 1; i++) {
            if (nav.GetChild(i) === holder && nav.GetChild(i + 1).BHasClass(SUBNAV_CLASS)) { return nav.GetChild(i + 1); }
        }
        return null;
    }

    function _gameHolder(nav) {
        var want = $.Localize(GAME_LABEL_TOKEN), labels = nav.FindChildrenWithClassTraverse(LABEL_CLASS);
        for (var i = 0; i < labels.length; i++) { if (labels[i].text === want) { return _holder(nav, labels[i]); } }
        return null;
    }

    function _stamp(parent, id, snippet) {
        var p = $.CreatePanel("Panel", parent, id);
        p.BLoadLayoutSnippet(snippet);
        return p;
    }

    function _scrollTo(body, title) {
        body.ScrollToBottom();
        $.Schedule(FIT_DELAY_SEC, function () { if (_alive(title)) { title.ScrollParentToMakePanelFit(FIT_BEHAVIOUR, false); } });
    }

    function _hover(sub) {
        sub.SetPanelEvent("onmouseover", function () { sub.AddClass(ACTIVE_CLASS); });
        sub.SetPanelEvent("onmouseout", function () { sub.RemoveClass(ACTIVE_CLASS); });
    }

    // win: the window; section: our PopupSettingsSettingsSection; subs: [{ group, panel }] in order.
    function mount(win, section, subs) {
        var gen = ++_gen;
        _s = null;
        var nav = win.FindChildTraverse(NAV_ID), body = win.FindChildTraverse(BODY_ID);
        var game = _gameHolder(nav);
        if (!game) { QolLiteMapLog.error("nav: no Game entry in the sidebar - our entries go last"); }
        var entry = _stamp(nav, "bm_nav_section", SECTION_SNIPPET);
        if (game) { nav.MoveChildAfter(entry, _subnavAfter(nav, game) || game); }
        entry.SetDialogVariable("section_name", QolLiteMapSchema.section().title);
        var icon = entry.FindChildTraverse(ICON_ID);
        if (icon) { icon.SetImage(ICON); }
        var radio = entry.FindChildTraverse(SECTION_RADIO_ID);
        var subnav = _stamp(nav, "bm_nav_subsections", SUBNAV_SNIPPET);
        nav.MoveChildAfter(subnav, entry);
        subnav.style.height = COLLAPSED;
        if (!radio) { QolLiteMapLog.error("nav: Valve's section entry has no #" + SECTION_RADIO_ID + " - no sidebar entry"); return; }
        radio.AddClass(NEW_CLASS);
        var sectionTitle = section.FindChildTraverse(SECTION_TITLE_ID) || section;
        radio.SetPanelEvent("onactivate", function () { _scrollTo(body, sectionTitle); });
        var list = [];
        for (var i = 0; i < subs.length; i++) {
            (function (sub) {
                var e = _stamp(subnav, "bm_nav_" + sub.group.id, SUBENTRY_SNIPPET);
                e.SetDialogVariable("subsection_name", sub.group.title);
                var r = e.FindChildTraverse(SUB_RADIO_ID);
                if (!r) { QolLiteMapLog.error("nav: Valve's sub-entry has no #" + SUB_RADIO_ID); return; }
                r.AddClass(NEW_CLASS);
                var titles = sub.panel.FindChildrenWithClassTraverse(SUB_TITLE_CLASS);
                var title = titles.length ? titles[0] : sub.panel;
                r.SetPanelEvent("onactivate", function () { _scrollTo(body, title); });
                _hover(sub.panel);
                list.push({ panel: sub.panel, entry: e, radio: r });
            })(subs[i]);
        }
        _s = { win: win, nav: nav, body: body, section: section, entry: entry, radio: radio, subnav: subnav,
               subs: list, current: false, cxxRadio: null, collapsed: [] };
        _log("mounted: " + list.length + " sub-entries");
        $.Schedule(SYNC_SEC, function () { _tick(gen); });
    }

    function _top(p, bodyTop) { return p.GetPositionWithinWindow().y - bodyTop; }

    // The Valve section entry selected now, if any.
    function _valveChecked() {
        var r = _s.nav.FindChildrenWithClassTraverse(SECTION_RADIO_CLASS);
        for (var i = 0; i < r.length; i++) { if (r[i] !== _s.radio && r[i].checked) { return r[i]; } }
        return null;
    }

    // Collapse every sub-navigation C++ has open, remembering its height.
    function _collapseValve() {
        var c = _s.nav.FindChildrenWithClassTraverse(SUBNAV_CLASS);
        for (var i = 0; i < c.length; i++) {
            if (c[i] === _s.subnav || _px(c[i].style.height) <= 0) { continue; }
            _s.collapsed.push({ panel: c[i], height: c[i].style.height });
            c[i].style.height = COLLAPSED;
        }
    }

    // Our sub-navigation's open height: its entries' heights in layout px, as C++ writes Valve's
    // ("128.0px" for four entries, run 1). 0 until they are laid out.
    function _openHeight() {
        var h = 0;
        for (var i = 0; i < _s.subs.length; i++) {
            var e = _s.subs[i].entry;
            if (e.actualuiscale_y > 0) { h += e.actuallayoutheight / e.actualuiscale_y; }
        }
        return h;
    }

    function _leave() {
        var back = _valveChecked() || _s.cxxRadio;
        if (_s.radio.checked && _alive(back)) { back.checked = true; }
        var open = back ? _subnavAfter(_s.nav, _holder(_s.nav, back)) : null;
        for (var i = _s.collapsed.length - 1; i >= 0; i--) {
            var c = _s.collapsed[i];
            if (c.panel === open && _alive(c.panel) && _px(c.panel.style.height) <= 0) { c.panel.style.height = c.height; break; }
        }
        _s.collapsed = [];
        _s.subnav.style.height = COLLAPSED;
        for (var j = 0; j < _s.subs.length; j++) { if (_s.subs[j].radio.checked) { _s.subs[j].radio.checked = false; } }
        _log("current: Valve's section again");
    }

    function _sync() {
        var bodyTop = _s.body.GetPositionWithinWindow().y, line = _s.body.actuallayoutheight * CURRENT_LINE;
        var top = _top(_s.section, bodyTop);
        var current = top <= line && top + _s.section.actuallayoutheight > line;
        if (current && !_s.current) { _s.cxxRadio = _valveChecked(); _s.collapsed = []; _log("current: ours"); }
        if (!current && _s.current) { _leave(); }
        _s.current = current;
        if (!current) { return; }
        var cxx = _valveChecked();
        if (cxx) { _s.cxxRadio = cxx; }
        if (!_s.radio.checked) { _s.radio.checked = true; }
        _collapseValve();
        var h = _openHeight();
        if (h > 0 && _px(_s.subnav.style.height) !== h) { _s.subnav.style.height = h + "px"; }
        var sub = null, i;
        for (i = 0; i < _s.subs.length; i++) { if (_top(_s.subs[i].panel, bodyTop) <= line) { sub = _s.subs[i]; } }
        for (i = 0; i < _s.subs.length; i++) {
            var on = _s.subs[i] === sub;
            if (_s.subs[i].radio.checked !== on) { _s.subs[i].radio.checked = on; }
        }
    }

    function _tick(gen) {
        if (gen !== _gen || !_s || !_alive(_s.win) || !_alive(_s.section)) { return; }
        try { _sync(); }
        catch (e) { QolLiteMapLog.error("nav: sync threw - the sidebar stops following: " + (e && e.message ? e.message : e)); return; }
        $.Schedule(SYNC_SEC, function () { _tick(gen); });
    }

    // UMM appeared after the mount: our entries go with our section (qollite_map_popup.js hides it).
    function hide() {
        _gen++;
        if (!_s) { return; }
        if (_s.current) { _leave(); _s.current = false; }
        _s.entry.visible = false;
        _s.subnav.visible = false;
    }

    return { mount: mount, hide: hide };
})();

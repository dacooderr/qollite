// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_settings_nav.js
"use strict";

var QolLiteMapSettingsNav = (function () {
    var NAV_ID = "SettingsNavigationButtonsContainer";
    var BODY_ID = "SettingsBody";
    var SECTION_RADIO_CLASS = "SettingsNavigationButton";
    var SUBNAV_CLASS = "SettingsSectionSubNavigationContainer";
    var SECTION_SNIPPET = "SettingsSectionNavigationButton";
    var SUBNAV_SNIPPET = "SettingsSubSectionNavigationContainer";
    var SUBENTRY_SNIPPET = "SettingsSubSectionNavigationButton";
    var SECTION_RADIO_ID = "SectionButton";
    var SUB_RADIO_ID = "SubSectionButton";
    var ICON_ID = "SectionIcon";
    var SECTION_TITLE_ID = "SectionTitleContainer";
    var SUB_TITLE_CLASS = "SettingsSubsectionTitleContainer";
    var ICON = "s2r://panorama/images/icons/icon_lanes.vsvg";
    var NEW_CLASS = "HaveNewSettings";
    var ACTIVE_CLASS = "ActiveSection";
    var CURRENT_LINE = 0.33;
    var SYNC_SEC = 0.03;
    var FIT_BEHAVIOUR = 1;
    var FIT_DELAY_SEC = 0.05;
    var COLLAPSED = "0px";

    var _gen = 0;
    var _s = null;

    function _log(m) { QolLiteMapLog.log("nav: " + m); }
    function _alive(p) { return !!p && p.IsValid(); }
    function _px(h) { var v = parseFloat(h); return isFinite(v) ? v : 0; }

    function _holder(nav, p) { while (p && p.GetParent() !== nav) { p = p.GetParent(); } return p; }

    function _subnavAfter(nav, holder) {
        for (var i = 0; i < nav.GetChildCount() - 1; i++) {
            if (nav.GetChild(i) === holder && nav.GetChild(i + 1).BHasClass(SUBNAV_CLASS)) { return nav.GetChild(i + 1); }
        }
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

    function mount(win, section, subs) {
        var gen = ++_gen;
        _s = null;
        var nav = win.FindChildTraverse(NAV_ID), body = win.FindChildTraverse(BODY_ID);
        var entry = _stamp(nav, "bm_nav_section", SECTION_SNIPPET);
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

    function _valveChecked() {
        var r = _s.nav.FindChildrenWithClassTraverse(SECTION_RADIO_CLASS);
        for (var i = 0; i < r.length; i++) { if (r[i] !== _s.radio && r[i].checked) { return r[i]; } }
        return null;
    }

    function _collapseValve() {
        var c = _s.nav.FindChildrenWithClassTraverse(SUBNAV_CLASS);
        for (var i = 0; i < c.length; i++) {
            if (c[i] === _s.subnav || _px(c[i].style.height) <= 0) { continue; }
            _s.collapsed.push({ panel: c[i], height: c[i].style.height });
            c[i].style.height = COLLAPSED;
        }
    }

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

    function _keepLast() {
        var nav = _s.nav, n = nav.GetChildCount();
        if (n >= 2 && nav.GetChild(n - 2) === _s.entry && nav.GetChild(n - 1) === _s.subnav) { return; }
        var last = nav.GetChild(n - 1);
        if (last !== _s.subnav) { nav.MoveChildAfter(_s.subnav, last); }
        nav.MoveChildBefore(_s.entry, _s.subnav);
        _log("our entries moved back to the end of the sidebar");
    }

    function _sync() {
        _keepLast();
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

    function hide() {
        _gen++;
        if (!_s) { return; }
        if (_s.current) { _leave(); _s.current = false; }
        _s.entry.visible = false;
        _s.subnav.visible = false;
    }

    return { mount: mount, hide: hide };
})();

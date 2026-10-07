// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ a7b55cf, mod/panorama/scripts/bettermap_store_codec.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// The pure half of the standalone store - no Panorama API, so it runs under node
// in tests/. It defines the stored record format and the bm1 request/answer
// format of our storage page (repo gfkm/bettermap-storage, index.html:
// request "#bm1.<id>.<op>[.<base64url>]", answer title "BM1:" + JSON).
var QolLiteMapStoreCodec = (function () {
    // 2 since D18. The owner, 2026-10-01, on the old saves: "you can forget the old
    // saves and just reset everything" (the corner setting was removed). A v1 record
    // therefore decodes as malformed: defaults now, overwritten on the next change.
    var VERSION = 2;
    var PROTOCOL = "bm1";
    var TITLE_PREFIX = "BM1:";   // must match the page's TITLE_PREFIX
    var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    function _own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

    // READ-OLD FALLBACK (spec docs/specs/2026-10-01-minimap-icon-sizes.md I7): records
    // written before the per-type icon sizes hold one playerIconScalePct for every hero.
    // It seeds the three player sizes unless the record already has one of them, and
    // it is removed from `extra` either way, so the next write no longer carries it.
    // After a downgrade and re-upgrade the three new keys win over an old key the older
    // build wrote back (newer schema wins).
    var OLD_PLAYER_KEY = "playerIconScalePct";
    var PLAYER_KEYS = ["selfIconScalePct", "allyIconScalePct", "enemyIconScalePct"];

    function _migratePlayerScale(values, extra) {
        if (!_own(extra, OLD_PLAYER_KEY)) { return; }
        var old = extra[OLD_PLAYER_KEY];
        delete extra[OLD_PLAYER_KEY];
        for (var i = 0; i < PLAYER_KEYS.length; i++) { if (_own(values, PLAYER_KEYS[i])) { return; } }
        for (var j = 0; j < PLAYER_KEYS.length; j++) {
            var v = QolLiteMapSchema.sanitize(PLAYER_KEYS[j], old);
            if (v !== undefined) { values[PLAYER_KEYS[j]] = v; }
        }
    }

    // UTF-8 + base64url without padding; Panorama has no btoa/TextEncoder precedent.
    function base64Url(text) {
        var bytes = [];
        for (var i = 0; i < text.length; i++) {
            var c = text.charCodeAt(i);
            if (c >= 0xD800 && c <= 0xDBFF && i + 1 < text.length) {
                c = 0x10000 + ((c - 0xD800) << 10) + (text.charCodeAt(++i) - 0xDC00);
            }
            if (c < 0x80) { bytes.push(c); }
            else if (c < 0x800) { bytes.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
            else if (c < 0x10000) { bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
            else { bytes.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
        }
        var out = "";
        for (var j = 0; j < bytes.length; j += 3) {
            var n = (bytes[j] << 16) | ((bytes[j + 1] || 0) << 8) | (bytes[j + 2] || 0);
            out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
            if (j + 1 < bytes.length) { out += B64[(n >> 6) & 63]; }
            if (j + 2 < bytes.length) { out += B64[n & 63]; }
        }
        return out;
    }

    // Stored record -> { ok, empty, values, extra, reason }. `values` holds only
    // valid, sanitised schema values. When ok=false, `code` is "malformed" (not JSON /
    // not a record) or "version" (a record version this build cannot read). `extra` keeps unknown keys, so a save
    // written by a newer mod version survives a downgrade. ok=false means: do not
    // trust it, and do not overwrite it until the player changes something.
    function decode(raw) {
        if (raw === null || raw === undefined || raw === "") {
            return { ok: true, empty: true, values: {}, extra: {} };
        }
        var rec;
        try { rec = JSON.parse(raw); } catch (e) { return { ok: false, code: "malformed", reason: "malformed", values: {}, extra: {} }; }
        if (!rec || typeof rec !== "object" || rec.v !== VERSION || !rec.values || typeof rec.values !== "object") {
            // Only a NEWER version is "version" (the store then refuses to overwrite it);
            // any other unusable record (null, {}, 123, v<1, missing values) is malformed.
            var newer = !!rec && typeof rec === "object" && typeof rec.v === "number" && rec.v > VERSION;
            return { ok: false, code: newer ? "version" : "malformed",
                     reason: "unsupported record (v=" + (rec && rec.v) + ")", values: {}, extra: {} };
        }
        var values = {}, extra = {};
        for (var k in rec.values) {
            if (!_own(rec.values, k)) { continue; }
            if (QolLiteMapSchema.byKey(k)) {
                var v = QolLiteMapSchema.sanitize(k, rec.values[k]);
                if (v !== undefined) { values[k] = v; }
            } else {
                extra[k] = rec.values[k];
            }
        }
        _migratePlayerScale(values, extra);
        return { ok: true, empty: false, values: values, extra: extra };
    }

    function encode(values, extra) {
        var out = {}, k;
        for (k in extra) { if (_own(extra, k)) { out[k] = extra[k]; } }
        for (k in values) { if (_own(values, k)) { out[k] = values[k]; } }
        return JSON.stringify({ v: VERSION, values: out });
    }

    function request(id, op, payload) {
        return PROTOCOL + "." + id + "." + op + (payload === undefined ? "" : "." + base64Url(payload));
    }

    // Page title -> answer object, or null for anything that is not a bm1 answer.
    function parseTitle(title) {
        if (typeof title !== "string" || title.indexOf(TITLE_PREFIX) !== 0) { return null; }
        var msg;
        try { msg = JSON.parse(title.slice(TITLE_PREFIX.length)); } catch (e) { return null; }
        return (msg && typeof msg.id === "string") ? msg : null;
    }

    return { VERSION: VERSION, base64Url: base64Url, decode: decode, encode: encode,
             request: request, parseTitle: parseTitle };
})();

// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_store_codec.js
"use strict";

var QolLiteMapStoreCodec = (function () {
    var VERSION = 2;
    var PROTOCOL = "bm1";
    var TITLE_PREFIX = "BM1:";
    var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    function _own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

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

    function decode(raw) {
        if (raw === null || raw === undefined || raw === "") {
            return { ok: true, empty: true, values: {}, extra: {} };
        }
        var rec;
        try { rec = JSON.parse(raw); } catch (e) { return { ok: false, code: "malformed", reason: "malformed", values: {}, extra: {} }; }
        if (!rec || typeof rec !== "object" || rec.v !== VERSION || !rec.values || typeof rec.values !== "object") {
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

    function parseTitle(title) {
        if (typeof title !== "string" || title.indexOf(TITLE_PREFIX) !== 0) { return null; }
        var msg;
        try { msg = JSON.parse(title.slice(TITLE_PREFIX.length)); } catch (e) { return null; }
        return (msg && typeof msg.id === "string") ? msg : null;
    }

    return { VERSION: VERSION, base64Url: base64Url, decode: decode, encode: encode,
             request: request, parseTitle: parseTitle };
})();

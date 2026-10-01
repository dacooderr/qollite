var MuteWatch = {
    values: {
        showTeam: true,
        showEnemy: true,
        showAll: true,
        showUnmuted: true
    },

    normalize: function(s) {
        var out;
        var inTag;
        var i;
        var ch;
        if (!s) return "";
        s = String(s);
        out = "";
        inTag = false;
        for (i = 0; i < s.length; i++) {
            ch = s.charAt(i);
            if (ch === "<") { inTag = true; continue; }
            if (ch === ">") { inTag = false; continue; }
            if (!inTag) out += ch;
        }
        return out.replace(/^\s+|\s+$/g, "").toLowerCase();
    },

    top: function() {
        var pnl;
        var guard;
        try { pnl = $.GetContextPanel(); } catch (e) { return null; }
        guard = 0;
        while (pnl && pnl.GetParent && pnl.GetParent() && guard < 50) {
            pnl = pnl.GetParent();
            guard++;
        }
        return pnl || null;
    },

    pushName: function(keys, value) {
        var name = MuteWatch.normalize(value);
        if (name && name.length > 1) keys[name] = true;
    },

    lastNames: "",
    emptyStreak: 0,

    entryOf: function(panel) {
        var p = panel;
        var guard = 0;
        var typeName;
        while (p && guard < 20) {
            if (p.BHasClass && (p.BHasClass("CitadelPlayersListEntry") || p.BHasClass("Player"))) return p;
            try { typeName = p.paneltype || ""; } catch (e) { typeName = ""; }
            if (typeName === "CitadelPlayersListEntry") return p;
            p = p.GetParent ? p.GetParent() : null;
            guard++;
        }
        return panel;
    },

    readText: function(keys, panel) {
        var classes;
        var ids;
        var attrs;
        var i;
        var nodes;
        var n;
        var node;
        var txt;
        if (!panel) return;
        ids = ["PlayerName", "AccountID", "MVPPlayerName"];
        if (panel.FindChildTraverse) {
            for (i = 0; i < ids.length; i++) {
                node = panel.FindChildTraverse(ids[i]);
                try { if (node && node.text) MuteWatch.pushName(keys, node.text); } catch (e1) {}
            }
        }
        classes = ["PlayerName", "PlayerHero", "HeroName"];
        if (panel.FindChildrenWithClassTraverse) {
            for (i = 0; i < classes.length; i++) {
                nodes = panel.FindChildrenWithClassTraverse(classes[i]) || [];
                for (n = 0; n < nodes.length; n++) {
                    try { if (nodes[n].text) MuteWatch.pushName(keys, nodes[n].text); } catch (e2) {}
                }
            }
        }
        attrs = ["account_id", "accountid", "steamid"];
        for (i = 0; i < attrs.length; i++) {
            try {
                txt = panel.GetAttributeString(attrs[i], "");
                if (txt) MuteWatch.pushName(keys, txt);
            } catch (e3) {}
        }
    },

    firstText: function(panel) {
        var found = "";
        function walk(p) {
            var i;
            var n;
            var t;
            if (!p || found) return;
            try { t = p.text; } catch (e) { t = ""; }
            if (typeof t === "string" && t) {
                found = t;
                return;
            }
            n = p.GetChildCount ? p.GetChildCount() : 0;
            for (i = 0; i < n; i++) walk(p.GetChild(i));
        }
        walk(panel);
        return found;
    },

    entryName: function(entry) {
        var labels;
        var label;
        if (!entry || !entry.FindChildrenWithClassTraverse) return "";
        labels = entry.FindChildrenWithClassTraverse("PlayerName") || [];
        label = labels.length ? labels[0] : null;
        return MuteWatch.normalize(MuteWatch.firstText(label));
    },

    unique: function(list) {
        var i;
        var sorted;
        if (!list || list.length < 2) return false;
        sorted = list.slice().sort();
        for (i = 0; i < sorted.length; i++) {
            if (!sorted[i]) return false;
            if (i && sorted[i] === sorted[i - 1]) return false;
        }
        return true;
    },

    walk: function(panel, fn) {
        var i;
        var n;
        if (!panel) return;
        fn(panel);
        n = panel.GetChildCount ? panel.GetChildCount() : 0;
        for (i = 0; i < n; i++) MuteWatch.walk(panel.GetChild(i), fn);
    },

    collect: function() {
        var ctx;
        var teams;
        var names = [];
        var muted = [];
        var seen = {};
        try { ctx = $.GetContextPanel(); } catch (e) { ctx = null; }
        if (!ctx || !ctx.FindChildTraverse) return null;
        teams = ctx.FindChildTraverse("Teams");
        if (!teams) return null;
        MuteWatch.walk(teams, function(panel) {
            var typeName = "";
            var name;
            try { typeName = panel.paneltype || ""; } catch (e2) { typeName = ""; }
            if (typeName !== "CitadelPlayersListEntry") return;
            name = MuteWatch.entryName(panel);
            if (seen[name]) return;
            seen[name] = true;
            names.push(name);
            if (panel.BHasClass && panel.BHasClass("IsMuted")) muted.push(name);
        });
        if (!MuteWatch.unique(names)) return null;
        return { names: names, muted: muted };
    },

    lastRoster: "",

    namesOf: function(keys) {
        if (!keys || !keys.muted) return MuteWatch.lastNames;
        return keys.muted.join("\n");
    },

    hold: function(raw) {
        var top = MuteWatch.top();
        var holder;
        if (!top || !top.FindChild) return;
        holder = top.FindChild("CommendMuteHold");
        if (!holder) {
            try { holder = $.CreatePanel("Panel", top, "CommendMuteHold"); } catch (e) { holder = null; }
        }
        if (!holder) return;
        holder.hittest = false;
        holder.visible = false;
        try { holder.SetAttributeString("cs_mutes", raw || ""); } catch (e2) {}
    },

    publish: function(raw) {
        var pnl;
        var guard;
        MuteWatch.lastNames = raw || "";
        MuteWatch.hold(MuteWatch.lastNames);
        try { pnl = $.GetContextPanel(); } catch (e) { pnl = null; }
        guard = 0;
        while (pnl && guard < 50) {
            try { pnl.SetAttributeString("cs_mutes", MuteWatch.lastNames); } catch (e2) {}
            if (!pnl.GetParent || !pnl.GetParent()) break;
            pnl = pnl.GetParent();
            guard++;
        }
        try {
            $.DispatchEvent("ClientUI_FireOutput", JSON.stringify({
                cs: 1,
                t: "mutes",
                names: MuteWatch.lastNames,
                roster: MuteWatch.lastRoster
            }));
        } catch (e3) {}
    },

    writeMutes: function(keys) {
        var raw;
        if (keys === null) {
            MuteWatch.publish(MuteWatch.lastNames);
            return;
        }
        MuteWatch.lastRoster = keys.names.join("\n");
        raw = MuteWatch.namesOf(keys);
        if (!raw && MuteWatch.lastNames) {
            MuteWatch.emptyStreak = MuteWatch.emptyStreak + 1;
            if (MuteWatch.emptyStreak < 6) {
                MuteWatch.publish(MuteWatch.lastNames);
                return;
            }
        } else {
            MuteWatch.emptyStreak = 0;
        }
        MuteWatch.publish(raw);
    },

    writeCfg: function() {
        var root = MuteWatch.top();
        var raw;
        if (!root || !root.SetAttributeString) return;
        raw = (MuteWatch.values.showTeam ? "1" : "0") + "|" +
            (MuteWatch.values.showEnemy ? "1" : "0") + "|" +
            (MuteWatch.values.showAll ? "1" : "0") + "|" +
            (MuteWatch.values.showUnmuted ? "1" : "0");
        try { root.SetAttributeString("cs_show", raw); } catch (e) {}
    },

    register: function() {
        try {
            $.DispatchEvent("ClientUI_FireOutput", JSON.stringify({
                umm: 1,
                t: "register",
                id: "commend-split",
                name: "Commend Split Buttons",
                settings: [
                    { id: "showTeam", type: "toggle", label: "Show Team button", "default": true },
                    { id: "showEnemy", type: "toggle", label: "Show Enemy button", "default": true },
                    { id: "showAll", type: "toggle", label: "Show All button", "default": true },
                    { id: "showUnmuted", type: "toggle", label: "Show Unmuted button", "default": true }
                ],
                values: {
                    showTeam: !!MuteWatch.values.showTeam,
                    showEnemy: !!MuteWatch.values.showEnemy,
                    showAll: !!MuteWatch.values.showAll,
                    showUnmuted: !!MuteWatch.values.showUnmuted
                }
            }));
        } catch (e) {}
    },

    onMsg: function(raw) {
        var msg;
        if (typeof raw !== "string") return;
        if (raw.indexOf('"cs"') !== -1) {
            try { msg = JSON.parse(raw); } catch (e0) { msg = null; }
            if (msg && msg.cs === 1 && msg.t === "want") MuteWatch.publish(MuteWatch.lastNames);
        }
        if (raw.indexOf('"umm"') === -1) return;
        try { msg = JSON.parse(raw); } catch (e) { return; }
        if (!msg || msg.umm !== 1) return;
        if (msg.t === "hello") {
            MuteWatch.register();
            return;
        }
        if (msg.t === "set" && msg.id === "commend-split" && msg.key && MuteWatch.values.hasOwnProperty(msg.key)) {
            MuteWatch.values[msg.key] = !!msg.value;
            MuteWatch.writeCfg();
        }
    },

    tick: function() {
        try {
            MuteWatch.writeMutes(MuteWatch.collect());
        } catch (e) {}
        $.Schedule(0.5, MuteWatch.tick);
    }
};

try {
    $.RegisterForUnhandledEvent("ClientUI_FireOutput", MuteWatch.onMsg);
} catch (e) {}
MuteWatch.register();
MuteWatch.writeCfg();
MuteWatch.tick();

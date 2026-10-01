var g_lastMatchId = "";
var g_lastObservedScreen = "";
var g_isFreshPostMatch = false;
var g_hasClickedAll = false;
var g_busMutes = "";
var g_rosterNames = {};
var g_rosterReady = false;
var g_muteAsks = 16;

var Umm = {
    id: "commend-split",
    name: "Commend Split Buttons",
    values: {
        showTeam: true,
        showEnemy: true,
        showAll: true,
        showUnmuted: true,
        showReturn: true
    },

    register: function() {
        var settings = [
            { id: "showTeam", type: "toggle", label: "Show Team button", "default": true },
            { id: "showEnemy", type: "toggle", label: "Show Enemy button", "default": true },
            { id: "showAll", type: "toggle", label: "Show All button", "default": true },
            { id: "showUnmuted", type: "toggle", label: "Show Unmuted button", "default": true },
            { id: "showReturn", type: "toggle", label: "Show Return button", "default": true }
        ];
        var msg = {
            umm: 1,
            t: "register",
            id: Umm.id,
            name: Umm.name,
            settings: settings,
            values: {
                showTeam: !!Umm.values.showTeam,
                showEnemy: !!Umm.values.showEnemy,
                showAll: !!Umm.values.showAll,
                showUnmuted: !!Umm.values.showUnmuted,
                showReturn: !!Umm.values.showReturn
            }
        };
        try {
            $.DispatchEvent("ClientUI_FireOutput", JSON.stringify(msg));
        } catch (e) {}
    },

    apply: function(root) {
        if (!root) root = Utils.getRoot();
        if (!root) return;
        Umm.setClassVisible(root, "AutoCommendTeam", !!Umm.values.showTeam);
        Umm.setClassVisible(root, "AutoCommendEnemy", !!Umm.values.showEnemy);
        Umm.setClassVisible(root, "AutoCommendAll", !!Umm.values.showAll);
        Umm.setClassVisible(root, "AutoCommendUnmuted", !!Umm.values.showUnmuted);
        Umm.setClassVisible(root, "AutoCommendReturn", !!Umm.values.showReturn);
    },

    setClassVisible: function(root, className, isOn) {
        var list = root.FindChildrenWithClassTraverse(className) || [];
        var i;
        for (i = 0; i < list.length; i++) {
            Utils.setPanelState(list[i], isOn);
        }
    },

    onMsg: function(raw) {
        var msg;
        if (typeof raw !== "string" || raw.indexOf('"umm"') === -1) return;
        try {
            msg = JSON.parse(raw);
        } catch (e) {
            return;
        }
        if (!msg || msg.umm !== 1) return;
        if (msg.t === "hello") {
            Umm.register();
            return;
        }
        if (msg.t === "set" && msg.id === Umm.id && msg.key) {
            Umm.values[msg.key] = !!msg.value;
            Umm.apply(null);
        }
    }
};

var Utils = {
    getRoot: function() {
        var pnl = $.GetContextPanel();
        var guard = 0;
        while (pnl && pnl.GetParent && pnl.GetParent() && guard < 50) {
            pnl = pnl.GetParent();
            guard++;
        }
        return pnl || null;
    },

    getPostGameRoot: function(root) {
        if (!root || !root.FindChildTraverse) {
            return null;
        }
        return root.FindChildTraverse("CitadelPostGameNew");
    },

    hasClass: function(panel, className) {
        return !!(panel && panel.IsValid && panel.IsValid() && panel.BHasClass && panel.BHasClass(className));
    },

    setClass: function(panel, className, shouldHaveClass) {
        if (!panel || !panel.IsValid || !panel.IsValid()) return;
        if (shouldHaveClass) {
            panel.AddClass(className);
        } else {
            panel.RemoveClass(className);
        }
    },

    clickPanel: function(panel) {
        if (!panel || !panel.IsValid || !panel.IsValid()) return false;
        try { $.DispatchEvent("Activated", panel, "mouse"); } catch (e) {}
        try { $.DispatchEvent("MouseActivate", panel, "mouse"); } catch (e2) {}
        try { $.DispatchEvent("onactivate", panel); } catch (e3) {}
        return true;
    },

    setPanelState: function(panel, isVisible) {
        if (!panel || !panel.IsValid || !panel.IsValid()) return;
        panel.style.opacity = isVisible ? "1" : "0";
        panel.style.visibility = isVisible ? "visible" : "collapse";
        panel.enabled = isVisible;
        panel.hittest = !!isVisible;
    },

    toggleCustomButtons: function(root, isVisible) {
        var rows = root.FindChildrenWithClassTraverse("AutoCommendRow") || [];
        var i;
        for (i = 0; i < rows.length; i++) {
            Utils.setPanelState(rows[i], isVisible);
        }
    },

    isPanelVisible: function(panel) {
        if (!panel || !panel.IsValid || !panel.IsValid() || !panel.visible) {
            return false;
        }
        if (panel.style) {
            if (panel.style.visibility === "collapse") return false;
            if (panel.style.opacity === "0") return false;
        }
        return true;
    },

    viewerCanCommend: function(root) {
        var scope = Utils.getPostGameRoot(root) || root;
        var panels;
        if (!scope) return false;
        if (scope.BHasClass && scope.BHasClass("CanCommendPlayers")) return true;
        if (!scope.FindChildrenWithClassTraverse) return false;
        panels = scope.FindChildrenWithClassTraverse("CanCommendPlayers") || [];
        return panels.length > 0;
    },

    hasPlayAgainButton: function(root) {
        var playAgainButton = root ? root.FindChildTraverse("PlayAgainButton") : null;
        return !!(playAgainButton && playAgainButton.IsValid && playAgainButton.IsValid());
    },

    getCurrentScreen: function(root) {
        var postGameRoot = Utils.getPostGameRoot(root);
        if (Utils.hasClass(postGameRoot, "SelectedScreen_MVP")) return "MVP";
        if (Utils.hasClass(postGameRoot, "SelectedScreen_Team1")) return "Team1";
        if (Utils.hasClass(postGameRoot, "SelectedScreen_Team2")) return "Team2";
        if (Utils.hasClass(postGameRoot, "SelectedScreen_Scoreboard")) return "Scoreboard";
        if (Utils.hasClass(postGameRoot, "SelectedScreen_Graphs")) return "Graphs";
        if (Utils.hasClass(postGameRoot, "SelectedScreen_LocalPlayer")) return "LocalPlayer";
        if (Utils.hasClass(postGameRoot, "SelectedScreen_Ranked")) return "Ranked";
        if (Utils.hasClass(postGameRoot, "SelectedScreen_HeroReleaseVoteResults")) return "HeroVote";
        return "";
    },

    getRowScreen: function(row) {
        var id;
        if (!row) return "";
        id = row.id || "";
        if (id.indexOf("AutoCommendRowMVP") === 0) return "MVP";
        if (id.indexOf("AutoCommendRowTeam1") === 0) return "Team1";
        if (id.indexOf("AutoCommendRowTeam2") === 0) return "Team2";
        if (id.indexOf("AutoCommendRowScoreboard") === 0) return "Scoreboard";
        return "";
    },

    ancestorHasClass: function(panel, className) {
        var p = panel;
        var guard = 0;
        while (p && guard < 40) {
            if (Utils.hasClass(p, className)) return true;
            p = p.GetParent ? p.GetParent() : null;
            guard++;
        }
        return false;
    },

    getTeamKey: function(panel) {
        var p = panel;
        var guard = 0;
        var id;

        while (p && guard < 50) {
            id = p.id || "";
            if (id === "Team1" || id === "Team1Screen" || id === "Team1Players") return "Team1";
            if (id === "Team2" || id === "Team2Screen" || id === "Team2Players") return "Team2";
            if (id.indexOf("Team1") === 0) return "Team1";
            if (id.indexOf("Team2") === 0) return "Team2";
            if (Utils.hasClass(p, "Team1") || Utils.hasClass(p, "team1")) return "Team1";
            if (Utils.hasClass(p, "Team2") || Utils.hasClass(p, "team2")) return "Team2";
            p = p.GetParent ? p.GetParent() : null;
            guard++;
        }
        return "";
    },

    normalizeKey: function(s) {
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

    getPlayerRow: function(panel) {
        var p = panel;
        var guard = 0;
        var type;
        var fallback = panel;
        while (p && guard < 40) {
            if (Utils.hasClass(p, "Player")) return p;
            if (Utils.hasClass(p, "CitadelPlayersListEntry")) return p;
            try { type = p.paneltype || ""; } catch (e) { type = ""; }
            if (type === "CitadelPlayersListEntry") return p;
            if (Utils.hasClass(p, "PlayerActionContainer")) fallback = p;
            p = p.GetParent ? p.GetParent() : null;
            guard++;
        }
        return fallback;
    },

    harvestIdentity: function(row, keys) {
        var ids;
        var i;
        var node;
        var txt;
        if (!row || !keys) return;

        function push(v) {
            v = Utils.normalizeKey(v);
            if (v && v.length > 1) keys[v] = true;
        }

        ids = ["PlayerName", "AccountID", "MVPPlayerName"];
        for (i = 0; i < ids.length; i++) {
            if (!row.FindChildTraverse) continue;
            node = row.FindChildTraverse(ids[i]);
            if (!node) continue;
            try { if (node.text) push(node.text); } catch (e) {}
        }

        if (row.FindChildrenWithClassTraverse) {
            node = ["PlayerName", "PlayerHero", "HeroName"];
            for (i = 0; i < node.length; i++) {
                ids = row.FindChildrenWithClassTraverse(node[i]) || [];
                for (txt = 0; txt < ids.length; txt++) {
                    try { if (ids[txt].text) push(ids[txt].text); } catch (eClass) {}
                }
            }
        }

        try {
            if (row.paneltype === "CitadelUserName" && row.text) push(row.text);
        } catch (e2) {}

        try {
            txt = row.GetAttributeString("account_id", "");
            if (txt) push(txt);
            txt = row.GetAttributeString("accountid", "");
            if (txt) push(txt);
        } catch (e3) {}
    },

    collectMutedKeys: function(root) {
        var keys = {};
        var panels;
        var i;
        var row;
        if (!root) return keys;
        panels = root.FindChildrenWithClassTraverse("IsMuted") || [];
        for (i = 0; i < panels.length; i++) {
            row = Utils.getPlayerRow(panels[i]);
            Utils.harvestIdentity(row, keys);
            Utils.harvestIdentity(panels[i], keys);
        }
        Utils.readSharedMutes(keys);
        return keys;
    },

    addMuteBlob: function(keys, raw) {
        var parts;
        var i;
        var name;
        if (!keys || !raw) return;
        parts = String(raw).split("\n");
        for (i = 0; i < parts.length; i++) {
            name = Utils.normalizeKey(parts[i]);
            if (name && name.length > 1) keys[name] = true;
        }
    },

    readSharedMutes: function(keys) {
        var root;
        var raw;
        var hold;
        var held;
        if (!keys) return;
        root = Utils.getRoot();
        raw = "";
        if (root && root.GetAttributeString) {
            try { raw = root.GetAttributeString("cs_mutes", ""); } catch (e) { raw = ""; }
        }
        if (root && root.FindChildTraverse) {
            hold = root.FindChildTraverse("CommendMuteHold");
            if (hold && hold.GetAttributeString) {
                try {
                    held = hold.GetAttributeString("cs_mutes", "");
                    if (held) raw = held;
                } catch (e2) {}
            }
        }
        Utils.addMuteBlob(keys, raw);
        Utils.addMuteBlob(keys, g_busMutes);
    },

    readSharedCfg: function() {
        var root;
        var raw;
        var parts;
        if (!Utils.getRoot) return;
        root = Utils.getRoot();
        if (!root || !root.GetAttributeString) return;
        try { raw = root.GetAttributeString("cs_show", ""); } catch (e) { raw = ""; }
        if (!raw) return;
        parts = String(raw).split("|");
        if (parts.length < 4) return;
        Umm.values.showTeam = parts[0] === "1";
        Umm.values.showEnemy = parts[1] === "1";
        Umm.values.showAll = parts[2] === "1";
        Umm.values.showUnmuted = parts[3] === "1";
        if (parts.length > 4) Umm.values.showReturn = parts[4] === "1";
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

    playerLabel: function(row) {
        var label;
        var labels;
        if (!row) return "";
        label = row.FindChildTraverse ? row.FindChildTraverse("PlayerName") : null;
        if (!label && row.FindChildTraverse) label = row.FindChildTraverse("MVPPlayerName");
        if (!label && row.FindChildrenWithClassTraverse) {
            labels = row.FindChildrenWithClassTraverse("PlayerName") || [];
            label = labels.length ? labels[0] : null;
        }
        return Utils.normalizeKey(Utils.firstText(label));
    },

    isMutedTarget: function(target, mutedKeys) {
        var name;
        if (!target) return true;
        if (!g_rosterReady) return true;
        if (Utils.ancestorHasClass(target.host, "IsMuted")) return true;
        if (Utils.ancestorHasClass(target.btn, "IsMuted")) return true;
        name = Utils.playerLabel(Utils.getPlayerRow(target.host));
        if (!name || !g_rosterNames[name]) return true;
        return !!mutedKeys[name];
    },

    isLocalPlayerPanel: function(panel) {
        var p = panel;
        var guard = 0;

        while (p && guard < 50) {
            if (Utils.hasClass(p, "IsLocalPlayer")) return true;
            if (Utils.hasClass(p, "LocalPlayer")) return true;
            if (Utils.hasClass(p, "local_player")) return true;
            if (Utils.hasClass(p, "IsLocal")) return true;
            if (Utils.hasClass(p, "TotalsRow")) return true;
            if ((p.id || "") === "LocalPlayerIdentifier") return true;
            p = p.GetParent ? p.GetParent() : null;
            guard++;
        }
        return false;
    },

    canReturnTarget: function(target) {
        var btn = target && target.btn;
        var host = (target && target.host) || btn;
        var id = (btn && btn.id) || "";

        if (!btn || target.kind !== "back") return false;
        if (id === "ReturnButton") return true;
        if (Utils.hasClass(btn, "CanReturnCommend") || Utils.hasClass(host, "CanReturnCommend")) return true;
        if (Utils.hasClass(btn, "CommendReturned") || Utils.hasClass(host, "CommendReturned")) return false;
        return false;
    },

    isAlreadyCommended: function(panel) {
        var p = panel;
        var guard = 0;
        while (p && guard < 40) {
            if (Utils.hasClass(p, "CommendedPlayer")) return true;
            if (Utils.hasClass(p, "AlreadyCommended")) return true;
            if (Utils.hasClass(p, "CommendReturned")) return true;
            if (Utils.hasClass(p, "CantCommend")) return true;
            if (Utils.hasClass(p, "MVPCantCommend")) return true;
            p = p.GetParent ? p.GetParent() : null;
            guard++;
        }
        return false;
    },

    commendHost: function(panel) {
        var p = panel;
        var guard = 0;
        var fallback = panel;
        while (p && guard < 30) {
            if (Utils.hasClass(p, "MVPHonorableMention")) return p;
            if (Utils.hasClass(p, "CanReturnCommend")) return p;
            if (Utils.hasClass(p, "Player")) return p;
            if (Utils.hasClass(p, "MVPDetails")) return p;
            if ((p.id || "") === "MVPHeroScenePanelMask") fallback = p;
            p = p.GetParent ? p.GetParent() : null;
            guard++;
        }
        return fallback;
    },

    targetKind: function(panel) {
        var id;
        if (!panel) return "";
        id = panel.id || "";
        if (id === "CommendPlayerButton") return "button";
        if (id === "HeroScenePanelMask" || id === "MVPHeroScenePanelMask") return "mask";
        if (id === "ReturnButton") return "back";
        if (Utils.hasClass(panel, "CanReturnCommend")) return "back";
        if (Utils.hasClass(panel, "CommendButton") || id === "MVPCommendButton") return "button";
        return "";
    },

    isOurButton: function(button) {
        if (!button) return true;
        if (Utils.hasClass(button, "AutoCommendStyle")) return true;
        if ((button.id || "").indexOf("AutoCommend") === 0) return true;
        return false;
    },

    findLocalTeamKey: function(root) {
        var containers;
        var i;
        var container;
        var key;
        var classes;
        var found;

        if (!root) return "";

        containers = root.FindChildrenWithClassTraverse("PlayerActionContainer") || [];
        for (i = 0; i < containers.length; i++) {
            container = containers[i];
            if (Utils.isLocalPlayerPanel(container)) {
                key = Utils.getTeamKey(container);
                if (key) return key;
            }
        }

        classes = ["LocalPlayer", "Local", "IsLocalPlayer", "local_player"];
        for (i = 0; i < classes.length; i++) {
            found = root.FindChildrenWithClassTraverse(classes[i]) || [];
            if (found.length) {
                key = Utils.getTeamKey(found[0]);
                if (key) return key;
            }
        }

        return "";
    },

    collectCommendTargets: function(root) {
        var targets = [];

        function add(button, kind) {
            var host;
            var idx;
            if (!button || !button.IsValid || !button.IsValid()) return;
            if (Utils.isOurButton(button)) return;
            if (!kind) kind = Utils.targetKind(button);
            if (!kind) return;
            host = Utils.commendHost(button);
            for (idx = 0; idx < targets.length; idx++) {
                if (targets[idx].btn === button) return;
            }
            targets.push({ btn: button, host: host, kind: kind });
        }

        function walk(panel) {
            var i;
            var n;
            var kind;
            if (!panel || !panel.IsValid || !panel.IsValid()) return;
            kind = Utils.targetKind(panel);
            if (kind) add(panel, kind);
            n = panel.GetChildCount ? panel.GetChildCount() : 0;
            for (i = 0; i < n; i++) walk(panel.GetChild(i));
        }

        walk(root);
        return targets;
    },

    targetMatchesMode: function(target, mode, localTeam, mutedKeys) {
        var team;
        var id;
        if (!target || !target.btn) return false;
        if (Utils.isLocalPlayerPanel(target.host) || Utils.isLocalPlayerPanel(target.btn)) return false;
        if (mode === "return") return Utils.canReturnTarget(target);
        if (Utils.isAlreadyCommended(target.host) || Utils.isAlreadyCommended(target.btn)) return false;
        id = target.btn.id || "";
        if (id === "MVPHeroScenePanelMask" && Utils.ancestorHasClass(target.btn, "MVPAlreadyCommended")) return false;
        if (mode === "unmuted") {
            return !Utils.isMutedTarget(target, mutedKeys || {});
        }
        if (mode === "all") return true;
        team = Utils.getTeamKey(target.host);
        if (!team || !localTeam) return false;
        if (mode === "team") return team === localTeam;
        if (mode === "enemy") return team !== localTeam;
        return false;
    },

    syncButtonVisibility: function(root) {
        var rows;
        var currentScreen;
        var i;
        var row;
        var rowScreen;
        var shouldShowCommend;
        var canCommend;

        if (!root) return;

        Utils.readSharedCfg();
        rows = root.FindChildrenWithClassTraverse("AutoCommendRow") || [];
        currentScreen = Utils.getCurrentScreen(root);
        canCommend = Utils.viewerCanCommend(root);

        if (g_hasClickedAll || Utils.hasClass(Utils.getPostGameRoot(root), "AutoCommendCompleted")) {
            g_hasClickedAll = true;
            Utils.toggleCustomButtons(root, false);
            return;
        }

        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            rowScreen = Utils.getRowScreen(row);
            shouldShowCommend = canCommend && currentScreen === rowScreen;
            Utils.setPanelState(row, shouldShowCommend);
        }

        Umm.apply(root);
    }
};

function ResetCommendState(root) {
    var targets;
    var autoButtons;
    var i;

    g_hasClickedAll = false;
    Utils.setClass(Utils.getPostGameRoot(root), "AutoCommendCompleted", false);

    targets = Utils.collectCommendTargets(root);
    for (i = 0; i < targets.length; i++) {
        if (targets[i].btn) targets[i].btn.RemoveClass("ac_done");
    }

    autoButtons = root.FindChildrenWithClassTraverse("AutoCommendStyle") || [];
    for (i = 0; i < autoButtons.length; i++) {
        if (autoButtons[i]) autoButtons[i].RemoveClass("ac_done");
    }
}

function CheckForNewMatch() {
    var root = Utils.getRoot();
    var matchIdLabel;
    var currentMatchId;
    var currentScreen;

    if (root) {
        matchIdLabel = root.FindChildTraverse("MatchID");
        currentMatchId = matchIdLabel ? matchIdLabel.text : "";
        currentScreen = Utils.getCurrentScreen(root);

        if (currentMatchId && currentMatchId !== g_lastMatchId) {
            g_lastMatchId = currentMatchId;
            g_lastObservedScreen = currentScreen;
            g_isFreshPostMatch = currentScreen === "MVP";
            Utils.toggleCustomButtons(root, true);
            ResetCommendState(root);
        } else if (currentScreen && currentScreen !== g_lastObservedScreen) {
            g_lastObservedScreen = currentScreen;
        }

        Utils.syncButtonVisibility(root);
    }

    $.Schedule(0.25, CheckForNewMatch);
}

function CommendByMode(mode) {
    var root = Utils.getRoot();
    var targets;
    var localTeam;
    var mutedKeys;
    var i;
    var target;
    var btn;

    if (!root) return;
    if (!Utils.viewerCanCommend(root)) return;

    localTeam = Utils.findLocalTeamKey(root);
    targets = Utils.collectCommendTargets(root);
    mutedKeys = Utils.collectMutedKeys(root);
    targets.sort(function(a, b) {
        function rank(kind) {
            if (kind === "button") return 0;
            if (kind === "mask") return 1;
            return 2;
        }
        return rank(a.kind) - rank(b.kind);
    });

    var seenNames = {};
    for (i = 0; i < targets.length; i++) {
        target = targets[i];
        btn = target.btn;
        if (!btn || !btn.IsValid || !btn.IsValid()) continue;
        if (mode !== "return" && btn.BHasClass("ac_done")) continue;
        if (!Utils.targetMatchesMode(target, mode, localTeam, mutedKeys)) continue;
        if (mode !== "return") {
            var seenName = Utils.playerLabel(target.host);
            if (seenName && seenNames[seenName]) continue;
            if (seenName) seenNames[seenName] = true;
        }
        Utils.clickPanel(btn);
        if (target.kind === "mask" || target.kind === "back") {
            try { $.DispatchEvent("CitadelPostGameCommendPlayer", btn); } catch (e) {}
        }
        if (mode === "return") btn.RemoveClass("ac_done");
        else btn.AddClass("ac_done");
    }

    if (mode === "all") {
        g_hasClickedAll = true;
        Utils.setClass(Utils.getPostGameRoot(root), "AutoCommendCompleted", true);
        Utils.toggleCustomButtons(root, false);
    }
}

function CommendTeam() {
    CommendByMode("team");
}

function CommendEnemy() {
    CommendByMode("enemy");
}

function CommendAll() {
    CommendByMode("all");
}

function CommendUnmuted() {
    CommendByMode("unmuted");
}

function CommendReturn() {
    CommendByMode("return");
}

function OnCommendBus(raw) {
    var msg;
    var parts;
    var i;
    var name;
    var count;
    if (typeof raw !== "string" || raw.indexOf('"cs"') === -1) return;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || msg.cs !== 1 || msg.t !== "mutes") return;
    if (typeof msg.names === "string") g_busMutes = msg.names;
    if (typeof msg.roster !== "string" || !msg.roster) return;
    g_rosterNames = {};
    count = 0;
    parts = msg.roster.split("\n");
    for (i = 0; i < parts.length; i++) {
        name = Utils.normalizeKey(parts[i]);
        if (!name || g_rosterNames[name]) continue;
        g_rosterNames[name] = true;
        count = count + 1;
    }
    g_rosterReady = count >= 2;
}

try {
    $.RegisterForUnhandledEvent("ClientUI_FireOutput", Umm.onMsg);
} catch (e) {}
try {
    $.RegisterForUnhandledEvent("ClientUI_FireOutput", OnCommendBus);
} catch (e2) {}
function AskMutes() {
    try {
        $.DispatchEvent("ClientUI_FireOutput", JSON.stringify({ cs: 1, t: "want" }));
    } catch (e) {}
    g_muteAsks = g_muteAsks - 1;
    if (g_muteAsks > 0) $.Schedule(0.25, AskMutes);
}
AskMutes();
Umm.register();
Utils.readSharedCfg();
CheckForNewMatch();

(function () {
  "use strict";

  var MIN_ACCOUNT_ID = 100000;
  var MAX_ACCOUNT_ID = 4294967295;
  var STATLOCKER_BASE_URL = "https://statlocker.gg/profile";

  function normalizeAccountText(value) {
    var text = String(value === undefined || value === null ? "" : value)
      .replace(/<[^>]*>/g, "")
      .replace(/[^0-9]/g, "");
    var numberValue;
    if (!/^\d{6,10}$/.test(text)) return "";
    text = text.replace(/^0+/, "") || "0";
    numberValue = Number(text);
    return isFinite(numberValue) && numberValue >= MIN_ACCOUNT_ID && numberValue <= MAX_ACCOUNT_ID
      ? text
      : "";
  }

  function buildStatlockerUrl(accountId) {
    var account = normalizeAccountText(accountId);
    return account ? STATLOCKER_BASE_URL + "/" + encodeURIComponent(account) : "";
  }

  function installPanorama() {
    var root = $.GetContextPanel();
    function isValid(panel) {
      try { return !!panel && (!panel.IsValid || panel.IsValid()); } catch (e0) { return false; }
    }

    function findChild(panel, id) {
      try { return panel && panel.FindChildTraverse ? panel.FindChildTraverse(id) : null; } catch (e0) { return null; }
    }

    function hasClass(panel, className) {
      try { return !!panel && panel.BHasClass && panel.BHasClass(className); } catch (e0) { return false; }
    }

    function readText(panel) {
      var value = "";
      if (!panel) return "";
      try { value = panel.text; } catch (e0) {}
      if (!value) try { value = panel.GetAttributeString("text", ""); } catch (e1) {}
      return String(value || "");
    }

    function readAttribute(panel, name) {
      try { return panel && panel.GetAttributeString ? panel.GetAttributeString(name, "") : ""; } catch (e0) { return ""; }
    }

    function readProperty(panel, name) {
      try { return panel && panel[name] !== undefined ? String(panel[name] || "") : ""; } catch (e0) { return ""; }
    }

    function accountForRow(row) {
      var playerName = findChild(row, "PlayerName");
      var candidates = [
        readText(findChild(row, "FriendsRankScoreboardAccountID")),
        readText(findChild(row, "FriendsRankScoreboardAccountIDDirect")),
        readText(findChild(row, "FriendsRankScoreboardPlayerAccountID")),
        readText(findChild(row, "FriendsRankScoreboardPlayerAccountIDRoot")),
        readAttribute(playerName, "accountid"),
        readAttribute(playerName, "account_id"),
        readAttribute(playerName, "player_account_id"),
        readProperty(playerName, "accountid"),
        readProperty(playerName, "account_id"),
        readProperty(playerName, "player_account_id"),
        readAttribute(row, "account_id"),
        readAttribute(row, "accountid"),
        readAttribute(row, "player_account_id"),
        readProperty(row, "accountid"),
        readProperty(row, "account_id"),
        readProperty(row, "player_account_id"),
      ];
      var i;
      var account;
      for (i = 0; i < candidates.length; i += 1) {
        account = normalizeAccountText(candidates[i]);
        if (account) return account;
      }
      return "";
    }

    function openUrl(url) {
      if (!url) return false;
      try {
        $.DispatchEvent("ExternalBrowserGoToURL", url);
        return true;
      } catch (e0) {}
      try {
        if (typeof SteamOverlayAPI !== "undefined" && SteamOverlayAPI && SteamOverlayAPI.OpenURL) {
          SteamOverlayAPI.OpenURL(url);
          return true;
        }
      } catch (e1) {}
      return false;
    }

    function collectRows(panel, result, depth) {
      var count;
      var i;
      var child;
      if (!isValid(panel) || depth > 12) return;
      if (hasClass(panel, "Player")) result.push(panel);
      try { count = panel.GetChildCount ? panel.GetChildCount() : 0; } catch (e0) { count = 0; }
      for (i = 0; i < count; i += 1) {
        try { child = panel.GetChild(i); } catch (e1) { child = null; }
        collectRows(child, result, depth + 1);
      }
    }

    function bindTarget(target, row) {
      if (!isValid(target) || readAttribute(target, "friends_rank_statlocker_bound") === "1") return false;
      try {
        target.SetAttributeString("friends_rank_statlocker_bound", "1");
        target.SetPanelEvent("onactivate", function () {
          var url = buildStatlockerUrl(accountForRow(row));
          if (url) openUrl(url);
        });
        return true;
      } catch (e0) {}
      return false;
    }

    function bindScoreboardOnce(attempt) {
      var rows = [];
      var i;
      collectRows(root, rows, 0);
      for (i = 0; i < rows.length; i += 1) {
        bindTarget(findChild(rows[i], "FriendsRankScoreboardStatlockerButton"), rows[i]);
      }
      if (attempt < 8) {
        try { $.Schedule(0.15, function () { bindScoreboardOnce(attempt + 1); }); } catch (e0) {}
      }
    }

    if (hasClass(root, "FriendsRankPostGameScoreboard") || hasClass(root, "FriendsRankPostGameTeam"))
      bindScoreboardOnce(0);
  }

  var TEST_API = {
    normalizeAccountText: normalizeAccountText,
    buildStatlockerUrl: buildStatlockerUrl,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = TEST_API;
  if (typeof $ !== "undefined" && $) installPanorama();
})();

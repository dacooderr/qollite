(function () {
  "use strict";

  var DEFAULT_CONFIG = {
    version: 16,
    debug: false,
    apiBaseUrl: "https://api.deadlock-api.com/v1/players",
    imageFormat: "webp",
    cacheTtlMs: 600000,
    minimumAccountId: 100000,
    maximumAccountId: 4294967295,
    popupReadyTimeoutMs: 5000,
    popupPollSeconds: 0.1,
    popupSettleMs: 750,
    popupEmptyPresenceSettleMs: 1500,
    stableChecksRequired: 2,
    mainProfileSettleMs: 2000,
    popupGuardIntervalSeconds: 0.016,
    failureCooldownMs: 15000,
    statlockerBaseUrl: "https://statlocker.gg/profile",
    activeWatchMs: 8000,
    activeWatchFastMs: 2500,
    activeWatchFastIntervalSeconds: 0.2,
    activeWatchIdleIntervalSeconds: 0.5,
  };
  var STEAM64_BASE = "76561197960265728";
  var STATE_CLASSES = [
    "FriendsRankStateResolving",
    "FriendsRankStateRequested",
    "FriendsRankStateUnavailable",
    "FriendsRankStateWaiting",
  ];

  function copyConfig(source) {
    var result = {};
    var key;
    for (key in DEFAULT_CONFIG)
      if (Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, key))
        result[key] = DEFAULT_CONFIG[key];
    for (key in source)
      if (source && Object.prototype.hasOwnProperty.call(source, key))
        result[key] = source[key];
    return result;
  }

  function cleanDecimal(value) {
    return String(value || "").replace(/^0+/, "") || "0";
  }

  function compareDecimal(left, right) {
    var a = cleanDecimal(left);
    var b = cleanDecimal(right);
    if (a.length !== b.length) return a.length > b.length ? 1 : -1;
    if (a === b) return 0;
    return a > b ? 1 : -1;
  }

  function subtractDecimal(left, right) {
    var a = cleanDecimal(left);
    var b = cleanDecimal(right);
    var result = "";
    var borrow = 0;
    var ai = a.length - 1;
    var bi = b.length - 1;
    var digit;
    if (compareDecimal(a, b) < 0) return "";
    while (ai >= 0) {
      digit = Number(a.charAt(ai)) - borrow - (bi >= 0 ? Number(b.charAt(bi)) : 0);
      if (digit < 0) {
        digit += 10;
        borrow = 1;
      } else {
        borrow = 0;
      }
      result = String(digit) + result;
      ai -= 1;
      bi -= 1;
    }
    return cleanDecimal(result);
  }

  function normalizeWhitespace(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .replace(/^\s+|\s+$/g, "");
  }

  function isValidAccountId(value, config) {
    var text = String(value || "");
    var numberValue = /^\d{1,10}$/.test(text) ? Number(text) : NaN;
    return (
      isFinite(numberValue) &&
      numberValue >= config.minimumAccountId &&
      numberValue <= config.maximumAccountId
    );
  }

  function steam64ToAccountId(value, config) {
    var text = normalizeWhitespace(value);
    var account;
    if (!/^\d{17}$/.test(text)) return "";
    account = subtractDecimal(text, STEAM64_BASE);
    return isValidAccountId(account, config) ? account : "";
  }

  function normalizeDigits(value, config) {
    var digits = String(value || "").replace(/[^0-9]/g, "").replace(/^0+/, "") || "0";
    if (digits === "0") return "";
    if (digits.length === 17) return steam64ToAccountId(digits, config);
    return isValidAccountId(digits, config) ? digits : "";
  }

  function addUniqueCandidate(candidates, value) {
    var i;
    if (!value) return;
    for (i = 0; i < candidates.length; i += 1)
      if (candidates[i] === value) return;
    candidates.push(value);
  }

  function normalizeAccountText(value, customConfig) {
    var config = copyConfig(customConfig || {});
    var text = normalizeWhitespace(value);
    var candidates = [];
    var match;
    var pattern;
    var exact;
    if (!text || /[{}]/.test(text) || /^#/.test(text) || /^nan$/i.test(text))
      return "";

    match = text.match(/^\[U:1:(\d+)\]$/i);
    if (match) return isValidAccountId(match[1], config) ? cleanDecimal(match[1]) : "";
    if (/^\d{1,10}$/.test(text) || /^\d{17}$/.test(text))
      return normalizeDigits(text, config);

    pattern = /\[U:1:(\d+)\]/gi;
    while ((match = pattern.exec(text)) !== null)
      addUniqueCandidate(candidates, isValidAccountId(match[1], config) ? cleanDecimal(match[1]) : "");

    pattern = /(^|\D)(\d{17})(?!\d)/g;
    while ((match = pattern.exec(text)) !== null)
      addUniqueCandidate(candidates, steam64ToAccountId(match[2], config));

    if (/\b(?:account\s*id|friend\s*code)\b/i.test(text)) {
      exact = text.replace(/^.*?\b(?:account\s*id|friend\s*code)\b\s*:?\s*/i, "");
      if (/^[0-9\s.,'’_-]+$/.test(exact))
        addUniqueCandidate(candidates, normalizeDigits(exact, config));
      pattern = /(^|\D)(\d{6,10})(?!\d)/g;
      while ((match = pattern.exec(text)) !== null)
        addUniqueCandidate(candidates, normalizeDigits(match[2], config));
    }
    return candidates.length === 1 ? candidates[0] : "";
  }

  function reconcileAccounts(hiddenValue, visibleValue, customConfig) {
    var hidden = normalizeAccountText(hiddenValue, customConfig);
    var visible = normalizeAccountText(visibleValue, customConfig);
    return {
      account: hidden && visible && hidden !== visible ? "" : hidden || visible,
      hidden: hidden,
      visible: visible,
      mismatch: !!(hidden && visible && hidden !== visible),
    };
  }

  function buildRankImageUrl(accountId, customConfig) {
    var config = copyConfig(customConfig || {});
    var account = normalizeAccountText(accountId, config);
    var base = String(config.apiBaseUrl || "").replace(/\/+$/, "");
    if (!account || !/^https:\/\//i.test(base)) return "";
    return base + "/" + encodeURIComponent(account) + "/rank/image?format=" + encodeURIComponent(config.imageFormat || "webp");
  }

  function buildStatlockerUrl(accountId, customConfig) {
    var config = copyConfig(customConfig || {});
    var account = normalizeAccountText(accountId, config);
    var base = String(config.statlockerBaseUrl || "").replace(/\/+$/, "");
    if (!account || base !== "https://statlocker.gg/profile") return "";
    return base + "/" + encodeURIComponent(account);
  }

  function createProfileState(cacheTtlMs) {
    var state = { token: 0, renderedAccount: "", requestedUrl: "", cache: {} };
    return {
      state: state,
      begin: function () {
        state.token += 1;
        state.renderedAccount = "";
        state.requestedUrl = "";
        return state.token;
      },
      commit: function (token, account, url, now) {
        if (token !== state.token || !account || !url) return false;
        state.renderedAccount = account;
        state.requestedUrl = url;
        state.cache[account] = { url: url, storedAt: now };
        return true;
      },
      isCurrent: function (token, account) {
        return token === state.token && account === state.renderedAccount;
      },
      lookup: function (account, now) {
        var entry = state.cache[account];
        if (!entry || now - entry.storedAt > cacheTtlMs) return null;
        return entry;
      },
    };
  }

  function installPanorama() {
    var config = copyConfig($.FriendsRankConfig || {});
    var localSequence = 0;

    function debugLog(message) {
      if (!config.debug) return;
      try {
        if ($.Msg) $.Msg("[FriendsRank] " + String(message || ""));
      } catch (e0) {}
    }

    function nowMs() {
      try {
        if (Date && Date.now) return Date.now();
      } catch (e0) {}
      return 0;
    }

    function loadingText() {
      try {
        return $.Localize ? $.Localize("#Citadel_Profile_Loading") : "";
      } catch (e0) {
        return "";
      }
    }

    function isPanelValid(panel) {
      if (!panel) return false;
      try {
        return !panel.IsValid || panel.IsValid();
      } catch (e0) {
        return false;
      }
    }

    function parentOf(panel) {
      try {
        return isPanelValid(panel) && panel.GetParent ? panel.GetParent() : null;
      } catch (e0) {
        return null;
      }
    }

    function findChild(root, id) {
      try {
        if (!isPanelValid(root) || !root.FindChildTraverse) return null;
        return root.FindChildTraverse(id);
      } catch (e0) {
        return null;
      }
    }

    function findProfileRoot(panel) {
      var current = isPanelValid(panel) ? panel : $.GetContextPanel();
      var child;
      var guard = 0;
      while (isPanelValid(current) && guard < 20) {
        if (findChild(current, "FriendsRankRoot")) return current;
        child = findChild(current, "ProfileCard");
        if (isPanelValid(child) && findChild(child, "FriendsRankRoot")) return child;
        current = parentOf(current);
        guard += 1;
      }
      return null;
    }

    function readText(panel) {
      try {
        return isPanelValid(panel) ? String(panel.text || "") : "";
      } catch (e0) {
        return "";
      }
    }

    function childrenOf(panel) {
      var children = [];
      var count;
      var i;
      if (!isPanelValid(panel)) return children;
      try {
        if (panel.Children) return panel.Children() || children;
      } catch (e0) {}
      try {
        count = panel.GetChildCount ? panel.GetChildCount() : 0;
        for (i = 0; i < count; i += 1) children.push(panel.GetChild(i));
      } catch (e1) {}
      return children;
    }

    function collectTexts(panel, output, depth) {
      var children;
      var i;
      var value;
      if (!isPanelValid(panel) || depth > 8) return;
      value = readText(panel);
      if (value) output.push(value);
      children = childrenOf(panel);
      for (i = 0; i < children.length; i += 1)
        collectTexts(children[i], output, depth + 1);
    }

    function getAttribute(panel, key) {
      var value = "";
      if (!isPanelValid(panel)) return "";
      try {
        if (panel.GetAttributeString) value = panel.GetAttributeString(key, "");
      } catch (e0) {}
      if (value) return value;
      try {
        return String(panel["__" + key] || "");
      } catch (e1) {
        return "";
      }
    }

    function setAttribute(panel, key, value) {
      var text = String(value === undefined || value === null ? "" : value);
      if (!isPanelValid(panel)) return;
      try {
        if (panel.SetAttributeString) panel.SetAttributeString(key, text);
      } catch (e0) {}
      try {
        panel["__" + key] = text;
      } catch (e1) {}
    }

    function setVisible(panel, visible) {
      if (!isPanelValid(panel)) return;
      try {
        panel.visible = !!visible;
        panel.style.visibility = visible ? "visible" : "collapse";
        panel.style.opacity = visible ? "1" : "0";
      } catch (e0) {}
    }

    function setEnabled(panel, enabled) {
      if (!isPanelValid(panel)) return;
      try {
        panel.enabled = !!enabled;
        panel.hittest = !!enabled;
        panel.hittestchildren = !!enabled;
      } catch (e0) {}
    }

    function hasClass(panel, className) {
      try {
        return isPanelValid(panel) && panel.BHasClass ? panel.BHasClass(className) : false;
      } catch (e0) {
        return false;
      }
    }

    function setRootState(root, className, statusText) {
      var uiRoot = findChild(root, "FriendsRankRoot");
      var i;
      if (!isPanelValid(uiRoot)) return;
      for (i = 0; i < STATE_CLASSES.length; i += 1) {
        try {
          uiRoot.RemoveClass(STATE_CLASSES[i]);
        } catch (e0) {}
      }
      try {
        uiRoot.AddClass(className);
      } catch (e1) {}
    }

    function isMainProfile(root) {
      return isPanelValid(findChild(root, "FriendsRankProfileFriendCode"));
    }

    function isPersistentProfilePopup(root) {
      var panel = root;
      var guard = 0;
      if (!isPanelValid(root) || isMainProfile(root)) return false;
      while (isPanelValid(panel) && guard < 12) {
        if (String(panel.id || "") === "ContextMenuBody" || hasClass(panel, "ContextMenuBody")) return true;
        panel = parentOf(panel);
        guard += 1;
      }
      return false;
    }

    function isLocalPlayer(root) {
      var panel = root;
      var guard = 0;
      while (isPanelValid(panel) && guard < 5) {
        if (hasClass(panel, "isLocalPlayer")) return true;
        panel = parentOf(panel);
        guard += 1;
      }
      return false;
    }

    function panelText(panel) {
      var values = [];
      collectTexts(panel, values, 0);
      return normalizeWhitespace(values.join(" "));
    }

    function profileFingerprint(root, account) {
      return [
        account || "",
        panelText(findChild(root, "UserName")),
        panelText(findChild(root, "UserNickname")),
        String(isLocalPlayer(root)),
      ].join("|");
    }

    function profilePresence(root) {
      return panelText(findChild(root, "UserRichPresence"));
    }

    function sharedState() {
      var target = null;
      var state;
      try {
        if (typeof GameUI !== "undefined" && GameUI && typeof GameUI.CustomUIConfig === "function")
          target = GameUI.CustomUIConfig();
      } catch (e0) {
        target = null;
      }
      if (!target) target = $;
      try {
        state = target.__friendsRankV1SharedState;
        if (!state || state.version !== config.version) {
          state = { version: config.version, cache: {} };
          target.__friendsRankV1SharedState = state;
        }
      } catch (e1) {
        state = { version: config.version, cache: {} };
      }
      return state;
    }

    function externalUrlAvailable() {
      try {
        if ($ && $.DispatchEvent) return true;
      } catch (e0) {
        // Try the generic Panorama overlay API below.
      }
      try {
        return typeof SteamOverlayAPI !== "undefined" && SteamOverlayAPI && !!SteamOverlayAPI.OpenURL;
      } catch (e1) {}
      return false;
    }

    function openExternalUrl(url) {
      if (!url) return false;
      try {
        if ($ && $.DispatchEvent) {
          $.DispatchEvent("ExternalBrowserGoToURL", url);
          return true;
        }
      } catch (e0) {}
      try {
        if (typeof SteamOverlayAPI !== "undefined" && SteamOverlayAPI && SteamOverlayAPI.OpenURL) {
          SteamOverlayAPI.OpenURL(url);
          return true;
        }
      } catch (e1) {}
      return false;
    }

    function statlockerButton(root) {
      return findChild(root, isMainProfile(root) ? "FriendsRankStatlockerProfileButton" : "FriendsRankStatlockerPopupButton");
    }

    function clearStatlockerIdentity(root) {
      var button = statlockerButton(root);
      setAttribute(root, "friends_rank_statlocker_account", "");
      setAttribute(root, "friends_rank_statlocker_fingerprint", "");
      setEnabled(button, false);
      setVisible(button, false);
    }

    function commitStatlockerIdentity(root, account, fingerprint) {
      var button = statlockerButton(root);
      var available = !!buildStatlockerUrl(account, config) && externalUrlAvailable();
      var interactive = isMainProfile(root) || isPersistentProfilePopup(root);
      setAttribute(root, "friends_rank_statlocker_account", available ? account : "");
      setAttribute(root, "friends_rank_statlocker_fingerprint", available ? fingerprint : "");
      setVisible(button, available && interactive);
      if (isPanelValid(button)) {
        try {
          button.enabled = available && interactive;
          button.hittest = available && interactive;
          button.hittestchildren = available && interactive;
        } catch (e0) {}
      }
    }

    function openStatlocker(root) {
      var account = getAttribute(root, "friends_rank_statlocker_account");
      var fingerprint = getAttribute(root, "friends_rank_statlocker_fingerprint");
      var live = snapshot(root);
      var url = buildStatlockerUrl(account, config);
      if (!isMainProfile(root) && !isPersistentProfilePopup(root)) return false;
      if (!url || !externalUrlAvailable() || live.loading || live.mismatch || live.account !== account || live.fingerprint !== fingerprint)
        return false;
      if (!openExternalUrl(url)) return false;
      return true;
    }

    function cachedEntry(key, now) {
      var state = sharedState();
      var entry = state.cache[key];
      if (!entry) return null;
      if (now - Number(entry.storedAt || 0) > config.cacheTtlMs) {
        try {
          delete state.cache[key];
        } catch (e0) {}
        return null;
      }
      return entry;
    }

    function storeUrl(key, url, now) {
      var state;
      var entry;
      try {
        state = sharedState();
        entry = state.cache[key] || {};
        entry.url = url;
        entry.storedAt = now;
        entry.failureUntil = 0;
        state.cache[key] = entry;
      } catch (e0) {}
    }

    function cachedFailure(key, now) {
      var entry = sharedState().cache[key];
      return entry && Number(entry.failureUntil || 0) > now ? entry : null;
    }

    function storeFailure(key, now) {
      var state;
      var entry;
      try {
        state = sharedState();
        entry = state.cache[key] || {};
        entry.failureUntil = now + Number(config.failureCooldownMs || 15000);
        entry.storedAt = now;
        state.cache[key] = entry;
      } catch (e0) {}
    }

    function readProfileAccount(root) {
      var ids = [
        "FriendsRankHiddenAccountID",
        "FriendsRankVisibleAccountID",
        "FriendsRankProfileAccountID",
        "FriendsRankProfileFriendCode",
        "FriendID",
      ];
      var texts = [];
      var accounts = [];
      var panel;
      var normalized;
      var i;
      for (i = 0; i < ids.length; i += 1) {
        panel = findChild(root, ids[i]);
        if (isPanelValid(panel)) texts.push(readText(panel));
      }
      collectTexts(findChild(root, "SelfName"), texts, 0);
      for (i = 0; i < texts.length; i += 1) {
        normalized = normalizeAccountText(texts[i], config);
        addUniqueCandidate(accounts, normalized);
      }
      return {
        account: accounts.length === 1 ? accounts[0] : "",
        hidden: texts.join(" | "),
        visible: "",
        mismatch: accounts.length > 1,
      };
    }

    function removeBadge(root) {
      var host = findChild(root, "FriendsRankMediaHost");
      var children = childrenOf(host);
      var i;
      for (i = 0; i < children.length; i += 1) {
        try {
          setVisible(children[i], false);
          if (children[i].DeleteAsync) children[i].DeleteAsync(0);
        } catch (e0) {}
      }
      setAttribute(root, "friends_rank_badge_panel", "");
    }

    function clearRank(root, resolving, hidden) {
      var uiRoot = findChild(root, "FriendsRankRoot");
      clearStatlockerIdentity(root);
      setVisible(uiRoot, false);
      setRootState(root, "FriendsRankStateWaiting", "");
      removeBadge(root);
      setAttribute(root, "friends_rank_rendered_account", "");
      setAttribute(root, "friends_rank_image_url", "");
      setAttribute(root, "friends_rank_subrank", "");
      setAttribute(root, "friends_rank_terminal_account", "");
      setAttribute(root, "friends_rank_terminal_fingerprint", "");
      setRootState(
        root,
        hidden ? "FriendsRankStateWaiting" : resolving ? "FriendsRankStateResolving" : "FriendsRankStateUnavailable",
        "",
      );
      setVisible(uiRoot, !hidden);
    }

    function currentToken(root) {
      return getAttribute(root, "friends_rank_watch_token");
    }

    function newToken(root) {
      localSequence += 1;
      var token = String(nowMs()) + "_" + String(localSequence);
      setAttribute(root, "friends_rank_watch_token", token);
      return token;
    }

    function requestBadgeImage(root, token, account, fingerprint, cacheKey, url) {
      var host = findChild(root, "FriendsRankMediaHost");
      var badge;
      var panelId;
      if (!isPanelValid(host) || !url || !$.CreatePanel) return false;
      removeBadge(root);
      localSequence += 1;
      panelId = "FriendsRankBadge_" + String(localSequence);
      try {
        badge = $.CreatePanel("Image", host, panelId);
        badge.AddClass("FriendsRankBadge");
        if (badge.SetScaling)
          badge.SetScaling("stretch-to-fit-preserve-aspect");
        else
          badge.scaling = "stretch-to-fit-preserve-aspect";
        setVisible(badge, false);
        setAttribute(root, "friends_rank_badge_panel", panelId);
        setAttribute(root, "friends_rank_image_url", url);
        if ($.RegisterEventHandler) {
          $.RegisterEventHandler("ImageLoaded", badge, function () {
            var live = snapshot(root);
            if (!isPanelValid(root) || !isPanelValid(badge) || currentToken(root) !== token) return;
            if (getAttribute(root, "friends_rank_badge_panel") !== panelId) return;
            if (live.loading || live.mismatch || live.account !== account || live.fingerprint !== fingerprint) return;
            setAttribute(root, "friends_rank_rendered_account", account);
            setAttribute(root, "friends_rank_terminal_account", "");
            setAttribute(root, "friends_rank_terminal_fingerprint", "");
            setRootState(root, "FriendsRankStateRequested", "");
            setVisible(findChild(root, "FriendsRankRoot"), true);
            setVisible(badge, true);
            debugLog("image loaded account=" + account);
          });
          $.RegisterEventHandler("ImageFailedLoad", badge, function () {
            var uiRoot;
            if (!isPanelValid(root) || currentToken(root) !== token) return;
            if (getAttribute(root, "friends_rank_badge_panel") !== panelId) return;
            debugLog("image failed account=" + account);
            // Commit the local Obscurus fallback before deleting the Image that
            // owns this callback. Panorama may stop processing an image event as
            // soon as its source panel is invalidated.
            setVisible(badge, false);
            storeFailure(cacheKey, nowMs());
            setAttribute(root, "friends_rank_rendered_account", "");
            setAttribute(root, "friends_rank_image_url", "");
            setAttribute(root, "friends_rank_badge_panel", "");
            setAttribute(root, "friends_rank_terminal_account", account);
            setAttribute(root, "friends_rank_terminal_fingerprint", fingerprint);
            setRootState(root, "FriendsRankStateUnavailable", "");
            uiRoot = findChild(root, "FriendsRankRoot");
            setVisible(uiRoot, true);
            try {
              if (badge.DeleteAsync) badge.DeleteAsync(0);
            } catch (e0) {}
          });
        }
        badge.SetImage(url);
        return true;
      } catch (e0) {
        debugLog("SetImage exception account=" + account + " error=" + String(e0));
        storeFailure(cacheKey, nowMs());
        setAttribute(root, "friends_rank_terminal_account", account);
        setAttribute(root, "friends_rank_terminal_fingerprint", fingerprint);
        return false;
      }
    }

    function applyRank(root, token, account) {
      var live = snapshot(root);
      var entry;
      var url;
      var cacheKey = account + "|" + String(config.imageFormat || "webp");
      var now = nowMs();
      if (!isPanelValid(root) || currentToken(root) !== token) return false;
      if (live.mismatch || live.account !== account) return false;
      if (cachedFailure(cacheKey, now)) {
        clearRank(root, false, false);
        commitStatlockerIdentity(root, account, live.fingerprint);
        setAttribute(root, "friends_rank_terminal_account", account);
        setAttribute(root, "friends_rank_terminal_fingerprint", live.fingerprint);
        debugLog("temporary failure cooldown account=" + account);
        return true;
      }
      entry = cachedEntry(cacheKey, now);
      url = entry && entry.url ? entry.url : buildRankImageUrl(account, config);
      if (!url) return false;
      debugLog("SetImage account=" + account + " url=" + url);
      storeUrl(cacheKey, url, now);
      setRootState(root, "FriendsRankStateResolving", "");
      setVisible(findChild(root, "FriendsRankRoot"), true);
      return requestBadgeImage(root, token, account, live.fingerprint, cacheKey, url);
    }

    function schedule(root, token, delay, callback) {
      try {
        if (!$.Schedule) return false;
        $.Schedule(delay, function () {
          if (!isPanelValid(root)) return;
          if (currentToken(root) !== token) return;
          callback();
        });
        return true;
      } catch (e0) {
        return false;
      }
    }

    function snapshot(root) {
      var identity = readProfileAccount(root);
      var username = panelText(findChild(root, isMainProfile(root) ? "SelfName" : "UserName"));
      var presence = isMainProfile(root) ? username : profilePresence(root);
      return {
        account: identity.account,
        mismatch: identity.mismatch,
        username: username,
        presence: presence,
        localPlayer: !isMainProfile(root) && isLocalPlayer(root),
        loading: hasClass(root, "Loading"),
        fingerprint: profileFingerprint(root, identity.account),
      };
    }

    function startActiveWatch(root, token, account, fingerprint) {
      var startedAt = nowMs();
      setAttribute(root, "friends_rank_phase", "watching");
      setAttribute(root, "friends_rank_active_account", account || "");
      setAttribute(root, "friends_rank_active_fingerprint", fingerprint || "");
      function tick() {
        var now = nowMs();
        var live = snapshot(root);
        var nextDelay;
        if (!isPanelValid(root) || currentToken(root) !== token) return;
        if (config.activeWatchMs > 0 && now - startedAt > config.activeWatchMs) {
          setAttribute(root, "friends_rank_phase", "idle");
          return;
        }
        if (!isMainProfile(root) && (
          live.loading ||
          (account && (live.account !== account || live.fingerprint !== fingerprint)) ||
          (!account && live.account && live.fingerprint !== fingerprint)
        )) {
          token = newToken(root);
          clearRank(root, true, true);
          startPopupResolve(root, token, fingerprint);
          return;
        } else if (isMainProfile(root) && (!live.account || live.account !== account)) {
          token = newToken(root);
          clearRank(root, true, false);
          startMainResolve(root, token);
          return;
        } else if (
          getAttribute(root, "friends_rank_rendered_account") !== account &&
          !(
            getAttribute(root, "friends_rank_terminal_account") === account &&
            getAttribute(root, "friends_rank_terminal_fingerprint") === fingerprint
          )
        ) {
          applyRank(root, token, account);
        }
        nextDelay = !isMainProfile(root)
          ? Number(config.popupGuardIntervalSeconds || 0.016)
          : now - startedAt < config.activeWatchFastMs
              ? config.activeWatchFastIntervalSeconds
              : config.activeWatchIdleIntervalSeconds;
        schedule(root, token, nextDelay, tick);
      }
      schedule(
        root,
        token,
        isMainProfile(root) ? config.activeWatchFastIntervalSeconds : Number(config.popupGuardIntervalSeconds || 0.016),
        tick,
      );
    }

    function startPopupResolve(root, token, previousFingerprint) {
      var startedAt = nowMs();
      var observedLoading = hasClass(root, "Loading");
      var stableKey = "";
      var stableCount = 0;
      var stableSince = 0;
      setAttribute(root, "friends_rank_phase", "resolving");
      function tick() {
        var live = snapshot(root);
        var key;
        var fresh;
        var requiredSettleMs;
        var now = nowMs();
        if (!isPanelValid(root) || currentToken(root) !== token) return;
        if (live.loading) observedLoading = true;
        fresh = live.localPlayer || (observedLoading && !live.loading) || (!!live.fingerprint && live.fingerprint !== previousFingerprint);
        key = [live.account, live.username, live.presence, live.fingerprint, String(live.localPlayer)].join("|");
        if (!live.loading && !live.mismatch && live.account && live.username && fresh) {
          if (key === stableKey) {
            stableCount += 1;
          } else {
            stableKey = key;
            stableCount = 1;
            stableSince = now;
          }
          requiredSettleMs = live.localPlayer || live.presence
            ? Number(config.popupSettleMs || 750)
            : Number(config.popupEmptyPresenceSettleMs || 1500);
          if (
            stableCount >= Number(config.stableChecksRequired || 2) &&
            now - stableSince >= requiredSettleMs
          ) {
            setAttribute(root, "friends_rank_confirmed_fingerprint", live.fingerprint);
            clearRank(root, true, false);
            commitStatlockerIdentity(root, live.account, live.fingerprint);
            if (applyRank(root, token, live.account))
              startActiveWatch(root, token, live.account, live.fingerprint);
            return;
          }
        } else {
          stableKey = "";
          stableCount = 0;
          stableSince = 0;
        }
        if (now - startedAt >= Number(config.popupReadyTimeoutMs || 5000)) {
          clearRank(root, false, true);
          debugLog("popup identity timeout; rank remains hidden");
          startActiveWatch(root, token, "", previousFingerprint);
          return;
        }
        schedule(root, token, Number(config.popupPollSeconds || 0.1), tick);
      }
      schedule(root, token, Number(config.popupPollSeconds || 0.1), tick);
    }

    function startMainResolve(root, token) {
      var stableKey = "";
      var stableCount = 0;
      var stableSince = 0;
      function tick() {
        var live = snapshot(root);
        var key = live.account + "|" + live.username;
        var now = nowMs();
        if (!isPanelValid(root) || currentToken(root) !== token) return;
        if (!live.mismatch && live.account) {
          if (key === stableKey) {
            stableCount += 1;
          } else {
            stableKey = key;
            stableCount = 1;
            stableSince = now;
          }
          if (
            stableCount >= Number(config.stableChecksRequired || 2) &&
            now - stableSince >= Number(config.mainProfileSettleMs || 2000)
          ) {
            setAttribute(root, "friends_rank_confirmed_fingerprint", live.fingerprint);
            commitStatlockerIdentity(root, live.account, live.fingerprint);
            if (applyRank(root, token, live.account))
              startActiveWatch(root, token, live.account, live.fingerprint);
            return;
          }
        } else {
          stableKey = "";
          stableCount = 0;
          stableSince = 0;
        }
        schedule(root, token, Number(config.activeWatchIdleIntervalSeconds || 0.5), tick);
      }
      schedule(root, token, 0.05, tick);
    }

    $.FriendsRankRefreshProfile = function (source) {
      var root = findProfileRoot($.GetContextPanel ? $.GetContextPanel() : null);
      var token;
      var previousFingerprint;
      var main;
      var live;
      var phase;
      if (!isPanelValid(root)) {
        debugLog("refresh ignored: FriendsRankRoot not found");
        return "";
      }
      if (String(source || "") === "open_statlocker") return openStatlocker(root) ? "opened" : "";
      previousFingerprint = getAttribute(root, "friends_rank_confirmed_fingerprint");
      main = isMainProfile(root);
      live = snapshot(root);
      phase = getAttribute(root, "friends_rank_phase");
      if (!main && phase === "resolving") {
        debugLog("refresh ignored: popup resolution already active");
        return currentToken(root);
      }
      if (
        !main &&
        phase === "watching" &&
        !live.loading &&
        !live.mismatch &&
        live.account &&
        live.account === getAttribute(root, "friends_rank_active_account") &&
        live.fingerprint === getAttribute(root, "friends_rank_active_fingerprint")
      ) {
        // Deadlock can collapse children when a reused popup closes without
        // changing its identity. Restore only the generic terminal fallback;
        // never revive a player-specific badge from this idempotent path.
        if (
          getAttribute(root, "friends_rank_terminal_account") === live.account &&
          getAttribute(root, "friends_rank_terminal_fingerprint") === live.fingerprint
        ) {
          setRootState(root, "FriendsRankStateUnavailable", "");
          setVisible(findChild(root, "FriendsRankRoot"), true);
        }
        debugLog("refresh ignored: popup identity already active");
        return currentToken(root);
      }
      token = newToken(root);
      clearRank(root, true, !main);
      debugLog("refresh source=" + String(source || "unknown") + " token=" + token);
      if (main) startMainResolve(root, token);
      else startPopupResolve(root, token, previousFingerprint);
      return token;
    };

    debugLog("runtime loaded; source=" + String(config.apiBaseUrl || "disabled"));
    try {
      $.Schedule(0.01, function () {
        if ($.FriendsRankRefreshProfile) $.FriendsRankRefreshProfile("profile_card_onload");
      });
    } catch (e0) {}
  }

  var TEST_API = {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    STEAM64_BASE: STEAM64_BASE,
    cleanDecimal: cleanDecimal,
    compareDecimal: compareDecimal,
    subtractDecimal: subtractDecimal,
    normalizeAccountText: normalizeAccountText,
    steam64ToAccountId: steam64ToAccountId,
    reconcileAccounts: reconcileAccounts,
    buildRankImageUrl: buildRankImageUrl,
    buildStatlockerUrl: buildStatlockerUrl,
    createProfileState: createProfileState,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = TEST_API;
  if (typeof $ !== "undefined" && $) installPanorama();
})();

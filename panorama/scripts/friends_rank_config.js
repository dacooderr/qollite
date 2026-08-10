(function () {
  "use strict";

  if (typeof $ === "undefined" || !$) return;

  $.FriendsRankConfig = {
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
})();

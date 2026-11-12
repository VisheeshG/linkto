/*! Linkto conversion tracking — https://linkto.in/guide */
/* eslint-disable @typescript-eslint/no-unused-vars */
(function (window, document) {
  "use strict";

  var PARAM = "lt_id";
  var STORE = "lt_id";
  var WINDOW_DAYS = 30;
  var TEST_PREFIX = "lt_test";
  var ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

  var existing = window.linkto;
  if (existing && existing.loaded) return;
  var queued = (existing && existing.q) || [];

  var script =
    document.currentScript || document.querySelector("script[data-site]");
  var site = script ? script.getAttribute("data-site") : null;
  var endpoint = script ? script.getAttribute("data-api") : null;
  if (!endpoint) {
    try {
      endpoint = new URL(script.src).origin + "/api/v1/events";
    } catch (e) {
      endpoint = "https://linkto.in/api/v1/events";
    }
  }

  function warn(message) {
    if (window.console && console.warn) console.warn("[Linkto] " + message);
  }

  // --- storage: first-party cookie, with localStorage as a backup ----------

  function readCookie(name) {
    var parts = ("; " + document.cookie).split("; " + name + "=");
    return parts.length < 2 ? null : decodeURIComponent(parts.pop().split(";")[0]);
  }

  function writeCookie(name, value, days, domain) {
    document.cookie =
      name + "=" + encodeURIComponent(value) +
      "; path=/; max-age=" + days * 86400 +
      "; SameSite=Lax" +
      (location.protocol === "https:" ? "; Secure" : "") +
      (domain ? "; domain=" + domain : "");
  }

  // Store on the widest domain the browser accepts (example.com rather than
  // shop.example.com) so every subdomain of the brand sees the same click.
  function saveClickId(id) {
    var labels = location.hostname.split(".");
    var saved = false;
    if (labels.length > 1 && !/^[\d.]+$/.test(location.hostname)) {
      for (var i = labels.length - 2; i >= 0 && !saved; i--) {
        writeCookie(STORE, id, WINDOW_DAYS, "." + labels.slice(i).join("."));
        saved = readCookie(STORE) === id;
      }
    }
    if (!saved) writeCookie(STORE, id, WINDOW_DAYS);
    try {
      localStorage.setItem(STORE, JSON.stringify({ id: id, at: Date.now() }));
    } catch (e) {}
  }

  function loadClickId() {
    var fromCookie = readCookie(STORE);
    if (fromCookie && ID_PATTERN.test(fromCookie)) return fromCookie;
    try {
      var stored = JSON.parse(localStorage.getItem(STORE) || "null");
      if (
        stored &&
        ID_PATTERN.test(stored.id) &&
        Date.now() - stored.at < WINDOW_DAYS * 86400000
      ) {
        return stored.id;
      }
    } catch (e) {}
    return null;
  }

  // --- click ID from the landing URL ---------------------------------------

  function takeClickIdFromUrl() {
    var match = new RegExp("[?&]" + PARAM + "=([^&#]*)").exec(location.search);
    if (!match) return null;
    var id = decodeURIComponent(match[1]);
    if (!ID_PATTERN.test(id)) return null;

    // Drop lt_id from the address bar so a shared or bookmarked URL does not
    // carry this visitor's click to someone else.
    try {
      var url = new URL(location.href);
      url.searchParams.delete(PARAM);
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    } catch (e) {}
    return id;
  }

  // --- sending --------------------------------------------------------------

  function isTest(id) {
    return !!id && id.indexOf(TEST_PREFIX) === 0;
  }

  function showTestBadge(text, ok) {
    var badge = document.getElementById("linkto-test-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "linkto-test-badge";
      badge.setAttribute("role", "status");
      badge.style.cssText =
        "position:fixed;z-index:2147483647;left:16px;bottom:16px;max-width:320px;" +
        "padding:10px 14px;border-radius:10px;font:500 13px/1.4 system-ui,sans-serif;" +
        "color:#fff;box-shadow:0 6px 24px rgba(15,23,42,.25)";
      (document.body || document.documentElement).appendChild(badge);
    }
    badge.style.background = ok ? "#047857" : "#be123c";
    badge.textContent = "Linkto test mode: " + text;
  }

  function send(event, data) {
    var clickId = state.clickId;
    if (!site) {
      warn('Missing data-site on the Linkto script tag; "' + event + '" was not sent.');
      return;
    }
    if (!clickId) return; // Visitor did not arrive through a Linkto link.

    var payload = { site: site, event: event, click_id: clickId };
    data = data || {};
    if (data.userId != null) payload.user_id = String(data.userId);
    if (data.amount != null) payload.amount = data.amount;
    if (data.currency) payload.currency = data.currency;
    if (data.orderId != null) payload.order_id = String(data.orderId);
    if (data.eventId != null) payload.event_id = String(data.eventId);
    var body = JSON.stringify(payload);
    var test = isTest(clickId);

    // text/plain keeps this a "simple" request (no CORS preflight); keepalive
    // lets it finish even if the page navigates away right after a purchase.
    if (window.fetch) {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: body,
        keepalive: true,
        credentials: "omit",
      })
        .then(function (response) {
          return response.json().then(function (result) {
            if (test) {
              showTestBadge(
                result.ok
                  ? event + " received ✓"
                  : event + " failed: " + (result.error || result.message),
                result.ok
              );
            } else if (!result.ok && response.status !== 404) {
              warn(event + " was not recorded: " + (result.error || result.message));
            }
          });
        })
        .catch(function () {
          if (test) showTestBadge(event + " could not reach Linkto", false);
        });
    } else if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, body);
    }
  }

  // --- public API: linkto("signup"), linkto("purchase", {...}) --------------

  var state = { clickId: null };

  function linkto(command, a, b) {
    switch (command) {
      case "signup":
        send("signup", a);
        break;
      case "purchase":
        send("purchase", a);
        break;
      case "track":
        if (typeof a === "string" && a) send(a, b);
        else warn('linkto("track", name) needs an event name.');
        break;
      default:
        warn('Unknown command "' + command + '". Use "signup", "purchase" or "track".');
    }
  }
  linkto.loaded = true;

  var fromUrl = takeClickIdFromUrl();
  if (fromUrl) {
    saveClickId(fromUrl); // last click wins
    state.clickId = fromUrl;
    send("visit");
  } else {
    state.clickId = loadClickId();
  }
  linkto.clickId = state.clickId;

  window.linkto = linkto;
  for (var i = 0; i < queued.length; i++) {
    linkto.apply(null, queued[i]);
  }
})(window, document);

/**
 * HouseGhost Core Engine - GraphQL Interceptor
 * Made by x4bhi
 */
var netflixApiblocker = (function () {
  "use strict";

  function init(targetFn) {
    return targetFn == null || typeof targetFn == "function" ? { main: targetFn } : targetFn;
  }

  const moduleRunner = init(() => {
    const TARGET_OP = "CLCSInterstitialPlaybackAndPostPlayback";
    const TARGET_HOST = "web.prod.cloud.netflix.com";
    const TARGET_PATH = "/graphql";

    // Intercept Fetch API
    const nativeFetch = window.fetch;
    window.fetch = async function (...args) {
      const [resource, config] = args;
      const url = typeof resource == "string" ? resource : resource instanceof URL ? resource.href : resource?.url || "";

      if (window.location.pathname.includes("/watch") && url.includes(TARGET_HOST) && url.includes(TARGET_PATH)) {
        const urlMatch = url.includes(TARGET_OP);
        const bodyMatch = (typeof config?.body == "string" ? config.body : "").includes(TARGET_OP);

        if (urlMatch || bodyMatch) {
          return new Response(JSON.stringify({ data: {} }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      return nativeFetch.apply(this, args);
    };

    // Intercept XHR
    const nativeOpen = XMLHttpRequest.prototype.open;
    const nativeSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._requestUrl = typeof url == "string" ? url : url.href;
      return nativeOpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const url = this._requestUrl || "";

      if (window.location.pathname.includes("/watch") && url.includes(TARGET_HOST) && url.includes(TARGET_PATH)) {
        const urlMatch = url.includes(TARGET_OP);
        const bodyMatch = (typeof body == "string" ? body : "").includes(TARGET_OP);

        if (urlMatch || bodyMatch) {
          Object.defineProperty(this, "status", { value: 200, writable: false });
          Object.defineProperty(this, "readyState", { value: 4, writable: false });
          Object.defineProperty(this, "responseText", { value: JSON.stringify({ data: {} }), writable: false });
          Object.defineProperty(this, "response", { value: JSON.stringify({ data: {} }), writable: false });

          setTimeout(() => {
            this.dispatchEvent(new Event("readystatechange"));
            this.dispatchEvent(new Event("load"));
            this.dispatchEvent(new Event("loadend"));
          }, 0);
          return;
        }
      }
      return nativeSend.apply(this, [body]);
    };
  });

  return (async () => {
    try {
      return await moduleRunner.main();
    } catch (err) {
      console.error("[HouseGhost] API Filter error:", err);
    }
  })();
})();

netflixApiblocker;
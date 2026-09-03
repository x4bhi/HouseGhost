/**
 * HouseGhost Core Engine - 4K Cinema Guard (MAIN World)
 * Made by x4bhi
 */
(function() {
  'use strict';
  
  // Check synchronous flag set by HouseGhost content.js
  // Default is OFF: only run if explicitly set to 'true'
  if (window.localStorage.getItem('HG_4K_ENABLED') !== 'true') {
    return;
  }
// ============================================
  // BROWSER DETECTION & LOGGING
  // ============================================

  const realUserAgent = navigator.userAgent;
  const isEdge = realUserAgent.includes('Edg/');
  const isChrome = realUserAgent.includes('Chrome') && !isEdge;
  const isFirefox = realUserAgent.includes('Firefox');
  const browserName = isEdge ? 'Edge' : isFirefox ? 'Firefox' : isChrome ? 'Chrome' : 'Unknown';

  // Extract Edge version
  let edgeVersion = 0;
  if (isEdge) {
    const match = realUserAgent.match(/Edg\/(\d+)/);
    edgeVersion = match ? parseInt(match[1]) : 0;
  }

  // Edge 118+ uses PlayReady 3.0 (hardware DRM), others use Widevine L3 (software)
  const drm = isEdge ? 'PlayReady 3.0' : 'Widevine L3';
  const can4K = isEdge && edgeVersion >= 118;

  console.log('[Netflix 4K] ==========================================');
  console.log('[Netflix 4K] Netflix 4K Optimizer - Initializing...');
  console.log('[Netflix 4K] ==========================================');
  console.log(`[Netflix 4K] Browser: ${browserName}${edgeVersion ? ' ' + edgeVersion : ''}`);
  console.log(`[Netflix 4K] DRM: ${drm} (${can4K ? 'Hardware - 4K capable' : 'Software - 1080p max'})`);

  if (isEdge && edgeVersion < 118) {
    console.log(`[Netflix 4K] NOTE: You need Edge 118+ for 4K. You have Edge ${edgeVersion}.`);
    console.log('[Netflix 4K] Update Edge at edge://settings/help');
  } else if (!isEdge) {
    console.log('[Netflix 4K] NOTE: Your browser uses Widevine L3 (software DRM).');
    console.log('[Netflix 4K] Netflix requires PlayReady 3.0 for 4K, which only Edge has on Windows.');
    console.log('[Netflix 4K] We\'ll still maximize quality within your browser\'s limits.');
  } else {
    console.log('[Netflix 4K] TIP: Make sure you have the HEVC extension from Microsoft Store.');
  }

  // ============================================
  // PLAYBACK STATS TRACKING
  // ============================================

  let currentStats = {
    playbackActive: false,
    currentResolution: null,
    currentBitrate: null,
    currentCodec: null,
    isHDR: false,
    videoId: null
  };

  // Send stats to content script
  const sendStats = () => {
    window.postMessage({
      type: 'NETFLIX_4K_STATS',
      stats: { ...currentStats, timestamp: Date.now() }
    }, '*');
  };

  // Update stats periodically
  setInterval(sendStats, 2000);

  // ============================================
  // 1. SPOOF SCREEN RESOLUTION
  // ============================================

  const realWidth = window.screen.width;
  const realHeight = window.screen.height;

  Object.defineProperty(window.screen, 'width', { get: () => 3840 });
  Object.defineProperty(window.screen, 'height', { get: () => 2160 });
  Object.defineProperty(window.screen, 'availWidth', { get: () => 3840 });
  Object.defineProperty(window.screen, 'availHeight', { get: () => 2160 });
  Object.defineProperty(window.screen, 'colorDepth', { get: () => 48 });
  Object.defineProperty(window.screen, 'pixelDepth', { get: () => 48 });
  Object.defineProperty(window, 'devicePixelRatio', { get: () => 1 });
  Object.defineProperty(window, 'outerWidth', { get: () => 3840, configurable: true });
  Object.defineProperty(window, 'outerHeight', { get: () => 2160, configurable: true });

  console.log(`[Netflix 4K] Screen: ${realWidth}x${realHeight} -> spoofed to 3840x2160`);

  // ============================================
  // 2. SPOOF MEDIA CAPABILITIES API
  // ============================================

  if (navigator.mediaCapabilities) {
    const originalDecodingInfo = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);

    navigator.mediaCapabilities.decodingInfo = async function(config) {
      const dominated4KCodecs = [
        'hev1', 'hvc1', 'vp09', 'vp9', 'av01', 'av1', 'dvhe', 'dvh1'
      ];

      let dominated = false;
      if (config.video) {
        const codec = config.video.contentType || '';
        dominated = dominated4KCodecs.some(c => codec.toLowerCase().includes(c));
      }

      try {
        const result = await originalDecodingInfo(config);
        if (dominated || (config.video && config.video.width >= 3840)) {
          return {
            supported: true,
            smooth: true,
            powerEfficient: true,
            keySystemAccess: result.keySystemAccess
          };
        }
        return result;
      } catch (e) {
        if (dominated) {
          return { supported: true, smooth: true, powerEfficient: true };
        }
        throw e;
      }
    };
  }

  // ============================================
  // 3. SPOOF MEDIA SOURCE EXTENSIONS
  // ============================================

  if (window.MediaSource) {
    const originalIsTypeSupported = MediaSource.isTypeSupported.bind(MediaSource);

    MediaSource.isTypeSupported = function(mimeType) {
      const dominated4KTypes = [
        'hev1', 'hvc1', 'dvh1', 'dvhe', 'vp09', 'vp9', 'av01'
      ];

      if (dominated4KTypes.some(t => mimeType.toLowerCase().includes(t))) {
        return true;
      }

      return originalIsTypeSupported(mimeType);
    };
  }

  // ============================================
  // 4. SPOOF EME / DRM CAPABILITIES
  // ============================================

  if (navigator.requestMediaKeySystemAccess) {
    const originalRequestMediaKeySystemAccess = navigator.requestMediaKeySystemAccess.bind(navigator);

    navigator.requestMediaKeySystemAccess = async function(keySystem, configs) {
      console.log('[Netflix 4K] DRM negotiation for:', keySystem);

      // Try with enhanced robustness first
      const enhancedConfigs = configs.map(config => {
        const enhanced = JSON.parse(JSON.stringify(config));
        if (enhanced.videoCapabilities) {
          enhanced.videoCapabilities = enhanced.videoCapabilities.map(vc => ({
            ...vc,
            robustness: 'HW_SECURE_ALL'
          }));
        }
        return enhanced;
      });

      try {
        const result = await originalRequestMediaKeySystemAccess(keySystem, enhancedConfigs);
        console.log('[Netflix 4K] DRM: HW_SECURE_ALL accepted');
        return result;
      } catch (e) {
        // Try SW_SECURE_DECODE (common fallback)
        const swConfigs = configs.map(config => {
          const sw = JSON.parse(JSON.stringify(config));
          if (sw.videoCapabilities) {
            sw.videoCapabilities = sw.videoCapabilities.map(vc => ({
              ...vc,
              robustness: 'SW_SECURE_DECODE'
            }));
          }
          return sw;
        });
        try {
          const result = await originalRequestMediaKeySystemAccess(keySystem, swConfigs);
          console.log('[Netflix 4K] DRM: SW_SECURE_DECODE accepted');
          return result;
        } catch (e2) {
          console.log('[Netflix 4K] DRM: Using original config');
          return originalRequestMediaKeySystemAccess(keySystem, configs);
        }
      }
    };
  }

  // ============================================
  // 5. SPOOF HDCP DETECTION
  // ============================================

  Object.defineProperty(navigator, 'hdcpPolicyCheck', {
    value: () => Promise.resolve({ hdcp: 'hdcp-2.2' }),
    writable: false
  });

  console.log('[Netflix 4K] HDCP: Spoofed to 2.2');

  // ============================================
  // 6. OVERRIDE BROWSER/PLATFORM DETECTION
  // ============================================

  Object.defineProperty(navigator, 'userAgent', {
    get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    configurable: true
  });

  Object.defineProperty(navigator, 'vendor', {
    get: () => 'Google Inc.',
    configurable: true
  });

  Object.defineProperty(navigator, 'platform', {
    get: () => 'Win32',
    configurable: true
  });

  // ============================================
  // 7. WEBGL RENDERER SPOOFING
  // ============================================

  const getParameterProxyHandler = {
    apply: function(target, thisArg, argumentsList) {
      const param = argumentsList[0];
      if (param === 37445) return 'NVIDIA Corporation';
      if (param === 37446) return 'NVIDIA GeForce RTX 4090/PCIe/SSE2';
      return Reflect.apply(target, thisArg, argumentsList);
    }
  };

  const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = new Proxy(originalGetParameter, getParameterProxyHandler);

  if (window.WebGL2RenderingContext) {
    const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = new Proxy(originalGetParameter2, getParameterProxyHandler);
  }

  // ============================================
  // 8. NETFLIX 4K PROFILES
  // ============================================

  const NETFLIX_4K_PROFILES = [
    // HEVC 4K HDR
    'hevc-main10-L51-dash-cenc-prk',
    'hevc-main10-L51-dash-cenc',
    'hevc-main10-L50-dash-cenc-prk',
    'hevc-main10-L50-dash-cenc',
    'hevc-main-L51-dash-cenc',
    'hevc-main-L50-dash-cenc',
    // VP9 4K HDR
    'vp9-profile2-L51-dash-cenc-prk',
    'vp9-profile2-L50-dash-cenc-prk',
    'vp9-profile0-L51-dash-cenc',
    'vp9-profile0-L50-dash-cenc',
    // AV1 4K
    'av1-main-L51-dash-cbcs-prk',
    'av1-main-L50-dash-cbcs-prk',
    // High bitrate H264 fallback
    'playready-h264hpl40-dash',
    'playready-h264hpl41-dash'
  ];

  // ============================================
  // 9. DEEP CONFIG PATCHER
  // ============================================

  const _patched = new WeakSet();

  const patchConfigValues = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 5) return;
    if (_patched.has(obj)) return;
    try { _patched.add(obj); } catch(e) { return; }

    let keys;
    try { keys = Object.keys(obj); } catch(e) { return; }

    for (const key of keys) {
      try {
        const lk = key.toLowerCase();
        const val = obj[key];

        // Skip audio-only properties
        if (lk.includes('audio') && !lk.includes('video')) continue;

        if (typeof val === 'number') {
          // Bitrate caps (skip audio: 'abitrate', 'audiobitrate', or ambiguous values < 500 kbps)
          if ((lk.includes('bitrate') || lk.includes('bandwidth')) && !lk.includes('min')) {
            const isAudioProp = lk === 'abitrate' || lk.includes('audio');
            const isLikelyAudio = val < 500 && !lk.includes('video') && !lk.includes('max') && !lk.includes('init');
            if (!isAudioProp && !isLikelyAudio && val > 0 && val < 16000) {
              console.log(`[Netflix 4K] Patched: ${key} ${val} -> 16000`);
              obj[key] = 16000;
            }
          }
          // Height caps
          if (lk.includes('height') && !lk.includes('min') && val >= 720 && val < 2160) {
            console.log(`[Netflix 4K] Patched: ${key} ${val} -> 2160`);
            obj[key] = 2160;
          }
          // Width caps
          if (lk.includes('width') && !lk.includes('min') && val >= 1280 && val < 3840) {
            console.log(`[Netflix 4K] Patched: ${key} ${val} -> 3840`);
            obj[key] = 3840;
          }
        }

        // HDCP version
        if (typeof val === 'string' && (lk === 'hdcp' || lk.includes('hdcp'))) {
          obj[key] = '2.2';
        }

        // Resolution object
        if (lk.includes('resolution') && val && typeof val === 'object' && !Array.isArray(val)) {
          if (typeof val.width === 'number' && val.width < 3840) val.width = 3840;
          if (typeof val.height === 'number' && val.height < 2160) val.height = 2160;
        }

        // Profiles array - prepend 4K profiles
        if ((lk === 'profiles' || lk === 'videoprofiles') && Array.isArray(val)) {
          const existing = new Set(val);
          const toAdd = NETFLIX_4K_PROFILES.filter(p => !existing.has(p));
          if (toAdd.length > 0) {
            obj[key] = [...toAdd, ...val];
          }
        }

        // Recurse into nested objects
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          patchConfigValues(val, depth + 1);
        }
      } catch(e) {}
    }
  };

  // ============================================
  // 10. INTERCEPT OBJECT PROPERTY DEFINITIONS
  // ============================================

  const originalDefineProperty = Object.defineProperty;
  const originalDefineProperties = Object.defineProperties;

  Object.defineProperty = function(obj, prop, descriptor) {
    if (typeof prop === 'string' && descriptor && descriptor.value !== undefined) {
      const lk = prop.toLowerCase();
      const val = descriptor.value;

      if (typeof val === 'number') {
        if ((lk.includes('bitrate') || lk.includes('bandwidth')) && !lk.includes('min')) {
          const isAudioProp = lk === 'abitrate' || lk.includes('audio');
          const isLikelyAudio = val < 500 && !lk.includes('video') && !lk.includes('max') && !lk.includes('init');
          if (!isAudioProp && !isLikelyAudio && val > 0 && val < 16000) {
            console.log(`[Netflix 4K] DefProp: ${prop} ${val} -> 16000`);
            descriptor = { ...descriptor, value: 16000 };
          }
        }
        if (lk.includes('height') && !lk.includes('min') && val >= 720 && val < 2160) {
          console.log(`[Netflix 4K] DefProp: ${prop} ${val} -> 2160`);
          descriptor = { ...descriptor, value: 2160 };
        }
        if (lk.includes('width') && !lk.includes('min') && val >= 1280 && val < 3840) {
          console.log(`[Netflix 4K] DefProp: ${prop} ${val} -> 3840`);
          descriptor = { ...descriptor, value: 3840 };
        }
      }

      if (typeof val === 'string' && (lk === 'hdcp' || lk.includes('hdcp'))) {
        descriptor = { ...descriptor, value: '2.2' };
      }
    }

    return originalDefineProperty.call(this, obj, prop, descriptor);
  };

  // Also intercept defineProperties (plural)
  Object.defineProperties = function(obj, props) {
    for (const prop of Object.keys(props)) {
      const lk = prop.toLowerCase();
      const desc = props[prop];
      if (desc && desc.value !== undefined) {
        const val = desc.value;
        if (typeof val === 'number') {
          if ((lk.includes('bitrate') || lk.includes('bandwidth')) && !lk.includes('min')) {
            const isAudio = lk === 'abitrate' || lk.includes('audio');
            const isLikelyAudio = val < 500 && !lk.includes('video') && !lk.includes('max') && !lk.includes('init');
            if (!isAudio && !isLikelyAudio && val > 0 && val < 16000) {
              desc.value = 16000;
            }
          }
          if (lk.includes('height') && !lk.includes('min') && val >= 720 && val < 2160) {
            desc.value = 2160;
          }
          if (lk.includes('width') && !lk.includes('min') && val >= 1280 && val < 3840) {
            desc.value = 3840;
          }
        }
      }
    }
    return originalDefineProperties.call(this, obj, props);
  };

  // ============================================
  // 11. INTERCEPT OBJECT.ASSIGN
  // ============================================

  const originalAssign = Object.assign;
  Object.assign = function(target, ...sources) {
    const result = originalAssign.call(this, target, ...sources);
    if (result && typeof result === 'object') {
      // Quick check if this looks like a Netflix config object
      try {
        const keys = Object.keys(result);
        if (keys.some(k => {
          const lk = k.toLowerCase();
          return lk.includes('bitrate') || lk.includes('maxheight') ||
                 lk.includes('maxwidth') || lk.includes('maxresolution') ||
                 lk.includes('videoprofile') || lk.includes('hdcp');
        })) {
          patchConfigValues(result);
        }
      } catch(e) {}
    }
    return result;
  };

  // ============================================
  // 12. CONFIG OBJECT PROXY
  // ============================================

  const createConfigProxy = (target, name) => {
    return new Proxy(target, {
      set(obj, prop, value) {
        const lowerProp = String(prop).toLowerCase();

        if ((lowerProp.includes('bitrate') || lowerProp.includes('bandwidth')) && typeof value === 'number' && !lowerProp.includes('audio') && !lowerProp.includes('min') && value < 16000) {
          value = 16000;
        }
        if (lowerProp.includes('height') && typeof value === 'number' && !lowerProp.includes('min') && value >= 720 && value < 2160) {
          value = 2160;
        }
        if (lowerProp.includes('width') && typeof value === 'number' && !lowerProp.includes('min') && value >= 1280 && value < 3840) {
          value = 3840;
        }

        obj[prop] = value;
        return true;
      },
      get(obj, prop) {
        const value = obj[prop];
        const lowerProp = String(prop).toLowerCase();

        if (lowerProp === 'maxbitrate' || lowerProp === 'maxvideobitrate') return Math.max(value || 0, 16000);
        if (lowerProp === 'maxvideoheight' || lowerProp === 'maxheight') return 2160;
        if (lowerProp === 'maxvideowidth' || lowerProp === 'maxwidth') return 3840;
        if (lowerProp === 'hdcpversion' || lowerProp === 'hdcp') return '2.2';

        return value;
      }
    });
  };

  // ============================================
  // 13. CADMIUM PLAYER HOOK
  // ============================================

  let cadmiumHooked = false;

  const hookCadmium = () => {
    if (cadmiumHooked) return;

    if (window.netflix && window.netflix.player) {
      const player = window.netflix.player;
      let methodsWrapped = 0;

      // Deep patch the player object itself
      patchConfigValues(player);

      // Wrap ALL methods on the player - both args and return values get patched
      let methodNames;
      try { methodNames = Object.getOwnPropertyNames(player); } catch(e) { methodNames = Object.keys(player); }

      for (const method of methodNames) {
        try {
          if (typeof player[method] !== 'function') continue;

          const original = player[method].bind(player);
          player[method] = function(...args) {
            // Patch config arguments going in
            for (const arg of args) {
              if (arg && typeof arg === 'object') {
                patchConfigValues(arg);
              }
            }

            const result = original(...args);

            // Patch config objects coming out
            if (result && typeof result === 'object') {
              // Handle promises
              if (typeof result.then === 'function') {
                return result.then(r => {
                  if (r && typeof r === 'object') patchConfigValues(r);
                  return r;
                });
              }
              patchConfigValues(result);
            }

            return result;
          };
          methodsWrapped++;
        } catch(e) {}
      }

      cadmiumHooked = true;
      console.log(`[Netflix 4K] Hooked Netflix Cadmium player (${methodsWrapped} methods wrapped)`);
    }

    // Also deep-patch the entire netflix namespace for config values
    if (window.netflix) {
      try {
        const walkNetflix = (obj, depth = 0) => {
          if (!obj || typeof obj !== 'object' || depth > 3) return;
          patchConfigValues(obj);
          for (const key of Object.keys(obj)) {
            try {
              if (obj[key] && typeof obj[key] === 'object' && key !== 'player') {
                walkNetflix(obj[key], depth + 1);
              }
            } catch(e) {}
          }
        };
        walkNetflix(window.netflix);
      } catch(e) {}
    }
  };

  // ============================================
  // 14. INTERCEPT JSON.STRINGIFY (manifest request injection)
  // ============================================

  const originalJSONStringify = JSON.stringify;
  JSON.stringify = function(value, replacer, space) {
    // First pass: stringify normally
    let result = originalJSONStringify.call(this, value, replacer, space);

    // Check the OUTPUT string for Netflix manifest keywords
    // (Netflix may use custom serializers that skip JSON.stringify for the top-level object
    //  but still stringify sub-objects — or the object structure may differ from what we expect)
    if (typeof result === 'string' && value && typeof value === 'object') {
      try {
        const hasProfiles = result.includes('dash-cenc') || result.includes('hevc-main') ||
                            result.includes('vp9-profile') || result.includes('av1-main') ||
                            result.includes('playready-h264');
        const hasManifestFields = result.includes('viewableId') || result.includes('lookupType') ||
                                  result.includes('"method":"manifest"');

        if (hasProfiles || hasManifestFields) {
          let modified = false;

          // Inject 4K profiles
          if (Array.isArray(value.profiles)) {
            const existing = new Set(value.profiles);
            const toAdd = NETFLIX_4K_PROFILES.filter(p => !existing.has(p));
            if (toAdd.length > 0) {
              value.profiles = [...toAdd, ...value.profiles];
              modified = true;
              console.log(`[Netflix 4K] Injected ${toAdd.length} 4K profiles via stringify`);
            }
          }

          // Ensure HDCP 2.2
          if (Array.isArray(value.videoOutputInfo)) {
            for (const info of value.videoOutputInfo) {
              if (info && typeof info === 'object') {
                info.supportedHdcpVersions = ['2.2', '2.1', '2.0', '1.4'];
                info.isHdcpEngaged = true;
                modified = true;
              }
            }
          }

          // Patch resolution/bitrate caps
          patchConfigValues(value);

          if (modified) {
            result = originalJSONStringify.call(this, value, replacer, space);
            console.log('[Netflix 4K] Manifest request modified via stringify');
          }
        }
      } catch(e) {}
    }

    return result;
  };

  // ============================================
  // 14b. INTERCEPT TextEncoder (catches custom serializers before MSL encryption)
  // ============================================

  const origTextEncoderEncode = TextEncoder.prototype.encode;
  TextEncoder.prototype.encode = function(input) {
    if (typeof input === 'string' && input.length > 100) {
      // Check for manifest request data (pre-encryption plaintext)
      if (input.includes('"profiles"') || input.includes('"viewableIds"') || input.includes('"lookupType"')) {
        try {
          const json = JSON.parse(input);
          let modified = false;

          // Inject 4K profiles
          if (Array.isArray(json.profiles)) {
            const existing = new Set(json.profiles);
            const toAdd = NETFLIX_4K_PROFILES.filter(p => !existing.has(p));
            if (toAdd.length > 0) {
              json.profiles = [...toAdd, ...json.profiles];
              modified = true;
              console.log(`[Netflix 4K] Injected ${toAdd.length} 4K profiles via TextEncoder`);
            }
          }

          // Ensure HDCP 2.2
          if (Array.isArray(json.videoOutputInfo)) {
            for (const info of json.videoOutputInfo) {
              if (info && typeof info === 'object') {
                info.supportedHdcpVersions = ['2.2', '2.1', '2.0', '1.4'];
                info.isHdcpEngaged = true;
                modified = true;
              }
            }
          }

          // Patch caps
          patchConfigValues(json);

          if (modified) {
            input = originalJSONStringify.call(JSON, json);
            console.log('[Netflix 4K] Modified manifest request before encryption');
          }
        } catch(e) {
          // Not valid JSON — could be MSL payload chunk with base64 data
          // Try to find and modify the inner data field
          try {
            if (input.includes('"data"') && (input.includes('"sequencenumber"') || input.includes('"messageid"'))) {
              const chunk = JSON.parse(input);
              if (chunk.data) {
                let innerText = atob(chunk.data);
                // Check if it's a manifest request
                if (innerText.includes('"profiles"') || innerText.includes('"viewableIds"')) {
                  const innerJson = JSON.parse(innerText);
                  let innerModified = false;

                  if (Array.isArray(innerJson.profiles)) {
                    const existing = new Set(innerJson.profiles);
                    const toAdd = NETFLIX_4K_PROFILES.filter(p => !existing.has(p));
                    if (toAdd.length > 0) {
                      innerJson.profiles = [...toAdd, ...innerJson.profiles];
                      innerModified = true;
                      console.log(`[Netflix 4K] Injected ${toAdd.length} 4K profiles in MSL payload`);
                    }
                  }

                  if (Array.isArray(innerJson.videoOutputInfo)) {
                    for (const info of innerJson.videoOutputInfo) {
                      if (info && typeof info === 'object') {
                        info.supportedHdcpVersions = ['2.2', '2.1', '2.0', '1.4'];
                        info.isHdcpEngaged = true;
                        innerModified = true;
                      }
                    }
                  }

                  patchConfigValues(innerJson);

                  if (innerModified) {
                    chunk.data = btoa(originalJSONStringify.call(JSON, innerJson));
                    input = originalJSONStringify.call(JSON, chunk);
                    console.log('[Netflix 4K] Modified MSL payload chunk');
                  }
                }
              }
            }
          } catch(e2) {}
        }
      }
    }
    return origTextEncoderEncode.call(this, input);
  };

  // ============================================
  // 15. INTERCEPT JSON PARSE
  // ============================================

  const originalJSONParse = JSON.parse;
  JSON.parse = function(text, reviver) {
    const result = originalJSONParse.call(this, text, reviver);

    if (result && typeof result === 'object') {
      // Only deep-patch if this looks like a Netflix config/manifest object
      try {
        const keys = Object.keys(result);
        const isConfig = keys.some(k => {
          const lk = k.toLowerCase();
          return lk.includes('bitrate') || lk.includes('resolution') ||
                 lk.includes('maxheight') || lk.includes('maxwidth') ||
                 lk.includes('profile') || lk.includes('drm') ||
                 lk.includes('manifest') || lk.includes('playback') ||
                 lk.includes('video');
        });
        if (isConfig) {
          patchConfigValues(result);
        }
      } catch(e) {}

      // Also catch the specific maxResolution pattern
      if (result.maxResolution) {
        result.maxResolution = { width: 3840, height: 2160 };
      }
    }

    return result;
  };

  // ============================================
  // 15. VIDEO ELEMENT MONITORING
  // ============================================

  const videoObserver = new MutationObserver((mutations) => {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (!video._netflix4k_monitored) {
        video._netflix4k_monitored = true;

        const updateStats = () => {
          if (video.videoWidth > 0) {
            const resolution = `${video.videoWidth}x${video.videoHeight}`;
            const is4K = video.videoWidth >= 3840 || video.videoHeight >= 2160;

            if (currentStats.currentResolution !== resolution) {
              currentStats.currentResolution = resolution;
              currentStats.playbackActive = true;

              const status = is4K ? '4K ACTIVE' : `${resolution}`;
              console.log(`[Netflix 4K] Resolution: ${resolution} ${is4K ? '(4K!)' : ''}`);
            }
          }
        };

        video.addEventListener('loadedmetadata', updateStats);
        video.addEventListener('playing', () => {
          currentStats.playbackActive = true;
          updateStats();
        });
        video.addEventListener('pause', () => {
          currentStats.playbackActive = false;
          sendStats();
        });

        // Check periodically while playing
        setInterval(() => {
          if (!video.paused && video.videoWidth > 0) {
            updateStats();
          }
        }, 3000);
      }
    });
  });

  // ============================================
  // 16. SPA NAVIGATION HANDLING
  // ============================================

  let lastWatchId = null;
  let lastHref = location.href;

  const getWatchId = () => {
    const match = location.pathname.match(/\/watch\/(\d+)/);
    return match ? match[1] : null;
  };

  const forceRehook = (reason) => {
    console.log(`[Netflix 4K] Rehook: ${reason}`);
    cadmiumHooked = false;
    // Clear patched cache so objects get re-patched
    // (WeakSet doesn't have clear(), but new objects will be untracked)

    const delays = [100, 300, 500, 1000, 2000];
    delays.forEach(delay => {
      setTimeout(() => {
        if (!cadmiumHooked) hookCadmium();
      }, delay);
    });
  };

  // URL change detection
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      const newWatchId = getWatchId();

      if (location.pathname.startsWith('/watch')) {
        if (newWatchId !== lastWatchId) {
          lastWatchId = newWatchId;
          currentStats.videoId = newWatchId;
          forceRehook('new video');
        }
      } else {
        lastWatchId = null;
        currentStats.playbackActive = false;
      }
    }
  }, 200);

  // Video element detection
  const videoCreationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
          forceRehook('video element added');
          return;
        }
      }
    }
  });

  // History API interception
  const wrapHistoryMethod = (method) => {
    const original = history[method];
    history[method] = function(...args) {
      const result = original.apply(this, args);
      setTimeout(() => {
        const watchId = getWatchId();
        if (watchId && watchId !== lastWatchId) {
          lastWatchId = watchId;
          currentStats.videoId = watchId;
          forceRehook(`history.${method}`);
        }
      }, 50);
      return result;
    };
  };

  wrapHistoryMethod('pushState');
  wrapHistoryMethod('replaceState');

  window.addEventListener('popstate', () => {
    setTimeout(() => {
      const watchId = getWatchId();
      if (watchId && watchId !== lastWatchId) {
        lastWatchId = watchId;
        forceRehook('popstate');
      }
    }, 50);
  });

  // Listen for reinit signal
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'NETFLIX_4K_REINIT') {
      forceRehook('content script signal');
    }
  });

  // ============================================
  // 17. INITIALIZATION
  // ============================================

  // Start observing
  const startObservers = () => {
    if (document.body) {
      videoObserver.observe(document.body, { childList: true, subtree: true });
      videoCreationObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      // Body doesn't exist yet at document_start, wait for it
      const bodyWaiter = new MutationObserver(() => {
        if (document.body) {
          bodyWaiter.disconnect();
          videoObserver.observe(document.body, { childList: true, subtree: true });
          videoCreationObserver.observe(document.body, { childList: true, subtree: true });
        }
      });
      bodyWaiter.observe(document.documentElement || document, { childList: true, subtree: true });
    }
  };

  startObservers();

  // Periodic Cadmium hook attempts + deep patching
  const hookInterval = setInterval(() => {
    if (window.netflix) {
      patchConfigValues(window.netflix);
    }
    hookCadmium();
    if (cadmiumHooked) clearInterval(hookInterval);
  }, 500);

  setTimeout(() => clearInterval(hookInterval), 60000);

  // Initial video ID
  const initialWatchId = getWatchId();
  if (initialWatchId) {
    lastWatchId = initialWatchId;
    currentStats.videoId = initialWatchId;
  }

  // Final status
  console.log('[Netflix 4K] ==========================================');
  console.log('[Netflix 4K] Initialization complete!');
  console.log('[Netflix 4K] ==========================================');
  console.log('[Netflix 4K] Active spoofs:');
  console.log('[Netflix 4K]   - Screen: 3840x2160');
  console.log('[Netflix 4K]   - HDCP: 2.2');
  console.log('[Netflix 4K]   - User-Agent: Edge');
  console.log('[Netflix 4K]   - Codecs: HEVC/VP9/AV1');
  console.log('[Netflix 4K]   - Max bitrate: 16 Mbps');
  console.log('[Netflix 4K]');
  console.log('[Netflix 4K] Press Ctrl+Shift+Alt+D on Netflix to see stream stats');
  if (!can4K) {
    console.log('[Netflix 4K]');
    if (isEdge && edgeVersion < 118) {
      console.log(`[Netflix 4K] Your Edge version (${edgeVersion}) is too old for 4K.`);
      console.log('[Netflix 4K] Update to Edge 118+ at edge://settings/help');
    } else {
      console.log(`[Netflix 4K] ${browserName} uses ${drm} - limited to 1080p.`);
      console.log('[Netflix 4K] For 4K, use Microsoft Edge 118+ on Windows.');
    }
  }
  console.log('[Netflix 4K] ==========================================');

})();

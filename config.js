/* Telegram-ready zero-config deployment settings.
   Never put a bot token in client-side files. */
(() => {
  'use strict';

  let publicUrl = '';
  try {
    const u = new URL(window.location.href);
    const isLocal = /^(localhost|127\.|0\.|\[::1\])/.test(u.hostname);
    if (u.protocol === 'https:' && !isLocal && !u.username && !u.password) {
      // Never share Telegram init data or other query/hash parameters.
      u.search = '';
      u.hash = '';
      publicUrl = u.href;
    }
  } catch {}

  window.GAME_CONFIG = Object.freeze({ publicUrl });
})();

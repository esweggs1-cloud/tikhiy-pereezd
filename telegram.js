/* Telegram is optional and asynchronous: an offline game never waits for the SDK. */
(() => {
  'use strict';
  function init() {
    const tg=window.Telegram?.WebApp;if(!tg)return;
    try {
      tg.ready();tg.expand();
      if(tg.isVersionAtLeast?.('7.7'))tg.disableVerticalSwipes?.();
      tg.setHeaderColor?.('#214c4d');tg.setBackgroundColor?.('#bfd8d0');
      tg.BackButton?.onClick(()=>window.closeGameModal?.());
      window.updateTelegramBack=show=>{try{show?tg.BackButton?.show():tg.BackButton?.hide();}catch{}};
      document.documentElement.classList.add('telegram-mini-app');
    }catch(e){console.warn('Telegram integration unavailable:',e.message);}
  }
  if(window.Telegram?.WebApp){init();return;}
  if(!/tgWebApp/.test(location.hash+location.search))return;
  const script=document.createElement('script');script.src='https://telegram.org/js/telegram-web-app.js';script.async=true;script.onload=init;document.head.append(script);
})();

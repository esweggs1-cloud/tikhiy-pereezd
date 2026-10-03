/* Тихий переезд — Городские истории 4.0 */
(() => {
  'use strict';
  const D = window.GameData, C = window.GameCore, $ = id => document.getElementById(id);
  const icons = {
    wallet: '<path d="M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7"/><path d="M21 12h-5v5h5"/><path d="M17 14.5h.01"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    route: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h9a4 4 0 0 1 0 8H8a2 2 0 0 0 0 4h9"/>',
    'rotate-left': '<path d="M4 10a8 8 0 1 1 0 5M4 4v6h6"/>',
    'rotate-right': '<path d="M20 10a8 8 0 1 0 0 5M20 4v6h-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    expand: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>',
    box: '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M8 5l9 5v5"/>',
    garage: '<path d="m3 9 9-6 9 6v12H3zM7 21V11h10v10M7 15h10M7 18h10"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
    friends: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
    x: '<path d="m6 6 12 12M6 18 18 6"/>',
  };
  function renderIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[el.dataset.icon] || icons.box}</svg>`; }); }
  renderIcons();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => `${Math.round(n).toLocaleString('ru-RU')} ₽`;
  const time = n => `${Math.floor(Math.max(0, n) / 60)}:${String(Math.floor(Math.max(0, n) % 60)).padStart(2, '0')}`;
  const level = () => 1 + Math.floor(state.reputation / 220);
  const vehicle = () => D.vehicles.find(v => v.id === state.vehicle);
  const cargo = () => state.job ? D.cargoes[state.job.cargo] : null;
  let renderer;
  try { renderer = createTownRenderer($('world')); } catch (e) {
    $('hud').classList.add('hidden');
    $('welcome').innerHTML = '<section class="intro"><h2>Городу нужна графика</h2><p>Не удалось включить WebGL. Откройте игру в современном браузере с аппаратным ускорением.</p><button class="primary" id="retry">Попробовать снова</button></section>';
    $('retry').onclick = () => location.reload(); console.error(e); return;
  }
  const nav = new C.Navigation(renderer.blocks);
  let state = C.fresh(), saveOK = true, loadNotice = '';
  for (const key of [C.SAVE_KEY, `${C.SAVE_KEY}-backup`, 'quiet-movers-v3', 'quiet-movers-v2', 'quiet-movers-v1']) {
    try {
      const raw = localStorage.getItem(key); if (!raw) continue;
      state = C.sanitize(JSON.parse(raw));
      if (key !== C.SAVE_KEY) loadNotice = key.includes('backup') ? 'Прогресс восстановлен из резервной копии.' : 'Ваш прогресс перенесён в новую версию.';
      break;
    } catch (e) { if (e.name === 'SecurityError') { saveOK = false; break; } loadNotice = 'Повреждённое сохранение пропущено. Проверяем резервную копию.'; }
  }
  let savedText = null;
  function save() {
    try {
      const raw = JSON.stringify(state);
      if (raw === savedText) return;
      if (savedText) localStorage.setItem(`${C.SAVE_KEY}-backup`, savedText);
      localStorage.setItem(C.SAVE_KEY, raw); savedText = raw; saveOK = true;
    } catch { saveOK = false; }
    $('storageWarning').classList.toggle('hidden', saveOK);
  }
  const repaired = nav.safe(state);
  if (repaired.x !== state.x || repaired.z !== state.z) { Object.assign(state, repaired); loadNotice = 'Вы перенесены на свободное место рядом с прежней позицией.'; }
  renderer.snap(state);
  let started = false, paused = false, lostContext = false, keys = {}, stick = {x:0,y:0}, joystickId = null;
  let loading = false, loadProgress = 0, yaw = .62, zoom = innerWidth < 700 ? 29 : 31, overview = false;
  let route = [], routeIndex = 1, routeFrom = {x:Infinity,z:Infinity}, routeKey = '', routeCooldown = 0, auto = false;
  let waypoint = null, race = null, boost = 1, boostPressed = false, boostLocked = false;
  let confetti = 0, toastRemaining = 0, last = 0, uiElapsed = 0, saveElapsed = 0, checkElapsed = 0, soundContext;
  let shopTab = 'vehicles', exploreTab = 'districts', jobFilter = 'all', offers = [], offerStamp = '', demandType = 'move';
  let modalKind = '', lastFocus = null, renderInfo = {minutes:970,night:0};
  const modalOpen = () => !$('modal').classList.contains('hidden');
  const currentTarget = () => race ? {x:race.def.points[race.index][0],z:race.def.points[race.index][1],name:`Ворота ${race.index}/${race.def.points.length-1}`} : state.job ? C.jobTarget(state) : waypoint;
  const distance = () => { const p = currentTarget(); return p ? Math.hypot(state.x-p.x,state.z-p.z) : 0; };
  function clearInput() { keys = {}; stick = {x:0,y:0}; boostPressed = false; joystickId = null; $('stick').style.transform = ''; }
  function toast(text, duration = 4) { $('toast').textContent = text; $('toast').classList.add('visible'); toastRemaining = duration; }
  function sound(notes) {
    if (!state.settings.sound) return;
    try {
      soundContext ??= new (window.AudioContext || window.webkitAudioContext)(); soundContext.resume().catch(()=>{});
      notes.forEach((n, i) => { const o = soundContext.createOscillator(), g = soundContext.createGain(), at = soundContext.currentTime+i*.1; o.type='sine';o.frequency.value=n;o.connect(g);g.connect(soundContext.destination);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.045,at+.01);g.gain.exponentialRampToValueAtTime(.001,at+.25);o.start(at);o.stop(at+.3); });
    } catch {}
  }
  function haptic(type = 'success') { if(state.settings.haptics)try{window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);}catch{} }
  function modal(html, kind = '') {
    if (!modalOpen()) lastFocus = document.activeElement;
    modalKind = kind; clearInput(); $('toast').classList.remove('visible'); toastRemaining=0; $('modalContent').innerHTML = html; $('modal').classList.remove('hidden');
    $('hud').inert = true; $('welcome').inert = true; renderIcons($('modal')); $('modal').querySelector('.dialog').scrollTop = 0; $('close').focus({preventScroll:true});
    window.updateTelegramBack?.(true);
  }
  function closeModal() {
    if(lostContext)return;
    $('modal').classList.add('hidden'); $('hud').inert = !started; $('welcome').inert = started; modalKind=''; clearInput(); paused=false;
    window.updateTelegramBack?.(false); if(lastFocus?.isConnected && !lastFocus.closest('[inert]')) lastFocus.focus({preventScroll:true});
  }
  window.closeGameModal = closeModal;
  function title(overline, heading, sub = '') { return `<div class="eyebrow">${overline}</div><h2 id="modalTitle">${heading}</h2>${sub?`<p>${sub}</p>`:''}`; }
  function invalidateRoute() { routeKey='';routeCooldown=0;route=[];routeIndex=1; }
  function refreshRoute(force = false) {
    const p = currentTarget(); if(!p){route=[];auto=false;return;}
    const key = `${p.x}:${p.z}`;
    if(!force && key===routeKey && (auto || Math.hypot(state.x-routeFrom.x,state.z-routeFrom.z)<8)) return;
    routeKey=key;routeFrom={x:state.x,z:state.z};route=nav.path(state,p);routeIndex=1;
    if(!route.length && auto){auto=false;toast('Маршрут не построен. Попробуйте выехать на ближайшую улицу.');}
  }
  function districtAt(p = state) {
    return D.districts.reduce((best,d)=>Math.hypot(p.x-d.x,p.z-d.z)<Math.hypot(p.x-best.x,p.z-best.z)?d:best,D.districts[0]);
  }
  function renderUI() {
    $('money').textContent=money(state.money);$('level').textContent=level();$('vehicleName').textContent=vehicle().name;$('vehicleIcon').innerHTML='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">'+(vehicle().cap>=3?'<path d="M3 10h17v15H3zM20 16h5l5 5v4H20M23 17v4h6"/><circle cx="9" cy="25" r="3" fill="#f8f2de"/><circle cx="25" cy="25" r="3" fill="#f8f2de"/>':'<circle cx="7" cy="24" r="4"/><circle cx="25" cy="24" r="4"/><path d="M7 24h13l5-17h-5M25 24l-2-12"/><path d="M14 21v-8l5-4"/><circle cx="18" cy="5" r="2"/>')+'</svg>';
    $('district').textContent=districtAt().name;
    const min=Math.floor(renderInfo.minutes),hour=Math.floor(min/60);
    $('gameClock').textContent=`${String(hour).padStart(2,'0')}:${String(min%60).padStart(2,'0')} · ${renderInfo.night>.5?'ночные огни':hour>=18?'золотой час':'тёплый день'}`;
    $('boostFill').style.width=`${boost*100}%`;
    $('jobSteps').classList.toggle('hidden',!state.job);
    $('autopilot').classList.toggle('hidden',!currentTarget()||!!race);
    $('autopilot').classList.toggle('active',auto);$('autopilot').querySelector('span').textContent=auto?'Остановить автопилот':'Автопилот';
    $('cancelJob').classList.toggle('hidden',!state.job&&!race&&!waypoint);
    $('cancelJob').textContent=race?'Завершить заезд':state.job?'Отменить заказ':'Убрать маршрут';
    $('loadBar').classList.toggle('hidden',!loading);$('loadBar').firstElementChild.style.width=`${loadProgress*100}%`;
    let action='Выбрать заказ',distanceText='Можно просто кататься и искать маленькие открытия';
    if (race) {
      $('jobEyebrow').textContent='ГОРОДСКОЙ ЗАЕЗД';$('jobTitle').textContent=race.def.name;$('jobText').textContent=`Пройдите светящиеся ворота по порядку. Осталось ${race.def.points.length-race.index}.`;
      $('cargoTag').textContent=`ВОРОТА ${race.index}/${race.def.points.length-1}`;$('reward').textContent=time(race.elapsed);action='Заезд идёт';distanceText=`${Math.round(distance())} м до ворот · цель ${time(race.def.par)}`;
    } else if (state.job) {
      const j=state.job,c=cargo(),info=D.jobTypeInfo[c.type],p=C.jobTarget(state);
      $('jobEyebrow').textContent=j.storyId?'ИСТОРИЯ ГОРОДА':j.tutorial?'ВАША ПЕРВАЯ ДОСТАВКА':'ВЫ ДЕЛАЕТЕ ГОРОД УЮТНЕЕ';
      $('jobTitle').textContent=j.stage==='pickup'?c.name:j.stops.length>1?`Остановка ${j.stopIndex+1} из ${j.stops.length}`:'Доставим с заботой';
      $('jobText').textContent=j.stage==='pickup'?`${p.name}. Подъезжайте к золотому кругу.`:`${p.name}. Маршрут уже на карте.`;
      $('cargoTag').textContent=info.label;$('reward').textContent=`+ ${money(j.pay)}`;
      $('step1Text').textContent=info.pickupText;$('step2Text').textContent=info.deliverText;
      $('step1').className=j.stage==='pickup'?'active':'done';$('step2').className=j.stage==='deliver'?'active':'';
      action=loading?`Действие… ${Math.round(loadProgress*100)}%`:distance()<5.6?(j.stage==='pickup'?'Забрать · E':c.type==='service'?'Починить · E':'Передать · E'):auto?'Едем к цели…':'Показать маршрут';
      distanceText=`${Math.round(distance())} м до цели${j.express?` · ${j.remaining>0?`⚡ ${time(j.remaining)} · +${money(j.expressBonus)}`:'Бонус за скорость истёк'}`:' · без спешки'}`;
    } else if (waypoint) {
      $('jobEyebrow').textContent=waypoint.raceId?'НА СТАРТ':'МАЛЕНЬКОЕ ОТКРЫТИЕ';$('jobTitle').textContent=waypoint.name;$('jobText').textContent=waypoint.photoId?'Подъезжайте к месту и добавьте открытку в альбом.':'Следуйте по мятным точкам на дороге.';
      $('cargoTag').textContent=waypoint.photoId?'ГОРОДСКОЙ АЛЬБОМ':waypoint.raceId?'ЗАЕЗД':'НАВИГАТОР';$('reward').textContent=waypoint.photoId?'+ 120 ₽':'';
      action=distance()<6?(waypoint.photoId?'Сделать открытку · E':waypoint.raceId?'Начать заезд · E':'Мы на месте · E'):'Показать маршрут';distanceText=`${Math.round(distance())} м · ${auto?'автопилот включён':'новое место, новая история'}`;
    } else {
      $('jobEyebrow').textContent='ВАША МАЛЕНЬКАЯ КОМПАНИЯ';$('jobTitle').textContent='Куда отправимся?';$('jobText').textContent='Город полон заказов. Или загляните в «Открытия»: там прогулки, заезды и новые районы.';
      $('cargoTag').textContent=`${state.delivered} ЗАКАЗОВ ВЫПОЛНЕНО`;$('reward').textContent='';
    }
    $('action').textContent=action;$('action').disabled=!!race;$('touchAction').textContent=loading?'…':race?'Заезд':currentTarget()&&distance()<6?'Действие':'Маршрут';
    $('distance').textContent=distanceText;
    // Keep the cancel action below the actual card at all desktop sizes.
    if(innerWidth>700)$('cancelJob').style.top=`${$('job').getBoundingClientRect().bottom+9}px`;else $('cancelJob').style.top='';
  }
  function acceptJob(offer) {
    if(state.job||race)return;
    const j=C.sanitizeJob(offer,state);if(!j){toast('Этот заказ не подходит для вашего транспорта. Обновили подборку.');offerStamp='';showJobs();return;}
    state.job=j;waypoint=null;auto=false;loading=false;loadProgress=0;invalidateRoute();save();closeModal();renderUI();refreshRoute(true);
    toast(`Сначала: ${D.pickupPoints[cargo().pickup].name}. Езжайте по мятному маршруту или нажмите N.`,6);sound([392,523]);
  }
  function updateOffers() {
    const stamp=`${Math.floor(Date.now()/300000)}:${state.vehicle}:${state.delivered}`;
    if(stamp!==offerStamp){const result=C.makeOffers(state);offers=result.offers;demandType=result.demandType;offerStamp=stamp;}
  }
  function showJobs(filter = jobFilter) {
    if(race){toast('Сначала закончите заезд.');return;}
    if(state.job){modal(title('У ВАС УЖЕ ЕСТЬ ДЕЛО','Один заказ за раз',`${cargo().name} · ${money(state.job.pay)}`)+'<button id="returnJob" class="primary">Вернуться к доставке →</button><button id="cancelActive" class="text-button danger">Отменить текущий заказ</button>','active-job');$('returnJob').onclick=closeModal;$('cancelActive').onclick=cancelCurrent;return;}
    jobFilter=filter;updateOffers();
    const types=[...new Set(offers.map(j=>D.cargoes[j.cargo].type))];
    if(filter!=='all'&&!types.includes(filter))jobFilter='all';
    modal(title('ДИСПЕТЧЕРСКАЯ','Найдём дело по душе','Срочный заказ даёт дополнительный бонус. Время в меню и свёрнутой игре не расходуется.')+
      `<div class="note">Сегодня в спросе: <b>${D.jobTypeInfo[demandType].icon} ${D.jobTypeInfo[demandType].label}</b> · оплата +25%</div>`+
      `<nav class="filter-tabs"><button data-filter="all" class="${jobFilter==='all'?'selected':''}">Все</button>${types.map(type=>`<button data-filter="${type}" class="${jobFilter===type?'selected':''}">${D.jobTypeInfo[type].icon} ${D.jobTypeInfo[type].label}</button>`).join('')}</nav>`+
      `<div class="items">${offers.map((j,i)=>{
        const c=D.cargoes[j.cargo],info=D.jobTypeInfo[c.type];if(jobFilter!=='all'&&c.type!==jobFilter)return '';
        return `<article class="item"><div class="item-top"><span class="emoji">${info.icon}</span><div class="badges">${j.tutorial?'<span class="badge green">ЛЁГКИЙ СТАРТ</span>':''}${j.hot?'<span class="badge">СПРОС +25%</span>':''}${j.express?'<span class="badge green">⚡ СРОЧНЫЙ</span>':''}</div></div><h3>${c.name}</h3><p>${D.pickupPoints[c.pickup].name}<br>→ ${D.locations[j.dest].name}${j.stops.length>1?`<br>Маршрут: ${j.stops.length} остановки`:''}${j.express?`<br>Бонус: +${money(j.expressBonus)}`:''}</p><button class="primary" data-offer="${i}">Принять <span>+ ${money(j.pay)}</span></button></article>`;
      }).join('')}</div><p class="refresh-note" id="offerCountdown"></p>`, 'jobs');
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>showJobs(b.dataset.filter));
    document.querySelectorAll('[data-offer]').forEach(b=>b.onclick=()=>acceptJob(offers[Number(b.dataset.offer)]));
  }
  function interact() {
    if(!started||modalOpen()||paused||race)return;
    if(!currentTarget()){showJobs();return;}
    if(distance()>=5.6){refreshRoute(true);toast('Мятные точки ведут к цели. N или кнопка маршрута — автопилот.');return;}
    auto=false;
    if(state.job){if(!loading){loading=true;loadProgress=0;sound([330,440]);}return;}
    if(waypoint?.photoId){
      const p=D.landmarks.find(p=>p.id===waypoint.photoId);
      if(!state.photos.includes(p.id)){state.photos.push(p.id);state.money+=120;state.reputation+=20;confetti=2.5;save();sound([523,659,784]);}
      waypoint=null;invalidateRoute();modal(title('ГОРОДСКОЙ АЛЬБОМ',p.name,p.desc)+`<div class="result"><span class="emoji">📸</span><h3>Открытка в вашей коллекции</h3><p>${state.photos.length} из ${D.landmarks.length} мест. За каждое новое место — 120 ₽ и 20 очков репутации.</p><button id="photoContinue" class="primary">Искать новые истории →</button></div>`,'photo');$('photoContinue').onclick=closeModal;
    }else if(waypoint?.raceId){const def=D.races.find(r=>r.id===waypoint.raceId);race={def,index:1,elapsed:0};waypoint=null;invalidateRoute();overview=false;toast('Поехали! Пройдите все ворота. Shift — ускорение.',5);sound([330,440,660]);}
    else {toast(`Вы приехали: ${waypoint.name}`);waypoint=null;invalidateRoute();}
    renderUI();
  }
  function finishLoading() {
    loading=false;loadProgress=0;const result=C.finishStage(state);if(!result)return;
    invalidateRoute();auto=false;save();renderUI();
    if(result.stage==='loaded'){toast('Всё готово! Теперь к месту назначения.');sound([440,554,660]);}
    else if(result.stage==='next'){toast(`Отлично! Следующая остановка: ${C.jobTarget(state).name}`);sound([440,660]);}
    else {
      confetti=2.5;haptic();sound([523,659,784,1046]);offerStamp='';
      modal(title('ЕЩЁ ОДНА ХОРОШАЯ ИСТОРИЯ','Доставлено с заботой',`Ваша компания завершила ${state.delivered} ${state.delivered===1?'заказ':'заказов'}.`)+
        `<div class="result"><span class="chip">ОПЛАТА ПОЛУЧЕНА</span><div class="result-total">+ ${money(result.total)}</div><dl><dt>Заказ</dt><dd>${money(result.base)}</dd>${[['property','Доход от зданий'],['express','Бонус за скорость'],['streak','Серия доставок'],['milestone','Пятая доставка']].filter(([k])=>result[k]).map(([k,label])=>`<dt>${label}</dt><dd>+ ${money(result[k])}</dd>`).join('')}<dt>Репутация</dt><dd>+ ${result.reputation}</dd></dl></div><div class="button-row"><button id="nextJob" class="primary">Новый заказ →</button><button id="afterDrive" class="secondary">Покататься</button></div>`, 'result');
      $('nextJob').onclick=()=>showJobs('all');$('afterDrive').onclick=closeModal;
    }
  }
  function cancelCurrent() {
    if(!state.job&&!race){waypoint=null;auto=false;invalidateRoute();closeModal();renderUI();return;}
    modal(title('МОЖНО И ПЕРЕДУМАТЬ',race?'Завершить заезд?':'Отменить заказ?',race?'Текущая попытка не попадёт в рекорды.':'Деньги останутся у вас. Текущая серия доставок прервётся.')+'<div class="button-row"><button id="keepJob" class="primary">Продолжить</button><button id="confirmCancel" class="secondary">Да, отменить</button></div>','cancel');
    $('keepJob').onclick=closeModal;$('confirmCancel').onclick=()=>{if(state.job){state.job=null;state.streak=0;}race=null;waypoint=null;auto=false;loading=false;loadProgress=0;invalidateRoute();save();closeModal();renderUI();toast('Теперь можно выбрать новое приключение.');};
  }
  function shop(which = shopTab) {
    shopTab=which;C.ensureDaily(state);
    const tabs={vehicles:'Транспорт',buildings:'Компания',strength:'Улучшения',career:'Карьера'};
    let html=title('ВАША МАЛЕНЬКАЯ КОМПАНИЯ','Большие планы',`${money(state.money)} в кошельке · уровень ${level()} · ${state.delivered} доставок`)+`<nav class="tabs">${Object.entries(tabs).map(([id,label])=>`<button data-shop-tab="${id}" class="${which===id?'selected':''}">${label}</button>`).join('')}</nav><div class="items">`;
    if(which==='vehicles')html+=D.vehicles.map(v=>{const own=state.owned.includes(v.id),selected=state.vehicle===v.id,locked=!!race||state.job&&cargo().cap>v.cap;return `<article class="item"><span class="emoji">${v.icon}</span><h3>${v.name}</h3><p>${v.desc}<br>Скорость ${v.speed} · вместимость ${v.cap}/3</p><button class="primary" data-vehicle="${v.id}" ${selected||locked||!own&&state.money<v.price?'disabled':''}>${selected?'Ваш транспорт':locked?'После задания':own?'Выбрать':money(v.price)}</button></article>`;}).join('');
    if(which==='buildings')html+=D.properties.map(p=>`<article class="item"><span class="emoji">${p.icon}</span><h3>${p.name}</h3><p>${p.desc}</p><button class="primary" data-property="${p.id}" ${state.properties.includes(p.id)||state.money<p.price?'disabled':''}>${state.properties.includes(p.id)?'Ваша компания':money(p.price)}</button></article>`).join('');
    if(which==='strength')html+=`<article class="item"><span class="emoji">💪</span><h3>Опыт грузчика · ${state.strength}/5</h3><p>Быстрее погрузка, легче дорога. Каждый уровень немного увеличивает скорость.</p><button id="train" class="primary" ${state.strength>=5||state.money<state.strength*350?'disabled':''}>${state.strength>=5?'Максимальный уровень':`Тренироваться · ${money(state.strength*350)}`}</button></article><article class="item"><span class="emoji">⚡</span><h3>Попутный ветер</h3><p>Зажмите Shift или кнопку молнии на телефоне. Ускорение постепенно восстанавливается, когда вы отдыхаете.</p><span class="chip">ДОСТУПНО С ПЕРВОЙ ПОЕЗДКИ</span></article>`;
    if(which==='career'){
      const ds=C.dailySpec(state);
      html+=`<article class="item career-hero"><div class="item-top"><span class="emoji">⭐</span><span class="count">${level()} уровень</span></div><h3>Репутация вашей компании</h3><p>${state.reputation} очков · ещё ${220-state.reputation%220} до следующего уровня.<br>Лучшая серия: ${state.bestStreak} · в пути: ${(state.odometer/1000).toFixed(1)} км</p><div class="progress"><i style="width:${state.reputation%220/2.2}%"></i></div></article>`;
      html+=`<article class="item"><span class="emoji">📅</span><h3>Дело дня</h3><p>Выполните 3 заказа: ${D.jobTypeInfo[ds.type].label}.<br>${state.dailyProgress}/3 · награда ${money(ds.reward)}</p><button id="daily" class="primary" ${state.dailyClaimed||state.dailyProgress<3?'disabled':''}>${state.dailyClaimed?'Награда получена':'Забрать награду'}</button></article>`;
      html+=D.questDefs.map(q=>{const value=Math.min(q.goal,q.value(state)),done=state.claimedQuests.includes(q.id);return `<article class="item"><span class="emoji">${done?'✅':'🏅'}</span><h3>${q.title}</h3><p>${q.desc}<br>${value}/${q.goal} · ${money(q.reward)}</p><div class="progress"><i style="width:${value/q.goal*100}%"></i></div><button class="primary" data-quest="${q.id}" ${done||value<q.goal?'disabled':''}>${done?'Получено':'Забрать награду'}</button></article>`;}).join('');
      html+=D.stories.map(st=>{const c=D.cargoes.find(c=>c.kind===st.cargoKind),done=state.storyCompleted.includes(st.id),unlocked=state.delivered>=st.unlock,fit=c.cap<=vehicle().cap,locked=state.job||race;return `<article class="item"><span class="emoji">${st.icon}</span><span class="chip">ИСТОРИЯ ГОРОДА</span><h3>${st.title}</h3><p>${st.desc}<br>Награда: ${money(st.pay)}</p><button class="primary" data-story="${st.id}" ${done||!unlocked||!fit||locked?'disabled':''}>${done?'История завершена':!unlocked?`После ${st.unlock} доставок`:!fit?`Нужна вместимость ${c.cap}/3`:locked?'Сначала текущее задание':'Начать историю'}</button></article>`;}).join('');
    }
    modal(html+'</div><p class="refresh-note">Все покупки — только за заработанные игровые рубли.</p>','shop');
    document.querySelectorAll('[data-shop-tab]').forEach(b=>b.onclick=()=>shop(b.dataset.shopTab));
    document.querySelectorAll('[data-vehicle]').forEach(b=>b.onclick=()=>{
      const v=D.vehicles.find(v=>v.id===b.dataset.vehicle);if(race||state.job&&cargo().cap>v.cap)return;
      if(!state.owned.includes(v.id)){if(state.money<v.price)return;state.money-=v.price;state.owned.push(v.id);}
      state.vehicle=v.id;offerStamp='';auto=false;save();renderUI();shop();sound([440,660]);
    });
    document.querySelectorAll('[data-property]').forEach(b=>b.onclick=()=>{const p=D.properties.find(p=>p.id===b.dataset.property);if(state.properties.includes(p.id)||state.money<p.price)return;state.money-=p.price;state.properties.push(p.id);save();renderUI();shop();sound([440,554,660]);});
    if($('train'))$('train').onclick=()=>{const price=state.strength*350;if(state.strength>=5||state.money<price)return;state.money-=price;state.strength++;save();renderUI();shop();};
    document.querySelectorAll('[data-quest]').forEach(b=>b.onclick=()=>{const q=D.questDefs.find(q=>q.id===b.dataset.quest);if(state.claimedQuests.includes(q.id)||q.value(state)<q.goal)return;state.claimedQuests.push(q.id);state.money+=q.reward;state.reputation+=25;save();renderUI();shop('career');sound([523,659,784]);});
    if($('daily'))$('daily').onclick=()=>{C.ensureDaily(state);const d=C.dailySpec(state);if(state.dailyClaimed||state.dailyProgress<3)return;state.dailyClaimed=true;state.money+=d.reward;state.reputation+=30;save();renderUI();shop('career');};
    document.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>{const st=D.stories.find(s=>s.id===b.dataset.story),ci=D.cargoes.findIndex(c=>c.kind===st.cargoKind);if(state.job||race||state.delivered<st.unlock||state.storyCompleted.includes(st.id)||D.cargoes[ci].cap>vehicle().cap)return;acceptJob({cargo:ci,dest:st.dest,stops:[st.dest],stopIndex:0,stage:'pickup',pay:st.pay,storyId:st.id,hot:false,express:false,remaining:0,expressBonus:0});});
  }
  function explore(which = exploreTab) {
    exploreTab=which;
    const tabs={districts:'Районы',album:'Альбом',races:'Заезды',collection:'Находки'};
    let html=title('МАЛЕНЬКИЕ ОТКРЫТИЯ','У города есть истории','Загляните за знакомый поворот. Здесь всегда есть что-то ещё.')+`<nav class="tabs">${Object.entries(tabs).map(([id,label])=>`<button data-explore-tab="${id}" class="${which===id?'selected':''}">${label}</button>`).join('')}</nav>`;
    const busy=state.job||race;
    if(which==='districts')html+=`<div class="note">Открыто ${state.discovered.length} из ${D.districts.length} районов. Новое место даёт 15 очков репутации.</div><div class="items" style="margin-top:14px">${D.districts.map(d=>`<article class="item"><div class="item-top"><span class="emoji">${d.icon}</span><span class="badge ${state.discovered.includes(d.id)?'green':''}">${state.discovered.includes(d.id)?'ОТКРЫТ':'НЕИЗВЕСТНОЕ МЕСТО'}</span></div><h3>${d.name}</h3><p>${d.desc}</p><button class="primary" data-district="${d.id}" ${busy?'disabled':''}>${busy?'После задания':'Отправиться →'}</button></article>`).join('')}</div>`;
    if(which==='album')html+=`<div class="items">${D.landmarks.map(p=>`<article class="item"><span class="emoji">${state.photos.includes(p.id)?'📷':'📍'}</span><h3>${p.name}</h3><p>${p.desc}<br>За открытку: 120 ₽ и 20 очков репутации.</p><button class="primary" data-photo="${p.id}" ${state.photos.includes(p.id)||busy?'disabled':''}>${state.photos.includes(p.id)?'В альбоме':busy?'После задания':'Найти это место →'}</button></article>`).join('')}</div>`;
    if(which==='races')html+=`<div class="note">Езжайте через ворота по порядку. Ускоряйтесь с Shift. Таймер стоит на паузе в меню. Рекорд хранится на этом устройстве.</div><div class="items" style="margin-top:14px">${D.races.map(r=>`<article class="item"><span class="emoji">${r.icon}</span><h3>${r.name}</h3><p>${r.desc}<br>Цель: ${time(r.par)} · награда за первый финиш: ${money(r.reward)}<br>Ваш рекорд: ${state.bestTimes[r.id]?time(state.bestTimes[r.id]):'ещё впереди'}</p><button class="primary" data-race="${r.id}" ${busy?'disabled':''}>${busy?'После задания':'К старту →'}</button></article>`).join('')}</div>`;
    if(which==='collection')html+=`<div class="result"><span class="count">${state.souvenirs.length} / ${D.souvenirs.length}</span><h3>Маленькие сокровища города</h3><p>Ищите золотые кубики во дворах и у достопримечательностей. Подъезжайте ближе, чтобы забрать находку.</p><div class="collection">${D.souvenirs.map(s=>`<span class="${state.souvenirs.includes(s.id)?'found':''}">${state.souvenirs.includes(s.id)?'✓':'○'} ${s.name}</span>`).join('')}</div></div>`;
    modal(html,'explore');
    document.querySelectorAll('[data-explore-tab]').forEach(b=>b.onclick=()=>explore(b.dataset.exploreTab));
    document.querySelectorAll('[data-district]').forEach(b=>b.onclick=()=>{
      if(state.job||race)return;const d=D.districts.find(d=>d.id===b.dataset.district);
      modal(title('НОВЫЙ ПОВОРОТ',d.name,d.desc)+`<div class="button-row"><button id="walkThere" class="primary">Проложить маршрут</button><button id="travelThere" class="secondary">Быстрый переход</button></div><p class="refresh-note">Быстрый переход доступен в свободной поездке.</p>`,'travel');
      $('walkThere').onclick=()=>{waypoint={name:d.name,x:d.x,z:d.z};invalidateRoute();closeModal();refreshRoute(true);renderUI();};
      $('travelThere').onclick=()=>{if(state.job||race)return;Object.assign(state,nav.safe(d));waypoint=null;auto=false;overview=false;renderer.snap(state);invalidateRoute();checkDiscoveries();save();closeModal();renderUI();toast(`Добро пожаловать: ${d.name}`);};
    });
    document.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>{if(state.job||race)return;const p=D.landmarks.find(p=>p.id===b.dataset.photo);waypoint={...p,photoId:p.id};invalidateRoute();closeModal();refreshRoute(true);renderUI();});
    document.querySelectorAll('[data-race]').forEach(b=>b.onclick=()=>{if(state.job||race)return;const r=D.races.find(r=>r.id===b.dataset.race);waypoint={name:r.name,x:r.points[0][0],z:r.points[0][1],raceId:r.id};invalidateRoute();closeModal();refreshRoute(true);renderUI();toast('Доберитесь до стартового круга и нажмите E.');});
  }
  function shareUrl() { return C.publicUrl(window.GAME_CONFIG?.publicUrl)||state.shareUrl||C.publicUrl(location.href); }
  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); toast('Ссылка скопирована.'); }
    catch { toast('Не удалось скопировать автоматически. Используйте системное меню «Поделиться».'); }
  }
  function friends() {
    const url=shareUrl();
    modal(title('ХОРОШЕЕ ЛУЧШЕ ДЕЛИТЬ','Пригласите друзей','Отправьте ссылку или покажите QR-код. Пусть у каждого появится своя история в этом городе.')+
      `<div class="friends-layout"><div id="qr" class="qr-wrap">${url?'':'<div class="qr-empty"><span class="emoji">↗</span><p>Здесь появится QR-код<br>ссылки на вашу игру</p></div>'}</div><div><h3>Встретимся на улицах?</h3><p>Одинаковые городские заезды — отличный повод сравнить рекорды. В этой версии каждый играет и сохраняет прогресс на своём устройстве.</p><button id="shareGame" class="primary" ${url?'':'disabled'}>Пригласить друга ↗</button><button id="copyGame" class="text-button" ${url?'':'disabled'}>Скопировать ссылку</button><div class="share-link">${esc(url)}</div></div></div>`+
      `<p class="refresh-note">Ссылка определяется автоматически после публикации игры по HTTPS. Ничего прописывать в config.js не нужно.</p>`, 'friends');
    if(url)try{new QRCode($('qr'),{text:url,width:160,height:160,colorDark:'#234e50',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}catch{$('qr').textContent='QR-код не поместился. Используйте более короткую ссылку.';}
    $('copyGame').onclick=()=>copyText(url);
    $('shareGame').onclick=async()=>{
      const records=D.races.filter(r=>state.bestTimes[r.id]).map(r=>`${r.name}: ${time(state.bestTimes[r.id])}`).join(', ');
      const text=`Тихий переезд — маленький город, большие истории. ${records?`Мои рекорды: ${records}. Попробуешь быстрее?`:'Поехали кататься!'}`;
      try {
        if(window.Telegram?.WebApp?.initData){window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);}
        else if(navigator.share)await navigator.share({title:'Тихий переезд',text,url});
        else await copyText(url);
      }catch(e){if(e.name!=='AbortError')await copyText(url);}
    };
  }
  function exportSave() {
    save();const blob=new Blob([JSON.stringify({game:'quiet-movers',version:4,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`quiet-movers-${C.dayId()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Копия прогресса подготовлена.');
  }
  function settings() {
    paused=true;
    modal(title('МОЖНО ПЕРЕВЕСТИ ДУХ','Небольшая остановка','Заказ и таймер ждут вас. Возвращайтесь, когда будете готовы.')+
      '<button id="resume" class="primary">Продолжить поездку →</button>'+
      `<div class="setting"><div>Графика<small>Тени и разрешение изображения</small></div><select id="quality" aria-label="Качество графики">${[['auto','Автоматически'],['high','Высокая'],['low','Лёгкая']].map(([v,l])=>`<option value="${v}" ${state.settings.quality===v?'selected':''}>${l}</option>`).join('')}</select></div>`+
      `<div class="setting"><div>Атмосфера<small>Время суток в вашем городе</small></div><select id="atmosphere" aria-label="Время суток">${[['cycle','Смена дня и ночи'],['day','Солнечный день'],['sunset','Золотой час'],['night','Ночные огни']].map(([v,l])=>`<option value="${v}" ${state.settings.atmosphere===v?'selected':''}>${l}</option>`).join('')}</select></div>`+
      `${[['sound','Звуки игры','Негромкие сигналы действий и наград'],['haptics','Отклик Telegram','Мягкая вибрация за достижения'],['motion','Плавная камера','Выключите, если предпочитаете неподвижную камеру']].map(([k,label,desc])=>`<label class="setting"><div>${label}<small>${desc}</small></div><input type="checkbox" data-setting="${k}" ${state.settings[k]?'checked':''}></label>`).join('')}`+
      '<div class="button-row"><button id="exportSave" class="secondary">Скачать прогресс</button><button id="importSave" class="secondary">Загрузить прогресс</button></div><input id="saveFile" type="file" accept=".json,application/json" class="hidden"><div class="button-row"><button id="rescue" class="secondary">Вернуться на улицу</button><button id="howTo" class="secondary">Как играть</button></div><button id="reset" class="text-button danger">Начать новую историю</button><p class="refresh-note">Тихий переезд · Городские истории 4.0</p>','settings');
    $('resume').onclick=closeModal;
    for(const k of ['quality','atmosphere'])$(k).onchange=()=>{state.settings[k]=$(k).value;save();};
    document.querySelectorAll('[data-setting]').forEach(el=>el.onchange=()=>{state.settings[el.dataset.setting]=el.checked;save();if(el.dataset.setting==='sound')sound([440,660]);});
    $('exportSave').onclick=exportSave;$('importSave').onclick=()=>$('saveFile').click();
    $('saveFile').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;if(file.size>1000000){toast('Файл слишком большой. Нужна JSON-копия прогресса.');return;}
      try {
        const raw=JSON.parse(await file.text());if(raw.game&&raw.game!=='quiet-movers')throw Error('Не тот формат');const imported=C.sanitize(raw);
        modal(title('ВАША ДРУГАЯ ИСТОРИЯ','Загрузить этот прогресс?',`${imported.delivered} доставок · ${money(imported.money)}. Текущий прогресс будет заменён.`)+'<div class="button-row"><button id="confirmImport" class="primary">Загрузить</button><button id="cancelImport" class="secondary">Отмена</button></div>','import');
        $('cancelImport').onclick=settings;$('confirmImport').onclick=()=>{state=imported;Object.assign(state,nav.safe(state));race=null;waypoint=null;auto=false;loading=false;loadProgress=0;boost=1;offerStamp='';invalidateRoute();renderer.snap(state);save();closeModal();renderUI();toast('Прогресс загружен. С возвращением!');};
      }catch{toast('Не удалось прочитать прогресс. Ваше текущее сохранение не изменилось.');}
    };
    $('rescue').onclick=()=>{
      if(race){toast('Сначала завершите заезд.');return;}
      const candidates=D.ROAD_GRID.flatMap(v=>[{x:v,z:state.z},{x:state.x,z:v}]).filter(p=>!nav.blocked(p.x,p.z));candidates.sort((a,b)=>Math.hypot(a.x-state.x,a.z-state.z)-Math.hypot(b.x-state.x,b.z-state.z));
      Object.assign(state,candidates[0]||{x:-24,z:0});auto=false;loading=false;loadProgress=0;invalidateRoute();renderer.snap(state);save();closeModal();renderUI();toast('Снова на свободной улице. Заказ сохранён.');
    };
    $('howTo').onclick=help;
    $('reset').onclick=()=>{modal(title('ЧИСТЫЙ ЛИСТ','Начать новую историю?','Покупки, деньги и достижения будут сброшены. Можно сначала скачать копию прогресса.')+'<div class="button-row"><button id="backupReset" class="secondary">Скачать копию</button><button id="confirmReset" class="primary">Начать заново</button></div>','reset');$('backupReset').onclick=exportSave;$('confirmReset').onclick=()=>{state=C.fresh();state.seen=true;race=null;waypoint=null;auto=false;loading=false;loadProgress=0;boost=1;offerStamp='';invalidateRoute();renderer.snap(state);save();closeModal();renderUI();toast('Новый день, новая история.');};};
  }
  function help() {
    modal(title('УСТРАИВАЙТЕСЬ ПОУДОБНЕЕ','Как устроен город')+
      '<div class="help-grid"><p><b>1. Возьмите заказ</b><br>В диспетчерской есть 8 видов работы. Тяжёлым грузам нужен транспорт побольше.</p><p><b>2. Подъезжайте к кругу</b><br>Золотой маркер — цель. Нажмите E или «Действие», чтобы забрать и передать груз.</p><p><b>3. Следуйте маршруту</b><br>Мятные точки обходят дома и реку. N включает автопилот. Ручное управление его останавливает.</p><p><b>4. Откройте свою историю</b><br>В гараже — транспорт, здания и карьера. В открытиях — альбом, районы и заезды.</p></div>'+
      '<p><b>WASD / стрелки</b> — ехать по направлению экрана. <b>Shift</b> — ускорение. <b>E / пробел</b> — действие. <b>Q / R</b> — камера. <b>M</b> — карта. <b>G</b> — гараж. <b>J</b> — заказы. <b>N</b> — автопилот. <b>Esc / P</b> — пауза.</p><p>На телефоне двигайте джойстик. Время срочного заказа приостанавливается в меню и при сворачивании. Штрафа за опоздание нет.</p><button id="helpDone" class="primary">Всё понятно →</button>','help');$('helpDone').onclick=closeModal;
  }
  const mapContext=$('minimap').getContext('2d');
  function drawMap(ctx,W,H,large=false) {
    const S=Math.min(W,H)/(D.WORLD_LIMIT*2+26),cx=W/2,cz=H/2,px=x=>cx+x*S,pz=z=>cz+z*S;
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#e9efdf';ctx.fillRect(0,0,W,H);ctx.fillStyle='#bdded4';ctx.fillRect(px(65),0,25*S,H);
    ctx.strokeStyle='#ced8cd';ctx.lineWidth=Math.max(1,8*S);for(const v of D.ROAD_GRID){ctx.beginPath();ctx.moveTo(px(-220),pz(v));ctx.lineTo(px(220),pz(v));ctx.moveTo(px(v),pz(-220));ctx.lineTo(px(v),pz(220));ctx.stroke();}
    ctx.fillStyle='#adc0b1';for(const b of renderer.blocks)ctx.fillRect(px(b.x-b.w/2),pz(b.z-b.d/2),Math.max(1,b.w*S),Math.max(1,b.d*S));
    if(route.length>1){ctx.strokeStyle='#66af96';ctx.lineWidth=large?3:2.5;ctx.lineCap='round';ctx.beginPath();route.forEach((p,i)=>i?ctx.lineTo(px(p.x),pz(p.z)):ctx.moveTo(px(p.x),pz(p.z)));ctx.stroke();}
    ctx.fillStyle='#cfb364';for(const p of D.souvenirs){if(state.souvenirs.includes(p.id))continue;ctx.beginPath();ctx.arc(px(p.x),pz(p.z),large?3:2,0,Math.PI*2);ctx.fill();}
    if(large){ctx.font='11px Arial';ctx.textAlign='center';for(const d of D.districts){ctx.fillStyle='#688779';ctx.fillText(d.name,px(d.x),pz(d.z)-12);}}
    const goal=currentTarget();if(goal){ctx.fillStyle='#dc9158';ctx.beginPath();ctx.arc(px(goal.x),pz(goal.z),large?6:4.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff9e9';ctx.lineWidth=2;ctx.stroke();}
    ctx.save();ctx.translate(px(state.x),pz(state.z));ctx.rotate(-state.angle);ctx.fillStyle='#28565b';ctx.strokeStyle='#fff9e9';ctx.lineWidth=2;const size=large?9:7;ctx.beginPath();ctx.moveTo(0,size);ctx.lineTo(-size*.65,-size*.7);ctx.lineTo(0,-size*.35);ctx.lineTo(size*.65,-size*.7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  function showMap() {refreshRoute(true);modal(title('ГОРОД НА ЛАДОНИ','Здесь столько всего',`${D.districts.length} районов · мятная линия — ваш маршрут · золотые точки — находки`)+`<canvas id="largeMap" class="map-large" width="900" height="720" aria-label="Большая карта города"></canvas><div class="button-row"><button id="mapDrive" class="primary">Вернуться в город →</button><button id="viewCity" class="secondary">Вид сверху</button></div>`,'map');drawMap($('largeMap').getContext('2d'),900,720,true);$('mapDrive').onclick=closeModal;$('viewCity').onclick=()=>{overview=!overview;closeModal();toast(overview?'Общий вид города. Нажмите M, чтобы открыть карту.':'Снова рядом с вами.');};}
  function checkDiscoveries() {
    const d=districtAt();if(!state.discovered.includes(d.id)){state.discovered.push(d.id);state.reputation+=15;toast(`Открыт район: ${d.name} · +15 репутации`);save();}
    for(const s of D.souvenirs){if(!state.souvenirs.includes(s.id)&&Math.hypot(state.x-s.x,state.z-s.z)<4.5){state.souvenirs.push(s.id);state.money+=s.reward;state.reputation+=15;confetti=2;toast(`${s.name} · +${money(s.reward)}`);sound([659,784,988]);haptic();save();break;}}
  }
  function finishRace() {
    const r=race,previous=state.bestTimes[r.def.id];state.bestTimes[r.def.id]=Math.min(previous||Infinity,r.elapsed);let earned=0;
    if(!state.raceRewards.includes(r.def.id)){state.raceRewards.push(r.def.id);earned=r.def.reward;state.money+=earned;state.reputation+=40;}
    race=null;auto=false;invalidateRoute();save();confetti=2.5;sound([523,659,784,1046]);haptic();
    modal(title('ОТЛИЧНАЯ ПОЕЗДКА','Финиш!',r.def.name)+`<div class="result"><div class="result-total">${time(r.elapsed)}</div><p>${r.elapsed<=r.def.par?'🏅 Норматив выполнен!':'Хороший круг. В следующий раз попробуйте ускорение на прямых.'}<br>${!previous||r.elapsed<previous?'Новый личный рекорд!':`Ваш рекорд: ${time(previous)}`}${earned?`<br>Первый финиш: +${money(earned)}`:''}</p></div><div class="button-row"><button id="raceAgain" class="primary">Ещё приключения →</button><button id="raceDone" class="secondary">Покататься</button></div>`,'race-result');$('raceAgain').onclick=()=>explore('races');$('raceDone').onclick=closeModal;renderUI();
  }
  function toggleAuto() {if(!currentTarget()||race||loading)return;auto=!auto;if(auto){overview=false;refreshRoute(true);toast('Автопилот включён. WASD или джойстик вернут управление вам.');}renderUI();}
  function start(tutorial) {
    started=true;state.seen=true;$('welcome').classList.add('hidden');document.body.classList.remove('welcome-visible');$('hud').inert=false;$('welcome').inert=true;save();renderUI();
    if(tutorial&&!state.job&&!state.delivered){acceptJob(C.makeOffers(state).offers[0]);}
    else if(state.job)refreshRoute(true);
    if(loadNotice){toast(loadNotice);loadNotice='';}
  }
  $('start').textContent=state.seen?'Продолжить историю →':'Начать свою историю →';
  document.body.classList.add('welcome-visible');$('hud').inert=true;
  $('start').onclick=()=>start(!state.seen);$('freeRoam').onclick=()=>start(false);
  $('action').onclick=interact;$('touchAction').onclick=interact;$('autopilot').onclick=toggleAuto;$('cancelJob').onclick=cancelCurrent;
  $('jobs').onclick=()=>showJobs('all');$('shop').onclick=()=>shop();$('career').onclick=()=>shop('career');$('explore').onclick=()=>explore();$('friends').onclick=friends;$('pause').onclick=settings;
  $('brand').onclick=e=>{e.preventDefault();help();};$('overview').onclick=showMap;$('minimap').onclick=showMap;$('close').onclick=closeModal;
  $('modal').onclick=e=>{if(e.target===$('modal'))closeModal();};
  $('collapseJob').onclick=()=>{const collapsed=$('job').classList.toggle('collapsed');$('collapseJob').setAttribute('aria-expanded',String(!collapsed));$('collapseJob').setAttribute('aria-label',collapsed?'Развернуть задание':'Свернуть задание');};
  $('rotateLeft').onclick=()=>yaw+=Math.PI/4;$('rotateRight').onclick=()=>yaw-=Math.PI/4;
  $('zoomIn').onclick=()=>{overview=false;zoom=Math.max(21,zoom-5);};$('zoomOut').onclick=()=>zoom=Math.min(57,zoom+5);
  $('world').addEventListener('wheel',e=>{if(!started||modalOpen())return;e.preventDefault();overview=false;zoom=Math.max(21,Math.min(57,zoom+e.deltaY*.02));},{passive:false});
  const isInput=el=>el?.matches?.('input,select,textarea,[contenteditable=true]');
  window.addEventListener('keydown',e=>{
    if(e.code==='Tab'&&modalOpen()){
      const els=[...$('modal').querySelectorAll('button:not(:disabled),input:not(.hidden),select,a[href]')].filter(el=>el.offsetParent!==null),first=els[0],end=els[els.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();end?.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first?.focus();}return;
    }
    if(isInput(e.target))return;
    if(e.code==='Escape'){e.preventDefault();if(modalOpen())closeModal();else if(started)settings();return;}
    if(!started||modalOpen()||paused)return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    if(e.repeat)return;keys[e.code]=true;
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){auto=false;overview=false;}
    if(['KeyE','Space'].includes(e.code))interact();if(e.code==='KeyG')shop();if(e.code==='KeyJ')showJobs('all');if(e.code==='KeyM')showMap();if(e.code==='KeyN')toggleAuto();if(e.code==='KeyP')settings();
  });
  window.addEventListener('keyup',e=>delete keys[e.code]);
  window.addEventListener('blur',()=>{clearInput();auto=false;save();});
  document.addEventListener('visibilitychange',()=>{clearInput();auto=false;last=0;if(document.hidden){save();if(started&&!modalOpen()){paused=true;settings();}}});
  window.addEventListener('pagehide',save);
  const joystick=$('joystick');
  function moveStick(e) {
    if(e.pointerId!==joystickId)return;const r=joystick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,m=Math.hypot(dx,dy),max=r.width*.32,scale=m>max?max/m:1;
    stick={x:dx*scale/max,y:dy*scale/max};if(m<6)stick={x:0,y:0};$('stick').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;auto=false;overview=false;
  }
  joystick.onpointerdown=e=>{if(!started||modalOpen()||joystickId!==null)return;e.preventDefault();joystickId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);};
  joystick.onpointermove=moveStick;
  joystick.onpointerup=joystick.onpointercancel=joystick.onlostpointercapture=e=>{if(e.pointerId===joystickId){joystickId=null;stick={x:0,y:0};$('stick').style.transform='';}};
  $('boost').onpointerdown=e=>{e.preventDefault();$('boost').setPointerCapture(e.pointerId);boostPressed=true;};$('boost').onpointerup=$('boost').onpointercancel=$('boost').onlostpointercapture=()=>boostPressed=false;
  window.addEventListener('town-context-lost',()=>{save();lostContext=true;paused=true;modal(title('КОРОТКАЯ ТЕХНИЧЕСКАЯ ПАУЗА','Восстановим город','Графический контекст потерян. Ваш прогресс сохранён, если автосохранение доступно.')+'<button id="reloadGraphics" class="primary">Перезапустить графику</button>','context-lost');$('reloadGraphics').onclick=()=>location.reload();});
  window.addEventListener('town-context-restored',()=>location.reload());
  const labelNodes=D.landmarks.map(p=>{const el=document.createElement('span');el.className='world-label';el.textContent=p.name;$('worldLabels').append(el);return {p,el};});
  function updateLabels() {
    const p=currentTarget(),el=$('targetLabel');
    if(p&&started&&!modalOpen()&&!overview){const pos=renderer.project(p,8);if(pos&&pos.x>25&&pos.x<innerWidth-25&&pos.y>85&&pos.y<innerHeight-95&&!(pos.x<$('job').getBoundingClientRect().right+10&&pos.y<$('job').getBoundingClientRect().bottom+24)){el.style.display='block';el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;el.textContent=loading?'СЕКУНДОЧКУ…':`${Math.round(distance())} М · ${distance()<6?'E — ДЕЙСТВИЕ':'ВАША ЦЕЛЬ'} ↓`;}else el.style.display='none';}else el.style.display='none';
    for(const {p,el} of labelNodes){if(!started||modalOpen()||overview||Math.hypot(state.x-p.x,state.z-p.z)>50){el.style.display='none';continue;}const pos=renderer.project(p,7);el.style.display=pos&&pos.x>innerWidth*.27&&pos.x<innerWidth-180&&pos.y>100&&pos.y<innerHeight-180?'block':'none';if(pos){el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;}}
  }
  function movePlayer(dx,dz,speed,dt) {
    const length=Math.hypot(dx,dz);if(length<.01)return;
    dx/=Math.max(1,length);dz/=Math.max(1,length);const oldX=state.x,oldZ=state.z;
    // Substeps prevent tunnelling even on a slow frame or with boost enabled.
    const steps=Math.max(1,Math.ceil(speed*dt/.6));
    for(let i=0;i<steps;i++){let x=state.x+dx*speed*dt/steps,z=state.z+dz*speed*dt/steps;if(!nav.blocked(x,state.z))state.x=x;if(!nav.blocked(state.x,z))state.z=z;}
    const travelled=Math.hypot(state.x-oldX,state.z-oldZ);state.odometer+=travelled;
    if(travelled>.001){const angle=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(angle-state.angle),Math.cos(angle-state.angle));state.angle+=delta*Math.min(1,dt*14);}
    if(auto&&travelled<.001){auto=false;invalidateRoute();toast('Автопилот остановился у препятствия. Построим новый маршрут.');}
  }
  function frame(now) {
    const dt=last?Math.min((now-last)/1000,.075):0;last=now;
    const playing=started&&!modalOpen()&&!paused&&!document.hidden&&!lostContext;
    if(playing){
      state.playTime+=dt;C.ensureDaily(state);
      if(state.job?.express)state.job.remaining=Math.max(0,state.job.remaining-dt);
      if(race)race.elapsed+=dt;
      if(keys.KeyQ)yaw+=dt;if(keys.KeyR)yaw-=dt;
      let sx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+stick.x,sy=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+stick.y;
      let dx=sx*Math.cos(yaw)+sy*Math.sin(yaw),dz=-sx*Math.sin(yaw)+sy*Math.cos(yaw);
      if(auto&&!loading){
        if(distance()<5.1){auto=false;toast('Вы на месте. Нажмите E или «Действие».');}
        else if(route[routeIndex]){let p=route[routeIndex],d=Math.hypot(state.x-p.x,state.z-p.z);while(d<1.3&&routeIndex<route.length-1){routeIndex++;p=route[routeIndex];d=Math.hypot(state.x-p.x,state.z-p.z);}dx=(p.x-state.x)/Math.max(.001,d);dz=(p.z-state.z)/Math.max(.001,d);}
        else auto=false;
      }
      const requestBoost=(keys.ShiftLeft||keys.ShiftRight||boostPressed)&&Math.hypot(dx,dz)>.1&&!loading;
      if(boost<=.005)boostLocked=true;if(!requestBoost&&boost>.2)boostLocked=false;
      const boosting=requestBoost&&!boostLocked&&boost>.005;boost=Math.max(0,Math.min(1,boost+(boosting?-.22:.12)*dt));
      if(!loading)movePlayer(dx,dz,vehicle().speed*(1+(state.strength-1)*.04+(state.properties.includes('gym')?.06:0))*(boosting?1.5:1),dt);
      if(loading){if(!state.job){loading=false;loadProgress=0;}else{loadProgress+=dt/Math.max(.6,1.6-(state.strength-1)*.22);if(loadProgress>=1)finishLoading();}}
      if(race&&distance()<5.5){race.index++;invalidateRoute();sound([523,784]);if(race.index>=race.def.points.length)finishRace();}
      checkElapsed+=dt;if(checkElapsed>.4){checkElapsed=0;checkDiscoveries();}
      routeCooldown-=dt;if(routeCooldown<=0){refreshRoute();routeCooldown=.8;}
    }
    renderInfo=renderer.render(state,document.hidden?0:dt,{playing,yaw,zoom,overview,target:currentTarget(),route,confetti})||renderInfo;
    uiElapsed+=dt;if(uiElapsed>.15){renderUI();drawMap(mapContext,420,340);updateLabels();uiElapsed=0;}
    saveElapsed+=dt;if(saveElapsed>4&&started){save();saveElapsed=0;}
    if(toastRemaining>0){toastRemaining-=dt;if(toastRemaining<=0)$('toast').classList.remove('visible');}confetti=Math.max(0,confetti-dt);
    const cd=$('offerCountdown');if(cd){cd.textContent=`Новая подборка через ${time((300000-Date.now()%300000)/1000)} · транспорт: ${vehicle().name}`;if(modalKind==='jobs'&&offerStamp.split(':')[0]!==String(Math.floor(Date.now()/300000)))showJobs();}
    requestAnimationFrame(frame);
  }
  renderUI();drawMap(mapContext,420,340);$('storageWarning').classList.toggle('hidden',saveOK);requestAnimationFrame(frame);
  // Read-only diagnostics are deliberately kept available for support and regression checks.
  window.gameDiagnostics=()=>({version:4,state:JSON.parse(JSON.stringify(state)),started,playing:started&&!modalOpen()&&!paused,loading,loadProgress,auto,race:race?{id:race.def.id,index:race.index,elapsed:race.elapsed}:null,target:currentTarget(),route:route.map(p=>({...p})),blocked:nav.blocked(state.x,state.z),saveOK,offers:offers.map(j=>({...j})),modal:modalKind,...renderer.stats()});
  window.gameWorldAudit=()=>({locations:D.locations.map(p=>({...p,blocked:nav.blocked(p.x,p.z),reachable:nav.path({x:-24,z:0},p).length>0})),pickups:Object.values(D.pickupPoints).map(p=>({...p,blocked:nav.blocked(p.x,p.z),reachable:nav.path({x:-24,z:0},p).length>0})),districts:D.districts.map(p=>({...p,blocked:nav.blocked(p.x,p.z)})),souvenirs:D.souvenirs.map(p=>({...p,reachable:nav.path({x:-24,z:0},nav.safe(p)).length>0})),blocks:renderer.blocks.map(b=>({...b}))});
})();

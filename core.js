/* Pure game rules: shared by the browser and the regression tests. */
(function (root) {
  'use strict';
  const D = root.GameData || require('./data.js');
  const SAVE_KEY = 'quiet-movers-v4';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const number = (n, fallback, min = 0, max = 1e9) => Number.isFinite(n) ? clamp(n, min, max) : fallback;
  const integer = (n, fallback = 0, max = 1e9) => Math.floor(number(n, fallback, 0, max));
  const dayId = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const hash = str => [...String(str)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 17);
  function random(seed) { let n = seed >>> 0; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); }
  const uniqueIds = (list, definitions) => Array.isArray(list) ? [...new Set(list.filter(id => definitions.some(d => d.id === id)))] : [];
  const fresh = () => ({
    version: 4, money: 350, delivered: 0, reputation: 0, owned: ['scooter'], vehicle: 'scooter',
    properties: [], strength: 1, x: -24, z: 0, angle: Math.PI, job: null, seen: false,
    jobStats: Object.fromEntries(Object.keys(D.jobTypeInfo).map(k => [k, 0])),
    souvenirs: [], claimedQuests: [], storyCompleted: [], discovered: ['center'], photos: [],
    streak: 0, bestStreak: 0, dailyDay: dayId(), dailyProgress: 0, dailyClaimed: false,
    bestTimes: {}, raceRewards: [], odometer: 0, playTime: 0,
    settings: { quality: 'auto', sound: false, haptics: true, atmosphere: 'cycle', motion: true },
    shareUrl: '',
  });
  function sanitizeJob(job, state, now = Date.now()) {
    if (!job || typeof job !== 'object') return null;
    const c = D.cargoes[job.cargo], v = D.vehicles.find(v => v.id === state.vehicle);
    if (!Number.isInteger(job.cargo) || !c || c.cap > v.cap || !['pickup', 'deliver'].includes(job.stage)) return null;
    if (!Number.isInteger(job.dest) || !D.locations[job.dest] || !Number.isFinite(job.pay) || job.pay <= 0) return null;
    const stops = Array.isArray(job.stops) ? job.stops : [job.dest];
    if (!stops.length || stops.length > 5 || stops.some(n => !Number.isInteger(n) || !D.locations[n])) return null;
    const stopIndex = integer(job.stopIndex, 0, stops.length - 1);
    const story = D.stories.find(s => s.id === job.storyId);
    if (job.storyId && (!story || state.storyCompleted.includes(story.id) || D.cargoes[job.cargo].kind !== story.cargoKind || job.dest !== story.dest)) return null;
    return {
      cargo: job.cargo, dest: job.dest, stops: [...stops], stopIndex, stage: job.stage,
      pay: integer(job.pay, c.pay, 30000), hot: job.hot === true, express: job.express === true,
      expressBonus: integer(job.expressBonus, 0, 3000),
      remaining: number(job.remaining, job.deadline ? Math.max(0, ((Number.isFinite(job.deadline) ? job.deadline : now) - now) / 1000) : 0, 0, 900),
      storyId: story?.id || null, tutorial: job.tutorial === true,
    };
  }
  function sanitize(input, now = Date.now()) {
    const s = input?.state || input;
    if (!s || typeof s !== 'object' || Array.isArray(s) || !Number.isFinite(s.money) || !Array.isArray(s.owned)) throw new Error('Некорректный формат сохранения');
    const out = fresh();
    for (const k of ['money', 'delivered', 'reputation', 'streak', 'bestStreak', 'dailyProgress']) out[k] = integer(s[k], out[k]);
    out.reputation = integer(s.reputation, out.delivered * 22);
    out.strength = clamp(integer(s.strength, 1, 5), 1, 5);
    out.owned = uniqueIds(s.owned, D.vehicles);
    if (!out.owned.includes('scooter')) out.owned.unshift('scooter');
    out.vehicle = out.owned.includes(s.vehicle) ? s.vehicle : 'scooter';
    for (const [key, defs] of Object.entries({properties: D.properties, souvenirs: D.souvenirs, claimedQuests: D.questDefs, storyCompleted: D.stories, discovered: D.districts, photos: D.landmarks, raceRewards: D.races})) out[key] = uniqueIds(s[key], defs);
    if (!out.discovered.length) out.discovered = ['center'];
    for (const key of Object.keys(D.jobTypeInfo)) out.jobStats[key] = integer(s.jobStats?.[key]);
    out.x = number(s.x, -24, -D.WORLD_LIMIT, D.WORLD_LIMIT);
    out.z = number(s.z, 0, -D.WORLD_LIMIT, D.WORLD_LIMIT);
    out.angle = number(s.angle, Math.PI, -Math.PI * 1000, Math.PI * 1000) % (Math.PI * 2);
    out.seen = s.seen === true;
    out.odometer = number(s.odometer, 0);
    out.playTime = number(s.playTime, 0);
    out.bestStreak = Math.max(out.streak, out.bestStreak);
    if (s.dailyDay === dayId()) { out.dailyProgress = integer(s.dailyProgress, 0, 3); out.dailyClaimed = s.dailyClaimed === true; }
    for (const r of D.races) if (Number.isFinite(s.bestTimes?.[r.id]) && s.bestTimes[r.id] > 0) out.bestTimes[r.id] = number(s.bestTimes[r.id], 9999, 1, 9999);
    if (['auto', 'high', 'low'].includes(s.settings?.quality)) out.settings.quality = s.settings.quality;
    if (['cycle', 'day', 'night', 'sunset'].includes(s.settings?.atmosphere)) out.settings.atmosphere = s.settings.atmosphere;
    for (const k of ['sound', 'haptics', 'motion']) if (typeof s.settings?.[k] === 'boolean') out.settings[k] = s.settings[k];
    out.shareUrl = publicUrl(s.shareUrl);
    out.job = sanitizeJob(s.job, out, now);
    return out;
  }
  function publicUrl(value) {
    try {
      if (typeof value !== 'string' || value.length > 600) return '';
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password || /^(localhost|127\.|0\.|\[::1\])/.test(u.hostname)) return '';
      // Telegram init data and referral payloads never belong in an invitation.
      u.hash = ''; u.search = ''; return u.href;
    } catch { return ''; }
  }
  function dailySpec(state) {
    const types = ['move', 'food', 'post', 'farm', 'medical'];
    return { type: types[hash(state.dailyDay) % types.length], goal: 3, reward: 700 };
  }
  function ensureDaily(state) {
    if (state.dailyDay !== dayId()) { state.dailyDay = dayId(); state.dailyProgress = 0; state.dailyClaimed = false; }
  }
  function jobTarget(state) {
    if (!state.job) return D.pickupPoints.depot;
    const j = state.job;
    return j.stage === 'pickup' ? D.pickupPoints[D.cargoes[j.cargo].pickup] : D.locations[j.stops[j.stopIndex]];
  }
  function makeOffers(state, now = Date.now()) {
    const vehicle = D.vehicles.find(v => v.id === state.vehicle);
    const allowed = D.cargoes.map((c, i) => i).filter(i => D.cargoes[i].cap <= vehicle.cap);
    const types = [...new Set(allowed.map(i => D.cargoes[i].type))];
    const r = random(hash(`${Math.floor(now / 300000)}:${state.vehicle}:${state.delivered}`));
    const demandType = types[Math.floor(r() * types.length)];
    const offers = types.map((type, n) => {
      const choices = allowed.filter(i => D.cargoes[i].type === type);
      const cargo = choices[Math.floor(r() * choices.length)], c = D.cargoes[cargo], pick = D.pickupPoints[c.pickup];
      const candidates = D.locations.map((p, i) => i).filter(i => Math.hypot(D.locations[i].x - pick.x, D.locations[i].z - pick.z) > 25);
      const stops = [];
      for (let i = 0; i < (c.stops || 1); i++) stops.push(candidates.splice(Math.floor(r() * candidates.length), 1)[0]);
      let dist = 0, p = pick;
      for (const stop of stops) { const next = D.locations[stop]; dist += Math.hypot(next.x - p.x, next.z - p.z); p = next; }
      const hot = type === demandType, express = c.stops ? false : n === 1 || r() > .8;
      return { cargo, dest: stops[0], stops, stopIndex: 0, stage: 'pickup', hot, express,
        expressBonus: express ? Math.round(120 + dist * .65) : 0,
        remaining: express ? clamp(70 + dist / vehicle.speed * 4, 110, 420) : 0,
        pay: Math.round((c.pay + dist * 1.6) * (hot ? 1.25 : 1) * (vehicle.id === 'truck' ? 1.15 : 1)), storyId: null };
    });
    // A nearby, inexpensive first job keeps the onboarding approachable.
    if (state.delivered === 0) offers.unshift({cargo: 2, dest: 3, stops: [3], stopIndex: 0, stage: 'pickup', pay: 420, hot: false, express: false, expressBonus: 0, remaining: 0, tutorial: true, storyId: null});
    return {offers, demandType};
  }
  function finishStage(state) {
    if (!state.job) return null;
    const j = state.job;
    if (j.stage === 'pickup') { j.stage = 'deliver'; return {stage: 'loaded'}; }
    if (j.stopIndex + 1 < j.stops.length) { j.stopIndex++; return {stage: 'next', index: j.stopIndex}; }
    const c = D.cargoes[j.cargo];
    const property = D.properties.filter(p => state.properties.includes(p.id)).reduce((s, p) => s + p.income, 0);
    const express = j.express && j.remaining > 0 ? j.expressBonus : 0;
    state.delivered++; state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.jobStats[c.type]++;
    ensureDaily(state);
    if (dailySpec(state).type === c.type) state.dailyProgress = Math.min(3, state.dailyProgress + 1);
    const streak = state.streak % 3 === 0 ? 150 + Math.min(state.streak, 30) * 25 : 0;
    const milestone = state.delivered % 5 === 0 ? 250 : 0;
    const story = D.stories.find(s => s.id === j.storyId);
    if (story && !state.storyCompleted.includes(story.id)) state.storyCompleted.push(story.id);
    const reputation = 22 + (j.hot ? 6 : 0) + (express ? 12 : 0) + (story?.rep || 0);
    const total = j.pay + property + express + streak + milestone;
    state.money = Math.min(1e9, state.money + total); state.reputation += reputation; state.job = null;
    return {stage: 'done', base: j.pay, property, express, streak, milestone, total, reputation, type: c.type};
  }
  class Heap {
    constructor() { this.a = []; }
    push(v) { const a = this.a; let i = a.length; a.push(v); while(i > 0) { const p = (i - 1) >> 1; if(a[p].f <= v.f) break; a[i] = a[p]; i = p; } a[i] = v; }
    pop() { const a = this.a, top = a[0], v = a.pop(); if(a.length) { let i = 0; while(i * 2 + 1 < a.length) { let c = i * 2 + 1; if(c + 1 < a.length && a[c + 1].f < a[c].f) c++; if(a[c].f >= v.f) break; a[i] = a[c]; i = c; } a[i] = v; } return top; }
  }
  class Navigation {
    constructor(blocks) {
      this.blocks = blocks; this.step = 4; this.min = -216; this.size = 109;
      // Spatial buckets keep route finding inexpensive in the expanded, tree-lined city.
      this.buckets = new Map();
      for (const b of blocks) {
        for (let x = Math.floor((b.x-b.w/2-1.5)/16); x <= Math.floor((b.x+b.w/2+1.5)/16); x++)
          for (let z = Math.floor((b.z-b.d/2-1.5)/16); z <= Math.floor((b.z+b.d/2+1.5)/16); z++) {
            const key = x+','+z; if (!this.buckets.has(key)) this.buckets.set(key, []); this.buckets.get(key).push(b);
          }
      }
      this.open = new Uint8Array(this.size ** 2);
      for(let z = 0; z < this.size; z++) for(let x = 0; x < this.size; x++) this.open[z * this.size + x] = !this.blocked(this.min + x * 4, this.min + z * 4);
    }
    blocked(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > D.WORLD_LIMIT - 2 || Math.abs(z) > D.WORLD_LIMIT - 2) return true;
      if (x > 64 && x < 90 && D.BRIDGES.every(v => Math.abs(z - v) > 3.5)) return true;
      return (this.buckets.get(Math.floor(x/16)+','+Math.floor(z/16)) || []).some(b => Math.abs(x - b.x) < b.w / 2 + 1.5 && Math.abs(z - b.z) < b.d / 2 + 1.5);
    }
    clear(a, b) {
      const steps = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / .8));
      for(let n = 0; n <= steps; n++) if(this.blocked(a.x + (b.x - a.x) * n / steps, a.z + (b.z - a.z) * n / steps)) return false;
      return true;
    }
    safe(p) {
      if (!this.blocked(p.x, p.z)) return {x: p.x, z: p.z};
      for(let r = 2; r < 440; r += 2) for(let i = 0; i < 32; i++) { const q = {x: clamp(p.x + Math.cos(i * Math.PI / 16) * r, -216, 216), z: clamp(p.z + Math.sin(i * Math.PI / 16) * r, -216, 216)}; if (!this.blocked(q.x, q.z)) return q; }
      return {x: -24, z: 0};
    }
    coord(id) { return {x: this.min + (id % this.size) * 4, z: this.min + Math.floor(id / this.size) * 4}; }
    node(p) {
      const gx = clamp(Math.round((p.x - this.min) / 4), 0, this.size - 1), gz = clamp(Math.round((p.z - this.min) / 4), 0, this.size - 1);
      for(let r = 0; r < 10; r++) {
        const choices = [];
        for(let z = Math.max(0, gz-r); z <= Math.min(this.size-1, gz+r); z++) for(let x = Math.max(0, gx-r); x <= Math.min(this.size-1, gx+r); x++) {
          const id = z * this.size + x; if(this.open[id]) choices.push(id);
        }
        choices.sort((a,b) => Math.hypot(this.coord(a).x-p.x,this.coord(a).z-p.z) - Math.hypot(this.coord(b).x-p.x,this.coord(b).z-p.z));
        for(const id of choices) if(this.clear(p, this.coord(id))) return id;
      }
      return -1;
    }
    path(from, to) {
      const start = this.node(from), goal = this.node(to), N = this.size;
      if(start < 0 || goal < 0) return [];
      const g = new Float64Array(N * N).fill(Infinity), prev = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N), heap = new Heap();
      const target = this.coord(goal), h = id => {const p = this.coord(id); return Math.hypot(p.x-target.x,p.z-target.z) / 4;};
      g[start] = 0; heap.push({id: start, f: h(start)});
      while(heap.a.length) {
        const {id} = heap.pop(); if(closed[id]) continue;
        if(id === goal) {
          const route = []; for(let at = goal; at !== -1; at = prev[at]) route.push(this.coord(at)); route.reverse();
          const points = [{x:from.x,z:from.z}, ...route, {x:to.x,z:to.z}];
          return points.filter((p, i) => !i || i === points.length-1 || Math.abs((p.x-points[i-1].x)*(points[i+1].z-p.z) - (p.z-points[i-1].z)*(points[i+1].x-p.x)) > .001);
        }
        closed[id] = 1; const x = id % N, z = Math.floor(id / N), p = this.coord(id);
        for(let dz = -1; dz <= 1; dz++) for(let dx = -1; dx <= 1; dx++) {
          if(!dx && !dz || x+dx < 0 || z+dz < 0 || x+dx >= N || z+dz >= N) continue;
          const next = (z+dz)*N+x+dx;
          if(!this.open[next] || closed[next] || dx && dz && (!this.open[z*N+x+dx] || !this.open[(z+dz)*N+x])) continue;
          const q = this.coord(next); if(!this.clear(p,q)) continue;
          const road = D.ROAD_GRID.some(v => Math.abs(q.x-v) <= 5 || Math.abs(q.z-v) <= 5);
          const cost = g[id] + (dx && dz ? Math.SQRT2 : 1) * (road ? 1 : 1.6);
          if(cost < g[next]) {g[next] = cost; prev[next] = id; heap.push({id: next, f: cost+h(next)});}
        }
      }
      return [];
    }
  }
  root.GameCore = {SAVE_KEY, fresh, sanitize, sanitizeJob, dayId, hash, random, publicUrl, dailySpec, ensureDaily, jobTarget, makeOffers, finishStage, Navigation};
  if(typeof module !== 'undefined') module.exports = root.GameCore;
})(typeof window !== 'undefined' ? window : globalThis);

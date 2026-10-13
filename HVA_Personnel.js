/* HVA_Personnel.js — CORE nhân sự dùng chung HVA
 * Tách khỏi Cuochop.html để dễ bảo trì.
 * Không chứa render/UI Cuộc họp.
 */
(function(global){
'use strict';

/* =========================================================
 * HVA PERSONNEL CORE V1 – DÙNG CHUNG TOÀN HVA
 *
 * Auth: dùng HVAAuthRequest của HVA, KHÔNG tự đọc token/session.
 * Nguồn: searchNhanSuQuick + getPersonnelWorkgroups.
 * Chống trùng: username (fallback maGV nếu nguồn thiếu username).
 * Hội đồng = BGH + 07 Tổ chuyên môn + Tổ Văn phòng.
 * ========================================================= */

function hvaPersonnelText(v){ return String(v ?? '').trim(); }

function hvaPersonnelArray(data){
  return Array.isArray(data) ? data
    : Array.isArray(data && data.data) ? data.data
    : Array.isArray(data && data.results) ? data.results
    : Array.isArray(data && data.items) ? data.items
    : [];
}

function hvaPersonnelCurrentUser(){
  try{
    if(typeof getSearchUser === 'function'){ const u=getSearchUser(); if(u && (u.tenDangNhap||u.username||u.userName)) return u; }
  }catch(e){}
  try{
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}') || {};
  }catch(e){ return {}; }
}

function hvaPersonnelEnsureAuth(){
  if(global.HVAAuthRequest && typeof global.HVAAuthRequest.withAuthBody==='function' && global.HVAAuthRequest.getSessionState?.().validLocal){
    return global.HVAAuthRequest;
  }

  /* Fallback dùng ĐÚNG cơ chế HVA AUTH REQUEST đang PASS trong main.html.
     Chỉ khởi tạo khi trang con (Cuochop/Giaonhanviec/...) chưa nạp helper toàn cục. */
  const TOKEN_KEY='hvaSessionToken';
  const EXPIRES_KEY='hvaSessionExpiresAt';

  function getSessionToken(){
    return String(localStorage.getItem(TOKEN_KEY)||'').trim();
  }
  function getSessionExpiresAt(){
    const raw=String(localStorage.getItem(EXPIRES_KEY)||'').trim();
    if(!raw) return 0;
    const numeric=Number(raw);
    if(Number.isFinite(numeric) && numeric>0) return numeric<1e12?numeric*1000:numeric;
    const parsed=Date.parse(raw);
    return Number.isFinite(parsed)?parsed:0;
  }
  function getSessionState(){
    const token=getSessionToken(), expiresAt=getSessionExpiresAt(), now=Date.now();
    return {
      hasToken:!!token,
      tokenLength:token.length,
      expiresAt,
      expired:!!expiresAt&&expiresAt<=now,
      validLocal:!!token&&!!expiresAt&&expiresAt>now
    };
  }
  function requireLocalSession(){
    const state=getSessionState();
    if(!state.hasToken){
      const e=new Error('AUTH_REQUIRED'); e.code='AUTH_REQUIRED'; throw e;
    }
    if(!state.expiresAt||state.expired){
      const e=new Error('SESSION_EXPIRED'); e.code='SESSION_EXPIRED'; throw e;
    }
    return getSessionToken();
  }
  function withAuthQuery(url){
    const u=new URL(url,global.location.href);
    u.searchParams.set('sessionToken',requireLocalSession());
    return u.toString();
  }
  function withAuthBody(payload){
    const src=payload&&typeof payload==='object'?payload:{};
    return Object.assign({},src,{sessionToken:requireLocalSession()});
  }
  async function authGet(url,options){
    return fetch(withAuthQuery(url),Object.assign({},options||{},{method:'GET'}));
  }
  async function authPostJson(url,payload,options){
    const opts=Object.assign({},options||{});
    opts.method='POST';
    opts.headers=Object.assign({},opts.headers||{}, {'Content-Type':'text/plain;charset=utf-8'});
    opts.body=JSON.stringify(withAuthBody(payload));
    return fetch(url,opts);
  }

  global.HVAAuthRequest=Object.freeze({
    getSessionState,withAuthQuery,withAuthBody,get:authGet,postJson:authPostJson
  });
  return global.HVAAuthRequest;
}

async function hvaPersonnelGet(action, params={}){
  const auth=hvaPersonnelEnsureAuth();
  const user=hvaPersonnelCurrentUser();
  const api=global.PERSONNEL_SEARCH_API ||
    'https://script.google.com/macros/s/AKfycbzTRkdqyYYI8LQo9MkiTjEIXkAC7BWK1MroUXPuvKMl9Yu_o9gXFS8QCcyQmq78-ikvvg/exec';
  const u=new URL(api);

  u.searchParams.set('action',hvaPersonnelText(action));
  if(user.tenDangNhap||user.username||user.userName||user.maGV){
    u.searchParams.set('username',hvaPersonnelText(user.tenDangNhap||user.username||user.userName||user.maGV));
  }
  Object.entries(params||{}).forEach(([k,v])=>{
    if(v!==undefined&&v!==null) u.searchParams.set(k,hvaPersonnelText(v));
  });
  u.searchParams.set('_',Date.now());

  const r=await auth.get(u.toString(),{cache:'no-store'});
  if(!r.ok) throw Error('HTTP '+r.status);
  const data=await r.json();
  if(data&&data.success===false){
    const e=new Error(data.message||data.code||'Không tải được dữ liệu nhân sự.');
    e.code=data.code||'PERSONNEL_API_ERROR';
    throw e;
  }
  return data;
}

function normalizeHvaPerson(m, groupLabel=''){
  m = m || {};
  const groups = (m.nhomCongTac && typeof m.nhomCongTac === 'object') ? m.nhomCongTac : {};
  const lop = hvaPersonnelText(m.lopChuNhiem || m.lopCN || groups.GVCN || '');

  return {
    username: hvaPersonnelText(m.username),
    maGV: hvaPersonnelText(m.maGV || m.maNhanSu || m.id),
    hoTen: hvaPersonnelText(m.hoTen || m.fullName || m.name),
    chucVu: hvaPersonnelText(m.chucVu || m.vaiTro || m.viTriViecLam || 'Giáo viên'),
    viTriViecLam: hvaPersonnelText(m.viTriViecLam),
    tenTo: hvaPersonnelText(m.to || m.toBoPhan || m.tenTo),
    lopChuNhiem: lop,
    nhomCongTac: m.nhomCongTac || {},
    dienThoai: hvaPersonnelText(m.dienThoai || m.soDienThoai || m.phone),
    ngaySinh: hvaPersonnelText(m.ngaySinh || m.birthDate),
    groupLabel: hvaPersonnelText(groupLabel),
    raw: m
  };
}

/* Tương thích render Cuộc họp hiện tại. */
function mapMeetingPerson(m, groupLabel){ return normalizeHvaPerson(m, groupLabel); }

function hvaPersonnelIdentity(m){
  const u = hvaPersonnelText(m && m.username).toLowerCase();
  if(u) return 'U:' + u;
  const ma = hvaPersonnelText(m && m.maGV).toLowerCase();
  if(ma) return 'M:' + ma;
  return '';
}

function hvaPersonnelDedupe(members, groupLabel=''){
  const map = new Map();
  hvaPersonnelArray(members).forEach(raw=>{
    const p = raw && raw.raw !== undefined ? raw : normalizeHvaPerson(raw, groupLabel);
    const key = hvaPersonnelIdentity(p);
    if(!key || map.has(key)) return;
    /* Các module hiện tại chọn theo username; nếu nguồn cũ chỉ có maGV thì dùng maGV làm ID kỹ thuật. */
    if(!p.username) p.username = p.maGV;
    map.set(key, p);
  });
  return [...map.values()];
}

const HVA_PERSONNEL_CACHE_PREFIX='HVA_PERSONNEL_V3:';
const meetingPersonnelMemory=new Map();

function meetingPersonnelCacheKey(action,params={}){
  const normalized={};
  Object.keys(params||{}).sort().forEach(k=>normalized[k]=hvaPersonnelText(params[k]));
  return HVA_PERSONNEL_CACHE_PREFIX + hvaPersonnelText(action).toUpperCase() + ':' + JSON.stringify(normalized);
}

function getMeetingPersonnelCache(action,params={}){
  const key=meetingPersonnelCacheKey(action,params);
  if(meetingPersonnelMemory.has(key)) return meetingPersonnelMemory.get(key);
  try{
    const raw=sessionStorage.getItem(key);
    if(raw!==null){
      const value=JSON.parse(raw);
      meetingPersonnelMemory.set(key,value);
      return value;
    }
  }catch(e){}
  return null;
}

function setMeetingPersonnelCache(action,params,value){
  const key=meetingPersonnelCacheKey(action,params);
  meetingPersonnelMemory.set(key,value);
  try{ sessionStorage.setItem(key,JSON.stringify(value)); }catch(e){}
  return value;
}

async function hvaPersonnelGetCached(action,params={}){
  const hit=getMeetingPersonnelCache(action,params);
  if(hit!==null) return hit;
  return setMeetingPersonnelCache(action,params,await hvaPersonnelGet(action,params));
}

async function hvaPersonnelSearch(category,q=''){
  return hvaPersonnelArray(await hvaPersonnelGetCached('searchNhanSuQuick',{
    q:hvaPersonnelText(q),
    category:hvaPersonnelText(category)
  }));
}

/*
 * Ưu tiên danh mục dùng chung HVA_PERSONNEL_UNITS nếu BASE chính đã nạp.
 * Fallback giữ ĐÚNG danh mục đang có trong file Cuộc họp này để không phá giao diện/chức năng.
 */
function hvaPersonnelUnits(){
  if(Array.isArray(window.HVA_PERSONNEL_UNITS) && window.HVA_PERSONNEL_UNITS.length){
    return window.HVA_PERSONNEL_UNITS.map(x=>{
      if(typeof x==='string') return {label:hvaPersonnelText(x),query:hvaPersonnelText(x)};
      return {
        label:hvaPersonnelText(x.label || x.name || x.value),
        query:hvaPersonnelText(x.value || x.name || x.label)
      };
    }).filter(x=>x.query);
  }

  /* query = ĐÚNG giá trị cột Tổ/Bộ phận trong nguồn nhân sự. */
  return [
    { label:'Toán - Tin',                 query:'Toán - Tin' },
    { label:'Ngữ văn',                    query:'Ngữ văn' },
    { label:'Tiếng Anh',                  query:'Ngoại Ngữ' },
    { label:'Lịch sử - Địa lí - GDKT&PL', query:'Sử - Địa - GD KT&PL' },
    { label:'Vật lí - Công nghệ',         query:'Vật lí - Công nghệ' },
    { label:'Hóa học',                    query:'Hóa học' },
    { label:'Sinh - GDTC - QPAN',         query:'Sinh - GDTC - QPAN' },
    { label:'Văn phòng',                  query:'Văn phòng' }
  ];
}

async function hvaPersonnelWorkgroupList(){
  const raw=await hvaPersonnelGetCached('getPersonnelWorkgroups',{});
  return hvaPersonnelArray(raw).map(x=>{
    if(typeof x==='string') return {name:hvaPersonnelText(x)};
    return {...x,name:hvaPersonnelText(x.name || x.label || x.value)};
  }).filter(x=>x.name);
}

function hvaPersonnelMakeGroup(groupKey,tenTo,kind,members){
  return {
    groupKey:hvaPersonnelText(groupKey),
    tenTo:hvaPersonnelText(tenTo),
    kind:hvaPersonnelText(kind),
    members:hvaPersonnelDedupe(members,tenTo)
  };
}

function hvaPersonnelNormUnit(v){
  return hvaPersonnelText(v).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

function hvaPersonnelUnitKey(v){
  const n=hvaPersonnelNormUnit(v);
  if(n==='ngoai ngu' || n==='tieng anh') return 'ENGLISH';
  if(n.includes('su') && n.includes('dia') && (n.includes('kt') || n.includes('giao duc kinh te'))) return 'HISTORY_GEO';
  if(n==='toan tin') return 'MATH_IT';
  if(n==='ngu van') return 'LITERATURE';
  if(n==='vat li cong nghe') return 'PHYSICS_TECH';
  if(n==='hoa hoc') return 'CHEMISTRY';
  if(n.includes('sinh') && n.includes('gdtc') && (n.includes('qpan') || n.includes('qp an'))) return 'BIO_PE_DEF';
  if(n==='van phong') return 'OFFICE';
  return n;
}

async function hvaPersonnelBuildGroups(){
  const api=global.PERSONNEL_SEARCH_API ||
    'https://script.google.com/macros/s/AKfycbzTRkdqyYYI8LQo9MkiTjEIXkAC7BWK1MroUXPuvKMl9Yu_o9gXFS8QCcyQmq78-ikvvg/exec';
  const auth=hvaPersonnelEnsureAuth();
  const token=auth.withAuthBody({}).sessionToken;
  return new Promise((resolve,reject)=>{
    const callback='hvaNvsPersonnel_'+Date.now()+'_'+Math.floor(Math.random()*1e6);
    const url=new URL(api);
    url.searchParams.set('action','getNVSMeetingPersonnel');
    url.searchParams.set('sessionToken',token);
    url.searchParams.set('callback',callback);
    const script=document.createElement('script');
    let timer;
    const clean=()=>{clearTimeout(timer);script.remove();delete global[callback];};
    global[callback]=data=>{
      clean();
      if(!data||data.success!==true) return reject(new Error(data&&data.message||'Không tải được nhân sự NVS'));
      const groups=(data.groups||[])
         .filter(g=>!/^cccd$/i.test(String(g.tenTo||'').trim()) && !/^workgroup:cccd$/i.test(String(g.groupKey||'').trim()))
         .map(g=>hvaPersonnelMakeGroup(g.groupKey,g.tenTo,g.kind,g.members));
      resolve(groups);
    };
    script.onerror=()=>{clean();reject(new Error('Không kết nối được Backend NVS'))};
    timer=setTimeout(()=>{clean();reject(new Error('Quá thời gian tải nhân sự NVS'))},20000);
    script.src=url.toString();
    document.head.appendChild(script);
  });
}



global.HVAPersonnel = Object.freeze({
  text: hvaPersonnelText,
  array: hvaPersonnelArray,
  currentUser: hvaPersonnelCurrentUser,
  ensureAuth: hvaPersonnelEnsureAuth,
  get: hvaPersonnelGet,
  normalize: normalizeHvaPerson,
  identity: hvaPersonnelIdentity,
  dedupe: hvaPersonnelDedupe,
  search: hvaPersonnelSearch,
  units: hvaPersonnelUnits,
  workgroupList: hvaPersonnelWorkgroupList,
  makeGroup: hvaPersonnelMakeGroup,
  normUnit: hvaPersonnelNormUnit,
  unitKey: hvaPersonnelUnitKey,
  buildGroups: hvaPersonnelBuildGroups
});

})(window);

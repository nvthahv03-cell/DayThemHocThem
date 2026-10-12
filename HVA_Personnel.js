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
    if(typeof getSearchUser === 'function') return getSearchUser() || {};
  }catch(e){}
  try{
    return JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || '{}') || {};
  }catch(e){ return {}; }
}

function hvaPersonnelEnsureAuth(){
  if(global.HVAAuthRequest && typeof global.HVAAuthRequest.get==='function'){
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
    const n=Number(String(localStorage.getItem(EXPIRES_KEY)||'').trim());
    return Number.isFinite(n)?n:0;
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
    'https://script.google.com/macros/s/AKfycbzj-6VHIUrnRfIBvzpM2R9ImU3Ikov8C49xNfB8JhcrN9kJTSBqwRgK63fea_Jbyr4U/exec';
  const u=new URL(api);

  u.searchParams.set('action',hvaPersonnelText(action));
  if(user.username||user.userName||user.maGV){
    u.searchParams.set('username',hvaPersonnelText(user.username||user.userName||user.maGV));
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
  const units=hvaPersonnelUnits();

  /* Mỗi tổ dùng CÙNG MỘT hàm searchNhanSuQuick('TEAM', query).
     Không dùng '*' và không có logic riêng cho bất kỳ tổ nào. */
  const [chiBoRaw,bghRaw,workgroups,teamResults]=await Promise.all([
    hvaPersonnelSearch('CHIBO',''),
    hvaPersonnelSearch('BGH',''),
    hvaPersonnelWorkgroupList(),
    Promise.all(units.map(async unit=>({
      name:unit.label,
      query:unit.query,
      raw:await hvaPersonnelSearch('TEAM',unit.query)
    })))
  ]);

  const workResults=await Promise.all(workgroups.map(async group=>{
    try{
      return {name:group.name,raw:await hvaPersonnelSearch('WORKGROUP',group.name)};
    }catch(e){
      console.warn('[HVA Personnel] WORKGROUP',group.name,e);
      return {name:group.name,raw:[]};
    }
  }));

  const groups=[];
  groups.push(hvaPersonnelMakeGroup('CHIBO','Chi bộ','ROOT',chiBoRaw));
  groups.push(hvaPersonnelMakeGroup('BGH','Ban Giám hiệu','ROOT',bghRaw));

  teamResults.forEach(x=>{
    groups.push(hvaPersonnelMakeGroup('TEAM:'+x.name,x.name,'TEAM',x.raw));
  });

  const councilMembers=[];
  groups.filter(g=>g.groupKey==='BGH'||g.kind==='TEAM')
    .forEach(g=>councilMembers.push(...g.members));
  groups.push(hvaPersonnelMakeGroup('COUNCIL:ALL','Hội đồng','COUNCIL',councilMembers));

  workResults.forEach(({name,raw})=>{
    if(!name) return;
    if(name.toUpperCase()==='GVCN'){
      const mapped=hvaPersonnelDedupe(raw,'GVCN');
      ['10','11','12'].forEach(khoi=>{
        const members=mapped
          .filter(m=>hvaPersonnelText(m.lopChuNhiem).startsWith(khoi+'/'))
          .sort((a,b)=>{
            const na=Number(hvaPersonnelText(a.lopChuNhiem).split('/')[1])||999;
            const nb=Number(hvaPersonnelText(b.lopChuNhiem).split('/')[1])||999;
            return na-nb||hvaPersonnelText(a.hoTen).localeCompare(hvaPersonnelText(b.hoTen),'vi');
          });
        groups.push(hvaPersonnelMakeGroup('GVCN:'+khoi,'GVCN khối '+khoi,'GVCN',members));
      });
    }else{
      groups.push(hvaPersonnelMakeGroup('WORKGROUP:'+name,name,'WORKGROUP',raw));
    }
  });

  return groups;
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

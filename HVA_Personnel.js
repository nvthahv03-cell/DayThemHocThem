/* NVS Personnel adapter for CuocHop.html. Requires WEB_APP_URL and NVS session token. */
(function(){'use strict';
  function normalize(p,label){return {username:String(p.username||p.tenDangNhap||'').trim(),hoTen:String(p.hoTen||p.fullName||'').trim(),chucVu:String(p.chucVu||p.vaiTro||'').trim(),tenTo:String(p.tenTo||p.to||label||'').trim(),gioiTinh:p.gioiTinh||'',lopChuNhiem:p.lopChuNhiem||''};}
  async function buildGroups(){
    const token=localStorage.getItem('hvaSessionToken')||sessionStorage.getItem('hvaSessionToken')||'';
    if(!token)throw new Error('Chưa có phiên đăng nhập NVS. Vui lòng đăng nhập lại.');
    const endpoint=(typeof WEB_APP_URL!=='undefined'?WEB_APP_URL:'');
    if(!endpoint)throw new Error('Chưa cấu hình WEB_APP_URL.');
    const url=endpoint+'?action=getNVSMeetingPersonnel&sessionToken='+encodeURIComponent(token);
    const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error('API nhân sự HTTP '+res.status);
    const data=await res.json();if(!data||data.success!==true)throw new Error((data&&data.message)||'Không tải được nhân sự NVS.');
    return (data.groups||[]).map(g=>({groupKey:g.groupKey,tenTo:g.tenTo,kind:g.kind,members:(g.members||[]).map(p=>normalize(p,g.tenTo))}));
  }
  window.HVAPersonnel={normalize,buildGroups};
})();

/* NVS Personnel adapter: Apps Script JSONP avoids browser CORS on GitHub Pages. */
(function(){'use strict';
  function normalize(p,label){return {username:String(p.username||p.tenDangNhap||'').trim(),hoTen:String(p.hoTen||p.fullName||'').trim(),chucVu:String(p.chucVu||p.vaiTro||'').trim(),tenTo:String(p.tenTo||p.to||label||'').trim(),gioiTinh:p.gioiTinh||'',lopChuNhiem:p.lopChuNhiem||''};}
  function buildGroups(){
    return new Promise(function(resolve,reject){
      const token=localStorage.getItem('hvaSessionToken')||sessionStorage.getItem('hvaSessionToken')||'';
      if(!token){reject(new Error('Chưa có phiên đăng nhập NVS. Vui lòng đăng nhập lại.'));return;}
      const endpoint=(typeof WEB_APP_URL!=='undefined'?WEB_APP_URL:'');
      if(!endpoint){reject(new Error('Chưa cấu hình WEB_APP_URL.'));return;}
      const callback='nvsPersonnelCallback_'+Date.now()+'_'+Math.floor(Math.random()*1000000);
      const script=document.createElement('script');let finished=false;
      const timeout=setTimeout(()=>done(new Error('Quá thời gian tải nhân sự. Kiểm tra URL Web App và quyền truy cập.')),20000);
      function done(err,data){if(finished)return;finished=true;clearTimeout(timeout);delete window[callback];script.remove();if(err)reject(err);else resolve(data);}
      window[callback]=function(data){if(!data||data.success!==true){done(new Error(data&&data.message||'Không tải được nhân sự NVS.'));return;}
        done(null,(data.groups||[]).map(g=>({groupKey:g.groupKey,tenTo:g.tenTo,kind:g.kind,members:(g.members||[]).map(p=>normalize(p,g.tenTo))})));
      };
      script.onerror=function(){done(new Error('Không tải được API nhân sự. Kiểm tra Web App đã triển khai mới.'));};
      script.src=endpoint+'?action=getNVSMeetingPersonnel&sessionToken='+encodeURIComponent(token)+'&callback='+encodeURIComponent(callback);
      document.head.appendChild(script);
    });
  }
  window.HVAPersonnel={normalize,buildGroups};
})();

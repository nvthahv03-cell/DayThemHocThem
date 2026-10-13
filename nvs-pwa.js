/* NVS PWA: giao diện cài app độc lập, không sửa đăng nhập/Backend. */
(()=> {
 let promptEvent=null;
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const ios=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const css=document.createElement('style');
 css.textContent='.nvs-install-btn{position:fixed;right:16px;bottom:16px;z-index:999;border:1px solid #8ce9ff;border-radius:24px;padding:12px 16px;color:#fff;background:linear-gradient(120deg,#075cad,#00b5d2);font-weight:800;box-shadow:0 8px 22px #02457b55;cursor:pointer}.nvs-install-btn[hidden]{display:none}.nvs-install-guide{position:fixed;inset:0;z-index:10000;background:#00264d99;display:none;align-items:center;justify-content:center;padding:20px}.nvs-install-guide.open{display:flex}.nvs-install-guide>div{width:min(400px,100%);background:white;color:#134875;border-radius:18px;padding:25px;font:14px/1.65 Arial,sans-serif}.nvs-install-guide button{padding:9px 18px;border:0;border-radius:10px;background:#075cad;color:white;font-weight:700;cursor:pointer}';
 document.head.appendChild(css);
 const btn=document.createElement('button');btn.type='button';btn.className='nvs-install-btn';btn.textContent='📲 Cài ứng dụng NVS';btn.hidden=true;
 const panel=document.createElement('div');panel.className='nvs-install-guide';panel.innerHTML='<div><h3>Cài ứng dụng NVS</h3><p></p><button type="button">Đóng</button></div>';
 document.body.append(btn,panel);
 const close=()=>panel.classList.remove('open');
 panel.querySelector('button').addEventListener('click',close);
 panel.addEventListener('click',e=>{if(e.target===panel)close()});
 const show=t=>{panel.querySelector('p').textContent=t;panel.classList.add('open')};
 const refresh=()=>{btn.hidden=standalone()||(!ios()&&!promptEvent)};
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;refresh()});
 window.addEventListener('appinstalled',()=>{promptEvent=null;refresh()});
 btn.addEventListener('click',async()=>{
  if(ios()){show('Mở NVS bằng Safari, chọn Chia sẻ → Thêm vào Màn hình chính.');return}
  if(promptEvent){const e=promptEvent;promptEvent=null;refresh();try{await e.prompt();await e.userChoice}catch(err){show('Mở menu Chrome và chọn Cài đặt ứng dụng.')}return}
  show('Mở menu trình duyệt và chọn Cài đặt ứng dụng hoặc Thêm vào Màn hình chính.');
 });
 refresh();
 if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('NVS PWA',e));
})();

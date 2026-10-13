/* NVS: không cache dữ liệu người dùng hoặc API */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));

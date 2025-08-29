(function(){
  try {
    var nav = document.querySelector('.site-header .main-nav');
    if (!nav) return;

    // Reuse existing wrap if present, otherwise create it
    var wrap = document.getElementById('userWrap');
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.id = 'userWrap';
      wrap.style.position = 'relative';
      wrap.style.display = 'inline-block';
      nav.appendChild(wrap);
    }

    // If menu/button not present, create them
    var btn = document.getElementById('userMenuBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'userMenuBtn';
      btn.type = 'button';
      btn.className = 'button';
      btn.style.display = 'none';
      btn.innerHTML = 'Hola, <span id="userName"></span> ▾';
      wrap.appendChild(btn);
    }
    var menu = document.getElementById('userMenu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'userMenu';
      menu.className = 'card';
      menu.style.position = 'absolute';
      menu.style.right = '0';
      menu.style.top = 'calc(100% + 8px)';
      menu.style.minWidth = '180px';
      menu.style.display = 'none';
      menu.style.zIndex = '50';
      menu.innerHTML = '<div class="card-body" style="display:flex;flex-direction:column;gap:6px;"><a class="button" href="/dashboard">Panel</a><button id="logoutBtn" class="button" type="button">Cerrar sesión</button></div>';
      wrap.appendChild(menu);
    }
    var nameEl = document.getElementById('userName');
    var loginA = document.getElementById('loginLink') || document.getElementById('hdrLogin');
    var regA = document.getElementById('hdrRegister');
    var logoutA = document.getElementById('logoutLink') || document.getElementById('hdrLogout');
    var hdrName = document.getElementById('hdrName');

    var token = null;
    try { token = localStorage.getItem('auth_token'); } catch(_) {}
    if (!token) return; // No auth, leave header as-is

    fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (!d || !d.user) return;
        if (loginA) loginA.style.display = 'none';
        if (regA) regA.style.display = 'none';
        if (logoutA) logoutA.style.display = 'none';
        if (hdrName) hdrName.style.display = 'none';
        if (nameEl) nameEl.textContent = d.user.name || 'Usuario';
        if (btn) btn.style.display = 'inline-block';
      })
      .catch(function(){});

    // Wire toggle and outside click (idempotent)
    if (!wrap.getAttribute('data-wired')) {
      wrap.setAttribute('data-wired','1');
      btn && btn.addEventListener('click', function(){
        if (!menu) return;
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
      });
      document.addEventListener('click', function(e){
        try {
          if (!wrap.contains(e.target)) { if (menu) menu.style.display = 'none'; }
        } catch(_) {}
      });
      var logoutBtn = document.getElementById('logoutBtn');
      logoutBtn && logoutBtn.addEventListener('click', function(){
        try { localStorage.removeItem('auth_token'); } catch(_){ }
        window.location.href = '/';
      });
    }
  } catch(_) {}
})();

(function () {
  if (window.__petPageInit || (document.body && document.body.dataset.petInit === '1')) return; // evitar doble inicializacion
  window.__petPageInit = true;
  if (document.body) document.body.dataset.petInit = '1';

  function $(id){ return document.getElementById(id); }
  function setText(id, val){ const el=$(id); if (el) el.textContent = val || '—'; }
  function showAlert(msg){ const a=$('alert'); if (a){ a.textContent = msg; a.style.display='block'; } }
  function setCityLegend(city){
    var content = $('content'); var legend = $('cityLegend');
    if (!content || !legend) return;
    if (!city) { legend.style.display = 'none'; content.style.removeProperty('--city-silhouette'); return; }
    // Build an abstract aerial map-style SVG (roads/blocks/parks/water)
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800' preserveAspectRatio='xMidYMid slice'>"
      + "<rect width='1200' height='800' fill='%23e5e7eb'/>" // base
      + "<g stroke='%23cbd5e1' stroke-width='6' fill='none' opacity='0.8'>" // main roads
      + "<path d='M0,100 L1200,220'/><path d='M0,500 L1200,620'/><path d='M200,0 L320,800'/><path d='M800,0 L920,800'/>"
      + "</g>"
      + "<g stroke='%23e2e8f0' stroke-width='2' fill='none' opacity='0.9'>" // secondary roads grid
      + (function(){ var s=''; for(var x=60;x<1200;x+=120){ s += "<path d='M"+x+",0 L"+x+",800'/>"; } for(var y=60;y<800;y+=120){ s += "<path d='M0,"+y+" L1200,"+y+"'/>"; } return s; })()
      + "</g>"
      + "<g fill='%23bfdbfe' opacity='0.65'>" // water bodies
      + "<ellipse cx='980' cy='180' rx='120' ry='70'/><ellipse cx='260' cy='640' rx='140' ry='80'/>"
      + "</g>"
      + "<g fill='%23a7f3d0' opacity='0.7'>" // parks
      + "<rect x='120' y='160' width='180' height='120' rx='20'/><rect x='720' y='520' width='200' height='140' rx='24'/>"
      + "</g>"
      + "<g stroke='%2394a3b8' stroke-width='1' fill='none' opacity='0.6'>" // block outlines
      + (function(){ var s=''; for(var x=0;x<1200;x+=120){ for(var y=0;y<800;y+=120){ s += "<rect x='"+x+"' y='"+y+"' width='120' height='120'/>"; } } return s; })()
      + "</g>"
      + "</svg>";
    var url = "url(\"data:image/svg+xml;utf8," + encodeURIComponent(svg) + "\")";
    content.style.setProperty('--city-silhouette', url);
    legend.textContent = 'Ciudad: ' + city;
    legend.style.display = 'inline-block';
  }

  // Obtener qrId desde la URL: /p/:qrId
  var qrId = (location.pathname.split('/')[2] || '').trim();
  if (!qrId) {
    showAlert('No se proporcionó un identificador de mascota.');
    return;
  }

  fetch('/api/pets/public/' + encodeURIComponent(qrId))
    .then(async (res) => {
      if (!res.ok) {
        if (res.status === 404) throw new Error('No se encontró esta mascota.');
        let msg = 'No se pudo cargar la información.';
        try { const e = await res.json(); if (e && e.error) msg += ' ' + e.error; } catch {}
        throw new Error(msg);
      }
      return res.json();
    })
  .then((data) => {
      var content = $('content'); if (content) content.style.display = 'block';
      // Pet
      setText('petName', data.pet?.name || '—');
      setText('title', data.pet?.name ? ('Mascota: ' + data.pet.name) : 'Mascota');
      setText('petSpecies', data.pet?.species || '—');
      setText('petBreed', data.pet?.breed || '—');
      setText('petColor', data.pet?.color || '—');
      setText('petNotes', data.pet?.notes || '—');
      if (data.pet?.photo_url) {
        var img = $('petPhoto'); if (img){ img.src = data.pet.photo_url; img.style.display='block'; }
      }
      var statusWrap = $('statusWrap');
      if (statusWrap) statusWrap.innerHTML = '';
      if (data.pet?.status && statusWrap) {
        var badge = document.createElement('span');
        badge.className = 'badge ' + (data.pet.status === 'lost' ? 'lost' : 'home');
        badge.textContent = data.pet.status === 'lost' ? 'Perdida' : 'En casa';
        statusWrap.appendChild(badge);
      }
  // Owner
      setText('ownerName', data.owner?.name || '—');
      setText('ownerPhone', data.owner?.phone || '—');
      setText('ownerEmail', data.owner?.email || '—');
      // Social
      try {
        var ig = $('ownerInstagram'), fb = $('ownerFacebook'), wa = $('ownerWhatsapp');
        if (ig && data.owner?.instagram_url) { ig.href = data.owner.instagram_url; ig.style.display = 'inline-block'; }
        if (fb && data.owner?.facebook_url) { fb.href = data.owner.facebook_url; fb.style.display = 'inline-block'; }
        if (wa && data.owner?.whatsapp_url) { wa.href = data.owner.whatsapp_url; wa.style.display = 'inline-block'; }
      } catch (_) {}
      if (data.owner?.phone) {
        var callBtn = $('callBtn'); if (callBtn){ callBtn.href = 'tel:' + data.owner.phone; callBtn.style.display='inline-block'; }
        var smsBtn = $('smsBtn'); if (smsBtn){ smsBtn.href = 'sms:' + data.owner.phone; smsBtn.style.display='inline-block'; }
      }
      if (data.owner?.email) {
        var mailBtn = $('mailBtn'); if (mailBtn){ mailBtn.href = 'mailto:' + data.owner.email + '?subject=Mascota%20encontrada'; mailBtn.style.display='inline-block'; }
      }
      // Optional: show social buttons if present
      try {
        var socialsWrap = document.getElementById('ownerSocials');
        if (socialsWrap) {
          if (data.owner?.instagram_url) socialsWrap.style.display = '';
          if (data.owner?.facebook_url) socialsWrap.style.display = '';
          if (data.owner?.whatsapp_url) socialsWrap.style.display = '';
        }
      } catch(_){}
      // City legend: prefer explicit pet.city (API); fallback to ?city=; last resort infer by phone prefix
      try {
        if (data.pet && data.pet.city) setCityLegend(data.pet.city);
        else {
          var urlCity = new URLSearchParams(location.search).get('city');
          if (urlCity) setCityLegend(urlCity);
          else if (data.owner?.phone) {
          var phone = String(data.owner.phone);
          var cityGuess = null;
          if (phone.startsWith('+57')) cityGuess = 'Bogotá';
          else if (phone.startsWith('+52')) cityGuess = 'CDMX';
          else if (phone.startsWith('+54')) cityGuess = 'Buenos Aires';
          else if (phone.startsWith('+56')) cityGuess = 'Santiago';
          else if (phone.startsWith('+51')) cityGuess = 'Lima';
          else if (phone.startsWith('+34')) cityGuess = 'Madrid';
          if (cityGuess) setCityLegend(cityGuess);
          }
        }
      } catch (_) {}
    })
    .catch((err) => {
      showAlert(err.message || 'No se pudo cargar la información.');
    });
})();

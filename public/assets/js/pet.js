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
    // Build a simple generic skyline SVG as data URL to avoid external requests
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 200' preserveAspectRatio='xMidYMax slice'><path fill='%23000' d='M0,200 L0,140 40,140 40,120 70,120 70,90 110,90 110,150 150,150 150,110 190,110 190,130 230,130 230,100 300,100 300,160 360,160 360,80 400,80 400,140 450,140 450,110 520,110 520,170 580,170 580,130 640,130 640,150 700,150 700,120 760,120 760,200 Z'/></svg>";
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
      if (data.owner?.phone) {
        var callBtn = $('callBtn'); if (callBtn){ callBtn.href = 'tel:' + data.owner.phone; callBtn.style.display='inline-block'; }
        var smsBtn = $('smsBtn'); if (smsBtn){ smsBtn.href = 'sms:' + data.owner.phone; smsBtn.style.display='inline-block'; }
      }
      if (data.owner?.email) {
        var mailBtn = $('mailBtn'); if (mailBtn){ mailBtn.href = 'mailto:' + data.owner.email + '?subject=Mascota%20encontrada'; mailBtn.style.display='inline-block'; }
      }
      // City legend: prefer ?city= param; fallback try to infer from phone country code
      try {
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
      } catch (_) {}
    })
    .catch((err) => {
      showAlert(err.message || 'No se pudo cargar la información.');
    });
})();

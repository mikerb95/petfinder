(function () {
  if (window.__petPageInit || (document.body && document.body.dataset.petInit === '1')) return; // prevent double init
  window.__petPageInit = true;
  if (document.body) document.body.dataset.petInit = '1';

  function $(id){ return document.getElementById(id); }
  function setText(id, val){ const el=$(id); if (el) el.textContent = val || '—'; }
  function showAlert(msg){ const a=$('alert'); if (a){ a.textContent = msg; a.style.display='block'; } }

  // Get qrId from URL: /p/:qrId
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
    })
    .catch((err) => {
      showAlert(err.message || 'No se pudo cargar la información.');
    });
})();

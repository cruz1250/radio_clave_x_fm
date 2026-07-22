// ============================================================
// CLAVEX FM — PANEL DE ADMINISTRADOR (página independiente)
// Requiere: supabase-config.js cargado antes que este archivo
// ============================================================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let songs = [];
let schedule = [];
let announcements = [];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function loadSongs() {
  const { data, error } = await supabaseClient
    .from('songs')
    .select('*')
    .order('position', { ascending: true });
  if (error) { console.error('Error cargando canciones:', error); return; }
  songs = data || [];
}

async function loadSchedule() {
  const { data, error } = await supabaseClient
    .from('schedule')
    .select('*')
    .order('position', { ascending: true });
  if (error) { console.error('Error cargando programación:', error); return; }
  schedule = data || [];
}

async function loadAnnouncements() {
  const { data, error } = await supabaseClient
    .from('announcements')
    .select('*')
    .order('position', { ascending: true });
  if (error) { console.error('Error cargando avisos:', error); return; }
  announcements = data || [];
}

// ============================================================
// AUTENTICACIÓN
// ============================================================

function showLoginScreen() {
  document.getElementById('adminLoginScreen').hidden = false;
  document.getElementById('adminDashboardPage').hidden = true;
  showLoginForm();
}

function showLoginForm() {
  document.getElementById('loginBox').hidden = false;
  document.getElementById('forgotPasswordBox').hidden = true;
}

function showForgotPasswordForm() {
  document.getElementById('loginBox').hidden = true;
  document.getElementById('forgotPasswordBox').hidden = false;
  document.getElementById('forgotError').hidden = true;
  document.getElementById('forgotSuccess').hidden = true;
}

async function sendPasswordReset() {
  const email = document.getElementById('forgotEmail').value.trim();
  const errorEl = document.getElementById('forgotError');
  const successEl = document.getElementById('forgotSuccess');
  errorEl.hidden = true;
  successEl.hidden = true;

  if (!email) return;

  const redirectTo = window.location.origin + window.location.pathname.replace('admin.html', 'reset-password.html');

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    errorEl.textContent = 'No pudimos enviar el correo: ' + error.message;
    errorEl.hidden = false;
    return;
  }

  successEl.hidden = false;
}

function showDashboardScreen() {
  document.getElementById('adminLoginScreen').hidden = true;
  document.getElementById('adminDashboardPage').hidden = false;
  openAdminDashboard();
}

async function adminLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('loginError');
  errorEl.hidden = true;

  if (!email || !password) return;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = 'Correo o contraseña incorrectos.';
    errorEl.hidden = false;
    return;
  }

  document.getElementById('password').value = '';
  showDashboardScreen();
}

async function adminLogout() {
  await supabaseClient.auth.signOut();
  showLoginScreen();
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    showDashboardScreen();
  } else {
    showLoginScreen();
  }
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (!session) showLoginScreen();
});

// ============================================================
// PANEL DE ADMINISTRADOR
// ============================================================

function openAdminDashboard() {
  renderAdminSongsList();
  renderAdminScheduleList();
  renderAdminAnnouncementsList();
  populateStreamingForm();
}

function switchTab(tabId) {
  document.querySelectorAll('.dash-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.dash-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

// ---------- Gestión de canciones ----------

function renderAdminSongsList() {
  const list = document.getElementById('adminSongsList');
  list.innerHTML = '';

  songs.forEach((song, i) => {
    const row = document.createElement('div');
    row.className = 'dash-row';
    row.innerHTML = `
      <span class="dash-row-num">${i + 1}</span>
      <span class="dash-row-title">${escapeHtml(song.title)} <em class="dash-row-artist">— ${escapeHtml(song.artist || '')}</em></span>
      <div class="dash-row-actions">
        <button class="dash-icon-btn-move" onclick="moveSongUp('${song.id}')" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
        <button class="dash-icon-btn-move" onclick="moveSongDown('${song.id}')" ${i === songs.length - 1 ? 'disabled' : ''} title="Bajar">↓</button>
        <button class="dash-icon-btn" onclick="editSong('${song.id}')">Editar</button>
        <button class="dash-icon-btn dash-icon-danger" onclick="deleteSong('${song.id}')">Eliminar</button>
      </div>
    `;
    list.appendChild(row);
  });

  if (songs.length === 0) {
    list.innerHTML = '<p class="dash-empty">Todavía no hay canciones. Agrega la primera abajo.</p>';
  }
}

function editSong(id) {
  const song = songs.find(s => s.id === id);
  if (!song) return;
  document.getElementById('songId').value = song.id;
  document.getElementById('songTitle').value = song.title;
  document.getElementById('songArtist').value = song.artist || '';
  document.getElementById('songYoutubeId').value = song.youtube_id;
  document.getElementById('songSubmitBtn').textContent = 'Guardar cambios';
  document.getElementById('songCancelBtn').hidden = false;
}

function resetSongForm() {
  document.getElementById('songForm').reset();
  document.getElementById('songId').value = '';
  document.getElementById('songSubmitBtn').textContent = 'Agregar canción';
  document.getElementById('songCancelBtn').hidden = true;
}

async function submitSongForm(e) {
  e.preventDefault();
  const id = document.getElementById('songId').value;
  const title = document.getElementById('songTitle').value.trim();
  const artist = document.getElementById('songArtist').value.trim();
  const youtube_id = document.getElementById('songYoutubeId').value.trim();

  if (!title || !artist || !youtube_id) return false;

  if (id) {
    const { error } = await supabaseClient.from('songs').update({ title, artist, youtube_id }).eq('id', id);
    if (error) { alert('Error al guardar: ' + error.message); return false; }
  } else {
    const nextPosition = songs.length > 0 ? Math.max(...songs.map(s => s.position)) + 1 : 1;
    const { error } = await supabaseClient.from('songs').insert({ title, artist, youtube_id, position: nextPosition });
    if (error) { alert('Error al agregar: ' + error.message); return false; }
  }

  resetSongForm();
  await loadSongs();
  renderAdminSongsList();
  return false;
}

async function deleteSong(id) {
  if (!confirm('¿Eliminar esta canción del repertorio?')) return;
  const { error } = await supabaseClient.from('songs').delete().eq('id', id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  await loadSongs();
  renderAdminSongsList();
}

async function moveSongUp(id) {
  const index = songs.findIndex(s => s.id === id);
  if (index <= 0) return;
  await swapPositions('songs', songs[index], songs[index - 1]);
  await loadSongs();
  renderAdminSongsList();
}

async function moveSongDown(id) {
  const index = songs.findIndex(s => s.id === id);
  if (index === -1 || index >= songs.length - 1) return;
  await swapPositions('songs', songs[index], songs[index + 1]);
  await loadSongs();
  renderAdminSongsList();
}

async function swapPositions(table, itemA, itemB) {
  const posA = itemA.position;
  const posB = itemB.position;
  const { error: e1 } = await supabaseClient.from(table).update({ position: posB }).eq('id', itemA.id);
  const { error: e2 } = await supabaseClient.from(table).update({ position: posA }).eq('id', itemB.id);
  if (e1 || e2) alert('Error al reordenar: ' + (e1?.message || e2?.message));
}

// ---------- Gestión de programación ----------

function renderAdminScheduleList() {
  const list = document.getElementById('adminScheduleList');
  list.innerHTML = '';

  schedule.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'dash-row';
    row.innerHTML = `
      <span class="dash-row-num">${escapeHtml(item.time_range)}</span>
      <span class="dash-row-title">${escapeHtml(item.title)}</span>
      <div class="dash-row-actions">
        <button class="dash-icon-btn-move" onclick="moveScheduleUp('${item.id}')" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
        <button class="dash-icon-btn-move" onclick="moveScheduleDown('${item.id}')" ${i === schedule.length - 1 ? 'disabled' : ''} title="Bajar">↓</button>
        <button class="dash-icon-btn" onclick="editScheduleItem('${item.id}')">Editar</button>
        <button class="dash-icon-btn dash-icon-danger" onclick="deleteScheduleItem('${item.id}')">Eliminar</button>
      </div>
    `;
    list.appendChild(row);
  });

  if (schedule.length === 0) {
    list.innerHTML = '<p class="dash-empty">Todavía no hay franjas de programación.</p>';
  }
}

function editScheduleItem(id) {
  const item = schedule.find(s => s.id === id);
  if (!item) return;
  document.getElementById('scheduleId').value = item.id;
  document.getElementById('scheduleTime').value = item.time_range;
  document.getElementById('scheduleTitle').value = item.title;
  document.getElementById('scheduleDesc').value = item.description || '';
  document.getElementById('scheduleSubmitBtn').textContent = 'Guardar cambios';
  document.getElementById('scheduleCancelBtn').hidden = false;
}

function resetScheduleForm() {
  document.getElementById('scheduleForm').reset();
  document.getElementById('scheduleId').value = '';
  document.getElementById('scheduleSubmitBtn').textContent = 'Agregar franja';
  document.getElementById('scheduleCancelBtn').hidden = true;
}

async function submitScheduleForm(e) {
  e.preventDefault();
  const id = document.getElementById('scheduleId').value;
  const time_range = document.getElementById('scheduleTime').value.trim();
  const title = document.getElementById('scheduleTitle').value.trim();
  const description = document.getElementById('scheduleDesc').value.trim();

  if (!time_range || !title) return false;

  if (id) {
    const { error } = await supabaseClient.from('schedule').update({ time_range, title, description }).eq('id', id);
    if (error) { alert('Error al guardar: ' + error.message); return false; }
  } else {
    const nextPosition = schedule.length > 0 ? Math.max(...schedule.map(s => s.position)) + 1 : 1;
    const { error } = await supabaseClient.from('schedule').insert({ time_range, title, description, position: nextPosition });
    if (error) { alert('Error al agregar: ' + error.message); return false; }
  }

  resetScheduleForm();
  await loadSchedule();
  renderAdminScheduleList();
  return false;
}

async function deleteScheduleItem(id) {
  if (!confirm('¿Eliminar esta franja de programación?')) return;
  const { error } = await supabaseClient.from('schedule').delete().eq('id', id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  await loadSchedule();
  renderAdminScheduleList();
}

async function moveScheduleUp(id) {
  const index = schedule.findIndex(s => s.id === id);
  if (index <= 0) return;
  await swapPositions('schedule', schedule[index], schedule[index - 1]);
  await loadSchedule();
  renderAdminScheduleList();
}

async function moveScheduleDown(id) {
  const index = schedule.findIndex(s => s.id === id);
  if (index === -1 || index >= schedule.length - 1) return;
  await swapPositions('schedule', schedule[index], schedule[index + 1]);
  await loadSchedule();
  renderAdminScheduleList();
}

// ---------- Gestión de avisos / información ----------

function renderAdminAnnouncementsList() {
  const list = document.getElementById('adminAnnouncementsList');
  list.innerHTML = '';

  announcements.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'dash-row' + (item.active ? '' : ' dash-row-inactive');
    row.innerHTML = `
      <span class="dash-row-num">${item.active ? '📢' : '🔇'}</span>
      <span class="dash-row-title">${escapeHtml(item.title)}</span>
      <div class="dash-row-actions">
        <button class="dash-icon-btn" onclick="toggleAnnouncementActive('${item.id}')">${item.active ? 'Ocultar' : 'Mostrar'}</button>
        <button class="dash-icon-btn" onclick="editAnnouncement('${item.id}')">Editar</button>
        <button class="dash-icon-btn dash-icon-danger" onclick="deleteAnnouncement('${item.id}')">Eliminar</button>
      </div>
    `;
    list.appendChild(row);
  });

  if (announcements.length === 0) {
    list.innerHTML = '<p class="dash-empty">Todavía no hay avisos. Agrega el primero abajo.</p>';
  }
}

function editAnnouncement(id) {
  const item = announcements.find(a => a.id === id);
  if (!item) return;
  document.getElementById('announcementId').value = item.id;
  document.getElementById('announcementTitle').value = item.title;
  document.getElementById('announcementMessage').value = item.message;
  document.getElementById('announcementActive').checked = item.active;
  document.getElementById('announcementSubmitBtn').textContent = 'Guardar cambios';
  document.getElementById('announcementCancelBtn').hidden = false;
}

function resetAnnouncementForm() {
  document.getElementById('announcementForm').reset();
  document.getElementById('announcementId').value = '';
  document.getElementById('announcementActive').checked = true;
  document.getElementById('announcementSubmitBtn').textContent = 'Agregar aviso';
  document.getElementById('announcementCancelBtn').hidden = true;
}

async function submitAnnouncementForm(e) {
  e.preventDefault();
  const id = document.getElementById('announcementId').value;
  const title = document.getElementById('announcementTitle').value.trim();
  const message = document.getElementById('announcementMessage').value.trim();
  const active = document.getElementById('announcementActive').checked;

  if (!title || !message) return false;

  if (id) {
    const { error } = await supabaseClient.from('announcements').update({ title, message, active }).eq('id', id);
    if (error) { alert('Error al guardar: ' + error.message); return false; }
  } else {
    const nextPosition = announcements.length > 0 ? Math.max(...announcements.map(a => a.position)) + 1 : 1;
    const { error } = await supabaseClient.from('announcements').insert({ title, message, active, position: nextPosition });
    if (error) { alert('Error al agregar: ' + error.message); return false; }
  }

  resetAnnouncementForm();
  await loadAnnouncements();
  renderAdminAnnouncementsList();
  return false;
}

async function toggleAnnouncementActive(id) {
  const item = announcements.find(a => a.id === id);
  if (!item) return;
  const { error } = await supabaseClient.from('announcements').update({ active: !item.active }).eq('id', id);
  if (error) { alert('Error al actualizar: ' + error.message); return; }
  await loadAnnouncements();
  renderAdminAnnouncementsList();
}

async function deleteAnnouncement(id) {
  if (!confirm('¿Eliminar este aviso?')) return;
  const { error } = await supabaseClient.from('announcements').delete().eq('id', id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  await loadAnnouncements();
  renderAdminAnnouncementsList();
}

// ---------- Gestión de streaming ----------

async function populateStreamingForm() {
  const input = document.getElementById('streamUrlInput');
  if (!input) return;

  const { data, error } = await supabaseClient
    .from('settings')
    .select('stream_url')
    .eq('id', 1)
    .single();

  if (error) {
    // La tabla "settings" probablemente no existe todavía (falta correr migracion-streaming.sql)
    input.placeholder = 'Corre migracion-streaming.sql en Supabase primero';
    return;
  }

  input.value = data?.stream_url || '';
}

async function submitStreamingForm(e) {
  e.preventDefault();
  const streamUrl = document.getElementById('streamUrlInput').value.trim();
  const msgEl = document.getElementById('streamingSavedMsg');

  const { error } = await supabaseClient
    .from('settings')
    .update({ stream_url: streamUrl || null, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) {
    alert('Error al guardar: ' + error.message + '\n\n¿Ya corriste "migracion-streaming.sql" en el SQL Editor de Supabase?');
    return false;
  }

  if (msgEl) {
    msgEl.hidden = false;
    setTimeout(() => { msgEl.hidden = true; }, 3000);
  }
  return false;
}

// ============================================================
// INICIO
// ============================================================

window.onload = async () => {
  await loadSongs();
  await loadSchedule();
  await loadAnnouncements();
  await checkSession();
};

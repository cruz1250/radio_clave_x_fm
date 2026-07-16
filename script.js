// ============================================================
// CLAVEX FM — lógica pública + panel de administrador
// Requiere: supabase-config.js cargado antes que este archivo
// ============================================================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let songs = [];
let schedule = [];
let currentIndex = 0;

// ---------- Reproductor YouTube ----------
let ytPlayer = null;
let youtubeApiReady = false;
let songsDataReady = false;
let soundEnabled = false;

// La API de YouTube llama esta función global cuando está lista
window.onYouTubeIframeAPIReady = function () {
  youtubeApiReady = true;
  tryInitPlayer();
};

function tryInitPlayer() {
  if (youtubeApiReady && songsDataReady && !ytPlayer && songs.length > 0) {
    ytPlayer = new YT.Player('youtubePlayerContainer', {
      height: '220',
      width: '100%',
      videoId: songs[currentIndex].youtube_id,
      playerVars: {
        autoplay: 1,
        mute: 1,          // arranca muteado: los navegadores exigen esto para autoplay
        controls: 1,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange
      }
    });
  }
}

let isPlaying = false;

function onPlayerReady() {
  updateNowPlayingText();
  highlightActiveSong(currentIndex);
}

function onPlayerStateChange(event) {
  // Cuando termina una canción, pasa automáticamente a la siguiente (radio continua)
  if (event.data === YT.PlayerState.ENDED) {
    nextSong();
    return;
  }
  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    updatePlayCtaIcon();
  }
  if (event.data === YT.PlayerState.PAUSED) {
    isPlaying = false;
    updatePlayCtaIcon();
  }
}

function handlePlayCta() {
  if (!ytPlayer) return;

  if (!soundEnabled) {
    // Primer clic: activa el sonido (requiere gesto del usuario) y asegura reproducción
    soundEnabled = true;
    ytPlayer.unMute();
    ytPlayer.setVolume(100);
    ytPlayer.playVideo();
    return;
  }

  // Clics siguientes: alterna play/pause
  if (isPlaying) {
    ytPlayer.pauseVideo();
  } else {
    ytPlayer.playVideo();
  }
}

function updatePlayCtaIcon() {
  const icon = document.getElementById('playCtaIcon');
  if (icon) icon.textContent = isPlaying ? '❚❚' : '▶';
}

// ============================================================
// REPRODUCTOR PÚBLICO
// ============================================================

async function loadSongs() {
  const { data, error } = await supabaseClient
    .from('songs')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    console.error('Error cargando canciones:', error);
    return;
  }

  songs = data || [];
  renderPlaylist();
  songsDataReady = true;
  tryInitPlayer();
}

async function loadSchedule() {
  const { data, error } = await supabaseClient
    .from('schedule')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    console.error('Error cargando programación:', error);
    return;
  }

  schedule = data || [];
  renderSchedule();
}

function playSong(index) {
  if (!songs[index]) return;
  currentIndex = index;
  const song = songs[index];

  if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
    ytPlayer.loadVideoById(song.youtube_id);
    if (soundEnabled) {
      ytPlayer.unMute();
      ytPlayer.setVolume(100);
    }
  }
  // Si el player aún no existe, tryInitPlayer() lo creará ya
  // apuntando a currentIndex una vez estén listas la API y las canciones.

  updateNowPlayingText();
  highlightActiveSong(index);
}

function updateNowPlayingText() {
  const song = songs[currentIndex];
  const nowPlayingEl = document.getElementById('nowPlaying');
  if (nowPlayingEl && song) {
    nowPlayingEl.textContent = song.artist ? `${song.title} — ${song.artist}` : song.title;
  }
}

function nextSong() {
  if (songs.length === 0) return;
  currentIndex = (currentIndex + 1) % songs.length;
  playSong(currentIndex);
}

function highlightActiveSong(index) {
  document.querySelectorAll('#playlist .song').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
}

function renderPlaylist() {
  const playlistEl = document.getElementById('playlist');
  playlistEl.innerHTML = '';

  songs.forEach((song, i) => {
    const div = document.createElement('div');
    div.className = 'song';
    div.innerHTML = `
      <span class="song-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="song-info">
        <div class="song-title">${escapeHtml(song.title)}</div>
        <div class="song-sub">${escapeHtml(song.artist || 'ClaveX fm')} · En vivo</div>
      </div>
      <button class="song-play" aria-label="Reproducir ${escapeHtml(song.title)}">▶</button>
    `;
    div.addEventListener('click', () => playSong(i));
    playlistEl.appendChild(div);
  });
}

function renderSchedule() {
  const grid = document.getElementById('scheduleGrid');
  grid.innerHTML = '';

  schedule.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'schedule-card';
    div.innerHTML = `
      <span class="schedule-time">${escapeHtml(item.time_range)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description || '')}</p>
    `;
    grid.appendChild(div);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ============================================================
// AUTENTICACIÓN
// ============================================================

function showAdminLogin() {
  document.getElementById('loginError').hidden = true;
  document.getElementById('adminModal').classList.add('open');
}

function hideAdminLogin() {
  document.getElementById('adminModal').classList.remove('open');
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
  hideAdminLogin();
  openAdminDashboard();
}

async function adminLogout() {
  await supabaseClient.auth.signOut();
  document.getElementById('adminDashboard').classList.remove('open');
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  updateAdminUI(!!data.session);
}

function updateAdminUI(isLoggedIn) {
  const navBtn = document.getElementById('navAdminBtn');
  if (isLoggedIn) {
    navBtn.textContent = 'Panel Admin';
    navBtn.onclick = openAdminDashboard;
  } else {
    navBtn.textContent = 'Administrador';
    navBtn.onclick = showAdminLogin;
  }
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  updateAdminUI(!!session);
});

// ============================================================
// PANEL DE ADMINISTRADOR
// ============================================================

function openAdminDashboard() {
  renderAdminSongsList();
  renderAdminScheduleList();
  document.getElementById('adminDashboard').classList.add('open');
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

// ---------- Gestión de programación ----------

function renderAdminScheduleList() {
  const list = document.getElementById('adminScheduleList');
  list.innerHTML = '';

  schedule.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'dash-row';
    row.innerHTML = `
      <span class="dash-row-num">${escapeHtml(item.time_range)}</span>
      <span class="dash-row-title">${escapeHtml(item.title)}</span>
      <div class="dash-row-actions">
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

// Cerrar modales al hacer clic fuera de la caja
document.addEventListener('click', (e) => {
  if (e.target.id === 'adminModal') hideAdminLogin();
});

// ============================================================
// INICIO
// ============================================================

window.onload = async () => {
  await loadSongs();
  await loadSchedule();
  await checkSession();

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
};

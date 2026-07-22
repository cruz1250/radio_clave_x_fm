// ============================================================
// CLAVEX FM — lógica pública del sitio (reproductor, repertorio,
// programación, avisos y señal en vivo)
// El panel de administrador vive aparte, en admin.html / admin.js
// Requiere: supabase-config.js y stream-config.js cargados antes
// ============================================================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let songs = [];
let schedule = [];
let announcements = [];
let currentIndex = 0;
let mode = 'unknown'; // 'live' | 'playlist'
let currentStreamUrl = null;

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
  if (mode === 'live') return; // no crear el reproductor YouTube mientras hay señal en vivo
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
  if (mode === 'live') {
    const audio = document.getElementById('liveAudio');
    if (!audio) return;

    if (!soundEnabled) {
      soundEnabled = true;
      audio.muted = false;
      audio.play();
      isPlaying = true;
      updatePlayCtaIcon();
      return;
    }

    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      audio.play();
      isPlaying = true;
    }
    updatePlayCtaIcon();
    return;
  }

  // Modo repertorio (YouTube)
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

  const medallion = document.querySelector('.medallion');
  if (medallion) medallion.classList.toggle('is-playing', isPlaying);
}

// ============================================================
// SEÑAL EN VIVO (Zeno.fm) con caída automática al repertorio
// ============================================================

async function loadStreamSettings() {
  try {
    const { data, error } = await supabaseClient
      .from('settings')
      .select('stream_url')
      .eq('id', 1)
      .single();

    if (!error && data && data.stream_url) {
      currentStreamUrl = data.stream_url;
      return;
    }
  } catch (e) {
    // La tabla "settings" todavía no existe (falta correr la migración) — seguimos con el respaldo de abajo.
  }

  // Respaldo: compatibilidad con configuraciones anteriores vía stream-config.js
  if (typeof ZENO_STREAM_URL !== 'undefined' && ZENO_STREAM_URL && !ZENO_STREAM_URL.includes('TU-MOUNT-AQUI')) {
    currentStreamUrl = ZENO_STREAM_URL;
  }
}

function attemptLiveStream() {
  const audio = document.getElementById('liveAudio');
  const badge = document.getElementById('liveStatusBadge');

  if (!audio || !currentStreamUrl) {
    // No hay URL de streaming configurada todavía: usar repertorio directamente.
    switchToPlaylistMode();
    return;
  }

  if (badge) badge.textContent = 'Conectando…';

  audio.src = currentStreamUrl;
  audio.muted = true; // necesario para que el navegador permita el intento automático

  const timeout = setTimeout(() => {
    switchToPlaylistMode();
  }, 6000);

  audio.addEventListener('playing', function onPlaying() {
    clearTimeout(timeout);
    switchToLiveMode();
    audio.removeEventListener('error', onError);
  }, { once: true });

  function onError() {
    clearTimeout(timeout);
    switchToPlaylistMode();
  }
  audio.addEventListener('error', onError, { once: true });

  audio.play().catch(() => {
    // El navegador bloqueó el intento silencioso; se espera el timeout como respaldo.
  });
}

function switchToLiveMode() {
  mode = 'live';
  isPlaying = true;
  updateModeUI();
}

function switchToPlaylistMode() {
  mode = 'playlist';
  updateModeUI();
  tryInitPlayer();
}

function updateModeUI() {
  const badge = document.getElementById('liveStatusBadge');
  const ytContainer = document.getElementById('youtubePlayerContainer');
  const nowPlayingEl = document.getElementById('nowPlaying');

  if (mode === 'live') {
    if (badge) { badge.textContent = '🔴 EN VIVO'; badge.classList.add('is-live'); }
    if (ytContainer) ytContainer.style.display = 'none';
    if (nowPlayingEl) nowPlayingEl.textContent = 'Transmisión en vivo — ClaveX fm';
  } else {
    if (badge) { badge.textContent = '🎶 Repertorio'; badge.classList.remove('is-live'); }
    if (ytContainer) ytContainer.style.display = 'block';
    updateNowPlayingText();
  }
  updatePlayCtaIcon();
}

// Botón para que un oyente vuelva a intentar la señal en vivo
// (útil si el locutor empezó a transmitir después de cargar la página)
async function retryLiveSignal() {
  soundEnabled = false;
  await loadStreamSettings();
  attemptLiveStream();
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

async function loadAnnouncements() {
  const { data, error } = await supabaseClient
    .from('announcements')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    console.error('Error cargando avisos:', error);
    return;
  }

  announcements = data || [];
  renderAnnouncements();
}

function playSong(index) {
  if (!songs[index]) return;
  currentIndex = index;

  // Si alguien elige una canción puntual del repertorio mientras hay
  // transmisión en vivo, pausamos la señal en vivo y pasamos a modo repertorio.
  if (mode === 'live') {
    const liveAudioEl = document.getElementById('liveAudio');
    if (liveAudioEl) liveAudioEl.pause();
    mode = 'playlist';
    updateModeUI();
    tryInitPlayer();
  }

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
        <div class="song-sub">${escapeHtml(song.artist || 'ClaveX fm')} · Repertorio</div>
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

function renderAnnouncements() {
  const list = document.getElementById('announcementsList');
  if (!list) return;
  list.innerHTML = '';

  const visible = announcements.filter(a => a.active);

  if (visible.length === 0) {
    list.innerHTML = '<p class="announcements-empty">No hay avisos por el momento.</p>';
    return;
  }

  visible.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'announcement-card';
    div.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.message)}</p>
    `;
    list.appendChild(div);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ============================================================
// INICIO
// ============================================================

window.onload = async () => {
  await loadStreamSettings();
  attemptLiveStream();
  await loadSongs();
  await loadSchedule();
  await loadAnnouncements();

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
};

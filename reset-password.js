// ============================================================
// CLAVEX FM — Restablecer contraseña (llega desde el enlace del correo)
// Requiere: supabase-config.js cargado antes que este archivo
// ============================================================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let recoveryConfirmed = false;

function showOnly(id) {
  ['checkingBox', 'resetFormBox', 'invalidLinkBox', 'successBox'].forEach(boxId => {
    document.getElementById(boxId).hidden = boxId !== id;
  });
}

supabaseClient.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoveryConfirmed = true;
    showOnly('resetFormBox');
  }
});

// Si en unos segundos no llegó el evento de recuperación, el enlace
// probablemente ya venció o es inválido.
setTimeout(() => {
  if (!recoveryConfirmed) {
    showOnly('invalidLinkBox');
  }
}, 4000);

async function submitNewPassword() {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('resetError');
  errorEl.hidden = true;

  if (!newPassword || !confirmPassword) {
    errorEl.textContent = 'Completa ambos campos.';
    errorEl.hidden = false;
    return;
  }

  if (newPassword.length < 6) {
    errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errorEl.hidden = false;
    return;
  }

  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'Las contraseñas no coinciden.';
    errorEl.hidden = false;
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

  if (error) {
    errorEl.textContent = 'Error al actualizar: ' + error.message;
    errorEl.hidden = false;
    return;
  }

  showOnly('successBox');
}

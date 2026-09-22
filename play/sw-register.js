if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

const offlineBadge = document.getElementById('offline-badge');

function updateOnlineStatus() {
  if (!offlineBadge) return;
  offlineBadge.classList.toggle('hidden', navigator.onLine);
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// EquityLensAI Browser Push Notification Service Worker
self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'EquityLensAI Alert';
    const options = {
      body: data.message || data.body || 'You have a new market event.',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: {
        url: data.link || data.url || '/notifications',
      },
      tag: data.id || 'equitylens-notification',
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('EquityLensAI Alert', {
        body: text,
        data: { url: '/notifications' },
      }),
    );
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});

self.addEventListener('push', function(event) {
    if (!(self.Notification && self.Notification.permission === 'granted')) {
        return;
    }

    const data = {};
    if (event.data) {
        data = event.data.json();
    }
    const title = data.title;
    const message = data.message;
    const icon = "favicon.ico";

    self.clickTarget = self.location.origin;

    event.waitUntil(self.registration.showNotification(title, {
        body: message,
        tag: 'Databag',
        icon: icon,
    }));
});

self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Notification click Received.');

    event.notification.close();

    if(clients.openWindow){
        event.waitUntil(clients.openWindow(self.clickTarget));
    }
});


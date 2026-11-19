/* Firebase Cloud Messaging service worker — config injected via query not available;
   fill from same NEXT_PUBLIC_FIREBASE_* values at deploy time by editing below
   OR keep placeholders until you paste Firebase web config. */
/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js");

// These are public client keys (safe in SW). Replace after Firebase console setup.
firebase.initializeApp({
  apiKey: self.__FIREBASE_API_KEY || "REPLACE_ME",
  authDomain: self.__FIREBASE_AUTH_DOMAIN || "REPLACE_ME.firebaseapp.com",
  projectId: self.__FIREBASE_PROJECT_ID || "REPLACE_ME",
  storageBucket: self.__FIREBASE_STORAGE_BUCKET || "REPLACE_ME.appspot.com",
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID || "REPLACE_ME",
  appId: self.__FIREBASE_APP_ID || "REPLACE_ME",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "GamePlay Live";
  const body = (payload.notification && payload.notification.body) || "";
  const image = payload.notification && payload.notification.image;
  const url = (payload.data && payload.data.url) || "/";
  self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    image: image || undefined,
    data: { url },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

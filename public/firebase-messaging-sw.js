/* Delegates to the hydrated SW route so placeholders are never served in production.
   Browsers that request /firebase-messaging-sw.js get a tiny bootstrap that imports
   the dynamically configured worker from /api/push/firebase-sw. */
/* eslint-disable no-undef */
importScripts("/api/push/firebase-sw");

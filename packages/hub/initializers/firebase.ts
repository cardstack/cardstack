import { initializeApp } from 'firebase-admin/app';
import admin from 'firebase-admin';
import config from 'config';

export default function initFirebase() {
  // apps.length check is to prevent "multiple initialization error" when running tests
  if (config.get('firebase.projectId') && admin.apps.length === 0) {
    initializeApp({
      credential: admin.credential.cert({
        projectId: config.get('firebase.projectId'),
        clientEmail: config.get('firebase.clientEmail'),
        privateKey: config.get('firebase.privateKey'),
      }),
      databaseURL: config.get('firebase.databaseURL'),
    });
  }
}

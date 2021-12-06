import { initializeApp } from 'firebase-admin/app';
import admin from 'firebase-admin';
import config from 'config';

export default function initFirebase() {
  initializeApp({
    credential: admin.credential.cert({
      projectId: config.get('firebase.projectId'),
      clientEmail: config.get('firebase.clientEmail'),
      privateKey: config.get('firebase.privateKey'),
    }),
    databaseURL: config.get('firebase.databaseURL'),
  });
}

import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

export const firebaseConfig = {
  apiKey: 'AIzaSyDeLbdvQ7ANADewDn_ciewU6wUeyFbolO0',
  authDomain: 'chatt-cdbf2.firebaseapp.com',
  databaseURL: 'https://chatt-cdbf2-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'chatt-cdbf2',
  storageBucket: 'chatt-cdbf2.firebasestorage.app',
  messagingSenderId: '754254258256',
  appId: '1:754254258256:web:fd9df9aab2f42115827155',
  measurementId: 'G-L22N68Q2ZQ',
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Safely initialize Firebase Analytics in browser contexts that support it
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      // Ignore analytics blocked by privacy extensions or sandboxed frames
    });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const db = getDatabase(app);

// Firebase v9 modular setup (Auth, Firestore, Storage).
// Configure these env vars in your Vite .env file (VITE_FIREBASE_...)
// Lazy/dynamic firebase initializer. This avoids build-time failures when
// firebase isn't installed in the dev environment. At runtime the code will
// dynamically import firebase packages when used.
// Static Firebase v9 modular setup. Ensure you set VITE_FIREBASE_* env vars.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const required = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const envVarNames: Record<keyof typeof required, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};



// runtime warnings for missing env vars
Object.entries(required).forEach(([k, v]) => {
	const envName = envVarNames[k as keyof typeof required];
	if (!v) console.warn(`Missing ${envName} in environment (.env)`);
});

const firebaseConfig = {
	apiKey: required.apiKey,
	authDomain: required.authDomain,
	projectId: required.projectId,
	storageBucket: required.storageBucket,
	messagingSenderId: required.messagingSenderId,
	appId: required.appId,
	measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined) ?? undefined,
};

let _app: ReturnType<typeof initializeApp> | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;
let _db: ReturnType<typeof getFirestore> | null = null;
let _storage: ReturnType<typeof getStorage> | null = null;

export const googleProvider = new GoogleAuthProvider();

function initApp(): ReturnType<typeof initializeApp> {
	// In dev, print masked env diagnostic right when initialization is attempted.
	// This helps confirm which VITE_FIREBASE_* values were bundled into the app.
	if (import.meta.env.DEV) debugFirebaseEnv();
	if (!_app) {
		if (!firebaseConfig.apiKey) {
			throw new Error('Missing VITE_FIREBASE_API_KEY in environment. Add .env and restart dev server.');
		}
		_app = initializeApp(firebaseConfig);
	}
	return _app;
}

export function getAuthInstance() {
	if (!_auth) _auth = getAuth(initApp());
	return _auth;
}

export function getFirestoreInstance() {
	if (!_db) _db = getFirestore(initApp());
	return _db;
}

export function getStorageInstance() {
	if (!_storage) _storage = getStorage(initApp());
	return _storage;
}

// Note: by using getters (getAuthInstance/getFirestoreInstance) we avoid
// triggering Firebase network calls (like identitytoolkit/getProjectConfig)
// at module load time. Call these functions only when you actually need auth/db/storage.

// Debug helper: in development, log a masked view of the VITE_FIREBASE_* values
// so you can confirm which values are actually present in the browser runtime
// without exposing full secrets in logs. This helps diagnose "api-key-not-valid"
// errors (wrong key, missing key, or key restricted to other referrers).
function mask(val?: string) {
	if (!val) return '<missing>';
	if (val.length <= 10) return '********';
	return `${val.slice(0, 6)}...${val.slice(-4)}`;
}

export function debugFirebaseEnv(): void {
	if (!(import.meta.env.DEV)) return;
	try {
		// Only log masked/diagnostic info
		
		console.debug('Firebase env (masked):', {
			apiKey: mask(required.apiKey as string | undefined),
			authDomain: required.authDomain ?? '<missing>',
			projectId: required.projectId ?? '<missing>',
			storageBucket: required.storageBucket ?? '<missing>',
			appId: required.appId ?? '<missing>',
		});
	} catch {
		// noop - intentionally swallow debug errors
	}
}


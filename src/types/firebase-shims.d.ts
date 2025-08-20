// Minimal shims for firebase modules to satisfy TypeScript in dev environments
declare module 'firebase/app';
declare module 'firebase/auth';
declare module 'firebase/firestore';
declare module 'firebase/storage';
declare module 'firebase/analytics';

declare module 'firebase/*';

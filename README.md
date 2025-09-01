# LivePulse Web — React + TypeScript + Vite

This app includes a simple WebRTC live streaming flow (Broadcaster ↔ Viewer) using Firebase Firestore for signaling.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Quick start (WebRTC + TURN)

1) Copy `.env.example` to `.env.local` and fill your Firebase values. For stable WebRTC across NATs, add TURN (recommended):

```
VITE_TURN_URL=turn:turn.example.com:3478
VITE_TURN_USERNAME=turnUser
VITE_TURN_CREDENTIAL=turnPass
# Optional for strict NAT testing
# VITE_FORCE_RELAY_FOR_VIEWER=true
```

2) Start dev server and open the app in two tabs/machines (one as broadcaster, one as viewer).

3) If the viewer sees a black screen and logs show ICE `disconnected/failed` on the broadcaster, configure a working TURN server or set `VITE_FORCE_RELAY_FOR_VIEWER=true` to force relay.

Notes:
- Signaling collections live under `liveStreams/{id}/sdp/{offer|answer}` and ICE in `candidates_broadcaster`/`candidates_viewers`.
- The app automatically handles ICE restarts and renegotiation.

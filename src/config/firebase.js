import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, CustomProvider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyCY2sz1UNEmUrrHgrCxOqSHiYJZ6nm2cF4",
  authDomain: "teamflow-c441c.firebaseapp.com",
  projectId: "teamflow-c441c",
  storageBucket: "teamflow-c441c.firebasestorage.app",
  messagingSenderId: "605163842942",
  appId: "1:605163842942:web:f1b8061dc44a724665172f",
  measurementId: "G-ZZPV5YQ8SM",
  // 온라인 상태(접속 여부) 표시용 Realtime Database
  // 콘솔에서 다른 리전으로 생성했다면 .env 의 REACT_APP_FIREBASE_DATABASE_URL 로 실제 URL 지정
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://teamflow-c441c-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);

// ── App Check ──────────────────────────────────────────────────
// 기존 프로젝트의 App Check (콘솔에서 설정한 reCAPTCHA Enterprise / 디버그 토큰 그대로 사용)
//  - 배포/일반: reCAPTCHA 사이트 키 (.env REACT_APP_RECAPTCHA_SITE_KEY, 종류는 REACT_APP_RECAPTCHA_PROVIDER=enterprise|v3)
//  - 로컬 개발: 콘솔에 등록한 디버그 토큰 (.env.development.local REACT_APP_APPCHECK_DEBUG_TOKEN, 개발 서버에서만 사용)
const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
const RECAPTCHA_PROVIDER = (process.env.REACT_APP_RECAPTCHA_PROVIDER || 'enterprise').toLowerCase();
const APPCHECK_DEBUG_TOKEN = process.env.NODE_ENV !== 'production' ? process.env.REACT_APP_APPCHECK_DEBUG_TOKEN : undefined;

// 로컬 개발 시 App Check 디버그 토큰 (브라우저 전역 값)
// eslint-disable-next-line no-restricted-globals
if (typeof window !== 'undefined' && APPCHECK_DEBUG_TOKEN) self.FIREBASE_APPCHECK_DEBUG_TOKEN = APPCHECK_DEBUG_TOKEN;

const attachAppCheck = (targetApp, siteKey, providerType) => {
  if (typeof window === 'undefined' || !(siteKey || APPCHECK_DEBUG_TOKEN)) return null;
  try {
    const provider = siteKey
      ? (providerType === 'v3' ? new ReCaptchaV3Provider(siteKey) : new ReCaptchaEnterpriseProvider(siteKey))
      // 디버그 토큰만 있는 로컬 개발: 디버그 모드에서는 이 provider가 호출되지 않음
      : new CustomProvider({ getToken: () => Promise.reject(new Error('reCAPTCHA site key not configured')) });
    return initializeAppCheck(targetApp, { provider, isTokenAutoRefreshEnabled: true });
  } catch (e) {
    console.error(`App Check 초기화 실패 (${targetApp.name}):`, e);
    return null;
  }
};

// 기존 프로젝트 App Check (기존 설정 그대로 유지)
export const appCheck = attachAppCheck(app, RECAPTCHA_SITE_KEY, RECAPTCHA_PROVIDER);

export const auth = getAuth(app);
export const db = getFirestore(app);


let realtimeDb = null;
try { realtimeDb = getDatabase(app); } catch (e) { console.error('Realtime Database 초기화 실패:', e); }
export const rtdb = realtimeDb;
export default app;

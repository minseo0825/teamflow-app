// AI 코드 리뷰 내역 — Firestore `codeReviews` 컬렉션
// - 분석 성공 시에만 저장 (실패한 요청은 저장하지 않음)
// - 본인(uid) 내역만 조회/삭제 (Firestore 보안 규칙으로도 강제)
// - 내역 조회는 Firestore 데이터만 사용하며 Groq API를 다시 호출하지 않음
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COL = 'codeReviews';

// 분석 결과 저장 → 문서 id 반환
export async function saveCodeReview(uid, { code, lang, focus, review, model }) {
  const ref = await addDoc(collection(db, COL), {
    uid,
    code,
    lang,
    focus,
    score: review.score,
    summary: review.summary,
    // 분석 결과 + 개선 코드(각 지적 사항의 fix)
    issues: review.issues.map(i => ({
      severity: i.severity, line: i.line ?? null, title: i.title, desc: i.desc, fix: i.fix,
    })),
    model: model || null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// 내 리뷰 내역 실시간 구독 (최신순). 복합 색인 없이 동작하도록 정렬은 클라이언트에서 수행
export function subscribeMyCodeReviews(uid, onData, onError) {
  const q = query(collection(db, COL), where('uid', '==', uid));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => {
      const data = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, ...data, createdAtMs: data.createdAt?.toMillis?.() ?? Date.now() };
    });
    list.sort((a, b) => b.createdAtMs - a.createdAtMs);
    onData(list);
  }, onError);
}

export function deleteCodeReview(id) {
  return deleteDoc(doc(db, COL, id));
}

// 저장된 문서 → 화면 표시용 리뷰 객체
export const toReview = (h) => ({ score: h.score, summary: h.summary, issues: h.issues || [] });

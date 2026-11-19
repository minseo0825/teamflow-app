import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext(null);

const DEFAULT_PROJECTS = [
  { id: 'p1', name: '쇼핑몰 리뉴얼', desc: 'B2C 이커머스 플랫폼 전면 개편 프로젝트', color: '#1e4fd8', progress: 67, members: ['김지수', '이민호', '박서연'], issues: 12 },
  { id: 'p2', name: '내부 관리 시스템', desc: 'HR/ERP 통합 관리 시스템 구축', color: '#1a7f4e', progress: 34, members: ['이민호', '최준혁'], issues: 8 },
  { id: 'p3', name: '모바일 앱 v2.0', desc: 'iOS/Android 앱 메이저 업데이트', color: '#6b3fc4', progress: 88, members: ['박서연', '김지수', '이민호'], issues: 5 },
];

const DEFAULT_ISSUES = [
  { id: 'i1', pid: 'p1', title: '결제 페이지 로딩 속도 개선', priority: 'critical', status: 'progress', assignee: '이민호', created: '2025-01-15', desc: '결제 페이지 초기 로드가 4.2초로 기준(2초) 초과.', comments: [{ author: '김지수', time: '2시간 전', txt: 'Chrome DevTools로 확인했을 때 블로킹 리소스가 주 원인입니다.' }], tags: ['performance', 'frontend'] },
  { id: 'i2', pid: 'p1', title: '상품 이미지 WebP 변환 자동화', priority: 'high', status: 'todo', assignee: '박서연', created: '2025-01-16', desc: '업로드 시 자동으로 WebP 형식으로 변환하여 용량을 70% 줄이는 파이프라인 구축.', comments: [], tags: ['backend', 'infra'] },
  { id: 'i3', pid: 'p1', title: '모바일 장바구니 UX 개선', priority: 'medium', status: 'review', assignee: '김지수', created: '2025-01-14', desc: '모바일에서 장바구니 진입 후 뒤로가기 시 스크롤 위치 초기화 버그 수정.', comments: [{ author: '이민호', time: '1일 전', txt: 'iOS Safari에서만 재현됩니다.' }], tags: ['bug', 'mobile'] },
  { id: 'i4', pid: 'p2', title: '직원 권한 관리 모듈 설계', priority: 'high', status: 'todo', assignee: '최준혁', created: '2025-01-17', desc: 'RBAC 기반의 직원 역할/권한 관리 시스템 설계 및 구현.', comments: [], tags: ['backend', 'security'] },
  { id: 'i5', pid: 'p2', title: '월별 급여 리포트 자동 생성', priority: 'medium', status: 'done', assignee: '이민호', created: '2025-01-10', desc: '매월 말일 자동으로 급여 명세서 PDF 생성 및 이메일 발송.', comments: [{ author: '최준혁', time: '3일 전', txt: '배포 완료.' }], tags: ['automation', 'pdf'] },
  { id: 'i6', pid: 'p3', title: 'iOS 푸시 알림 미도달 버그', priority: 'critical', status: 'progress', assignee: '박서연', created: '2025-01-18', desc: 'iOS 16 이상에서 푸시 알림이 30% 확률로 미도달하는 버그.', comments: [], tags: ['bug', 'ios', 'critical'] },
  { id: 'i7', pid: 'p3', title: '다크모드 색상 시스템 통일', priority: 'low', status: 'todo', assignee: '김지수', created: '2025-01-19', desc: '앱 전체 다크모드 색상 토큰 정리 및 일관성 확보.', comments: [], tags: ['design', 'darkmode'] },
];

const DEFAULT_MEETINGS = [
  { id: 'm1', pid: 'p1', title: '결제 시스템 성능 개선 킥오프', date: '2025-01-15', attendees: ['김지수', '이민호', '박서연'], content: '결제 페이지 로딩 이슈 원인 분석. Lighthouse 기준 수립. 2주 스프린트 계획. 담당자: 이민호. 완료 목표: 1월 31일.', summary: '' },
  { id: 'm2', pid: 'p2', title: 'HR 시스템 요구사항 정의', date: '2025-01-12', attendees: ['이민호', '최준혁'], content: 'RBAC 권한 모델 설계 논의. 직급별 메뉴 접근 권한 매핑. 급여 모듈 우선 개발 결정.', summary: '' },
  { id: 'm3', pid: 'p3', title: '앱 v2.0 릴리즈 사전 점검', date: '2025-01-18', attendees: ['박서연', '김지수', '이민호'], content: 'iOS 푸시 알림 버그 재현 방법 공유. APNs 토큰 이슈 확인. 릴리즈 2월 첫째 주로 연기 결정.', summary: '' },
];

const DEFAULT_NOTIFS = [
  { id: 'n1', type: 'issue', txt: '이민호님이 이슈 #i1에 코멘트를 남겼습니다', time: '5분 전', read: false },
  { id: 'n2', type: 'pr', txt: '박서연님이 PR #42를 머지했습니다', time: '1시간 전', read: false },
  { id: 'n3', type: 'meeting', txt: '회의록이 등록되었습니다', time: '3시간 전', read: true },
  { id: 'n4', type: 'invite', txt: '최준혁님이 프로젝트에 초대했습니다', time: '1일 전', read: true },
];

const DEFAULT_ROOMS = [
  { id: 'general', name: '일반', desc: '전체 공지 및 일상 대화' },
  { id: 'dev', name: '개발', desc: '개발 관련 논의' },
  { id: 'design', name: '디자인', desc: 'UI/UX 논의' },
  { id: 'p1-ch', name: '쇼핑몰 리뉴얼', desc: '프로젝트 채널', project: true },
];

const DEFAULT_MSGS = {
  general: [
    { id: 'c1', author: '이민호', txt: '안녕하세요! 오늘 스탠드업 2시에 시작하겠습니다.', time: '오전 9:02' },
    { id: 'c2', author: '김지수', txt: '알겠습니다. 준비하고 있겠습니다.', time: '오전 9:05' },
  ],
  dev: [
    { id: 'd1', author: '최준혁', txt: 'PR #44 리뷰 부탁드립니다.', time: '오전 10:30' },
  ],
  design: [],
  'p1-ch': [
    { id: 'p1', author: '박서연', txt: 'WebP 변환 파이프라인 설계 완료했습니다.', time: '어제' },
  ],
};

function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem('tf_react') || 'null');
    if (d) return d;
  } catch (e) {}
  return null;
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tf_react_me') || 'null'); } catch { return null; }
  });

  const saved = loadData();
  const [projects, setProjects] = useState(saved?.projects || DEFAULT_PROJECTS);
  const [issues, setIssues] = useState(saved?.issues || DEFAULT_ISSUES);
  const [meetings, setMeetings] = useState(saved?.meetings || DEFAULT_MEETINGS);
  const [notifs, setNotifs] = useState(saved?.notifs || DEFAULT_NOTIFS);
  const [rooms, setRooms] = useState(saved?.rooms || DEFAULT_ROOMS);
  const [msgs, setMsgs] = useState(saved?.msgs || DEFAULT_MSGS);
  const [extraMembers, setExtraMembers] = useState(saved?.extraMembers || []);
  const [toasts, setToasts] = useState([]);

  const save = useCallback((data) => {
    try { localStorage.setItem('tf_react', JSON.stringify(data)); } catch (e) {}
  }, []);

  useEffect(() => {
    save({ projects, issues, meetings, notifs, rooms, msgs, extraMembers });
  }, [projects, issues, meetings, notifs, rooms, msgs, extraMembers, save]);

  const toast = useCallback((msg, type = 's') => {
    const id = Date.now();
    setToasts(prev => [{ id, msg, type }, ...prev]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);

  const addNotif = useCallback((type, txt) => {
    setNotifs(prev => [{ id: 'n' + Date.now(), type, txt, time: '방금', read: false }, ...prev]);
  }, []);

  const login = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem('tf_react_me', JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('tf_react_me');
  }, []);

  const openIssueCount = issues.filter(i => i.status !== 'done').length;

  return (
    <AppContext.Provider value={{
      user, login, logout,
      projects, setProjects,
      issues, setIssues,
      meetings, setMeetings,
      notifs, setNotifs,
      rooms, setRooms,
      msgs, setMsgs,
      extraMembers, setExtraMembers,
      toasts, toast,
      addNotif,
      openIssueCount,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

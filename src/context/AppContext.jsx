import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy,
  serverTimestamp, setDoc, getDoc, getDocs, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import {
  ref as rtdbRef, onValue, push, set as rtdbSet, remove as rtdbRemove,
  onDisconnect, serverTimestamp as rtdbServerTimestamp,
} from 'firebase/database';
import { auth, db, rtdb } from '../config/firebase';

const AppContext = createContext(null);

const DEFAULT_ROOMS = [];

// 참여 초대 대상별 Firestore 정보
//  uidsField  : 참여자 uid 배열 (조회 권한)
//  namesField : 참여자 이름 배열 (화면 표시용, 있는 경우만)
export const ITEM_INVITE = {
  project: { label: '프로젝트', col: 'projects', uidsField: 'memberUids',      namesField: 'members' },
  issue:   { label: '이슈',     col: 'issues',   uidsField: 'participantUids', namesField: null },
  meeting: { label: '회의록',   col: 'meetings', uidsField: 'attendeeUids',    namesField: null },
};

// 초대 대상 목록 → 저장할 inviteStatus 맵
const pendingStatusMap = (invitees = []) =>
  Object.fromEntries(invitees.map(m => [m.uid, { status: 'pending', name: m.name || m.email || '' }]));

export function AppProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [projects, setProjects]       = useState([]);
  const [issues, setIssues]           = useState([]);
  const [meetings, setMeetings]       = useState([]);
  const [notifs, setNotifs]           = useState([]);
  const [invites, setInvites]         = useState([]); // 채팅 초대 (기존 기능)
  const [itemInvites, setItemInvites] = useState([]); // 프로젝트/이슈/회의록 참여 초대
  const [rooms, setRooms]             = useState(DEFAULT_ROOMS);
  const [roomsError, setRoomsError]   = useState(null); // 채팅방 목록을 읽지 못한 이유 (보안 규칙 등)
  const [toasts, setToasts]           = useState([]);

  const toast = useCallback((msg, type = 's') => {
    const id = Date.now();
    setToasts(prev => [{ id, msg, type }, ...prev]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);

  const addNotif = useCallback((type, txt) => {
    setNotifs(prev => [{ id: 'n' + Date.now(), type, txt, time: '방금', read: false }, ...prev]);
  }, []);

  // ── Auth 상태 감지 ───────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fu) => {
      if (fu) {
        const userDoc = await getDoc(doc(db, 'users', fu.uid));
        const ud = userDoc.exists() ? userDoc.data() : {};
        setUser({ uid: fu.uid, name: fu.displayName || ud.name || '사용자', email: fu.email, role: ud.role || '멤버', team: ud.team || '내 팀', profileColor: ud.profileColor || null });
      } else {
        setUser(null);
        setProjects([]); setIssues([]); setMeetings([]);
        setRooms(DEFAULT_ROOMS); setInvites([]); setItemInvites([]);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Firestore 실시간 구독 ────────────────────────────
  useEffect(() => {
    if (!user) return;

    // 프로젝트: 공개 범위에 따라 3개 쿼리 결과를 합침
    //  - mine   : 내가 만든 프로젝트 (기존 프로젝트 포함)
    //  - team   : 내가 참여 팀원(memberUids)으로 지정된 프로젝트
    //  - public : 같은 조직(org)의 '전체' 공개 프로젝트
    const projectSources = { mine: [], team: [], public: [] };
    const mergeProjects = () => {
      const map = new Map();
      [...projectSources.mine, ...projectSources.team, ...projectSources.public].forEach(p => map.set(p.id, p));
      const toMs = p => p.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER; // 방금 생성(서버 시간 대기)은 맨 앞
      setProjects([...map.values()].sort((a, b) => toMs(b) - toMs(a)));
    };
    const projectSub = (key, q) => onSnapshot(q,
      s => { projectSources[key] = s.docs.map(d => ({ id: d.id, ...d.data() })); mergeProjects(); },
      (err) => console.error(`프로젝트(${key}) 구독 에러:`, err));

    const issueSources = { mine: [], invited: [] };
    const issueSub = (key, q) => onSnapshot(q,
      s => {
        issueSources[key] = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const map = new Map();
        [...issueSources.mine, ...issueSources.invited].forEach(i => map.set(i.id, i));
        const toMs = i => i.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        setIssues([...map.values()].sort((a, b) => toMs(b) - toMs(a)));
      },
      (err) => console.error(`이슈(${key}) 구독 에러:`, err));

    // 채팅방 문서 구독 상태 (삭제된 방은 null → 목록에서 제외)
    const roomSubs = {};
    const roomDocs = {};
    const roomErrors = new Set();
    const publishRooms = () => {
      const toMs = r => r.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      setRooms(Object.values(roomDocs).filter(Boolean).sort((a, b) => toMs(a) - toMs(b)));
      setRoomsError(roomErrors.size ? 'room-denied' : null);
    };

    const meetingSources = { mine: [], invited: [] };
    const meetingSub = (key, q) => onSnapshot(q,
      s => {
        meetingSources[key] = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const map = new Map();
        [...meetingSources.mine, ...meetingSources.invited].forEach(m => map.set(m.id, m));
        const toMs = m => m.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        setMeetings([...map.values()].sort((a, b) => toMs(b) - toMs(a)));
      },
      (err) => console.error(`회의록(${key}) 구독 에러:`, err));

    const subs = [
      projectSub('mine', query(collection(db, 'projects'), where('createdBy', '==', user.uid), orderBy('createdAt', 'desc'))),
      projectSub('team', query(collection(db, 'projects'), where('memberUids', 'array-contains', user.uid))),
      projectSub('public', query(collection(db, 'projects'), where('visibility', '==', 'public'), where('org', '==', user.team || ''))),

      // 이슈: 내가 만든 이슈 + 내가 참여자로 초대된 이슈만 (그 외 사용자는 조회 불가)
      issueSub('mine', query(collection(db, 'issues'), where('createdBy', '==', user.uid), orderBy('createdAt', 'desc'))),
      issueSub('invited', query(collection(db, 'issues'), where('participantUids', 'array-contains', user.uid))),

      // 회의록: 내가 만든 회의록 + 내가 참석자로 초대된 회의록
      meetingSub('mine', query(collection(db, 'meetings'), where('createdBy', '==', user.uid), orderBy('createdAt', 'desc'))),
      meetingSub('invited', query(collection(db, 'meetings'), where('attendeeUids', 'array-contains', user.uid))),

      // 채팅방: 내가 멤버(roomMembers)인 방만, 방 문서를 하나씩 구독
      // (rooms 전체 조회는 보안 규칙에 막히므로 사용하지 않음)
      onSnapshot(
        query(collection(db, 'roomMembers'), where('uid', '==', user.uid)),
        s => {
          const myRoomIds = new Set(s.docs.map(d => d.data().roomId).filter(Boolean));
          // 나간 방 구독 해제
          Object.keys(roomSubs).forEach(id => {
            if (!myRoomIds.has(id)) { roomSubs[id](); delete roomSubs[id]; delete roomDocs[id]; }
          });
          // 새로 참여한 방 구독
          myRoomIds.forEach(id => {
            if (roomSubs[id]) return;
            roomSubs[id] = onSnapshot(doc(db, 'rooms', id),
              rs => { roomDocs[id] = rs.exists() ? { id: rs.id, ...rs.data() } : null; roomErrors.delete(id); publishRooms(); },
              err => { console.error(`채팅방(${id}) 구독 에러:`, err.code); roomDocs[id] = null; roomErrors.add(id); publishRooms(); });
          });
          publishRooms();
        },
        err => { console.error('채팅방 멤버십 구독 에러:', err); setRoomsError(err.code === 'permission-denied' ? 'membership-denied' : 'membership-error'); }
      ),

      // 초대 구독: 채팅 초대(기존 기능) + 프로젝트/이슈/회의록 참여 초대
      onSnapshot(
        query(collection(db, 'invites'), where('toEmail', '==', user.email), where('status', '==', 'pending')),
        s => {
          const all = s.docs.map(d => ({ id: d.id, ...d.data() }));
          setInvites(all.filter(inv => !ITEM_INVITE[inv.type]));
          setItemInvites(all.filter(inv => ITEM_INVITE[inv.type]));
        },
        (err) => console.error('초대 구독 에러:', err)
      ),

      onSnapshot(
        query(collection(db, 'notifications'), where('uid', '==', user.uid), orderBy('createdAt', 'desc')),
        s => setNotifs(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
    ];

    return () => {
      subs.forEach(u => u());
      Object.values(roomSubs).forEach(u => u());
    };
  }, [user]);

  // ── 실시간 접속 상태 (Realtime Database presence) ────
  // presence/{uid}/connections/{connId} : 탭(연결)마다 1개 노드
  //  - 연결되면 노드 생성, 연결이 끊기면(브라우저 종료·네트워크 단절) 서버가 onDisconnect로 자동 삭제
  //  - 노드가 1개 이상이면 온라인 → 여러 탭 중 하나만 닫아도 오프라인이 되지 않음
  const [isConnected, setIsConnected] = useState(false);
  const presenceConnRef = useRef(null);

  useEffect(() => {
    if (!user?.uid || !rtdb) return;
    const uid = user.uid;
    const unsub = onValue(rtdbRef(rtdb, '.info/connected'), snap => {
      const connected = snap.val() === true;
      setIsConnected(connected);
      if (!connected) return;
      const connRef = push(rtdbRef(rtdb, `presence/${uid}/connections`));
      presenceConnRef.current = connRef;
      onDisconnect(connRef).remove()
        .then(() => rtdbSet(connRef, { at: rtdbServerTimestamp(), ua: navigator.userAgent.slice(0, 120) }))
        .catch(err => console.error('접속 상태 등록 실패:', err));
    }, err => console.error('접속 상태 구독 에러:', err));

    return () => {
      unsub();
      if (presenceConnRef.current) {
        rtdbRemove(presenceConnRef.current).catch(() => {});
        presenceConnRef.current = null;
      }
      setIsConnected(false);
    };
  }, [user?.uid]);

  // 다른 사용자의 접속 상태 구독 → callback({ state: 'online' | 'offline' })
  const subscribeUserStatus = useCallback((uid, callback) => {
    if (!rtdb || !uid) { callback({ state: 'offline' }); return () => {}; }
    return onValue(rtdbRef(rtdb, `presence/${uid}/connections`),
      snap => callback({ state: snap.exists() ? 'online' : 'offline' }),
      () => callback({ state: 'offline' }));
  }, []);

  // ── 로그인/회원가입/로그아웃 ─────────────────────────
  // ── 프로필 색상 변경 ─────────────────────────────────
  const updateProfileColor = useCallback(async (color) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { profileColor: color });
      setUser(prev => ({ ...prev, profileColor: color }));
    } catch { }
  }, [user]);

  // ── 프로필 업데이트 ──────────────────────────────────
  const updateProfile = useCallback(async (updates) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
      setUser(prev => ({ ...prev, ...updates }));
      toast('프로필이 업데이트되었습니다', 's');
    } catch {
      toast('프로필 업데이트에 실패했습니다', 'e');
    }
  }, [user, toast]);

  const login = useCallback(async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast('로그인되었습니다', 's');
    } catch (e) {
      const msg = e.code === 'auth/invalid-credential' ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : e.code === 'auth/user-not-found' ? '계정이 없습니다. 회원가입을 먼저 해주세요.'
        : e.code === 'auth/wrong-password' ? '비밀번호가 올바르지 않습니다.'
        : '로그인에 실패했습니다.';
      toast(msg, 'e'); throw e;
    }
  }, [toast]);

  const register = useCallback(async ({ name, email, password, role, team }) => {
    try {
      const { user: fu } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(fu, { displayName: name });
      const userRole = role || '멤버';
      const userTeam = team || '내 팀';
      await setDoc(doc(db, 'users', fu.uid), {
        name, email, role: userRole, team: userTeam, createdAt: serverTimestamp(),
      });
      // 기본 채널 자동 등록
      for (const roomId of ['general', 'dev', 'design']) {
        await setDoc(doc(db, 'roomMembers', `${roomId}_${fu.uid}`), {
          roomId, uid: fu.uid, name, email, role: userRole, joinedAt: serverTimestamp(),
        });
      }
      toast(`${name}님, 환영합니다!`, 's');
    } catch (e) {
      const msg = e.code === 'auth/email-already-in-use' ? '이미 가입된 이메일입니다.'
        : e.code === 'auth/weak-password' ? '비밀번호는 6자 이상이어야 합니다.'
        : '회원가입에 실패했습니다.';
      toast(msg, 'e'); throw e;
    }
  }, [toast]);

  const logout = useCallback(async () => {
    // 로그아웃 전에(인증이 살아있을 때) 이 탭의 접속 노드를 제거 → 즉시 오프라인 반영
    if (presenceConnRef.current) {
      const connRef = presenceConnRef.current;
      presenceConnRef.current = null;
      try { await onDisconnect(connRef).cancel(); await rtdbRemove(connRef); } catch { }
    }
    await signOut(auth);
    toast('로그아웃되었습니다', 'i');
  }, [toast]);

  // ── 채팅 초대 보내기 ─────────────────────────────────
  // toEmail: 상대 이메일 (가입된 사용자만 초대 가능), opts.silent: 토스트 생략
  // 반환: true(발송) / false(발송 안 함)
  const sendInvite = useCallback(async (toEmail, roomId, roomName, opts = {}) => {
    if (!user || !roomId) return false;
    const email = String(toEmail || '').trim();
    if (!email) { toast('이메일을 입력하세요', 'e'); return false; }
    if (email.toLowerCase() === String(user.email).toLowerCase()) { toast('자신을 초대할 수 없습니다', 'e'); return false; }
    try {
      // 가입된 사용자인지 확인 (users 컬렉션)
      let snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
      if (snap.empty && email !== email.toLowerCase()) snap = await getDocs(query(collection(db, 'users'), where('email', '==', email.toLowerCase())));
      if (snap.empty) { toast(`${email} 은(는) TeamFlow에 가입된 사용자가 아닙니다`, 'e'); return false; }
      const target = { uid: snap.docs[0].id, ...snap.docs[0].data() };

      // 이미 참여 중인지 확인 (채팅 화면에서 구독 중인 멤버 목록 기준)
      if ((opts.memberUids || []).includes(target.uid)) { if (!opts.silent) toast(`${target.name || email}님은 이미 이 채팅방에 참여 중입니다`, 'i'); return false; }

      // 중복 초대 방지 (내가 보낸 대기 중 초대)
      const dup = await getDocs(query(collection(db, 'invites'),
        where('fromUid', '==', user.uid), where('roomId', '==', roomId), where('toUid', '==', target.uid), where('status', '==', 'pending')));
      if (!dup.empty) { if (!opts.silent) toast('이미 초대장을 보냈습니다', 'i'); return false; }

      await addDoc(collection(db, 'invites'), {
        type: 'chat',
        fromUid:   user.uid,
        fromName:  user.name,
        fromEmail: user.email,
        toUid:     target.uid,
        toName:    target.name || '',
        toEmail:   String(target.email || email).toLowerCase(), // Firebase 로그인 이메일은 소문자로 저장됨
        roomId,
        roomName,
        isDM: !!opts.isDM,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      if (!opts.silent) toast(`${target.name || email}님에게 초대장을 보냈습니다`, 's');
      return true;
    } catch (e) {
      console.error('채팅 초대 실패:', e);
      toast('초대 전송에 실패했습니다', 'e');
      return false;
    }
  }, [user, toast]);

  // ── 채팅 초대 수락 → 수락한 본인만 멤버로 등록 ────────
  const acceptInvite = useCallback(async (invite) => {
    try {
      await updateDoc(doc(db, 'invites', invite.id), { status: 'accepted', respondedAt: serverTimestamp() });
      await setDoc(doc(db, 'roomMembers', `${invite.roomId}_${user.uid}`), {
        roomId: invite.roomId,
        uid: user.uid,
        name: user.name,
        email: user.email,
        role: user.role || '멤버',
        inviteId: invite.id, // 보안 규칙에서 '초대받은 사람만 참여' 확인용
        joinedAt: serverTimestamp(),
      });
      toast(invite.isDM ? `${invite.fromName}님과의 1:1 채팅에 참여했습니다` : `#${invite.roomName} 채널에 참여했습니다!`, 's');
      return true;
    } catch (e) {
      console.error('채팅 초대 수락 실패:', e);
      toast('수락에 실패했습니다', 'e');
      return false;
    }
  }, [user, toast]);

  // ── 채팅방 만들기 (그룹 채널 / 1:1 채팅) ─────────────
  // 방을 만든 사람만 바로 멤버가 되고, 나머지는 초대장을 받아 수락해야 참여
  const createChatRoom = useCallback(async ({ name, desc = '', isDM = false, dmWith = null }) => {
    if (!user) return null;
    const id = `${isDM ? 'dm' : 'ch'}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; // 기존 방과 겹치지 않는 고유 ID
    try {
      await setDoc(doc(db, 'rooms', id), {
        id, name, desc,
        isDM,
        ...(isDM && dmWith ? { dmUids: [user.uid, dmWith.uid], dmNames: { [user.uid]: user.name, [dmWith.uid]: dmWith.name || '' } } : {}),
        createdBy: user.uid, createdByName: user.name,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'roomMembers', `${id}_${user.uid}`), {
        roomId: id, uid: user.uid, name: user.name, email: user.email, role: user.role || '멤버',
        isOwner: true, joinedAt: serverTimestamp(),
      });
      return id;
    } catch (e) {
      console.error('채팅방 생성 실패:', e);
      toast('채팅방 생성에 실패했습니다', 'e');
      return null;
    }
  }, [user, toast]);

  // ── 초대 거절 ────────────────────────────────────────
  const rejectInvite = useCallback(async (inviteId) => {
    try {
      await updateDoc(doc(db, 'invites', inviteId), { status: 'rejected' });
      toast('초대를 거절했습니다', 'i');
    } catch {
      toast('거절에 실패했습니다', 'e');
    }
  }, [toast]);

  // ── 프로젝트/이슈/회의록 참여 초대 ───────────────────
  // 초대장 발송 (참여자로는 생성 시점에 바로 등록됨. 거절하면 제외)
  const sendItemInvites = useCallback(async (type, targetId, targetName, invitees = []) => {
    const targets = invitees.filter(m => m?.uid && m.uid !== user.uid);
    await Promise.all(targets.map(m => addDoc(collection(db, 'invites'), {
      type, targetId, targetName,
      fromUid: user.uid, fromName: user.name, fromEmail: user.email,
      toUid: m.uid, toName: m.name || '', toEmail: m.email || '',
      status: 'pending',
      createdAt: serverTimestamp(),
    })));
    if (targets.length) toast(`${targets.length}명에게 초대장을 보냈습니다`, 's');
  }, [user, toast]);

  // 생성자에게 수락/거절 알림
  const notifyInviteResult = async (inv, accepted) => {
    const meta = ITEM_INVITE[inv.type];
    try {
      await addDoc(collection(db, 'notifications'), {
        uid: inv.fromUid, type: 'invite', read: false, time: '방금',
        txt: `${user.name}님이 ${meta.label} "${inv.targetName}" 초대를 ${accepted ? '수락' : '거절'}했습니다`,
        createdAt: serverTimestamp(),
      });
    } catch (e) { console.error('초대 결과 알림 전송 실패:', e); }
  };

  const acceptItemInvite = useCallback(async (inv) => {
    const meta = ITEM_INVITE[inv.type];
    try {
      await updateDoc(doc(db, meta.col, inv.targetId), {
        [meta.uidsField]: arrayUnion(user.uid),
        [`inviteStatus.${user.uid}`]: { status: 'accepted', name: user.name },
      });
      if (inv.id) await updateDoc(doc(db, 'invites', inv.id), { status: 'accepted', respondedAt: serverTimestamp() });
      await notifyInviteResult(inv, true);
      toast(`${meta.label} "${inv.targetName}" 초대를 수락했습니다`, 's');
    } catch (e) {
      console.error('초대 수락 실패:', e);
      toast('수락에 실패했습니다', 'e');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, toast]);

  const rejectItemInvite = useCallback(async (inv) => {
    const meta = ITEM_INVITE[inv.type];
    try {
      // 참여자에서 제외 (이 업데이트 이후에는 해당 항목을 조회할 수 없음)
      const updates = {
        [meta.uidsField]: arrayRemove(user.uid),
        [`inviteStatus.${user.uid}`]: { status: 'rejected', name: user.name },
      };
      if (meta.namesField) updates[meta.namesField] = arrayRemove(user.name);
      await updateDoc(doc(db, meta.col, inv.targetId), updates).catch(e => {
        if (e.code !== 'not-found') throw e; // 이미 삭제된 항목이면 초대만 정리
      });
      if (inv.id) await updateDoc(doc(db, 'invites', inv.id), { status: 'rejected', respondedAt: serverTimestamp() });
      await notifyInviteResult(inv, false);
      toast('초대를 거절했습니다', 'i');
    } catch (e) {
      console.error('초대 거절 실패:', e);
      toast('거절에 실패했습니다', 'e');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, toast]);

  // 상세 화면에서 초대에 응답 (알림을 닫았거나 나중에 응답하는 경우)
  const respondToItemInvite = useCallback(async (type, item, accept) => {
    const inv = itemInvites.find(i => i.type === type && i.targetId === item.id)
      || { id: null, type, targetId: item.id, targetName: item.name || item.title || '', fromUid: item.createdBy };
    if (accept) await acceptItemInvite(inv);
    else await rejectItemInvite(inv);
  }, [itemInvites, acceptItemInvite, rejectItemInvite]);

  // 참여 중인 프로젝트/이슈/회의록에서 나가기 (생성자 제외)
  const leaveItem = useCallback(async (type, item) => {
    const meta = ITEM_INVITE[type];
    const targetName = item.name || item.title || '';
    try {
      const updates = {
        [meta.uidsField]: arrayRemove(user.uid),
        [`inviteStatus.${user.uid}`]: { status: 'left', name: user.name },
      };
      if (meta.namesField) updates[meta.namesField] = arrayRemove(user.name);
      await updateDoc(doc(db, meta.col, item.id), updates);
      // 아직 응답하지 않은 초대장이 있으면 정리
      const pending = itemInvites.filter(i => i.type === type && i.targetId === item.id);
      await Promise.all(pending.map(i => updateDoc(doc(db, 'invites', i.id), { status: 'left', respondedAt: serverTimestamp() }).catch(() => {})));
      if (item.createdBy && item.createdBy !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          uid: item.createdBy, type: 'invite', read: false, time: '방금',
          txt: `${user.name}님이 ${meta.label} "${targetName}"에서 나갔습니다`,
          createdAt: serverTimestamp(),
        }).catch(e => console.error('나가기 알림 전송 실패:', e));
      }
      toast(`${meta.label} "${targetName}"에서 나갔습니다`, 'i');
      return true;
    } catch (e) {
      console.error('나가기 실패:', e);
      toast('나가기에 실패했습니다', 'e');
      return false;
    }
  }, [user, itemInvites, toast]);

  // 기존 이슈/회의록에 참여자 추가 → 바로 등록 + 초대장 발송
  const inviteToItem = useCallback(async (type, targetId, targetName, member) => {
    const meta = ITEM_INVITE[type];
    try {
      const updates = {
        [meta.uidsField]: arrayUnion(member.uid),
        [`inviteStatus.${member.uid}`]: { status: 'pending', name: member.name || member.email || '' },
      };
      if (meta.namesField) updates[meta.namesField] = arrayUnion(member.name);
      await updateDoc(doc(db, meta.col, targetId), updates);
      await sendItemInvites(type, targetId, targetName, [member]);
      return true;
    } catch (e) {
      console.error('참여자 초대 실패:', e);
      toast('참여자 초대에 실패했습니다', 'e');
      return false;
    }
  }, [sendItemInvites, toast]);

  // ── 프로젝트 CRUD ────────────────────────────────────
  // invitees: 초대장을 보낼 사용자 [{ uid, name, email }]
  const createProject = useCallback(async (data, invitees = []) => {
    try {
      const docRef = await addDoc(collection(db, 'projects'), { ...data, inviteStatus: pendingStatusMap(invitees), createdBy: user.uid, createdAt: serverTimestamp() });
      toast(`"${data.name}" 프로젝트가 생성되었습니다`, 's');
      await sendItemInvites('project', docRef.id, data.name, invitees).catch(e => console.error('초대장 발송 실패:', e));
      return docRef.id;
    } catch {
      toast('프로젝트 생성에 실패했습니다', 'e');
      return null;
    }
  }, [user, toast, sendItemInvites]);

  const updateProject = useCallback(async (id, data) => {
    try { await updateDoc(doc(db, 'projects', id), data); toast('프로젝트가 수정되었습니다', 's'); }
    catch { toast('수정에 실패했습니다', 'e'); }
  }, [toast]);

  const deleteProject = useCallback(async (id) => {
    try { await deleteDoc(doc(db, 'projects', id)); toast('프로젝트가 삭제되었습니다', 'i'); }
    catch { toast('삭제에 실패했습니다', 'e'); }
  }, [toast]);

  // ── 이슈 CRUD ────────────────────────────────────────
  const createIssue = useCallback(async (data, invitees = []) => {
    try {
      const docRef = await addDoc(collection(db, 'issues'), { ...data, inviteStatus: pendingStatusMap(invitees), createdBy: user.uid, created: new Date().toISOString().split('T')[0], createdAt: serverTimestamp(), comments: [] });
      toast(`"${data.title}" 이슈가 등록되었습니다`, 's');
      addNotif('issue', `새 이슈 "${data.title}" 등록됨`);
      await sendItemInvites('issue', docRef.id, data.title, invitees).catch(e => console.error('초대장 발송 실패:', e));
    } catch { toast('이슈 등록에 실패했습니다', 'e'); }
  }, [user, toast, addNotif, sendItemInvites]);

  const updateIssue = useCallback(async (id, field, val) => {
    try { await updateDoc(doc(db, 'issues', id), { [field]: val }); if (field !== 'comments') toast('이슈 업데이트됨', 's'); }
    catch { toast('업데이트에 실패했습니다', 'e'); }
  }, [toast]);

  const deleteIssue = useCallback(async (id) => {
    try { await deleteDoc(doc(db, 'issues', id)); toast('이슈가 삭제되었습니다', 'i'); }
    catch { toast('삭제에 실패했습니다', 'e'); }
  }, [toast]);

  // ── 회의록 CRUD ──────────────────────────────────────
  // invitees: 참여자로 초대할 사용자 → attendeeUids에 바로 등록(조회 권한) + 초대장 발송
  const createMeeting = useCallback(async (data, invitees = []) => {
    try {
      const docRef = await addDoc(collection(db, 'meetings'), {
        ...data,
        attendeeUids: [user.uid, ...invitees.map(m => m.uid)],
        inviteStatus: pendingStatusMap(invitees),
        createdBy: user.uid, createdAt: serverTimestamp(),
      });
      toast('회의록이 등록되었습니다', 's');
      await sendItemInvites('meeting', docRef.id, data.title, invitees).catch(e => console.error('초대장 발송 실패:', e));
    }
    catch { toast('회의록 등록에 실패했습니다', 'e'); }
  }, [user, toast, sendItemInvites]);

  const updateMeeting = useCallback(async (id, data) => {
    try { await updateDoc(doc(db, 'meetings', id), data); toast('회의록이 수정되었습니다', 's'); }
    catch { toast('수정에 실패했습니다', 'e'); }
  }, [toast]);

  const deleteMeeting = useCallback(async (id) => {
    try { await deleteDoc(doc(db, 'meetings', id)); toast('회의록이 삭제되었습니다', 'i'); }
    catch { toast('삭제에 실패했습니다', 'e'); }
  }, [toast]);

  // ── 채널 생성 ────────────────────────────────────────
  const createRoom = useCallback(async (name, desc = '') => {
    try {
      const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'ch-' + Date.now();
      await setDoc(doc(db, 'rooms', id), { id, name, desc, createdAt: serverTimestamp() });
      toast(`#${name} 채널이 생성되었습니다`, 's');
      return id;
    } catch { toast('채널 생성에 실패했습니다', 'e'); }
  }, [toast]);

  // ── 채팅 메시지 ──────────────────────────────────────
  // 반환: true(전송 성공) / false(실패) — 실패 시 입력한 내용을 지우지 않기 위함
  const sendMessage = useCallback(async (roomId, text) => {
    if (!user || !roomId || !text?.trim()) return false;
    try {
      await addDoc(collection(db, 'messages'), {
        roomId, author: user.name, uid: user.uid, txt: text.trim(),
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp(),
      });
      return true;
    } catch (e) {
      console.error('메시지 전송 실패:', e);
      toast(e?.code === 'permission-denied' ? '이 채팅방에 메시지를 보낼 권한이 없습니다 (초대 수락 여부 / 보안 규칙 확인)' : '메시지 전송에 실패했습니다', 'e');
      return false;
    }
  }, [user, toast]);

  // 메시지 실시간 구독: roomId 조건만 사용(복합 색인 불필요) + 화면에서 시간순 정렬
  const subscribeRoom = useCallback((roomId, callback, onError) => {
    const q = query(collection(db, 'messages'), where('roomId', '==', roomId));
    return onSnapshot(q, s => {
      const msgs = s.docs.map(d => {
        const data = d.data({ serverTimestamps: 'estimate' }); // 방금 보낸 메시지도 바로 표시
        return { id: d.id, ...data, _ms: data.createdAt?.toMillis?.() ?? Date.now() };
      });
      msgs.sort((a, b) => a._ms - b._ms);
      callback(msgs);
    }, err => { console.error('메시지 구독 에러:', err); onError?.(err); });
  }, []);

  // ── 사용자 목록 조회 (내부 함수, 11-15번 UI는 제거됨) ──
  const getAllUsers = useCallback(async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      return usersSnapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
    } catch (e) {
      console.error('사용자 목록 불러오기 실패:', e);
      return [];
    }
  }, []);

  const openIssueCount = issues.filter(i => i.status !== 'done').length;

  return (
    <AppContext.Provider value={{
      user, authLoading,
      login, register, logout,
      projects, setProjects,
      issues, meetings, notifs, rooms, roomsError,
      invites, sendInvite, acceptInvite, rejectInvite,
      itemInvites, acceptItemInvite, rejectItemInvite, inviteToItem, setNotifs,
      respondToItemInvite, leaveItem,
      toasts, toast, addNotif,
      openIssueCount,
      updateProfileColor,
      updateProfile,
      createProject, updateProject, deleteProject,
      createIssue, updateIssue, deleteIssue,
      createMeeting, updateMeeting, deleteMeeting,
      createRoom, createChatRoom,
      sendMessage, subscribeRoom,
      getAllUsers,
      subscribeUserStatus, isConnected,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

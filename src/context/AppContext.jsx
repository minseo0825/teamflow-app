import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  serverTimestamp, setDoc, getDoc, getDocs,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AppContext = createContext(null);

const DEFAULT_ROOMS = [];

export function AppProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [projects, setProjects]       = useState([]);
  const [issues, setIssues]           = useState([]);
  const [meetings, setMeetings]       = useState([]);
  const [notifs, setNotifs]           = useState([]);
  const [invites, setInvites]         = useState([]); // 채팅 초대 (기존 기능)
  const [rooms, setRooms]             = useState(DEFAULT_ROOMS);
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
        setRooms(DEFAULT_ROOMS); setInvites([]);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Firestore 실시간 구독 ────────────────────────────
  useEffect(() => {
    if (!user) return;

    const subs = [
      // 내가 만든 프로젝트만
      onSnapshot(query(collection(db, 'projects'), where('createdBy', '==', user.uid), orderBy('createdAt', 'desc')),
        s => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),

      // 내가 만든 이슈만
      onSnapshot(query(collection(db, 'issues'), where('createdBy', '==', user.uid), orderBy('createdAt', 'desc')),
        s => setIssues(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),

      // 내가 만든 회의록만
      onSnapshot(query(collection(db, 'meetings'), where('createdBy', '==', user.uid), orderBy('createdAt', 'desc')),
        s => setMeetings(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),

      // 채널: 기본 채널 + Firestore 채널
      // 내가 멤버인 채널만 보이도록 roomMembers 기반으로 구독
      onSnapshot(
        query(collection(db, 'roomMembers'), where('uid', '==', user.uid)),
        async s => {
          const myRoomIds = s.docs.map(d => d.data().roomId);
          if (myRoomIds.length === 0) { setRooms([]); return; }
          // rooms 컬렉션에서 내가 속한 채널만 가져오기
          onSnapshot(query(collection(db, 'rooms'), orderBy('createdAt', 'asc')),
            rs => {
              const myRooms = rs.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(r => myRoomIds.includes(r.id));
              setRooms(myRooms);
            }, () => {}
          );
        }, () => {}
      ),

      // 채팅 초대 구독 (기존 기능)
      onSnapshot(
        query(collection(db, 'invites'), where('toEmail', '==', user.email), where('status', '==', 'pending')),
        s => {
          // type이 'project'나 'issue'가 아닌 채팅 초대만 필터링
          const chatInvites = s.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(inv => inv.type !== 'project' && inv.type !== 'issue');
          setInvites(chatInvites);
        },
        (err) => console.error('초대 구독 에러:', err)
      ),

      onSnapshot(
        query(collection(db, 'notifications'), where('uid', '==', user.uid), orderBy('createdAt', 'desc')),
        s => setNotifs(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
    ];

    return () => subs.forEach(u => u());
  }, [user]);

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
    await signOut(auth);
    toast('로그아웃되었습니다', 'i');
  }, [toast]);

  // ── 초대 보내기 ──────────────────────────────────────
  const sendInvite = useCallback(async (toEmail, roomId, roomName) => {
    if (!user) return;
    if (toEmail === user.email) { toast('자신을 초대할 수 없습니다', 'e'); return; }
    try {
      // 중복 초대 방지
      const existing = invites.find(i => i.toEmail === toEmail && i.roomId === roomId);
      if (existing) { toast('이미 초대장을 보냈습니다', 'e'); return; }

      await addDoc(collection(db, 'invites'), {
        fromUid:   user.uid,
        fromName:  user.name,
        fromEmail: user.email,
        toEmail,
        roomId,
        roomName,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      toast(`${toEmail}에게 초대장을 보냈습니다`, 's');
    } catch {
      toast('초대 전송에 실패했습니다', 'e');
    }
  }, [user, invites, toast]);

  // ── 초대 수락 ────────────────────────────────────────
  const acceptInvite = useCallback(async (invite) => {
    try {
      await updateDoc(doc(db, 'invites', invite.id), { status: 'accepted' });
      // 채널 멤버로 등록
      await setDoc(doc(db, 'roomMembers', `${invite.roomId}_${user.uid}`), {
        roomId: invite.roomId,
        uid: user.uid,
        name: user.name,
        email: user.email,
        role: user.role || '멤버',
        joinedAt: serverTimestamp(),
      });
      // 초대한 사람도 멤버로 등록 (아직 없으면)
      await setDoc(doc(db, 'roomMembers', `${invite.roomId}_${invite.fromUid}`), {
        roomId: invite.roomId,
        uid: invite.fromUid,
        name: invite.fromName,
        email: invite.fromEmail,
        role: '멤버',
        joinedAt: serverTimestamp(),
      }, { merge: true });
      toast(`#${invite.roomName} 채널에 참여했습니다!`, 's');
    } catch {
      toast('수락에 실패했습니다', 'e');
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

  // ── 프로젝트 CRUD ────────────────────────────────────
  const createProject = useCallback(async (data) => {
    try {
      const docRef = await addDoc(collection(db, 'projects'), { ...data, createdBy: user.uid, createdAt: serverTimestamp() });
      toast(`"${data.name}" 프로젝트가 생성되었습니다`, 's');
      return docRef.id;
    } catch {
      toast('프로젝트 생성에 실패했습니다', 'e');
      return null;
    }
  }, [user, toast]);

  const updateProject = useCallback(async (id, data) => {
    try { await updateDoc(doc(db, 'projects', id), data); toast('프로젝트가 수정되었습니다', 's'); }
    catch { toast('수정에 실패했습니다', 'e'); }
  }, [toast]);

  const deleteProject = useCallback(async (id) => {
    try { await deleteDoc(doc(db, 'projects', id)); toast('프로젝트가 삭제되었습니다', 'i'); }
    catch { toast('삭제에 실패했습니다', 'e'); }
  }, [toast]);

  // ── 이슈 CRUD ────────────────────────────────────────
  const createIssue = useCallback(async (data) => {
    try {
      await addDoc(collection(db, 'issues'), { ...data, createdBy: user.uid, created: new Date().toISOString().split('T')[0], createdAt: serverTimestamp(), comments: [] });
      toast(`"${data.title}" 이슈가 등록되었습니다`, 's');
      addNotif('issue', `새 이슈 "${data.title}" 등록됨`);
    } catch { toast('이슈 등록에 실패했습니다', 'e'); }
  }, [user, toast, addNotif]);

  const updateIssue = useCallback(async (id, field, val) => {
    try { await updateDoc(doc(db, 'issues', id), { [field]: val }); if (field !== 'comments') toast('이슈 업데이트됨', 's'); }
    catch { toast('업데이트에 실패했습니다', 'e'); }
  }, [toast]);

  const deleteIssue = useCallback(async (id) => {
    try { await deleteDoc(doc(db, 'issues', id)); toast('이슈가 삭제되었습니다', 'i'); }
    catch { toast('삭제에 실패했습니다', 'e'); }
  }, [toast]);

  // ── 회의록 CRUD ──────────────────────────────────────
  const createMeeting = useCallback(async (data) => {
    try { await addDoc(collection(db, 'meetings'), { ...data, createdBy: user.uid, createdAt: serverTimestamp() }); toast('회의록이 등록되었습니다', 's'); }
    catch { toast('회의록 등록에 실패했습니다', 'e'); }
  }, [user, toast]);

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
  const sendMessage = useCallback(async (roomId, text) => {
    if (!user || !text.trim()) return;
    try {
      await addDoc(collection(db, 'messages'), {
        roomId, author: user.name, uid: user.uid, txt: text.trim(),
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp(),
      });
    } catch { toast('메시지 전송에 실패했습니다', 'e'); }
  }, [user, toast]);

  const subscribeRoom = useCallback((roomId, callback) => {
    const q = query(collection(db, 'messages'), where('roomId', '==', roomId), orderBy('createdAt', 'asc'));
    return onSnapshot(q, s => callback(s.docs.map(d => ({ id: d.id, ...d.data() }))));
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
      issues, meetings, notifs, rooms,
      invites, sendInvite, acceptInvite, rejectInvite,
      toasts, toast, addNotif,
      openIssueCount,
      updateProfileColor,
      updateProfile,
      createProject, updateProject, deleteProject,
      createIssue, updateIssue, deleteIssue,
      createMeeting, updateMeeting, deleteMeeting,
      createRoom,
      sendMessage, subscribeRoom,
      getAllUsers,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

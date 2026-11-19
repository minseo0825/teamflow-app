import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const PALETTE = ['#1e4fd8', '#1a7f4e', '#6b3fc4', '#d97706', '#d93025', '#0891b2', '#be185d', '#0f766e'];
const DEFAULT_COLOR = '#6b3fc4';
const getColor = () => DEFAULT_COLOR; // 모든 멤버 동일 색상
const getMyColor = () => { try { return localStorage.getItem('tf_my_color') || 'var(--accent)'; } catch { return 'var(--accent)'; } };

export default function Chat() {
  const { user, rooms = [], sendMessage, subscribeRoom, toast, createRoom, sendInvite, updateProfileColor } = useApp();
  const [activeRoom, setActiveRoom] = useState('');
  const [messages, setMessages] = useState([]);
  const [roomMembers, setRoomMembers] = useState([]);
  const [input, setInput] = useState('');
  const [channelModal, setChannelModal] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [nicknameModal, setNicknameModal] = useState(false);
  const [colorModal, setColorModal] = useState(false);
  const [profileModal, setProfileModal] = useState(null);
  const [newChannel, setNewChannel] = useState({ name: '', desc: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [nickname, setNickname] = useState(user?.name || '');
  const myColor = user?.profileColor || 'var(--accent)';
  const bottomRef = useRef(null);

  // rooms 로드되면 첫 채널 자동 선택
  useEffect(() => {
    if (rooms.length > 0 && !activeRoom) setActiveRoom(rooms[0].id);
  }, [rooms, activeRoom]);

  // 메시지 구독
  useEffect(() => {
    if (!activeRoom) return;
    const unsub = subscribeRoom(activeRoom, (msgs) => setMessages(msgs));
    return unsub;
  }, [activeRoom, subscribeRoom]);

  // 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 채널 멤버 구독
  const [usersInfo, setUsersInfo] = useState({});

  useEffect(() => {
    if (!activeRoom) return;
    const q = query(collection(db, 'roomMembers'), where('roomId', '==', activeRoom));
    const unsub = onSnapshot(q, snap => {
      const members = snap.docs.map(d => d.data());
      setRoomMembers(members);
      // 각 멤버의 users 컬렉션 정보 (색상 등) 실시간 구독
      members.forEach(m => {
        if (!m.uid) return;
        onSnapshot(doc(db, 'users', m.uid), userSnap => {
          if (userSnap.exists()) {
            setUsersInfo(prev => ({ ...prev, [m.uid]: userSnap.data() }));
          }
        });
      });
    });
    return unsub;
  }, [activeRoom]);

  // uid로 색상 가져오기
  const getUserColor = (uid) => {
    if (uid === user?.uid) return myColor;
    return usersInfo[uid]?.profileColor || DEFAULT_COLOR;
  };

  // uid로 별명 가져오기 (roomMembers 우선, 없으면 users)
  const getDisplayName = (uid, fallbackName) => {
    const member = roomMembers.find(m => m.uid === uid);
    return member?.name || usersInfo[uid]?.name || fallbackName;
  };

  // 현재 채널 정보
  const currentRoom = rooms.find(r => r.id === activeRoom);
  const isOwner = currentRoom?.createdBy === user?.uid;

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(activeRoom, input);
    setInput('');
  };

  const createChannel = async () => {
    if (!newChannel.name.trim()) { toast('채널 이름을 입력하세요', 'e'); return; }
    const id = newChannel.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'ch-' + Date.now();
    // 채널 생성 + 방장 등록
    await setDoc(doc(db, 'rooms', id), { id, name: newChannel.name, desc: newChannel.desc || '', createdBy: user.uid, createdByName: user.name, createdAt: serverTimestamp() });
    await setDoc(doc(db, 'roomMembers', `${id}_${user.uid}`), { roomId: id, uid: user.uid, name: user.name, email: user.email, role: user.role || '멤버', isOwner: true, joinedAt: serverTimestamp() });
    setActiveRoom(id);
    setChannelModal(false);
    setNewChannel({ name: '', desc: '' });
    toast(`#${newChannel.name} 채널이 생성되었습니다`, 's');
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast('이메일을 입력하세요', 'e'); return; }
    await sendInvite(inviteEmail.trim(), activeRoom, currentRoom?.name || activeRoom);
    setInviteEmail('');
    setInviteModal(false);
  };

  const saveNickname = async () => {
    if (!nickname.trim()) { toast('별명을 입력하세요', 'e'); return; }
    try {
      // 없으면 새로 만들고, 있으면 업데이트 (merge: true로 upsert)
      await setDoc(doc(db, 'roomMembers', `${activeRoom}_${user.uid}`), {
        roomId: activeRoom,
        uid: user.uid,
        name: nickname,
        email: user.email,
        role: user.role || '멤버',
        joinedAt: serverTimestamp(),
      }, { merge: true });
      toast('별명이 변경되었습니다', 's');
      setNicknameModal(false);
    } catch (e) {
      toast('별명 변경에 실패했습니다', 'e');
    }
  };

  // 1:1 채팅 시작
  const saveColor = async (color) => {
    await updateProfileColor(color);
    setColorModal(false);
    toast('프로필 색상이 변경되었습니다', 's');
  };

  const startDM = async (member) => {
    const dmId = ['dm', user.uid, member.uid].sort().join('_');
    // DM 채널 생성
    await setDoc(doc(db, 'rooms', dmId), { id: dmId, name: member.name, desc: `${user.name}과 ${member.name}의 대화`, isDM: true, createdBy: user.uid, createdAt: serverTimestamp() }, { merge: true });
    // 양쪽 멤버 등록
    await setDoc(doc(db, 'roomMembers', `${dmId}_${user.uid}`), { roomId: dmId, uid: user.uid, name: user.name, email: user.email, role: user.role, joinedAt: serverTimestamp() }, { merge: true });
    await setDoc(doc(db, 'roomMembers', `${dmId}_${member.uid}`), { roomId: dmId, uid: member.uid, name: member.name, email: member.email, role: member.role, joinedAt: serverTimestamp() }, { merge: true });
    setActiveRoom(dmId);
    setProfileModal(null);
    toast(`${member.name}님과 1:1 채팅을 시작합니다`, 's');
  };

  const myMemberInfo = roomMembers.find(m => m.uid === user?.uid);
  const displayName = myMemberInfo?.name || user?.name;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: 'var(--surface)', borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', width: '100%' }}>

      {/* 채널 사이드바 */}
      <div style={{ width: 200, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--navy)', flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '14px 14px 6px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', letterSpacing: '.06em' }}>채널</div>
        {rooms.filter(r => !r.isDM).length === 0 && (
          <div style={{ padding: '10px 14px', fontSize: 12, color: 'rgba(255,255,255,.3)', lineHeight: 1.7 }}>
            채널이 없어요!<br />+ 채널 버튼으로<br />만들어보세요
          </div>
        )}
        {rooms.filter(r => !r.isDM).map(r => (
          <div key={r.id} onClick={() => setActiveRoom(r.id)} style={{
            padding: '7px 14px', cursor: 'pointer', borderRadius: 6, margin: '1px 6px',
            background: activeRoom === r.id ? 'rgba(255,255,255,.12)' : 'transparent',
            color: activeRoom === r.id ? '#fff' : 'rgba(255,255,255,.5)',
            fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s',
          }}>
            <span style={{ opacity: .6 }}>#</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
          </div>
        ))}
        {rooms.filter(r => r.isDM).length > 0 && (
          <>
            <div style={{ padding: '14px 14px 6px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', letterSpacing: '.06em', marginTop: 8 }}>다이렉트 메시지</div>
            {rooms.filter(r => r.isDM).map(r => (
              <div key={r.id} onClick={() => setActiveRoom(r.id)} style={{
                padding: '7px 14px', cursor: 'pointer', borderRadius: 6, margin: '1px 6px',
                background: activeRoom === r.id ? 'rgba(255,255,255,.12)' : 'transparent',
                color: activeRoom === r.id ? '#fff' : 'rgba(255,255,255,.5)',
                fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s',
              }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: DEFAULT_COLOR, display: 'grid', placeItems: 'center', fontSize: 9, color: '#fff', fontWeight: 700, flexShrink: 0 }}>{r.name?.[0]}</div>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 메인 채팅 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 헤더 */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{currentRoom?.isDM ? '💬' : '#'} {currentRoom?.name}</span>
          {currentRoom?.createdByName && !currentRoom?.isDM && (
            <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg)', padding: '2px 7px', borderRadius: 10, border: '1px solid var(--border)' }}>
              👑 {currentRoom.createdByName}
            </span>
          )}
          {!currentRoom?.isDM && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => { setNickname(displayName); setNicknameModal(true); }}>✏️ 별명</button>
              <button className="btn btn-outline btn-sm" onClick={() => setColorModal(true)}>🎨 색상</button>
              <button className="btn btn-outline btn-sm" onClick={() => setChannelModal(true)}>+ 채널</button>
              <button className="btn btn-primary btn-sm" onClick={() => setInviteModal(true)}>👤 초대</button>
            </div>
          )}
        </div>

        {/* 메시지 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, gap: 8 }}>
              <div style={{ fontSize: 32 }}>💬</div>
              <div>아직 메시지가 없습니다</div>
              {!currentRoom?.isDM && <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }} onClick={() => setInviteModal(true)}>팀원 초대하기</button>}
            </div>
          ) : messages.map((msg, i) => {
            const isMe = msg.uid === user?.uid;
            const showHeader = i === 0 || messages[i - 1].author !== msg.author;
            // roomMembers에서 별명 가져오기
            const displayAuthor = getDisplayName(msg.uid, msg.author);
            const msgColor = getUserColor(msg.uid);
            return (
              <div key={msg.id} style={{ marginTop: showHeader && i > 0 ? 12 : 2, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {showHeader && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: msgColor, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                      {displayAuthor?.[0]}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{isMe ? `나 (${displayAuthor})` : displayAuthor}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{msg.time}</span>
                  </div>
                )}
                <div style={{
                  maxWidth: '65%', padding: '8px 12px',
                  borderRadius: isMe ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  background: isMe ? 'var(--accent)' : 'var(--bg)',
                  color: isMe ? '#fff' : 'var(--text)',
                  fontSize: 13.5, lineHeight: 1.6,
                  border: isMe ? 'none' : '1px solid var(--border)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.txt}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* 입력창 */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
            <textarea rows={1} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`${currentRoom?.isDM ? displayName + '에게 메시지' : '# ' + currentRoom?.name + '에 메시지 보내기'}`}
              style={{ flex: 1, border: 'none', background: 'transparent', resize: 'none', outline: 'none', fontSize: 13.5, lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', color: 'var(--text)' }}
            />
            <button onClick={handleSend} disabled={!input.trim()}
              style={{ width: 32, height: 32, borderRadius: 7, border: 'none', background: input.trim() ? 'var(--accent)' : 'var(--border)', cursor: input.trim() ? 'pointer' : 'default', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 16 16"><path d="M14 2L2 8l5 2 2 5 5-13z"/></svg>
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>Enter로 전송, Shift+Enter로 줄바꿈</div>
        </div>
      </div>

      {/* 멤버 패널 */}
      <div style={{ width: 200, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--white)', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.06em' }}>
          대화 상대 ({roomMembers.length || 1})
        </div>

        {/* 나 */}
        <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
          onClick={() => { setNickname(displayName); setNicknameModal(true); }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: myColor, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {displayName?.[0]}
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              나 {displayName}
              {myMemberInfo?.isOwner && <span style={{ fontSize: 10, marginLeft: 4 }}>👑</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{user?.role}</div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 12px' }} />

        {/* 다른 멤버들 */}
        {roomMembers.filter(m => m.uid !== user?.uid).map(member => (
          <div key={member.uid}
            onClick={() => setProfileModal(member)}
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', borderRadius: 8, margin: '1px 6px', transition: 'background .12s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: getUserColor(member.uid), display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {member.name?.[0]}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member.name}
                {member.isOwner && <span style={{ fontSize: 10, marginLeft: 4 }}>👑</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{member.role}</div>
            </div>
          </div>
        ))}

        {roomMembers.filter(m => m.uid !== user?.uid).length === 0 && (
          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>아직 멤버가 없어요</div>
        )}

        <div style={{ marginTop: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-outline btn-sm btn-full" onClick={() => setInviteModal(true)}>+ 대화상대 초대하기</button>
          {currentRoom && !currentRoom.isDM && (
            <button
              className="btn btn-sm btn-full"
              style={{ background: 'var(--red-bg, #fff0f0)', color: 'var(--red)', border: '1px solid var(--red)', fontSize: 12 }}
              onClick={async () => {
                const isOwner = currentRoom.createdBy === user?.uid;
                if (isOwner) {
                  if (!window.confirm(`"#${currentRoom.name}" 채널을 삭제할까요?\n모든 메시지가 사라집니다.`)) return;
                  await deleteDoc(doc(db, 'rooms', currentRoom.id));
                  setActiveRoom(rooms.filter(x => x.id !== currentRoom.id)[0]?.id || '');
                  toast(`#${currentRoom.name} 채널이 삭제되었습니다`, 'i');
                } else {
                  if (!window.confirm(`"#${currentRoom.name}" 채널에서 나갈까요?`)) return;
                  await deleteDoc(doc(db, 'roomMembers', `${currentRoom.id}_${user?.uid}`));
                  setActiveRoom(rooms.filter(x => x.id !== currentRoom.id)[0]?.id || '');
                  toast(`#${currentRoom.name} 채널에서 나갔습니다`, 'i');
                }
              }}
            >
              {currentRoom.createdBy === user?.uid ? '🗑 채널 삭제' : '← 채널 나가기'}
            </button>
          )}
          {currentRoom?.isDM && (
            <button
              className="btn btn-sm btn-full"
              style={{ background: 'var(--red-bg, #fff0f0)', color: 'var(--red)', border: '1px solid var(--red)', fontSize: 12 }}
              onClick={async () => {
                if (!window.confirm(`DM을 나갈까요?`)) return;
                await deleteDoc(doc(db, 'roomMembers', `${currentRoom.id}_${user?.uid}`));
                setActiveRoom(rooms.filter(x => x.id !== currentRoom.id)[0]?.id || '');
                toast('DM에서 나갔습니다', 'i');
              }}
            >← DM 나가기</button>
          )}
        </div>
      </div>

      {/* 색상 변경 모달 */}
      <Modal open={colorModal} onClose={() => setColorModal(false)}>
        <div className="modal-title">내 프로필 색상 변경</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>내 아바타에만 적용됩니다</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {PALETTE.map(c => (
            <div key={c} onClick={() => saveColor(c)} style={{
              width: '100%', aspectRatio: '1', borderRadius: 12,
              background: c, cursor: 'pointer',
              border: myColor === c ? '3px solid var(--text)' : '3px solid transparent',
              transition: 'transform .15s', display: 'grid', placeItems: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              {myColor === c && <span style={{ fontSize: 18, color: '#fff' }}>✓</span>}
            </div>
          ))}
        </div>
        <div className="modal-ft">
          <button className="btn btn-outline" onClick={() => setColorModal(false)}>닫기</button>
        </div>
      </Modal>

      {/* 채널 추가 모달 */}
      <Modal open={channelModal} onClose={() => setChannelModal(false)}>
        <div className="modal-title">새 채널 추가</div>
        <div className="fg">
          <label className="fl">채널 이름</label>
          <input className="fi" value={newChannel.name} onChange={e => setNewChannel(p => ({ ...p, name: e.target.value }))} placeholder="예: backend, design-review" onKeyDown={e => e.key === 'Enter' && createChannel()} />
        </div>
        <div className="fg">
          <label className="fl">설명 (선택)</label>
          <input className="fi" value={newChannel.desc} onChange={e => setNewChannel(p => ({ ...p, desc: e.target.value }))} placeholder="채널 목적을 입력하세요" />
        </div>
        <div className="modal-ft">
          <button className="btn btn-outline" onClick={() => setChannelModal(false)}>취소</button>
          <button className="btn btn-primary" onClick={createChannel}>채널 만들기</button>
        </div>
      </Modal>

      {/* 초대 모달 */}
      <Modal open={inviteModal} onClose={() => setInviteModal(false)}>
        <div className="modal-title">팀원 초대</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, padding: '10px 12px', background: 'var(--accent-light)', borderRadius: 8, lineHeight: 1.6 }}>
          초대받은 사람이 로그인하면 <strong>수락/거절 알림</strong>이 뜹니다.
        </div>
        <div className="fg">
          <label className="fl">초대할 채널</label>
          <select value={activeRoom} onChange={e => setActiveRoom(e.target.value)}>
            {rooms.filter(r => !r.isDM).map(r => <option key={r.id} value={r.id}>#{r.name}</option>)}
          </select>
        </div>
        <div className="fg">
          <label className="fl">상대방 이메일</label>
          <input className="fi" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="teammate@company.com" onKeyDown={e => e.key === 'Enter' && handleInvite()} />
        </div>
        <div className="modal-ft">
          <button className="btn btn-outline" onClick={() => setInviteModal(false)}>취소</button>
          <button className="btn btn-primary" onClick={handleInvite}>초대 보내기</button>
        </div>
      </Modal>

      {/* 별명 변경 모달 */}
      <Modal open={nicknameModal} onClose={() => setNicknameModal(false)}>
        <div className="modal-title">별명 변경</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>이 채널에서만 사용할 별명을 설정하세요</div>
        <div className="fg">
          <label className="fl">별명</label>
          <input className="fi" value={nickname} onChange={e => setNickname(e.target.value)} placeholder={user?.name} onKeyDown={e => e.key === 'Enter' && saveNickname()} />
        </div>
        <div className="modal-ft">
          <button className="btn btn-outline" onClick={() => setNicknameModal(false)}>취소</button>
          <button className="btn btn-primary" onClick={saveNickname}>저장</button>
        </div>
      </Modal>

      {/* 멤버 프로필 모달 */}
      <Modal open={!!profileModal} onClose={() => setProfileModal(null)}>
        {profileModal && (
          <>
            <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: getUserColor(profileModal.uid), display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 auto 12px' }}>
                {profileModal.name?.[0]}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                {profileModal.name}
                {profileModal.isOwner && <span style={{ fontSize: 14, marginLeft: 6 }}>👑</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>{profileModal.role || '멤버'}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{profileModal.email}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{profileModal.email}</div>
            </div>
            <div className="modal-ft">
              <button className="btn btn-outline" onClick={() => setProfileModal(null)}>닫기</button>
              <button className="btn btn-primary" onClick={() => startDM(profileModal)}>
                💬 1:1 채팅하기
              </button>
            </div>
          </>
        )}
      </Modal>

    </div>
  );
}

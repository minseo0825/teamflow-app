import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Issues, { NewIssueModal } from './pages/Issues';
import Meetings from './pages/Meetings';
import Chat from './pages/Chat';
import { Projects, ProjectDetail, CodeReview, Github, Stats } from './pages/OtherPages';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast';
import Modal from './components/Modal';
import ProjectVisibilityField, { buildVisibilityFields, projectInvitees } from './components/ProjectVisibilityField';
import { InviteMembersField } from './components/MemberPicker';
import InviteNotification from './components/InviteNotification';

// 다른 사용자 프로필 보기 모달
function UserProfileModal({ userId, onClose }) {
  const { user: currentUser, getAllUsers } = useApp();
  const [userInfo, setUserInfo] = useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      const users = await getAllUsers();
      const found = users.find(u => u.uid === userId);
      setUserInfo(found);
    };
    loadUser();
  }, [userId, getAllUsers]);

  if (!userInfo) return <div>로딩 중...</div>;

  return (
    <>
      <div className="modal-title">프로필</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div className="av av-lg" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{userInfo.name?.[0]}</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.3px' }}>{userInfo.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{userInfo.role || '멤버'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{userInfo.email}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{userInfo.team || ''}</div>
        </div>
      </div>
      <div className="modal-ft">
        <button className="btn btn-primary" onClick={onClose}>닫기</button>
      </div>
    </>
  );
}

function NewProjectModal({ onClose }) {
  const { user, projects, createProject, toast } = useApp();
  const [f, setF] = useState({ name: '', desc: '' });
  const [visibility, setVisibility] = useState('private');
  const [members, setMembers] = useState([]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const colors = ['#1e4fd8', '#1a7f4e', '#6b3fc4', '#d97706', '#d93025', '#0891b2'];

  const submit = async () => {
    if (!f.name.trim()) { toast('프로젝트 이름을 입력하세요', 'e'); return; }

    const newProject = {
      name: f.name,
      desc: f.desc || '새 프로젝트',
      color: colors[projects.length % colors.length],
      progress: 0,
      ...buildVisibilityFields(user, visibility, members),
    };

    await createProject(newProject, projectInvitees(visibility, members));
    onClose();
  };

  return (
    <>
      <div className="modal-title">새 프로젝트</div>
      <div className="fg"><label className="fl">프로젝트 이름</label><input className="fi" value={f.name} onChange={e => set('name', e.target.value)} placeholder="예: 서비스 리뉴얼" onKeyDown={e => e.key === 'Enter' && submit()} /></div>
      <div className="fg"><label className="fl">설명</label><textarea rows={2} value={f.desc} onChange={e => set('desc', e.target.value)} placeholder="프로젝트 목적을 간략히 입력하세요" style={{ resize: 'none' }} /></div>
      <ProjectVisibilityField visibility={visibility} onVisibilityChange={setVisibility} members={members} onMembersChange={setMembers} />
      <div className="modal-ft">
        <button className="btn btn-outline" onClick={onClose}>취소</button>
        <button className="btn btn-primary" onClick={submit}>생성</button>
      </div>
    </>
  );
}

function NewMeetingModal({ onClose }) {
  const { user, projects, createMeeting, toast } = useApp();
  const [f, setF] = useState({
    pid: projects[0]?.id || '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    attendees: user?.name || '',
    content: '',
  });
  const [invitees, setInvitees] = useState([]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.title.trim()) { toast('회의 제목을 입력하세요', 'e'); return; }
    if (!f.content.trim()) { toast('회의 내용을 입력하세요', 'e'); return; }
    await createMeeting({
      ...f,
      attendees: f.attendees.split(',').map(a => a.trim()).filter(Boolean),
    }, invitees);
    onClose();
  };

  return (
    <>
      <div className="modal-title">새 회의록</div>
      <div className="fg"><label className="fl">프로젝트</label>
        <select value={f.pid} onChange={e => set('pid', e.target.value)}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="fg"><label className="fl">회의 제목</label><input className="fi" value={f.title} onChange={e => set('title', e.target.value)} placeholder="회의 제목을 입력하세요" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="fg"><label className="fl">날짜</label><input className="fi" type="date" value={f.date} onChange={e => set('date', e.target.value)} /></div>
        <div className="fg"><label className="fl">참석자 (쉼표 구분)</label><input className="fi" value={f.attendees} onChange={e => set('attendees', e.target.value)} placeholder="김지수, 이민호" /></div>
      </div>
      <div className="fg"><label className="fl">회의 내용</label><textarea rows={4} value={f.content} onChange={e => set('content', e.target.value)} placeholder="회의에서 논의된 내용을 입력하세요" /></div>
      <InviteMembersField selected={invitees} onChange={setInvitees} />
      <div className="modal-ft">
        <button className="btn btn-outline" onClick={onClose}>취소</button>
        <button className="btn btn-primary" onClick={submit}>저장</button>
      </div>
    </>
  );
}

function ProfileModal({ onClose }) {
  const { user, toast, getAllUsers, updateProfile } = useApp();
  const [inviteEmail, setInviteEmail] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
  });

  const loadUsers = async () => {
    const users = await getAllUsers();
    setAllUsers(users.filter(u => u.uid !== user.uid)); // 자신 제외
    setShowUserList(true);
  };

  const saveProfile = async () => {
    await updateProfile(profileForm);
    setEditMode(false);
  };

  const filteredUsers = allUsers.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.team?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const send = () => {
    if (!inviteEmail) { toast('이메일을 입력하세요', 'e'); return; }
    toast(`${inviteEmail}에게 초대 메일을 발송했습니다`, 's');
    onClose();
  };

  return (
    <>
      <div className="modal-title">내 프로필</div>
      {editMode ? (
        <>
          <div className="fg">
            <label className="fl">이름</label>
            <input className="fi" value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setEditMode(false)}>취소</button>
            <button className="btn btn-primary btn-sm" onClick={saveProfile}>저장</button>
          </div>
          <hr />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div className="av av-lg" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{user?.name?.[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.3px' }}>{user?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{user?.role || '멤버'}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{user?.email}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{user?.team || ''}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setEditMode(true)}>편집</button>
          </div>
          <hr />
        </>
      )}
      <div style={{ marginTop: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={loadUsers}>
            👥 등록된 직원 목록에서 선택
          </button>
        </div>
        {showUserList && (
          <div style={{ marginBottom: 14 }}>
            <input
              className="fi"
              placeholder="이름, 이메일, 팀 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 8 }}>
              {filteredUsers.length === 0 ? (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>검색 결과 없음</div>
              ) : filteredUsers.map(u => (
                <div key={u.uid} style={{ padding: '8px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, ':hover': { background: 'var(--bg)' } }} onClick={() => { setInviteEmail(u.email); setShowUserList(false); }}>
                  <div className="av av-sm">{u.name?.[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email} · {u.team}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="fg">
          <label className="fl">팀원 초대 이메일</label>
          <input className="fi" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
        </div>
      </div>
      <div className="modal-ft">
        <button className="btn btn-outline" onClick={onClose}>닫기</button>
        <button className="btn btn-primary" onClick={send}>초대 메일 발송</button>
      </div>
    </>
  );
}

export default function App() {
  const { user, authLoading } = useApp();
  const [page, setPage] = useState('dashboard');
  const [projectId, setProjectId] = useState(null);
  const [issueFilter, setIssueFilter] = useState({ status: 'all', priority: 'all', project: 'all', search: '' });
  const [profileOpen, setProfileOpen] = useState(false);
  const [userProfileId, setUserProfileId] = useState(null);
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [chatChannelSignal, setChatChannelSignal] = useState(0); // 상단 '+ 채널 추가' 버튼 → 팀 채팅 채널 생성창

  const handleSearch = (val) => {
    setIssueFilter(f => ({ ...f, search: val }));
    if (val) setPage('issues');
  };

  // 로딩 중
  if (authLoading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontSize: 14, color: 'var(--text3)' }}>로딩 중...</div>
    </div>
  );

  if (!user) return <><Auth /><Toast /></>;

  const isChat = page === 'chat';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar page={page} setPage={setPage} onProfile={() => setProfileOpen(true)} />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar page={page} onAction={() => {
          if (page === 'issues' || page === 'dashboard') setNewIssueOpen(true);
          else if (page === 'projects') setNewProjectOpen(true);
          else if (page === 'meetings') setNewMeetingOpen(true);
          else if (page === 'chat') setChatChannelSignal(n => n + 1);
        }} onSearch={handleSearch} setPage={setPage} />

        {isChat ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            <Chat openChannelSignal={chatChannelSignal} />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {page === 'dashboard'   && <Dashboard setPage={setPage} setIssueFilter={setIssueFilter} />}
            {page === 'projects'    && <Projects onProjectClick={(id) => { setProjectId(id); setPage('project-detail'); }} />}
            {page === 'project-detail' && <ProjectDetail projectId={projectId} setPage={setPage} setProjectId={setProjectId} onUserClick={setUserProfileId} />}
            {page === 'issues'      && <Issues filter={issueFilter} onUserClick={setUserProfileId} />}
            {page === 'meetings'    && <Meetings />}
            {page === 'codereview'  && <CodeReview />}
            {page === 'github'      && <Github />}
            {page === 'stats'       && <Stats />}
          </div>
        )}
      </div>

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)}>
        <ProfileModal onClose={() => setProfileOpen(false)} />
      </Modal>

      <Modal open={!!userProfileId} onClose={() => setUserProfileId(null)}>
        {userProfileId && <UserProfileModal userId={userProfileId} onClose={() => setUserProfileId(null)} />}
      </Modal>

      <Modal open={newIssueOpen} onClose={() => setNewIssueOpen(false)}>
        <NewIssueModal onClose={() => setNewIssueOpen(false)} />
      </Modal>

      <Modal open={newProjectOpen} onClose={() => setNewProjectOpen(false)}>
        <NewProjectModal onClose={() => setNewProjectOpen(false)} />
      </Modal>

      <Modal open={newMeetingOpen} onClose={() => setNewMeetingOpen(false)}>
        <NewMeetingModal onClose={() => setNewMeetingOpen(false)} />
      </Modal>

      {/* 채팅 / 프로젝트 / 이슈 / 회의록 초대 수락·거절 알림 */}
      <InviteNotification />

      <Toast />
    </div>
  );
}

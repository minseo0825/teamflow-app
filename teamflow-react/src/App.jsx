import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Issues from './pages/Issues';
import { Projects, Meetings, CodeReview, Chat, Github, Stats } from './pages/OtherPages';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast';
import Modal from './components/Modal';

function ProfileModal({ onClose }) {
  const { user, toast } = useApp();
  const [inviteEmail, setInviteEmail] = useState('');
  const send = () => {
    if (!inviteEmail) { toast('이메일을 입력하세요', 'e'); return; }
    toast(`${inviteEmail}에게 초대 메일을 발송했습니다`, 's');
    onClose();
  };
  return (
    <>
      <div className="modal-title">내 프로필</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div className="av av-lg" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{user?.name?.[0]}</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.3px' }}>{user?.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{user?.role || '멤버'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{user?.email}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{user?.team || ''}</div>
        </div>
      </div>
      <hr />
      <div className="fg" style={{ marginTop: 14 }}>
        <label className="fl">팀원 초대 이메일</label>
        <input className="fi" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
      </div>
      <div className="modal-ft">
        <button className="btn btn-outline" onClick={onClose}>닫기</button>
        <button className="btn btn-primary" onClick={send}>초대 메일 발송</button>
      </div>
    </>
  );
}

export default function App() {
  const { user } = useApp();
  const [page, setPage] = useState('dashboard');
  const [issueFilter, setIssueFilter] = useState({ status: 'all', priority: 'all', project: 'all', search: '' });
  const [profileOpen, setProfileOpen] = useState(false);
  const [newModal, setNewModal] = useState(false); // for page-level new action

  const handleSearch = (val) => {
    setIssueFilter(f => ({ ...f, search: val }));
    if (val) setPage('issues');
  };

  const handleAction = () => {
    setNewModal(true);
  };

  if (!user) return <><Auth /><Toast /></>;

  const isChat = page === 'chat';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar page={page} setPage={setPage} onProfile={() => setProfileOpen(true)} />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar page={page} onAction={handleAction} onSearch={handleSearch} />

        {isChat ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            <Chat />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {page === 'dashboard' && <Dashboard setPage={setPage} setIssueFilter={setIssueFilter} />}
            {page === 'projects' && <Projects />}
            {page === 'issues' && <Issues filter={issueFilter} />}
            {page === 'meetings' && <Meetings />}
            {page === 'codereview' && <CodeReview />}
            {page === 'github' && <Github />}
            {page === 'stats' && <Stats />}
          </div>
        )}
      </div>

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)}>
        <ProfileModal onClose={() => setProfileOpen(false)} />
      </Modal>

      <Toast />
    </div>
  );
}

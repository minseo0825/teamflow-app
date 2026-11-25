import React from 'react';
import { useApp } from '../context/AppContext';
import MemberPicker from './MemberPicker';

// 프로젝트 공개 범위
export const VISIBILITY_OPTIONS = [
  { value: 'private', label: '개인', desc: '프로젝트를 생성한 본인만 조회할 수 있습니다' },
  { value: 'team',    label: '팀',   desc: '생성자와 초대된 팀원만 조회할 수 있습니다' },
  { value: 'public',  label: '전체', desc: '같은 조직의 모든 사용자가 조회할 수 있습니다' },
];

// 기존 프로젝트(visibility 필드 없음)는 생성자만 조회 가능하므로 '개인'으로 취급
export const visibilityLabel = (v) => (VISIBILITY_OPTIONS.find(o => o.value === v) || VISIBILITY_OPTIONS[0]).label;

export function VisibilityBadge({ visibility }) {
  return (
    <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg)', padding: '1px 7px', borderRadius: 10, border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
      {visibilityLabel(visibility)}
    </span>
  );
}

// 새 프로젝트 모달 안에 들어가는 공개 범위 + 팀원 선택 필드
// members: [{ uid, name, email, ... }]  (생성자 본인 제외)
export default function ProjectVisibilityField({ visibility, onVisibilityChange, members, onMembersChange }) {
  const { user } = useApp();

  return (
    <>
      <div className="fg">
        <label className="fl">공개 범위</label>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
          {VISIBILITY_OPTIONS.map((o, idx) => (
            <button
              key={o.value}
              type="button"
              className="btn btn-sm"
              style={{
                flex: 1, borderRadius: 0, border: 'none',
                borderLeft: idx > 0 ? '1px solid var(--border)' : 'none',
                background: visibility === o.value ? 'var(--accent-light)' : 'transparent',
                color: visibility === o.value ? 'var(--accent)' : 'var(--text2)',
              }}
              onClick={() => onVisibilityChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>
          {VISIBILITY_OPTIONS.find(o => o.value === visibility)?.desc}
        </div>
      </div>

      {visibility === 'team' && (
        <div className="fg">
          <label className="fl">참여 팀원 ({members.length + 1}명)</label>
          <SelectedChips me={user} members={members} onRemove={m => onMembersChange(members.filter(x => x.uid !== m.uid))} />
          <MemberPicker selected={members} onChange={onMembersChange} />
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>선택한 팀원에게 초대장이 발송되며, 거절하면 팀원에서 제외됩니다</div>
        </div>
      )}
    </>
  );
}

// 선택된 참여자 칩 (본인 + 선택한 사람)
export function SelectedChips({ me, members, onRemove }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
      {[{ uid: me.uid, name: me.name, isMe: true }, ...members].map(p => (
        <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--accent-light)', borderRadius: 'var(--r-sm)', fontSize: 13 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600 }}>{p.name?.[0]}</div>
          <span>{p.name}{p.isMe && ' (나)'}</span>
          {!p.isMe && (
            <button type="button" onClick={() => onRemove(p)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 2, color: 'var(--text3)', fontSize: 14, lineHeight: 1 }}>×</button>
          )}
        </div>
      ))}
    </div>
  );
}

// 공개 범위 선택값 → Firestore에 저장할 필드
export function buildVisibilityFields(user, visibility, members) {
  const others = visibility === 'team' ? members : [];
  return {
    visibility,
    org: user.team || '',
    members: [user.name, ...others.map(m => m.name)],
    memberUids: [user.uid, ...others.map(m => m.uid)],
  };
}

// 초대장을 보낼 대상 (팀 공개일 때만)
export const projectInvitees = (visibility, members) => (visibility === 'team' ? members : []);

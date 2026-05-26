import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const PALETTE = ['#E8521A','#2563EB','#7C3AED','#059669','#DB2777','#D97706','#0EA5E9','#84CC16'];
const PRIORITY_CONFIG = {
  high:   { label: 'Cao',        color: '#DC2626', bg: '#FEE2E2', dot: '🔴' },
  medium: { label: 'Trung bình', color: '#D97706', bg: '#FEF3C7', dot: '🟡' },
  low:    { label: 'Thấp',       color: '#059669', bg: '#D1FAE5', dot: '🟢' },
};
function getInitials(name) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function getMemberColor(members, name) { const idx = members.indexOf(name); return PALETTE[idx >= 0 ? idx % PALETTE.length : 0]; }
function formatDate(d) { if (!d) return null; return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }); }
function isOverdue(task) { return task.status === 'todo' && task.deadline && new Date(task.deadline + 'T00:00:00') < new Date(); }

function ProgressRing({ done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const r = 22, circ = 2 * Math.PI * r, offset = circ - (pct / 100) * circ;
  return (
    <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
      <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="#F0F0F0" strokeWidth="4" />
        <circle cx="30" cy="30" r={r} fill="none" stroke="#E8521A" strokeWidth="4" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#1C1C1E' }}>{pct}%</div>
    </div>
  );
}

export default function TabHouseApp() {
  const [tasks, setTasks]     = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberFilter, setMemberFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);
  const [newMember, setNewMember]       = useState('');
  const [form, setForm] = useState({ title: '', description: '', assignee: '', deadline: '', priority: 'medium' });

  useEffect(() => {
    fetchAll();
    const taskChannel = supabase.channel('tasks-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe();
    const memberChannel = supabase.channel('members-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, fetchMembers)
      .subscribe();
    return () => { supabase.removeChannel(taskChannel); supabase.removeChannel(memberChannel); };
  }, []);

  const fetchTasks = async () => { const { data } = await supabase.from('tasks').select('*').order('id', { ascending: false }); if (data) setTasks(data); };
  const fetchMembers = async () => { const { data } = await supabase.from('members').select('*').order('id'); if (data) { const names = data.map(m => m.name); setMembers(names); setForm(f => ({ ...f, assignee: f.assignee || names[0] || '' })); } };
  const fetchAll = async () => { setLoading(true); await Promise.all([fetchTasks(), fetchMembers()]); setLoading(false); };

  const toggleTask  = async (id, cur) => { const s = cur === 'done' ? 'todo' : 'done'; await supabase.from('tasks').update({ status: s }).eq('id', id); setTasks(p => p.map(t => t.id === id ? { ...t, status: s } : t)); };
  const deleteTask  = async (id) => { await supabase.from('tasks').delete().eq('id', id); setTasks(p => p.filter(t => t.id !== id)); };
  const addTask = async () => {
    if (!form.title.trim()) return;
    const task = { ...form, id: Date.now(), status: 'todo' };
    const { data } = await supabase.from('tasks').insert([task]).select();
    if (data) setTasks(p => [data[0], ...p]);
    setForm({ title: '', description: '', assignee: members[0] || '', deadline: '', priority: 'medium' });
    setShowModal(false);
  };
  const addMember = async () => { const t = newMember.trim(); if (!t || members.includes(t)) return; await supabase.from('members').insert([{ name: t }]); setMembers(p => [...p, t]); setNewMember(''); };
  const removeMember = async (name) => { await supabase.from('members').delete().eq('name', name); setMembers(p => p.filter(x => x !== name)); if (memberFilter === name) setMemberFilter('all'); };

  const filtered = tasks.filter(t => {
    if (memberFilter !== 'all' && t.assignee !== memberFilter) return false;
    if (statusFilter === 'todo' && t.status !== 'todo') return false;
    if (statusFilter === 'done' && t.status !== 'done') return false;
    return true;
  });
  const stats = { total: tasks.length, done: tasks.filter(t => t.status === 'done').length, todo: tasks.filter(t => t.status === 'todo').length, overdue: tasks.filter(isOverdue).length };

  const pill = (active, color) => ({ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? (color || '#E8521A') : '#E8E8E8'}`, background: active ? (color ? color + '18' : '#FFF3EF') : '#fff', color: active ? (color || '#E8521A') : '#777', transition: 'all 0.15s', whiteSpace: 'nowrap' });
  const inp = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #EBEBEB', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 14, color: '#1C1C1E', background: '#FAFAFA' };

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', color:'#ABABAB' }}><div style={{ textAlign:'center' }}><div style={{ fontSize:36, marginBottom:12 }}>🎸</div><div style={{ fontWeight:600 }}>Đang tải...</div></div></div>;

  return (
    <div style={{ minHeight:'100vh', background:'#fff', fontFamily:"'Be Vietnam Pro', -apple-system, sans-serif", color:'#1C1C1E' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap'); *{box-sizing:border-box;margin:0;padding:0} button:hover{opacity:.85}`}</style>

      <header style={{ background:'#fff', borderBottom:'1.5px solid #F2F2F2', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, background:'#E8521A', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:15 }}>TH</div>
          <div><div style={{ fontWeight:800, fontSize:16, letterSpacing:-0.3 }}>TabHouse</div><div style={{ fontSize:11, color:'#ABABAB', fontWeight:500, marginTop:-1 }}>Quản lý công việc</div></div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <ProgressRing done={stats.done} total={stats.total} />
          <button onClick={() => setShowSettings(s => !s)} style={{ background: showSettings ? '#FFF3EF' : '#F5F5F5', border:'none', borderRadius:10, width:38, height:38, cursor:'pointer', fontSize:17, display:'flex', alignItems:'center', justifyContent:'center' }}>⚙️</button>
        </div>
      </header>

      <main style={{ maxWidth:680, margin:'0 auto', padding:'20px 16px 100px' }}>
        {showSettings && (
          <div style={{ background:'#FAFAFA', border:'1.5px solid #F0F0F0', borderRadius:16, padding:'16px 18px', marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>👥 Thành viên</div>
            {members.map((m, i) => (
              <div key={m} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #EBEBEB' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:PALETTE[i%PALETTE.length], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700 }}>{getInitials(m)}</div>
                  <span style={{ fontWeight:600, fontSize:14 }}>{m}</span>
                  <span style={{ fontSize:12, color:'#ABABAB' }}>{tasks.filter(t => t.assignee===m && t.status==='todo').length} việc</span>
                </div>
                {members.length > 1 && <button onClick={() => removeMember(m)} style={{ background:'none', border:'none', color:'#DC2626', cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>}
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="Tên thành viên mới..." style={{ ...inp, margin:0, flex:1 }} onKeyDown={e => e.key==='Enter' && addMember()} />
              <button onClick={addMember} style={{ padding:'11px 18px', background:'#E8521A', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontSize:20, lineHeight:1 }}>+</button>
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:22 }}>
          {[{num:stats.total,label:'Tổng',color:'#1C1C1E'},{num:stats.done,label:'Xong',color:'#059669'},{num:stats.todo,label:'Đang làm',color:'#2563EB'},{num:stats.overdue,label:'Quá hạn',color:'#DC2626'}].map(({num,label,color}) => (
            <div key={label} style={{ background:'#FAFAFA', border:'1.5px solid #F0F0F0', borderRadius:14, padding:'12px 10px', textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:800, color, lineHeight:1 }}>{num}</div>
              <div style={{ fontSize:11, color:'#ABABAB', fontWeight:600, marginTop:4 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          <button style={pill(memberFilter==='all')} onClick={() => setMemberFilter('all')}>Tất cả</button>
          {members.map((m,i) => <button key={m} style={pill(memberFilter===m, PALETTE[i%PALETTE.length])} onClick={() => setMemberFilter(m)}>{m}</button>)}
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:20 }}>
          {[['all','Tất cả'],['todo','Đang làm'],['done','Hoàn thành']].map(([v,label]) => (
            <button key={v} onClick={() => setStatusFilter(v)} style={{ padding:'7px 16px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', background:statusFilter===v ? '#1C1C1E' : '#F3F3F3', color:statusFilter===v ? '#fff' : '#888', transition:'all 0.15s' }}>{label}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'56px 20px', color:'#ABABAB' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
            <div style={{ fontWeight:700, fontSize:15, color:'#888' }}>Không có công việc nào</div>
            <div style={{ fontSize:13, marginTop:5 }}>Nhấn <b>+</b> để thêm công việc mới</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(task => {
              const over = isOverdue(task), done = task.status==='done';
              const mColor = getMemberColor(members, task.assignee);
              const pCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
              const expanded = expandedTask === task.id;
              return (
                <div key={task.id} style={{ background:'#fff', border:`1.5px solid ${over?'#FECACA':done?'#F0F0F0':'#EBEBEB'}`, borderRadius:14, padding:'14px 16px', display:'flex', gap:12, opacity:done?0.6:1, transition:'all 0.2s' }}>
                  <div onClick={() => toggleTask(task.id, task.status)} style={{ width:24, height:24, borderRadius:7, border:done?'none':'2px solid #D0D0D0', background:done?'#E8521A':'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1, cursor:'pointer', transition:'all 0.15s' }}>
                    {done && <span style={{ color:'#fff', fontSize:13, fontWeight:800 }}>✓</span>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14.5, textDecoration:done?'line-through':'none', color:done?'#ABABAB':'#1C1C1E', lineHeight:1.4 }}>{task.title}</div>
                    {task.description && expanded && <div style={{ fontSize:13, color:'#888', marginTop:6, lineHeight:1.6, background:'#FAFAFA', padding:'8px 10px', borderRadius:8 }}>{task.description}</div>}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', background:mColor, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:9, fontWeight:800 }}>{getInitials(task.assignee)}</div>
                        <span style={{ fontSize:12, fontWeight:700, color:mColor }}>{task.assignee}</span>
                      </div>
                      <span style={{ background:pCfg.bg, color:pCfg.color, fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:6 }}>{pCfg.label}</span>
                      {task.deadline && <span style={{ fontSize:12, color:over?'#DC2626':'#ABABAB', fontWeight:600 }}>{over?'⚠️':'📅'} {formatDate(task.deadline)}</span>}
                      {task.description && <button onClick={() => setExpandedTask(expanded ? null : task.id)} style={{ background:'none', border:'none', fontSize:12, color:'#ABABAB', cursor:'pointer', padding:0, fontWeight:600 }}>{expanded?'▲ Ẩn':'▼ Ghi chú'}</button>}
                    </div>
                  </div>
                  <button onClick={() => deleteTask(task.id)} style={{ background:'none', border:'none', color:'#DDD', cursor:'pointer', fontSize:20, alignSelf:'flex-start', padding:0, lineHeight:1, flexShrink:0 }}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <button onClick={() => { setForm({ title:'', description:'', assignee:members[0]||'', deadline:'', priority:'medium' }); setShowModal(true); }} style={{ position:'fixed', bottom:24, right:24, width:54, height:54, borderRadius:'50%', background:'#E8521A', color:'#fff', border:'none', fontSize:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 24px rgba(232,82,26,.45)', zIndex:99, lineHeight:1 }}>+</button>

      {showModal && (
        <div onClick={e => e.target===e.currentTarget && setShowModal(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'22px 22px 0 0', width:'100%', maxWidth:680, padding:'24px 22px 40px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
              <div style={{ fontWeight:800, fontSize:18 }}>✏️ Thêm công việc</div>
              <button onClick={() => setShowModal(false)} style={{ background:'#F3F3F3', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', fontSize:18, color:'#888', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            {[['Tên công việc *','title','text','VD: Quay video review guitar...'],['Ghi chú','description','textarea','Chi tiết thêm...']].map(([lbl,key,type,ph]) => (
              <div key={key}>
                <label style={{ fontSize:11, fontWeight:700, color:'#ABABAB', textTransform:'uppercase', letterSpacing:.6, display:'block', marginBottom:6 }}>{lbl}</label>
                {type==='textarea'
                  ? <textarea style={{ ...inp, minHeight:78, resize:'vertical' }} placeholder={ph} value={form[key]} onChange={e => setForm(p => ({...p,[key]:e.target.value}))} />
                  : <input style={inp} placeholder={ph} value={form[key]} onChange={e => setForm(p => ({...p,[key]:e.target.value}))} />}
              </div>
            ))}
            <label style={{ fontSize:11, fontWeight:700, color:'#ABABAB', textTransform:'uppercase', letterSpacing:.6, display:'block', marginBottom:6 }}>Giao cho</label>
            <select style={{ ...inp, appearance:'none' }} value={form.assignee} onChange={e => setForm(p => ({...p,assignee:e.target.value}))}>
              {members.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <label style={{ fontSize:11, fontWeight:700, color:'#ABABAB', textTransform:'uppercase', letterSpacing:.6, display:'block', marginBottom:6 }}>Deadline</label>
            <input type="date" style={inp} value={form.deadline} onChange={e => setForm(p => ({...p,deadline:e.target.value}))} />
            <label style={{ fontSize:11, fontWeight:700, color:'#ABABAB', textTransform:'uppercase', letterSpacing:.6, display:'block', marginBottom:8 }}>Độ ưu tiên</label>
            <div style={{ display:'flex', gap:8, marginBottom:24 }}>
              {Object.entries(PRIORITY_CONFIG).map(([v,cfg]) => (
                <button key={v} onClick={() => setForm(p => ({...p,priority:v}))} style={{ flex:1, padding:'10px 8px', borderRadius:12, border:`1.5px solid ${form.priority===v?cfg.color:'#EBEBEB'}`, background:form.priority===v?cfg.bg:'#FAFAFA', color:form.priority===v?cfg.color:'#ABABAB', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                  {cfg.dot} {cfg.label}
                </button>
              ))}
            </div>
            <button onClick={addTask} style={{ width:'100%', padding:'15px', borderRadius:14, background:form.title.trim()?'#E8521A':'#F0F0F0', color:form.title.trim()?'#fff':'#ABABAB', fontWeight:700, fontSize:15, border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>Thêm công việc</button>
          </div>
        </div>
      )}
    </div>
  );
    }

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, CalendarDays, Check, Clock3, Instagram, Menu, MessageCircle, ShieldCheck, Sparkles, X, XCircle, LogOut, RefreshCw, Trash2, Upload } from 'lucide-react';
import './styles.css';

const TIMES = ['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'];
const CATEGORIES = ['Todos','Fine line','Blackwork','Realismo','Ornamental','Tradicional'];
const photos = [
  { title:'Ornamental', type:'Ornamental', place:'Antebraço', image:'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&w=1000&q=85' },
  { title:'Blackwork', type:'Blackwork', place:'Braço', image:'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=1000&q=85' },
  { title:'Fine line', type:'Fine line', place:'Costela', image:'https://images.unsplash.com/photo-1565058379802-bbe93b2f703a?auto=format&fit=crop&w=1000&q=85' },
  { title:'Realismo', type:'Realismo', place:'Panturrilha', image:'https://images.unsplash.com/photo-1590246814883-57c9da4b7e8d?auto=format&fit=crop&w=1000&q=85' },
  { title:'Tradicional', type:'Tradicional', place:'Ombro', image:'https://images.unsplash.com/photo-1597854710119-fc6e5d4c9a6b?auto=format&fit=crop&w=1000&q=85' },
  { title:'Blackwork', type:'Blackwork', place:'Peito', image:'https://images.unsplash.com/photo-1580246082731-6f5a7c4a9d2d?auto=format&fit=crop&w=1000&q=85' },
];
const blankForm = { name:'', phone:'', style:'Fine line', date:'', time:'', description:'' };
const api = async (url, options={}) => {
  const response = await fetch(url, { credentials:'same-origin', ...options, headers:{ 'Content-Type':'application/json', ...(options.headers||{}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
};
const localDate = () => { const d = new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const dateLabel = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : '—';

function App() {
  const [page,setPage] = useState(()=>window.location.pathname.replace(/\/$/,'')==='/admin'?'admin':'home');
  const [mobileMenu,setMobileMenu] = useState(false);
  const [filter,setFilter] = useState('Todos');
  const [modal,setModal] = useState(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [form,setForm] = useState(blankForm);
  const [available,setAvailable] = useState(TIMES);
  const [config,setConfig] = useState({whatsappNumber:''});
  const [authenticated,setAuthenticated] = useState(false);
  const [checkingSession,setCheckingSession] = useState(false);
  const [password,setPassword] = useState('');
  const [bookings,setBookings] = useState([]);
  const [loadingBookings,setLoadingBookings] = useState(false);
  const [statusFilter,setStatusFilter] = useState('Todos');
  const [dateFilter,setDateFilter] = useState('');
  const [galleryPhotos,setGalleryPhotos] = useState(photos);
  const [photoForm,setPhotoForm] = useState({title:'',type:'Fine line',place:'',client:''});
  const [photoFile,setPhotoFile] = useState(null);
  const [photoBusy,setPhotoBusy] = useState(false);
  const visiblePhotos = useMemo(() => { const all=[...galleryPhotos].reverse(); return filter === 'Todos' ? all : all.filter(p=>p.type===filter); },[filter,galleryPhotos]);
  const pending = bookings.filter(b=>b.status==='Pendente').length;
  const confirmed = bookings.filter(b=>b.status==='Confirmado').length;

  useEffect(()=>{ api('/api/public-config').then(setConfig).catch(()=>{}); loadPhotos(); },[]);
  useEffect(()=>{ if(form.date) api(`/api/availability?date=${encodeURIComponent(form.date)}`).then(d=>setAvailable(d.times)).catch(()=>setAvailable([])); else setAvailable(TIMES); },[form.date]);
  useEffect(()=>{ if(page==='admin'){ setCheckingSession(true); api('/api/admin/session').then(()=>{setAuthenticated(true);loadBookings();}).catch(()=>setAuthenticated(false)).finally(()=>setCheckingSession(false)); } },[page]);
  const update=(key,value)=>setForm(old=>({...old,[key]:value}));
  const notify=message=>{setNotice(message);window.setTimeout(()=>setNotice(''),5000);};
  async function loadPhotos(){ try{const data=await api('/api/photos');setGalleryPhotos([...photos,...(data.photos||[])]);}catch{} }
  async function loadBookings(){ setLoadingBookings(true); try{ const data=await api('/api/admin/bookings');setBookings(data.bookings); }catch(e){ if(e.message.includes('Sessão')) setAuthenticated(false); else setError(e.message); }finally{setLoadingBookings(false);} }
  const nav=target=>{const nextPath=target==='admin'?'/admin':'/';if(window.location.pathname!==nextPath)window.history.pushState({},'',nextPath);setPage(target);setMobileMenu(false);setError('');window.scrollTo({top:0,behavior:'smooth'});};
  useEffect(()=>{const handlePopState=()=>{setPage(window.location.pathname.replace(/\/$/,'')==='/admin'?'admin':'home');setMobileMenu(false);};window.addEventListener('popstate',handlePopState);return()=>window.removeEventListener('popstate',handlePopState);},[]);
  async function submitBooking(e){ e.preventDefault();setError('');try{await api('/api/bookings',{method:'POST',body:JSON.stringify(form)});setModal(false);setForm(blankForm);notify('Solicitação enviada. Aguarde a confirmação do estúdio.');}catch(e){setError(e.message);}}
  async function login(e){e.preventDefault();setError('');try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password})});setAuthenticated(true);setPassword('');await loadBookings();}catch(e){setError(e.message);}}
  async function logout(){try{await api('/api/admin/logout',{method:'POST'});}catch{}setAuthenticated(false);setBookings([]);setPage('home');}
  async function addPhoto(e){
    e.preventDefault(); if(!photoFile){setError('Escolha uma imagem.');return;}
    setPhotoBusy(true);setError('');
    try{const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));reader.readAsDataURL(photoFile);});
      const data=await api('/api/admin/photos',{method:'POST',body:JSON.stringify({...photoForm,dataUrl})});
      setGalleryPhotos(old=>[...old,data.photo]);setPhotoForm({title:'',type:'Fine line',place:'',client:''});setPhotoFile(null);e.target.reset();notify('Foto adicionada à galeria.');
    }catch(err){setError(err.message);}finally{setPhotoBusy(false);}
  }
  async function deletePhoto(id){if(!window.confirm('Excluir esta foto da galeria?'))return;try{await api(`/api/admin/photos/${id}`,{method:'DELETE'});setGalleryPhotos(old=>old.filter(p=>p.id!==id));notify('Foto excluída.');}catch(err){setError(err.message);}}
  async function changeStatus(id,status){setError('');try{const data=await api(`/api/admin/bookings/${id}`,{method:'PATCH',body:JSON.stringify({status})});setBookings(old=>old.map(b=>b.id===id?data.booking:b));notify(`Solicitação ${status.toLowerCase()}.`);}catch(e){setError(e.message);}}
  const filteredBookings=bookings.filter(b=>(statusFilter==='Todos'||b.status===statusFilter)&&(!dateFilter||b.date===dateFilter));
  const waLink=phone=>{const n=(phone||'').replace(/\D/g,'');return n?`https://wa.me/${n}?text=${encodeURIComponent('Olá! Estou entrando em contato sobre sua solicitação de agendamento no INK STUDIO.')}`:'#';};

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={()=>nav('home')}><span className="brand-mark">I<span>.</span></span><span>INK<span className="brand-light">STUDIO</span></span></button>
      <nav className={mobileMenu?'nav-links open':'nav-links'}><button onClick={()=>nav('home')}>Início</button><button onClick={()=>nav('portfolio')}>Portfólio</button><button onClick={()=>{nav('home');setTimeout(()=>document.getElementById('sobre')?.scrollIntoView({behavior:'smooth'}),80);}}>O estúdio</button><button className="nav-cta" onClick={()=>{setError('');setModal(true);}}>Agendar sessão <ArrowUpRight size={16}/></button></nav>
      <button className="mobile-toggle" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Abrir menu">{mobileMenu?<X/>:<Menu/>}</button>
    </header>

    {page==='home'&&<main>
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> ESTÚDIO DE TATUAGEM</div><h1>Arte que fica.<br/><em>Histórias na pele.</em></h1><p>Projetos autorais, traços precisos e atenção a cada detalhe. Sua próxima ideia começa aqui.</p><div className="hero-actions"><button className="button-primary" onClick={()=>setModal(true)}>Solicitar agendamento <ArrowUpRight size={17}/></button><button className="button-quiet" onClick={()=>nav('portfolio')}>Explorar portfólio <span>↓</span></button></div><div className="hero-meta"><div><strong>100%</strong><span>Autoral</span></div><i/><div><strong>1:1</strong><span>Atendimento</span></div><i/><div><strong>01</strong><span>Artista</span></div></div></div><div className="hero-art"><div className="hero-image"/><div className="hero-image-label"><span>FLASH / 001</span><span>INK STUDY — 2026</span></div><div className="hero-stamp"><Sparkles size={19}/><span>FEITO<br/>À MÃO</span></div><div className="vertical-note">CUSTOM TATTOO EXPERIENCE</div></div></section>
      <section className="ticker"><div>BLACKWORK <b>✳</b> FINE LINE <b>✳</b> REALISMO <b>✳</b> ORNAMENTAL <b>✳</b> TRADICIONAL <b>✳</b> BLACKWORK <b>✳</b> FINE LINE <b>✳</b></div></section>
      <section className="portfolio-section section-wrap"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> SELEÇÃO DE TRABALHOS</div><h2>Feito para <em>marcar.</em></h2></div><button className="text-link" onClick={()=>nav('portfolio')}>Ver galeria completa <ArrowUpRight size={17}/></button></div><div className="photo-grid">{galleryPhotos.slice(-3).reverse().map((p,i)=><PhotoCard key={p.title+i} photo={p} index={i}/>)}</div></section>
      <section className="about-section" id="sobre"><div className="about-visual"><div className="about-image"/><div className="about-caption">PROCESSO · PRECISÃO · IDENTIDADE</div></div><div className="about-copy"><div className="eyebrow"><span className="eyebrow-line"/> SOBRE O ESPAÇO</div><h2>Não é só tinta.<br/><em>É expressão.</em></h2><p>Um espaço pensado para transformar referências e ideias em projetos que fazem sentido para quem vai carregar cada traço.</p><div className="about-points"><div><ShieldCheck/><span><b>Atendimento individual</b><small>Um projeto de cada vez, com atenção total.</small></span></div><div><Sparkles/><span><b>Projeto personalizado</b><small>Desenhos pensados para cada pessoa.</small></span></div></div><button className="button-outline" onClick={()=>setModal(true)}>Vamos criar seu projeto <ArrowUpRight size={16}/></button></div></section>
      <section className="booking-banner"><div><div className="eyebrow"><span className="eyebrow-line"/> SUA IDEIA COMEÇA AQUI</div><h2>Pronto para dar<br/><em>forma à ideia?</em></h2></div><button className="button-primary" onClick={()=>setModal(true)}>Solicitar um horário <ArrowUpRight size={17}/></button><span className="banner-orbit">INK<br/>01</span></section>
    </main>}

    {page==='portfolio'&&<main className="page-content"><div className="eyebrow"><span className="eyebrow-line"/> GALERIA</div><div className="section-heading"><h1 className="page-title">Trabalhos & <em>referências.</em></h1><span className="demo-tag">IMAGENS DE REFERÊNCIA</span></div><div className="filters">{CATEGORIES.map(c=><button key={c} className={filter===c?'filter active':'filter'} onClick={()=>setFilter(c)}>{c}</button>)}</div><div className="photo-grid gallery-grid">{visiblePhotos.map((p,i)=><PhotoCard key={p.title+i} photo={p} index={i}/>)}</div><p className="image-disclaimer">As fotografias são referências externas para demonstração do site. Substitua por imagens próprias ou autorizadas antes da publicação comercial.</p></main>}

    {page==='admin'&&<main className="admin-page">
      {checkingSession?<div className="loading-state">Verificando acesso...</div>:!authenticated?<section className="login-card"><div className="eyebrow"><span className="eyebrow-line"/> ACESSO RESTRITO</div><h1>Área do artista<span>.</span></h1><p>Entre com a senha administrativa configurada neste computador.</p><form onSubmit={login}><label>Senha<input type="password" autoComplete="current-password" required minLength="1" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha"/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button-primary" type="submit">Entrar <ArrowUpRight size={17}/></button></form><small>A sessão expira automaticamente após 8 horas.</small></section>:<>
        <div className="admin-head"><div><div className="eyebrow"><span className="eyebrow-line"/> PAINEL INTERNO</div><h1>Visão geral<span>.</span></h1><p>Gerencie solicitações e acompanhe sua agenda.</p></div><div className="admin-head-actions"><button className="button-outline" onClick={loadBookings}><RefreshCw size={15}/> Atualizar</button><button className="button-outline" onClick={logout}><LogOut size={15}/> Sair</button></div></div>
        <div className="stats-grid"><Stat label="Solicitações pendentes" value={pending} icon={<Clock3/>}/><Stat label="Agendamentos confirmados" value={confirmed} icon={<CalendarDays/>}/><Stat label="Total de solicitações" value={bookings.length} icon={<Sparkles/>}/></div>
        <section className="requests-panel photo-manager"><div className="panel-title"><div><h2>Gerenciar portfólio</h2><p>Adicione fotos de tatuagens e trabalhos de clientes à galeria pública.</p></div><span className="count-pill">{galleryPhotos.length} fotos</span></div>
          <form className="photo-upload-form" onSubmit={addPhoto}><div className="photo-form-grid"><label>Título da foto<input required maxLength="80" value={photoForm.title} onChange={e=>setPhotoForm(v=>({...v,title:e.target.value}))} placeholder="Ex.: Dragão oriental"/></label><label>Estilo<select value={photoForm.type} onChange={e=>setPhotoForm(v=>({...v,type:e.target.value}))}>{CATEGORIES.slice(1).map(c=><option key={c}>{c}</option>)}</select></label><label>Região do corpo<input maxLength="80" value={photoForm.place} onChange={e=>setPhotoForm(v=>({...v,place:e.target.value}))} placeholder="Ex.: Antebraço"/></label><label>Cliente (opcional)<input maxLength="80" value={photoForm.client} onChange={e=>setPhotoForm(v=>({...v,client:e.target.value}))} placeholder="Nome ou identificação"/></label></div><label className="photo-file-label">Foto (JPG, PNG ou WebP — até 6 MB)<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhotoFile(e.target.files?.[0]||null)}/></label><button className="button-primary" type="submit" disabled={photoBusy}>{photoBusy?'Enviando...':<><Upload size={16}/> Adicionar à galeria</>}</button></form>
          <div className="admin-photo-grid">{galleryPhotos.filter(p=>p.id).map(p=><article className="admin-photo-item" key={p.id}><img src={p.image} alt={p.title}/><div><b>{p.title}</b><span>{p.type}{p.place?` · ${p.place}`:''}{p.client?` · ${p.client}`:''}</span><button className="icon-action reject" title="Excluir foto" onClick={()=>deletePhoto(p.id)}><Trash2 size={16}/></button></div></article>)}</div>
        </section>
        <section className="requests-panel"><div className="panel-title"><div><h2>Solicitações</h2><p>Pedidos recebidos pelo site</p></div><span className="count-pill">{bookings.length} registros</span></div>
          <div className="admin-filters"><label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{['Todos','Pendente','Confirmado','Recusado','Cancelado'].map(s=><option key={s}>{s}</option>)}</select></label><label>Data<input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/></label><button className="button-quiet" onClick={()=>{setStatusFilter('Todos');setDateFilter('');}}>Limpar filtros</button></div>
          {error&&<p className="form-error" role="alert">{error}</p>}
          {loadingBookings?<div className="loading-state">Carregando solicitações...</div>:filteredBookings.length===0?<div className="empty-state">Nenhuma solicitação encontrada com esses filtros.</div>:<div className="request-list">{filteredBookings.map(b=><article className="request-card" key={b.id}><div className="request-date"><b>{dateLabel(b.date)}</b><span>{b.time}</span></div><div className="request-info"><h3>{b.name}</h3><span>{b.style} · {b.phone}</span><p>{b.description||'Sem descrição.'}</p><a className="request-whatsapp" href={waLink(b.phone)} target="_blank" rel="noreferrer" onClick={e=>{if(waLink(b.phone)==='#')e.preventDefault();}}>Abrir conversa no WhatsApp</a></div><div className="request-actions"><span className={`status status-${b.status.toLowerCase()}`}>{b.status}</span>{b.status==='Pendente'&&<><button className="icon-action approve" title="Confirmar" onClick={()=>changeStatus(b.id,'Confirmado')}><Check size={17}/></button><button className="icon-action reject" title="Recusar" onClick={()=>changeStatus(b.id,'Recusado')}><XCircle size={17}/></button></>}</div></article>)}</div>}
        </section><div className="admin-footnote"><ShieldCheck size={16}/> Dados salvos no banco local do servidor, compartilhados entre navegadores deste computador/rede.</div>
      </>}
    </main>}

    <footer className="footer"><div className="footer-top"><button className="brand" onClick={()=>nav('home')}><span className="brand-mark">I<span>.</span></span><span>INK<span className="brand-light">STUDIO</span></span></button><p>Arte que fica. Histórias na pele.</p><div className="footer-social"><a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram/></a>{config.whatsappNumber&&<a href={`https://wa.me/${config.whatsappNumber}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle/></a>}</div></div><div className="footer-bottom"><span>© 2026 INK STUDIO</span><span>IMAGENS ILUSTRATIVAS</span></div></footer>

    {modal&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal(false)}><div className="booking-modal"><button className="modal-close" onClick={()=>setModal(false)} aria-label="Fechar"><X/></button><div className="eyebrow"><span className="eyebrow-line"/> PRIMEIRO CONTATO</div><h2>Solicite seu <em>horário.</em></h2><p className="modal-intro">Conte um pouco sobre sua ideia. O pedido ficará pendente até a confirmação do estúdio.</p><form onSubmit={submitBooking}><div className="form-row"><label>Seu nome<input required minLength="2" maxLength="100" value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Nome completo"/></label><label>WhatsApp<input required type="tel" maxLength="30" value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="(00) 00000-0000"/></label></div><div className="form-row"><label>Estilo desejado<select value={form.style} onChange={e=>update('style',e.target.value)}>{CATEGORIES.slice(1).map(c=><option key={c}>{c}</option>)}</select></label><label>Data desejada<input required type="date" min={localDate()} value={form.date} onChange={e=>{update('date',e.target.value);update('time','');}}/></label></div><label>Horário disponível<select required value={form.time} onChange={e=>update('time',e.target.value)} disabled={!form.date||available.length===0}><option value="">{!form.date?'Selecione uma data':available.length?'Selecione':'Sem horários disponíveis'}</option>{available.map(t=><option key={t}>{t}</option>)}</select></label><label>Descreva sua ideia<textarea rows="4" maxLength="1200" value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Local do corpo, tamanho aproximado, referências..."/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button-primary submit-button" type="submit">Enviar solicitação <ArrowUpRight size={17}/></button><small className="form-legal">Ao enviar, você autoriza o estúdio a usar esses dados para responder sobre este pedido de agendamento.</small></form></div></div>}
    {notice&&<div className="toast"><Check size={18}/>{notice}</div>}
  </div>;
}
function PhotoCard({photo,index}){return <article className="photo-card"><div className="photo-frame"><img src={photo.image} alt={`Referência de tatuagem ${photo.type}`} loading="lazy" onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement.classList.add('image-fallback');}}/><span className="photo-number">0{index+1}</span><span className="photo-arrow"><ArrowUpRight size={18}/></span><span className="photo-fallback">Imagem de referência</span></div><div className="photo-caption"><b>{photo.title}</b><span>{photo.place}</span></div></article>;}
function Stat({label,value,icon}){return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div>;}

createRoot(document.getElementById('root')).render(<App/>);

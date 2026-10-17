/* Afarinesh manager screens. Loaded before app.js, which merges MR / MSH / ACTM into its route, sheet and action tables.
   Managers are accounts whose profile has app_role = 'manager'. Row-level security lets them read every unit;
   changes go through set_request_status, set_order_status and set_booking_status. */

let MG=null,MCH=null,mT=0;

const MQ_ST={received:['wait','جدید'],assigned:['wait','ارجاع شد'],in_progress:['live','در حال انجام'],done:['done','انجام شد'],cancelled:['bad','لغو شده']};
const MQ_STEPS=[['received','جدید'],['assigned','ارجاع'],['in_progress','در حال انجام'],['done','انجام شد']];
const mPill=st=>{const x=MQ_ST[st]||['done',st];return `<span class="pill ${x[0]}">${x[1]}</span>`;};
const mUnitLine=u=>`واحد ${faDigits(u)}${MG.who(u)?' · '+esc(MG.who(u)):''}`;
const mIcon=r=>r.kind==='tech'?(REQ_IC[r.type]||'wrench'):r.kind==='rent'?'key':'msg';
const mTitle=r=>(r.kind==='tech'?'خدمات فنی · ':r.kind==='message'?'پیام · ':'')+r.type;
const mOpenStates=['received','assigned','in_progress'];
const mRow=(attr,ic,title,sub,right='')=>`<button class="act press" ${attr}><div class="tile-ic neutral">${I(ic)}</div><div class="stack"><span class="t ellipsis">${title}</span><span class="m ellipsis">${sub}</span></div>${right}</button>`;
const mBal=u=>`<span class="amt num" style="${u.balance<0?'color:var(--bad)':''}">${u.balance<0?'−':''}${mil(u.balance)} <small>م</small></span>`;
const mSeg=(items,cur,act)=>`<div class="seg">${items.map(([k,l])=>`<button class="${cur===k?'on':''}" data-act="${act}:${k}">${l}</button>`).join('')}</div>`;

function MTABS(){const n=MG?MG.requests.filter(r=>r.status==='received').length:0;
  return [['m_home','خلاصه','home'],['m_requests','درخواست‌ها','msg',n],['m_orders','سفارش‌ها','utensils'],['m_bookings','رزروها','cal'],['m_units','واحدها','building']];}

/* ---------- data ---------- */
async function loadManager(){
  const {data:{user}}=await SB.auth.getUser();
  const q=(t,col,n)=>SB.from(t).select('*').order(col,{ascending:false}).limit(n);
  const [rq,od,bk,un,pf,uu]=await Promise.all([q('requests','created_at',300),q('orders','created_at',300),q('bookings','starts_at',400),SB.from('units').select('*'),
    SB.from('profiles').select('id,full_name,first_name,app_role'),SB.from('user_units').select('user_id,unit_code')]);
  for(const r of [rq,od,bk,un,pf,uu])if(r.error)throw r.error;
  const prof=Object.fromEntries(pf.data.map(p=>[p.id,p])),names={};
  uu.data.forEach(x=>{const p=prof[x.user_id];if(p&&p.app_role==='resident'){const a=(names[x.unit_code]=names[x.unit_code]||[]);if(!a.includes(p.full_name))a.push(p.full_name);}});
  const me=prof[user.id]||{};
  MG={uid:user.id,me:{name:me.first_name||'مدیر',full:me.full_name||'دفتر ساختمان',manager:true,admin:me.app_role==='admin'},names,who:u=>(names[u]||[]).join('، '),
    units:un.data.map(u=>({...u,balance:Number(u.balance)})).sort((a,b)=>a.balance-b.balance),requests:rq.data,orders:od.data,bookings:bk.data};
}
async function enterManager(){
  try{await loadCatalogue();await loadManager();}
  catch(e){console.error(e);await SB.auth.signOut();MG=null;S.stack=['login'];render('');toast(dbError(e));return;}
  S.stack=['m_home'];mSubscribe();render('');toast(`خوش آمدید، ${MG.me.name}`);
}
function mSubscribe(){mUnsub();MCH=SB.channel('manager');
  ['requests','orders','bookings'].forEach(t=>MCH.on('postgres_changes',{event:'*',schema:'public',table:t},p=>mOnRt(t,p)));MCH.subscribe();}
function mUnsub(){if(MCH){SB.removeChannel(MCH);MCH=null;}}
function mOnRt(t,p){
  if(p.eventType==='INSERT'){const n=p.new||{};toast(t==='requests'?'درخواست جدید · '+(n.type||''):t==='orders'?'سفارش جدید':'رزرو جدید');}
  clearTimeout(mT);
  mT=setTimeout(async()=>{try{await loadManager();}catch(e){return;}const n=S.stack[S.stack.length-1].split(':')[0];if(!sheetOpen&&n.startsWith('m_'))redraw();else drawNav();},500);
}
async function mAct(btn,label,fn,ok){busy(btn,true,label);const {data,error}=await fn();if(error){busy(btn,false);toast(dbError(error));return;}
  await loadManager();closeSheet(true);redraw();toast(typeof ok==='function'?ok(data):ok);}

/* ---------- screens ---------- */
const MR={},MSH={},ACTM={};

MR.m_home=()=>{
  const open=MG.requests.filter(r=>mOpenStates.includes(r.status)),fresh=open.filter(r=>r.status==='received');
  const prep=MG.orders.filter(o=>o.status==='preparing');
  const soon=MG.bookings.filter(b=>b.status==='confirmed'&&new Date(b.starts_at)>Date.now()-36e5&&new Date(b.starts_at)-Date.now()<864e5);
  const debt=MG.units.filter(u=>u.balance<0),debtSum=debt.reduce((a,u)=>a-u.balance,0);
  const kpi=(go,v,l,sub)=>`<button class="kpi glass press" data-tabgo="${go}" style="text-align:right"><span class="m">${l}</span><span class="v num">${fa(v)}</span><span class="m">${sub||'&nbsp;'}</span></button>`;
  return {html:`
  <header class="top"><div class="stack"><span class="m">${F_DAY.format(new Date())}</span><h1 class="h-l">دفتر ساختمان</h1></div><button class="icon-btn glass press" aria-label="خروج" data-act="logout">${I('logout')}</button></header>
  <div class="kpis">
    ${kpi('m_requests',open.length,'درخواست باز',fresh.length?`${fa(fresh.length)} جدید`:'')}
    ${kpi('m_orders',prep.length,'سفارش در حال آماده‌سازی')}
    ${kpi('m_bookings',soon.length,'رزرو ۲۴ ساعت آینده')}
    ${kpi('m_units',debt.length,'واحد بدهکار',debtSum?`${mil(debtSum)} میلیون تومان`:'')}
  </div>
  ${sec('درخواست‌های جدید',fresh.length?`<button class="link" data-tabgo="m_requests">همه ${I('chevL','xs')}</button>`:'',fresh.length?`<div class="list glass">${fresh.slice(0,5).map(r=>mRow(`data-sheet="mreq:${r.id}"`,mIcon(r),esc(mTitle(r)),`${mUnitLine(r.unit_code)} · ${agoLabel(r.created_at)}`,mPill(r.status))).join('')}</div>`:empty('درخواست جدیدی نیست.'))}
  ${sec('سفارش‌های در حال آماده‌سازی',prep.length?`<button class="link" data-tabgo="m_orders">همه ${I('chevL','xs')}</button>`:'',prep.length?`<div class="list glass">${prep.slice(0,4).map(mOrderRow).join('')}</div>`:empty('سفارشی در جریان نیست.'))}
  ${sec('بدهکارترین واحدها',debt.length?`<button class="link" data-tabgo="m_units">همه ${I('chevL','xs')}</button>`:'',debt.length?`<div class="list glass">${debt.slice(0,5).map(mUnitRow).join('')}</div>`:empty('واحد بدهکاری نیست.'))}`};
};

const mOrderRow=o=>{const n=o.items.reduce((a,x)=>a+x.qty,0);const st=o.status==='delivered'?['done','تحویل شد']:o.status==='cancelled'?['bad','لغو شده']:['live','در حال آماده‌سازی'];
  return mRow(`data-sheet="mord:${o.id}"`,VENUE_IC[o.venue],`${VENUE_T[o.venue]} · ${fa(n)} آیتم`,`${mUnitLine(o.unit_code)} · ${agoLabel(o.created_at)}`,`<span class="pill ${st[0]}">${st[1]}</span>`);};
const mUnitRow=u=>mRow(`data-sheet="munit:${u.code}"`,'building',`واحد ${faDigits(u.code)}`,esc(MG.who(u.code)||'—')+' · '+roleLabel(u),mBal(u));
const mBookRow=b=>{const p=PROVBYID[b.provider_id]||{name:'خدمت',category:'spa'};const st={confirmed:['ok','تایید شده'],done:['done','انجام شد'],cancelled:['bad','لغو شده']}[b.status];
  return mRow(`data-sheet="mbook:${b.id}"`,PROV_IC[p.category]||'cal',esc(p.name),`${mUnitLine(b.unit_code)} · ${F_TIME.format(new Date(b.starts_at))}`,`<span class="pill ${st[0]}">${st[1]}</span>`);};

MR.m_requests=()=>{const f=S.mReqF||'open';
  const test={open:r=>mOpenStates.includes(r.status),new:r=>r.status==='received',closed:r=>['done','cancelled'].includes(r.status)};
  const cnt=k=>MG.requests.filter(test[k]).length,L=MG.requests.filter(test[f]);
  return {html:`<div class="between"><h1 class="h-l">درخواست‌ها</h1></div>
  ${mSeg([['open',`باز · ${fa(cnt('open'))}`],['new',`جدید · ${fa(cnt('new'))}`],['closed','بسته‌شده']],f,'mreqf')}
  ${L.length?`<div class="list glass">${L.slice(0,80).map(r=>mRow(`data-sheet="mreq:${r.id}"`,mIcon(r),esc(mTitle(r)),`${mUnitLine(r.unit_code)} · ${agoLabel(r.created_at)}`,mPill(r.status))).join('')}</div>`:empty('درخواستی در این بخش نیست.')}`};};

MR.m_orders=()=>{const f=S.mOrdF||'prep';const L=MG.orders.filter(o=>f==='prep'?o.status==='preparing':o.status!=='preparing');
  return {html:`<div class="between"><h1 class="h-l">سفارش‌ها</h1></div>
  ${mSeg([['prep','در حال آماده‌سازی'],['done','قبلی']],f,'mordf')}
  ${L.length?`<div class="list glass">${L.slice(0,80).map(mOrderRow).join('')}</div>`:empty('سفارشی در این بخش نیست.')}`};};

MR.m_bookings=()=>{const f=S.mBkF||'soon';const now=Date.now();
  const soon=MG.bookings.filter(b=>b.status==='confirmed'&&new Date(b.starts_at)>now-36e5).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  const past=MG.bookings.filter(b=>!(b.status==='confirmed'&&new Date(b.starts_at)>now-36e5)).sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at)).slice(0,60);
  const L=f==='soon'?soon:past;const days=[...new Set(L.map(b=>dayKey(b.starts_at)))];
  return {html:`<div class="between"><h1 class="h-l">رزروها</h1></div>
  ${mSeg([['soon',`پیش رو · ${fa(soon.length)}`],['past','گذشته']],f,'mbkf')}
  ${L.length?days.map(d=>{const items=L.filter(b=>dayKey(b.starts_at)===d);return `<span class="tx-group">${F_DAY.format(new Date(items[0].starts_at))}</span><div class="list glass">${items.map(mBookRow).join('')}</div>`;}).join(''):empty('رزروی در این بخش نیست.')}`};};

MR.m_units=()=>({html:`<div class="between"><h1 class="h-l">واحدها</h1><span class="m">${fa(MG.units.length)} واحد</span></div>
  <label class="search glass">${I('search','sm')}<input id="mu-q" type="search" placeholder="کد واحد یا نام ساکن" style="border:0;background:none;outline:none;flex:1;font-size:15px;min-width:0" aria-label="جستجوی واحد"></label>
  <div class="list glass" id="mu-list">${MG.units.map(u=>mUnitRow(u).replace('<button ',`<button data-name="${esc(u.code+' '+MG.who(u.code))}" `)).join('')}</div>`,
  after(){const q=document.getElementById('mu-q');q.addEventListener('input',()=>{const v=enDigits(q.value.trim());document.querySelectorAll('#mu-list [data-name]').forEach(el=>{el.hidden=!!v&&!el.dataset.name.includes(v);});});}});

/* ---------- detail sheets ---------- */
MSH.mreq=id=>{const r=MG.requests.find(x=>x.id===id);if(!r)return ['درخواست',empty('پیدا نشد.')];
  if(S.mSelId!==id){S.mSelId=id;S.mSel=r.status;S.mAs=r.assignee||'';}
  const photos=r.photos||[];
  return [esc(mTitle(r)),`
   <div class="row"><div class="tile-ic">${I(mIcon(r))}</div><div class="stack"><span class="t">${mUnitLine(r.unit_code)}</span><span class="m">${whenLabel(r.created_at)} · کد ${faDigits(r.code)}</span></div>${mPill(r.status)}</div>
   <div class="card glass" style="padding:16px"><p style="margin:0;line-height:1.9;white-space:pre-wrap">${esc(r.description)}</p></div>
   ${photos.length?`<div class="thumbs" id="act-photos" data-paths="${photos.join(',')}"></div>`:''}
   <span class="eyebrow">وضعیت</span>
   <div class="seg sm4">${MQ_STEPS.map(([k,l])=>`<button class="${S.mSel===k?'on':''}" data-act="mstat:${k}">${l}</button>`).join('')}</div>
   <div class="field"><label for="m-as">مسئول</label><select class="input" id="m-as"><option value="">بدون مسئول</option>${STAFF.map(s=>`<option value="${esc(s[1])}" ${S.mAs===s[1]?'selected':''}>${esc(s[1])} · ${s[2]}</option>`).join('')}</select></div>
   <button class="btn pri block" data-act="msave:${id}">ذخیره</button>`];};

MSH.mord=id=>{const o=MG.orders.find(x=>x.id===id);if(!o)return ['سفارش',empty('پیدا نشد.')];
  const where=o.delivery==='unit'?'تحویل در واحد':o.delivery==='cafe'?'سرو در کافی‌شاپ':'پارکینگ';
  return [`${VENUE_T[o.venue]}`,`
   <div class="row"><div class="tile-ic">${I(VENUE_IC[o.venue])}</div><div class="stack"><span class="t">${mUnitLine(o.unit_code)}</span><span class="m">${whenLabel(o.created_at)} · کد ${faDigits(o.code)}</span></div></div>
   <div class="card glass" style="padding:4px 16px">${o.items.map(i=>`<div class="kv"><span>${esc(i.name)} × ${fa(i.qty)}</span><span class="num">${fa(i.price*i.qty)}</span></div>`).join('')}<div class="kv"><span>جمع</span><span class="num">${fa(o.total)} تومان</span></div><div class="kv"><span>تحویل</span><span>${where}</span></div></div>
   ${o.status==='preparing'?`<button class="btn pri block" data-act="mdeliver:${id}">تحویل شد</button>`:`<div class="note">${I('check','sm')}<span>${o.status==='delivered'?'این سفارش تحویل شده است.':'این سفارش لغو شده است.'}</span></div>`}`];};

MSH.mbook=id=>{const b=MG.bookings.find(x=>x.id===id);if(!b)return ['رزرو',empty('پیدا نشد.')];const p=PROVBYID[b.provider_id]||{name:'خدمت',place:'',category:'spa'};
  const st={confirmed:['ok','تایید شده'],done:['done','انجام شد'],cancelled:['bad','لغو شده']}[b.status];
  return [esc(p.name),`
   <div class="row"><div class="tile-ic">${I(PROV_IC[p.category]||'cal')}</div><div class="stack"><span class="t">${mUnitLine(b.unit_code)}</span><span class="m">${whenLabel(b.starts_at)}</span></div><span class="pill ${st[0]}">${st[1]}</span></div>
   <div class="card glass" style="padding:4px 16px"><div class="kv"><span>مکان</span><span>${esc(p.place||'—')}</span></div><div class="kv"><span>مبلغ</span><span class="num">${b.price?fa(b.price)+' تومان · '+(b.paid_by==='card'?'کارت':'حساب واحد'):'رایگان'}</span></div><div class="kv"><span>کد رزرو</span><span class="num">${faDigits(b.code)}</span></div>${b.note?`<div class="kv"><span>توضیح ساکن</span><span>${esc(b.note)}</span></div>`:''}</div>
   ${b.status==='confirmed'?`<button class="btn pri block" data-act="mbdone:${id}">انجام شد</button><button class="btn block" style="color:var(--bad)" data-sheet="mbcancel:${id}">لغو و بازگشت وجه</button>`:''}`];};

MSH.mbcancel=id=>{const b=MG.bookings.find(x=>x.id===id);const p=PROVBYID[b.provider_id]||{name:'خدمت'};
  return ['لغو رزرو',`<p class="sub" style="color:var(--ink2)">${esc(p.name)} · ${mUnitLine(b.unit_code)} · ${whenLabel(b.starts_at)}</p>
   <div class="note">${I('info','sm')}<span>${b.price?`مبلغ ${fa(b.price)} تومان کامل ${b.paid_by==='card'?'به کارت':'به حساب واحد'} برمی‌گردد و به ساکن اطلاع داده می‌شود.`:'این رزرو هزینه‌ای نداشت. به ساکن اطلاع داده می‌شود.'}</span></div>
   <button class="btn block" style="background:var(--bad);color:#fff" data-act="mbcancelgo:${id}">بله، لغو شود</button><button class="btn sec block" data-sheet="mbook:${id}">نه، نگه دار</button>`];};

MSH.munit=code=>{const u=MG.units.find(x=>x.code===code);if(!u)return ['واحد',empty('پیدا نشد.')];
  return ['واحد '+faDigits(code),`
   <div style="text-align:center"><span class="m">مانده حساب</span><div class="big-num num" style="${u.balance<0?'color:var(--bad)':''}">${u.balance<0?'−':''}${T(u.balance)}<small>تومان ${u.balance<0?'بدهکار':'بستانکار'}</small></div></div>
   <div class="card glass" style="padding:4px 16px"><div class="kv"><span>ساکنین</span><span>${esc(MG.who(code)||'—')}</span></div><div class="kv"><span>نوع</span><span>${roleLabel(u)}</span></div></div>
   <span class="eyebrow">آخرین تراکنش‌ها</span><div id="unit-tx" data-unit="${code}"><div class="spin"></div></div>`];};
async function showUnitTx(){const box=document.getElementById('unit-tx');if(!box)return;
  const {data,error}=await SB.from('transactions').select('*').eq('unit_code',box.dataset.unit).order('created_at',{ascending:false}).limit(8);
  if(error){box.innerHTML=empty('بارگذاری نشد.');return;}
  box.innerHTML=data.length?`<div class="list glass">${data.map(x=>{const m=mapTx(x);return `<div><span class="tile-ic neutral">${I(m.ic,'sm')}</span><div class="stack"><span class="t ellipsis">${esc(m.t)}</span><span class="m">${m.dt}</span></div><span class="amt num ${m.a>0?'in':''}">${m.a>0?'+':'−'}${T(m.a)}</span></div>`;}).join('')}</div>`:empty('تراکنشی نیست.');}

/* ---------- actions ---------- */
Object.assign(ACTM,{
  mreqf:v=>{S.mReqF=v;redraw();},mordf:v=>{S.mOrdF=v;redraw();},mbkf:v=>{S.mBkF=v;redraw();},
  mstat:k=>{S.mSel=k;refreshSheet();},
  msave:id=>mAct(document.querySelector('[data-act^="msave"]'),'در حال ذخیره…',()=>SB.rpc('set_request_status',{p_id:id,p_status:S.mSel,p_assignee:S.mAs||null}),'ذخیره شد · ساکن مطلع شد'),
  mdeliver:id=>mAct(document.querySelector('[data-act^="mdeliver"]'),'در حال ثبت…',()=>SB.rpc('set_order_status',{p_id:id,p_status:'delivered'}),'سفارش تحویل شد · ساکن مطلع شد'),
  mbdone:id=>mAct(document.querySelector('[data-act^="mbdone"]'),'در حال ثبت…',()=>SB.rpc('set_booking_status',{p_id:id,p_status:'done'}),'رزرو انجام‌شده ثبت شد'),
  mbcancelgo:id=>mAct(document.querySelector('[data-act^="mbcancelgo"]'),'در حال لغو…',()=>SB.rpc('set_booking_status',{p_id:id,p_status:'cancelled'}),d=>d&&d.refunded?`رزرو لغو شد · ${fa(d.refunded)} تومان برگشت`:'رزرو لغو شد'),
});
document.addEventListener('change',e=>{if(e.target&&e.target.id==='m-as')S.mAs=e.target.value;});

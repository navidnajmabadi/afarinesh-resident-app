/* Afarinesh resident app — UI, routing and interactions. Depends on shared.js. */

let ST=null;                       // persisted per-unit data (balance, activities, transactions…)
const S={stack:[],mode:'light',book:null,cart:{},finTab:'unit',actTab:'all',reqType:0,reqTime:0,cafeCat:0,cafeServe:0,
  catFilter:'all',provGender:'all',provSort:'rate',txCat:'all',period:7,bMonth:5,week:2,rptOpt:[true,true,true],
  pay:{mode:'full',method:'gw'},rate:{stars:5,tags:[0,1]},msgType:0,photos:[],photoFiles:[],consent:true,last:null};
const TABS=[['home','آف‌بات','bot'],['services','خدمات','grid'],['activity','فعالیت‌ها','pulse'],['finance','مالی','chart'],['profile','من','user']];
const view=document.getElementById('view'),tabbar=document.getElementById('tabbar'),overlay=document.getElementById('overlay'),app=document.getElementById('app');
function drawNav(){const mgr=!!MG&&!ST,tabs=mgr?MTABS():TABS,me=mgr?MG.me:(ST?ME():null);
  tabbar.innerHTML=`<div class="side-brand">AFARINESH</div><div class="side-sub">${mgr?'پنل مدیریت':'برج '+TOWER}</div>`+tabs.map(([r,l,i,n])=>`<button class="tab" data-tab="${r}" aria-label="${l}${n?'، '+fa(n)+' مورد جدید':''}">${I(i)}<span>${l}</span>${n?`<b class="tbadge num">${fa(n)}</b>`:''}</button>`).join('')+(me?`<div class="side-foot"><div class="who"><span class="avatar">${me.name[0]}</span><div class="stack"><b style="font-weight:600">${me.full}</b><span class="m">${mgr?(MG.me.admin?'مدیر سیستم':'مدیر'):'واحد '+faDigits(ST.unit)}</span></div></div><button class="btn sec sm block" data-act="togglemode">${I(S.mode==='dark'?'sun':'moon','sm')} ${S.mode==='dark'?'حالت روشن':'حالت تیره'}</button>${mgr?`<button class="btn sec sm block" data-act="logout">${I('logout','sm')} خروج</button>`:''}</div>`:'');}

const ME=()=>ST.me;
const isOwner=()=>ST.unitRow.role==='owner';
let saveT=0;const save=()=>{clearTimeout(saveT);saveT=setTimeout(()=>savePrefs(ST),400);};
const SEED_USAGE={cafe:12,spa:9,classes:7,spaces:6,tech:5,hk:4,kitchen:3,carwash:1,rent:0};
const usage=()=>{const u={...SEED_USAGE};ST.acts.forEach(a=>{if(a.catKey)u[a.catKey]=(u[a.catKey]||0)+3;});Object.entries(ST.opens||{}).forEach(([k,n])=>u[k]=(u[k]||0)+n);return u;};
function bump(k,n=1){if(!CATS[k]||!ST)return;ST.opens=ST.opens||{};ST.opens[k]=(ST.opens[k]||0)+n;}
const ranked=()=>{const u=usage();return Object.keys(CATS).sort((a,b)=>(u[b]||0)-(u[a]||0));};
const catRoute=k=>k==='tech'||k==='rent'?'request:'+k:k==='cafe'||k==='kitchen'||k==='carwash'?'cafe:'+k:'provider:'+k;
const catKeyOfProv=id=>Object.keys(PROV).find(k=>PROV[k].some(p=>p.id===id));
const freshBook=()=>({day:0,slot:null,step:1,pay:'acc',remind:true,cal:true,note:''});
const cleanPw=v=>String(v).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,'').trim();
const clearPhotos=()=>{S.photos=[];S.photoFiles=[];};
async function refresh(){const keep={opens:ST.opens,seen:ST.seen,rated:ST.rated,onboarded:ST.onboarded,autoReport:ST.autoReport,email:ST.email};ST=Object.assign(await loadState(ST.unit),keep);}
const busy=(btn,on,label)=>{if(!btn)return;btn.disabled=on;if(on&&label){btn.dataset.l=btn.innerHTML;btn.textContent=label;}else if(!on&&btn.dataset.l){btn.innerHTML=btn.dataset.l;delete btn.dataset.l;}};

/* live updates: when staff change a request, the resident's screen follows */
let CH=null,rtT=0;
function subscribe(){unsubscribe();CH=SB.channel('unit-'+ST.unit);
  ['requests','orders','bookings','notifications'].forEach(t=>CH.on('postgres_changes',{event:'*',schema:'public',table:t,filter:`unit_code=eq.${ST.unit}`},p=>onRt(t,p)));CH.subscribe();}
function unsubscribe(){if(CH){SB.removeChannel(CH);CH=null;}}
function onRt(t,p){if(t==='notifications'&&p.eventType==='INSERT'&&p.new&&p.new.title)toast(p.new.title);clearTimeout(rtT);
  rtT=setTimeout(async()=>{try{await refresh();}catch(e){return;}const n=S.stack[S.stack.length-1].split(':')[0];if(!sheetOpen&&!TOUR&&['home','activity','finance'].includes(n))redraw();},500);}

/* ============ ROUTER ============ */
function render(dir='enter'){
  const [name,param]=S.stack[S.stack.length-1].split(':');
  const out=R[name](param);app.dataset.route=name;drawNav();
  const dash=['services','activity','finance','profile','m_home'].includes(name);
  view.className='view '+(dash?'dash ':name==='login'?'':name==='home'?'chatpage narrow ':'narrow ')+(out.flow?'flow ':'')+(out.cls||'')+' '+dir;
  view.innerHTML=out.html;view.scrollTop=0;
  tabbar.classList.toggle('hide',!!out.noTab);
  tabbar.querySelectorAll('.tab').forEach(b=>{const on=b.dataset.tab===(out.tab||name);b.classList.toggle('on',on);b.setAttribute('aria-current',on?'page':'false')});
  app.querySelectorAll(':scope > .cta-bar,:scope > .cartbar,:scope > .chatbar').forEach(e=>e.remove());
  if(out.bar)view.insertAdjacentHTML('afterend',out.bar);
  out.after&&out.after();
  endTour();if(ST&&name!=='login')setTimeout(()=>maybeTour(name),450);
}
function go(r,{root=false}={}){if(root)S.stack=[r];else S.stack.push(r);closeSheet(true);render('enter');}
function back(){if(S.stack.length>1){S.stack.pop();render('back');}}
function redraw(){const y=view.scrollTop;render('');view.scrollTop=y;}

/* ============ COMPONENTS ============ */
const bar=(title,right='')=>`<div class="bar"><button class="icon-btn glass press" data-act="back" aria-label="بازگشت">${I('back')}</button><h1 class="h-m">${title}</h1>${right}</div>`;
const sec=(title,link,body)=>`<section class="sec"><div class="sec-h"><h2 class="h-m">${title}</h2>${link||''}</div>${body}</section>`;
const pillFor=a=>`<span class="pill ${a.st}">${a.stt}</span>`;
const actRow=a=>`<button class="act press" data-sheet="act:${a.id}">${a.day&&a.st!=='bad'?`<div class="date-blk"><b class="num">${a.day}</b><span>${a.mon}</span></div>`:`<div class="tile-ic ${a.st==='done'||a.st==='bad'?'neutral':''}">${I(a.ic)}</div>`}<div class="stack"><span class="t ellipsis">${esc(a.t)}</span><span class="m ellipsis">${a.when}</span></div>${pillFor(a)}</button>`;
const provCard=p=>`<button class="prov glass press" data-go="booking:${p.id}">
  <div class="row">${p.art?`<div class="thumb">${ART[p.art]()}</div>`:`<div class="avatar">${p.n.trim()[0]}</div>`}
    <div class="stack"><span class="t">${p.n}</span><span class="m"><span class="star">★</span> <span class="num">${fa(p.rate,1)}</span> · <span style="color:var(--ok)">${nextFree(p)}</span></span></div>
    <span class="t num" style="flex:none">${p.price?`${fa(p.price/1000)} <small class="m">هزار</small>`:`<span class="tag gold">رایگان</span>`}</span></div>
</button>`;
const empty=(t,cta='')=>`<div class="empty glass" style="border-radius:22px">${t}${cta?`<div style="margin-top:12px">${cta}</div>`:''}</div>`;
const photoPicker=()=>`<div class="thumbs" id="thumbs">${S.photos.map(src=>`<img src="${src}" alt="عکس پیوست">`).join('')}<label class="upl press">${I('camera')}افزودن عکس<input type="file" accept="image/*" multiple data-photo></label></div>`;

/* ============ ROUTES ============ */
const R={};Object.assign(R,MR,CR);

R.loading=()=>({noTab:true,html:`<div class="spin" role="status" aria-label="در حال بارگذاری" style="margin:40vh auto 0"></div>`});

R.login=()=>({noTab:true,cls:'login',html:`
  <div class="hero">${tower()}<div class="wm"><div class="wm-word">AFARINESH</div><p class="sub" style="margin-top:12px">زندگی در برج ${TOWER}</p></div></div>
  <form class="glass" id="login-form" style="border-radius:28px" novalidate>
    <div class="field"><label for="l-u">کد واحد یا نام کاربری</label><input class="input num" id="l-u" name="unit" type="text" inputmode="text" enterkeyhint="next" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" placeholder="مثلاً ۱۲۰۴ یا ali"></div>
    <div class="field"><label for="l-p">رمز عبور</label><div style="position:relative"><input class="input" id="l-p" name="pass" type="password" autocomplete="current-password" placeholder="رمز عبور"><button type="button" class="icon-btn" style="position:absolute;left:4px;top:4px" aria-label="نمایش رمز" data-act="peek">${I('eye','sm')}</button></div></div>
    <div class="err" id="l-err" role="alert"></div>
    <button type="button" class="chk" role="checkbox" aria-checked="${S.consent}" data-act="consent"><span class="box">${I('check','xs')}</span><span>آیین‌نامه ساختمان را خوانده‌ام و می‌پذیرم. <span class="link" style="display:inline;min-height:0" data-sheet="rules">مطالعه</span></span></button>
    <button type="submit" class="btn pri block">ورود</button>
    <button type="button" class="link" style="align-self:center" data-sheet="forgot">رمز عبور را فراموش کرده‌ام</button>
  </form>`,
  after(){const f=document.getElementById('login-form');f.addEventListener('submit',e=>{e.preventDefault();doLogin();});}});

async function doLogin(){
  const u=enDigits(document.getElementById('l-u').value.trim()).toLowerCase(),p=cleanPw(document.getElementById('l-p').value);
  const err=document.getElementById('l-err');const fu=document.getElementById('l-u'),fp=document.getElementById('l-p'),btn=document.querySelector('#login-form [type=submit]');
  fu.classList.remove('bad');fp.classList.remove('bad');err.innerHTML='';
  if(!u){err.innerHTML=I('info','xs')+'کد واحد را وارد کنید.';fu.classList.add('bad');fu.focus();return;}
  if(!p){err.innerHTML=I('info','xs')+'رمز عبور را وارد کنید.';fp.classList.add('bad');fp.focus();return;}
  if(!S.consent){err.innerHTML=I('info','xs')+'برای ورود، پذیرش آیین‌نامه لازم است.';return;}
  busy(btn,true,'در حال ورود…');
  const {error}=await SB.auth.signInWithPassword({email:emailFor(u),password:p});
  if(error){busy(btn,false,true);console.warn('sign-in failed:',error.status,error.code||'',error.message);
    const bad=error.code==='invalid_credentials'||/invalid login/i.test(error.message);
    if(bad){fu.classList.add('bad');fp.classList.add('bad');}
    err.innerHTML=I('info','xs')+(bad?'کد واحد یا رمز عبور درست نیست. دوباره امتحان کنید یا «فراموشی رمز» را بزنید.':error.code==='email_not_confirmed'?'این حساب هنوز فعال نشده است. با دفتر ساختمان تماس بگیرید.':/api key/i.test(error.message)?'تنظیمات اتصال نادرست است. به پشتیبانی خبر دهید.':dbError(error));return;}
  await enter();
}
async function enter(){
  S.stack=['loading'];render('');
  try{if(['manager','admin'].includes(await myRole())){ST=null;await enterManager();return;}await loadCatalogue();ST=await loadState();}
  catch(e){console.error(e);await SB.auth.signOut();ST=null;S.stack=['login'];render('');toast(e.message==='no_units'?'این حساب به هیچ واحدی وصل نیست.':dbError(e));return;}
  S.stack=['home'];chatReset();subscribe();render('');
  if(!ST.onboarded)showOnboarding();else toast(`خوش آمدید، ${ST.me.name}`);
}

R.services=()=>{const r=ranked();const top=r.slice(0,4),rest=r.slice(4);
  return {html:`
  <div class="stack"><h1 class="h-l">خدمات</h1></div>
  <label class="search glass">${I('search','sm')}<input id="svc-q" type="search" placeholder="جستجوی خدمت" style="border:0;background:none;outline:none;flex:1;font-size:15px;min-width:0" aria-label="جستجوی خدمات"></label>
  <section class="sec full" id="top-svc"><div class="sec-h"><h2 class="h-m">پراستفاده‌های شما</h2><span class="m">بر اساس استفاده</span></div>
    <div class="svc-grid">${top.map(k=>`<button class="svc glass press svc-item" data-name="${CATS[k].t} ${CATS[k].sub}" data-go="${catRoute(k)}"><span class="tile-ic">${I(CATS[k].ic)}</span><span class="t">${CATS[k].t}</span></button>`).join('')}</div></section>
  <section class="sec full" id="more-svc"><h2 class="h-m">سایر خدمات</h2>
    <div class="list glass">${rest.map(k=>`<button class="press svc-item" data-name="${CATS[k].t} ${CATS[k].sub}" data-go="${catRoute(k)}"><span class="tile-ic neutral">${I(CATS[k].ic,'sm')}</span><div class="stack"><span class="t">${CATS[k].t}</span><span class="m">${CATS[k].sub}</span></div>${I('chevL','sm chev')}</button>`).join('')}</div></section>
  <div class="empty full" id="svc-empty" hidden>خدمتی با این نام پیدا نشد.</div>`,
  after(){const q=document.getElementById('svc-q');q.addEventListener('input',()=>{const v=q.value.trim();let n=0;
    view.querySelectorAll('.svc-item').forEach(el=>{const m=!v||el.dataset.name.includes(v);el.hidden=!m;if(m)n++;});
    ['top-svc','more-svc'].forEach(id=>{const sct=document.getElementById(id);sct.hidden=![...sct.querySelectorAll('.svc-item')].some(e=>!e.hidden);});
    document.getElementById('svc-empty').hidden=n>0;});}};
};

R.provider=(k)=>{const c=CATS[k];let list=[...(PROV[k]||[])];
  if(S.provGender!=='all')list=list.filter(p=>p.tags.includes(S.provGender));
  list.sort((a,b)=>S.provSort==='price'?a.price-b.price:b.rate-a.rate);
  const active=S.provGender!=='all'||S.provSort!=='rate';
  return {tab:'services',html:`
  ${bar(c.t,`<button class="icon-btn glass press" aria-label="فیلتر و مرتب‌سازی" data-sheet="pfilter:${k}">${I('filter','sm')}${active?'<span class="dot"></span>':''}</button>`)}
  ${k==='hk'?`<div class="note">${I('info','sm')}<span>نوبت خانه‌داری را حداقل یک روز قبل رزرو کنید.</span></div>`:''}
  <div class="sec">${list.length?list.map(provCard).join(''):empty('موردی با این فیلتر نیست.',`<button class="btn sec sm" data-act="pclear">حذف فیلتر</button>`)}</div>`};};

R.booking=(id)=>{const p=ALLPROV.find(x=>x.id===id);if(!p)return {noTab:true,html:`${bar('رزرو')}${empty('این مورد پیدا نشد.')}`};
  if(!S.book)S.book=freshBook();const b=S.book;const days=slotDays(p.id);
  if(b.day>=days.length)b.day=0;
  const day=days[b.day],slots=day?day.slots:[];const slotObj=b.slot!=null&&slots[b.slot]?slots[b.slot]:null;
  const timeOf=x=>F_TIME.format(new Date(x.starts_at));
  const stepper=`<div class="stepper">${['زمان','جزئیات','پرداخت'].map((s,i)=>`<div class="${b.step==i+1?'on':b.step>i+1?'done':''}">${fa(i+1)} · ${s}</div>`).join('')}</div>`;
  const disc=isOwner()&&p.price?Math.round(p.price*.1):0,final=p.price-disc;
  const when=slotObj?`${day.label}، ${timeOf(slotObj)}`:'';
  let body='',cta='';
  if(b.step===1){
    if(!days.length){body=`<div class="stack" style="gap:6px"><h2 class="h-l" style="font-weight:300">نوبتی <b style="font-weight:600">پیدا نشد</b></h2><p class="sub">${p.r} · ${p.place}</p></div>${empty('در ۷ روز آینده نوبت خالی نیست. بعداً دوباره سر بزنید.')}`;cta=`<button class="btn sec block" data-act="back">بازگشت</button>`;}
    else{
    const free=slots.filter(x=>x.free>0).length;
    body=`<div class="stack" style="gap:6px"><h2 class="h-l" style="font-weight:300">چه زمانی <b style="font-weight:600">مناسب شماست؟</b></h2><p class="sub">${p.r} · ${p.place}</p></div>
    <div class="days">${days.map((d,i)=>{const n=d.slots.filter(x=>x.free>0).length;return `<button class="day press ${i==b.day?'on':''} ${n?'':'full'}" ${n?'':'disabled'} data-act="day:${i}" aria-label="${d.label}${n?'':'، تکمیل'}"><span>${d.wk}</span><b class="num">${d.num}</b><i></i></button>`}).join('')}</div>
    <div class="sec"><div class="between"><span class="eyebrow">${day.label}</span><span class="m">${fa(free)} نوبت آزاد</span></div>
    <div class="slots">${slots.map((x,i)=>{const o=x.free>0;return `<button class="slot press ${b.slot===i?'on':''}" ${o?'':'disabled'} data-act="slot:${i}" aria-label="${timeOf(x)} ${o?'آزاد':'تکمیل'}"><span class="num">${timeOf(x)}</span>${!o?'<small>تکمیل</small>':x.capacity>1?`<small>${fa(x.free)} جا</small>`:''}</button>`}).join('')}</div></div>
    <div class="note">${I('info','sm')}<span>ساعت‌ها طبق برنامه‌ی کاری این مکان است${p.cat==='hk'?' و خانه‌داری باید حداقل ۲۴ ساعت قبل رزرو شود':''}. لغو رایگان تا ۲۴ ساعت قبل.</span></div>`;
    cta=`<button class="btn pri block" data-act="step:2" ${!slotObj?'disabled':''}>${!slotObj?'یک زمان انتخاب کنید':'ادامه · '+when}</button>`;}
  } else if(b.step===2){
    body=`<div class="stack" style="gap:6px"><h2 class="h-l" style="font-weight:300">جزئیات <b style="font-weight:600">نوبت</b></h2><p class="sub">${when}</p></div>
    <div class="field"><label for="b-n">توضیح برای ${p.n} <span class="m">(اختیاری)</span></label><textarea class="input" id="b-n" placeholder="مثلاً حساسیت پوستی یا ترجیح خاص">${esc(b.note)}</textarea></div>
    <div class="list glass"><div class="between"><div class="stack"><span class="t">یادآوری</span><span class="m">۱ ساعت قبل با اعلان</span></div><button class="toggle" role="switch" aria-checked="${b.remind}" data-act="remind" aria-label="یادآوری"></button></div>
    <div class="between"><div class="stack"><span class="t">افزودن به تقویم</span><span class="m">پس از تایید، نوبت به تقویم گوشی یا کامپیوتر اضافه می‌شود</span></div><button class="toggle" role="switch" aria-checked="${b.cal}" data-act="bcal" aria-label="افزودن به تقویم"></button></div></div>`;
    cta=`<button class="btn pri block" data-act="step:3">${final?'ادامه به پرداخت':'ادامه به تایید'}</button>`;
  } else {
    body=`<div class="card glass" style="display:flex;flex-direction:column;gap:12px">
      <div class="row">${p.art?`<div class="thumb" style="width:48px;height:48px;border-radius:14px;overflow:hidden">${ART[p.art]()}</div>`:`<div class="avatar">${p.n[0]}</div>`}<div class="stack"><span class="t">${p.n}</span><span class="m">${p.r}</span></div></div>
      <div class="divider"></div>
      <div class="row m">${I('cal','sm')} ${when}</div><div class="row m">${I('pin','sm')} ${p.place}</div>${b.note?`<div class="row m">${I('msg','sm')} ${esc(b.note)}</div>`:''}</div>
    ${final?`<div class="sec"><span class="eyebrow">پرداخت از</span>
      <button class="radio-card press ${b.pay==='acc'?'on':''}" data-act="bpay:acc"><span class="tile-ic">${I('wallet','sm')}</span><div class="stack"><span class="t">حساب واحد ${faDigits(ST.unit)}</span><span class="m">به صورت‌حساب ماهانه اضافه می‌شود</span></div><span class="rd"></span></button>
      <button class="radio-card press ${b.pay==='card'?'on':''}" data-act="bpay:card"><span class="tile-ic neutral">${I('card','sm')}</span><div class="stack"><span class="t">کارت بانکی</span><span class="m">پرداخت آنی از درگاه</span></div><span class="rd"></span></button></div>
    <div class="card glass"><div class="sum-row"><span>هزینه خدمت</span><span class="num">${fa(p.price)}</span></div>${disc?`<div class="sum-row"><span>تخفیف مالکین ۱۰٪</span><span class="num" style="color:var(--ok)">−${fa(disc)}</span></div>`:''}
      <div class="sum-total"><span class="t">مبلغ نهایی</span><span class="big-num num" style="font-size:26px">${fa(final)}<small>تومان</small></span></div></div>`
    :`<div class="note">${I('check','sm')}<span>استفاده از ${p.n} برای ساکنین رایگان است.</span></div>`}`;
    cta=`<button class="btn pri block" data-act="confirm:${p.id}">${final?`تایید و پرداخت ${fa(final)} تومان`:'تایید رزرو'}</button><span class="m">لغو رایگان تا ۲۴ ساعت قبل از نوبت</span>`;
  }
  return {noTab:true,flow:true,html:`${bar('رزرو '+p.n)}${stepper}${body}`,bar:`<div class="cta-bar glass">${cta}</div>`,
    after(){const n=document.getElementById('b-n');n&&n.addEventListener('input',()=>b.note=n.value);}};
};

async function confirmBooking(pid){
  const p=ALLPROV.find(x=>x.id===pid),b=S.book,days=slotDays(pid);const disc=isOwner()&&p.price?Math.round(p.price*.1):0,final=p.price-disc;
  const btn=document.querySelector('.cta-bar .btn');
  const commit=async()=>{
    const {data,error}=await SB.rpc('book_slot',{p_unit:ST.unit,p_provider:pid,p_starts:days[b.day].slots[b.slot].starts_at,p_pay:b.pay==='card'?'card':'account',p_note:b.note||null,p_source:'app'});
    if(error){toast(dbError(error));busy(btn,false);if(/slot_taken|bad_slot|already_booked/.test(error.message)){try{await loadSlots(pid);}catch(e){}b.step=1;b.slot=null;render('back');}return false;}
    bump(catKeyOfProv(pid),3);await refresh();S.last=ST.acts.find(a=>a.rid===data.id);if(S.last&&S.last.cal)S.last.cal.want=b.cal;S.book=null;S.stack=['home'];go('success:res');return true;};
  busy(btn,true);
  if(final&&b.pay==='card')await gateway(final,commit);else await commit();
}

R.success=(kind)=>{const a=S.last||ST.acts[0];const isReq=kind==='req';return {noTab:true,html:`
  <div class="done-mark">${I('check')}</div>
  <div style="text-align:center;display:flex;flex-direction:column;gap:8px"><h1 class="h-l">${isReq?'درخواست شما ثبت شد':kind==='order'?'سفارش ثبت شد':'رزرو شما قطعی شد'}</h1><p class="sub">${isReq?'کارشناس به‌زودی بررسی می‌کند. وضعیت را از «فعالیت‌ها» دنبال کنید.':kind==='order'?'آماده‌سازی حدود ۲۰ دقیقه طول می‌کشد.':'جزئیات و امکان لغو در «فعالیت‌ها» است.'}</p></div>
  <div class="card glass" style="padding:4px 18px"><div class="kv"><span>عنوان</span><span>${esc(a.t)}</span></div><div class="kv"><span>${isReq?'ثبت':'زمان'}</span><span>${a.when}</span></div><div class="kv"><span>${kind==='order'?'تحویل':'مکان / مسئول'}</span><span>${esc(a.who)}</span></div><div class="kv"><span>کد پیگیری</span><span class="num">${faDigits(a.code)}</span></div></div>
  <div class="stack" style="gap:10px">${a.cal&&a.cal.want?`<button class="btn sec block" data-act="cal:${a.id}">${I('cal','sm')} افزودن به تقویم</button>`:''}<button class="btn pri block" data-tabgo="activity">پیگیری در فعالیت‌ها</button><button class="btn sec block" data-tabgo="home">بازگشت به خانه</button></div>`};};

R.request=(k)=>{const q=REQ[k];return {noTab:true,flow:true,html:`
  ${bar(q.t)}
  <div class="sec"><span class="eyebrow">نوع درخواست</span><div class="chips" style="flex-wrap:wrap;margin:0;padding:0">${q.types.map((t,i)=>`<button class="chip ${S.reqType==i?'on':''}" data-act="rtype:${i}">${t}</button>`).join('')}</div></div>
  <div class="note">${I('info','sm')}<span>${q.info}</span></div>
  <div class="field"><label for="r-d">شرح ${k==='rent'?'درخواست':'مشکل'}</label><textarea class="input" id="r-d" placeholder="${k==='rent'?'مثلاً متراژ، قیمت پیشنهادی، زمان مناسب تماس':'مثلاً کلید برق آشپزخانه جرقه می‌زند'}"></textarea><span class="err" id="r-err" role="alert"></span><span class="help">هر درخواست برای یک مورد است. موارد دیگر را جداگانه ثبت کنید.</span></div>
  ${k==='rent'?'':`<div class="sec"><span class="eyebrow">عکس <span class="m">(اختیاری)</span></span>${photoPicker()}</div>
  <div class="sec"><span class="eyebrow">زمان مناسب</span><div class="seg">${['هرچه زودتر','امروز عصر','فردا صبح'].map((t,i)=>`<button class="${S.reqTime==i?'on':''}" data-act="rtime:${i}">${t}</button>`).join('')}</div></div>`}`,
  bar:`<div class="cta-bar glass"><button class="btn pri block" data-act="submitreq:${k}">ثبت درخواست</button></div>`};};

async function submitRequest(k){
  const q=REQ[k],ta=document.getElementById('r-d'),txt=ta.value.trim(),err=document.getElementById('r-err'),btn=document.querySelector('.cta-bar .btn');
  if(txt.length<5){err.innerHTML=I('info','xs')+'کمی بیشتر توضیح دهید تا کارشناس بداند چه لازم است.';ta.classList.add('bad');ta.focus();return;}
  busy(btn,true,'در حال ثبت…');
  const paths=S.photoFiles.length?await uploadFiles(ST.unit,S.photoFiles):[];
  if(S.photoFiles.length&&paths.length<S.photoFiles.length)toast('بعضی عکس‌ها بارگذاری نشد');
  const when=k==='tech'?`\n\nزمان ترجیحی: ${['هرچه زودتر','امروز عصر','فردا صبح'][S.reqTime]}`:'';
  const {data,error}=await SB.from('requests').insert({unit_code:ST.unit,kind:k,type:q.types[S.reqType],description:txt+when,urgency:['high','normal','low'][S.reqTime]||'normal',photos:paths}).select().single();
  if(error){busy(btn,false);toast(dbError(error));return;}
  bump(k,3);await refresh();S.last=ST.acts.find(a=>a.rid===data.id);clearPhotos();S.stack=['home'];go('success:req');
}

R.cafe=(k)=>{const m=MENU[k];const items=m.items[S.cafeCat]||[];
  const lines=Object.entries(S.cart).filter(([key,q])=>q&&key.startsWith(k+'-'));
  const count=lines.reduce((a,[,q])=>a+q,0);const sum=lines.reduce((a,[key,q])=>{const [c,i]=key.split('-').slice(1).map(Number);return a+m.items[c][i][2]*q},0);
  return {noTab:true,html:`
  ${bar(m.t,`<span class="pill ok">${m.sub}</span>`)}
  ${k==='kitchen'?`<div class="note">${I('info','sm')}<span>با سفارش ۳۰ پرس یا بیشتر، ۱۰٪ تخفیف خودکار اعمال می‌شود.</span></div>`:''}
  ${k==='cafe'?`<div class="seg">${['سرو در کافی‌شاپ','تحویل در واحد'].map((t,i)=>`<button class="${S.cafeServe==i?'on':''}" data-act="serve:${i}">${t}</button>`).join('')}</div>`:''}
  <div class="chips">${m.cats.map((c,i)=>`<button class="chip ${S.cafeCat==i?'on':''}" data-act="ccat:${i}">${c}</button>`).join('')}</div>
  <div class="card glass" style="padding:4px 16px">${items.map((it,i)=>{const key=`${k}-${S.cafeCat}-${i}`,q=S.cart[key]||0;return `<div class="item"><div class="stack"><span class="t">${it[0]}</span>${it[1]?`<span class="m ellipsis">${it[1]}</span>`:''}<span class="num" style="font-size:14px;font-weight:600">${fa(it[2]/1000)} <small class="m">هزار تومان</small></span></div>${q?`<div class="qty"><button data-act="qty:${key}:1" aria-label="افزودن">${I('plus','sm')}</button><b class="num">${fa(q)}</b><button data-act="qty:${key}:-1" aria-label="کم کردن">${I('minus','sm')}</button></div>`:`<button class="add press" data-act="qty:${key}:1" aria-label="افزودن ${it[0]}">${I('plus','sm')}</button>`}</div>`}).join('')}</div>
  <div style="height:60px"></div>`,
  bar:`<button class="cartbar ${count?'':'hide'}" data-sheet="cart:${k}"><span><span class="badge num">${fa(count)}</span>مشاهده سبد</span><span class="num">${fa(sum/1000)} هزار تومان</span></button>`};};

function cartTotals(k){const m=MENU[k];const lines=Object.entries(S.cart).filter(([key,q])=>q&&key.startsWith(k+'-')).map(([key,q])=>{const [c,i]=key.split('-').slice(1).map(Number);return {it:m.items[c][i],q}});
  const qty=lines.reduce((a,l)=>a+l.q,0),sub=lines.reduce((a,l)=>a+l.it[2]*l.q,0),disc=k==='kitchen'&&qty>=30?Math.round(sub*.1):0;return {lines,qty,sub,disc,total:sub-disc};}
async function placeOrder(k){const c=cartTotals(k);if(!c.qty)return;const btn=document.querySelector('.sheet [data-act^="order"]');busy(btn,true,'در حال ثبت…');
  const {data,error}=await SB.rpc('place_order',{p_unit:ST.unit,p_venue:k,p_items:c.lines.map(l=>({id:l.it[3],qty:l.q})),p_delivery:k==='cafe'?(S.cafeServe?'unit':'cafe'):k==='carwash'?'parking':'unit',p_source:'app'});
  if(error){busy(btn,false);toast(dbError(error));return;}
  bump(k,3);S.cart={};await refresh();S.last=ST.acts.find(a=>a.rid===data.id);closeSheet(true);S.stack=['home'];go('success:order');}

R.activity=()=>{const f=S.actTab;const list=ST.acts.filter(a=>f==='all'||a.k===f);
  const groups=[['در جریان',list.filter(a=>a.st==='live'||a.st==='wait')],['پیش رو',list.filter(a=>a.st==='ok').sort((x,y)=>new Date(x.starts||x.created)-new Date(y.starts||y.created))],['انجام شده',list.filter(a=>a.st==='done')],['لغو شده',list.filter(a=>a.st==='bad')]].filter(g=>g[1].length);
  return {html:`
  <div class="between"><h1 class="h-l">فعالیت‌ها</h1><button class="icon-btn glass press" aria-label="درخواست جدید" data-go="request:tech">${I('plus')}</button></div>
  <div class="seg">${[['all','همه'],['res','رزروها'],['req','درخواست‌ها'],['ord','سفارش‌ها']].map(([k,l])=>`<button class="${f===k?'on':''}" data-act="atab:${k}">${l}</button>`).join('')}</div>
  ${groups.length?groups.map(([t,g])=>`<section class="sec"><span class="eyebrow">${t} · ${fa(g.length)}</span><div class="list glass">${g.map(actRow).join('')}</div></section>`).join(''):empty('موردی در این بخش نیست.')}`};};

R.finance=(p)=>{if(p)S.finTab=p;const t=S.finTab;
  const seg=`<div class="seg">${[['unit','حساب واحد'],['building','گزارش ساختمان']].map(([k,l])=>`<button class="${t===k?'on':''}" data-act="ftab:${k}">${l}</button>`).join('')}</div>`;
  const head=`<div class="between"><h1 class="h-l">مالی</h1><button class="icon-btn glass press" aria-label="گزارش هفتگی PDF" data-go="report">${I('file')}</button></div>`;
  if(t==='unit'){
    const cur=monthDebits(ST)/1e6;const vals=S.period===7?[...SPEND_PREV,cur]:[...SPEND_PREV12,cur];const labs=S.period===7?MONTHS:MONTHS12;
    const prev=vals[vals.length-2],chg=prev?Math.round((cur-prev)/prev*100):0;
    const bd=breakdown(ST);
    const cats=['all',...new Set(ST.tx.map(x=>x.c))];
    const txs=ST.tx.filter(x=>S.txCat==='all'||x.c===S.txCat);const groups=[...new Set(txs.map(x=>x.g))];
    return {html:`${head}${seg}
    <div class="card glass" style="display:flex;flex-direction:column;gap:14px">
      <span class="eyebrow">مانده حساب</span>
      <div class="big-num num"><bdi dir="ltr">${ST.bal<0?"−":""}${T(ST.bal)}</bdi><small>تومان ${ST.bal<0?'بدهکار':'بستانکار'}</small></div>
      <div class="row" style="gap:8px"><button class="btn pri sm" style="flex:1" data-sheet="pay">${ST.bal<0?'پرداخت':'افزایش اعتبار'}</button><a class="btn sec sm" style="flex:1;text-decoration:none" href="report.html?unit=${ST.unit}&week=2&o=100&print=1" target="_blank" rel="noopener">${I("download","sm")} صورت‌حساب</a></div>
    </div>
    <div class="card glass sec">
      <div class="between"><h2 class="h-m">هزینه‌های شما</h2><div class="seg" style="padding:3px">${[[7,'۷ ماه'],[12,'۱۲ ماه']].map(([v,l])=>`<button class="${S.period===v?'on':''}" style="height:30px;padding:0 10px;font-size:12px" data-act="period:${v}">${l}</button>`).join('')}</div></div>
      <div class="readout" data-readout><span class="m">مهر</span><b class="num">${fa(cur,1)} میلیون تومان</b></div>
      ${areaChart(vals,labs,{})}
      <button class="btn sec sm block" data-sheet="breakdown:unit">${I('chart','sm')} تفکیک هزینه‌های مهر</button>
    </div>
    <section class="sec tx-list"><div class="sec-h"><h2 class="h-m">تراکنش‌ها</h2><button class="link" data-sheet="txfilter">${S.txCat==='all'?'فیلتر':S.txCat} ${I('filter','xs')}</button></div>
      ${groups.length?groups.map(g=>`<span class="tx-group">${g}</span><div class="list glass">${txs.filter(x=>x.g===g).map(x=>`<button class="press" data-sheet="tx:${x.id}"><span class="tile-ic ${x.a>0?'':'neutral'}">${I(x.ic,'sm')}</span><div class="stack"><span class="t ellipsis">${esc(x.t)}</span><span class="m">${x.c}</span></div><span class="amt num ${x.a>0?'in':''}"><bdi dir="ltr">${x.a>0?"+":"−"}${T(x.a)}</bdi></span></button>`).join('')}</div>`).join(''):empty('تراکنشی در این دسته نیست.')}
    </section>`};
  }
  const m=S.bMonth,ti=BLD.inc[m],te=BLD.exp[m],per=Math.round((te-ti)*1e6/BLD.shares),mine=per*ME().shares;
  const fac=FAC.map(f=>({...f,inc:f.inc*FAC_MULT[m],exp:f.exp*FAC_MULT[m]}));const maxNet=Math.max(...fac.map(f=>Math.abs(f.inc-f.exp)));
  const pi=m?BLD.inc[m-1]:ti,pe=m?BLD.exp[m-1]:te;const di=((ti-pi)/pi*100),de=((te-pe)/pe*100);
  const bb=BLD.breakdown.map(([n,r,c])=>[n,te*r,c]);
  return {html:`${head}${seg}
    <div class="between"><button class="month-sel glass press" data-sheet="months">${I('cal','sm')} ${BLD.mon[m]} ۱۴۰۵ ${I('chevD','xs')}</button></div>
    <div class="kpis">
      <div class="kpi glass"><span class="m">درآمد ماه</span><span class="v num">${fa(ti/1000,2)} <small>میلیارد</small></span>${m?`<span class="delta ${di>=0?'down':'up'}">${I(di>=0?'arrowUp':'arrowDown','xs')} ${fa(Math.abs(di),1)}٪</span>`:''}</div>
      <div class="kpi glass"><span class="m">هزینه ماه</span><span class="v num">${fa(te/1000,2)} <small>میلیارد</small></span>${m?`<span class="delta ${de>=0?'up':'down'}">${I(de>=0?'arrowUp':'arrowDown','xs')} ${fa(Math.abs(de),1)}٪</span>`:''}</div>
      <div class="kpi glass" style="grid-column:span 2;flex-direction:row;align-items:center;justify-content:space-between"><div class="stack"><span class="m">سهم واحد ${faDigits(ST.unit)} (${fa(ME().shares)} سهم)</span><span class="v num">${fa(mine)} <small>تومان</small></span></div><div class="stack" style="flex:none;text-align:left"><span class="m">هر سهم</span><span class="t num">${fa(per)}</span></div></div>
    </div>
    <div class="card glass sec"><div class="between"><h2 class="h-m">درآمد و هزینه ساختمان</h2><span class="m">میلیارد تومان</span></div>
      <div class="readout"><span class="m">${BLD.mon[m]}</span><b class="num">درآمد ${fa(ti/1000,2)} · هزینه ${fa(te/1000,2)}</b></div>
      ${groupedBars(BLD.mon,BLD.inc,BLD.exp,m)}
      <div class="row m" style="gap:16px;flex-wrap:wrap"><span class="row" style="gap:6px"><span class="sw" style="background:var(--gold)"></span>درآمد</span><span class="row" style="gap:6px"><span class="sw" style="background:var(--c2);opacity:.45"></span>هزینه</span></div>
      <button class="btn sec sm block" data-sheet="breakdown:bld">${I('chart','sm')} تفکیک هزینه‌های ${BLD.mon[m]}</button></div>
    <div class="card glass sec" style="padding-bottom:8px"><div class="between"><h2 class="h-m">عملکرد مجموعه‌ها</h2><span class="m">مانده خالص</span></div>
      <div>${fac.map((f,i)=>{const net=f.inc-f.exp;return `<button class="fac press" data-sheet="fac:${i}"><div class="between"><span class="t">${f.n}</span><span class="amt num ${net>0?'in':''}" style="${net<0?'color:var(--bad)':''}"><bdi dir="ltr">${net>0?"+":"−"}${mil(net)}</bdi> <small>میلیون</small></span></div><div class="track"><i class="${net<0?'neg':''}" style="width:${Math.abs(net)/maxNet*100}%"></i></div></button>`}).join('')}</div></div>
    <button class="card glass press row" style="text-align:right" data-go="owners"><div class="tile-ic">${I('receipt')}</div><div class="stack"><span class="t">گزارش مالی مالکین</span><span class="m">اموال و تجهیزات · مانده ۳۶۲٫۴ میلیون</span></div>${I('chevL','sm chev')}</button>`};
};

R.owners=()=>({tab:'finance',html:`${bar('گزارش مالی مالکین')}
  <div class="card glass sec"><span class="eyebrow">مانده فعلی · تا ۱۸ مهر ۱۴۰۵</span><div class="big-num num">${fa(362443045)}<small>تومان</small></div>
  <div class="readout" data-readout><span class="m">مهر</span><b class="num">${fa(362)} میلیون تومان</b></div>
  ${areaChart(OWN_TREND,MONTHS,{h:120,d:0})}</div>
  <div class="list glass">${OWN.map((o,i)=>`<button class="press" data-sheet="own:${i}"><span class="tile-ic ${o.a>0?'':'neutral'}">${I(o.a>0?'arrowDown':'arrowUp','sm')}</span><div class="stack"><span class="t ellipsis">${o.t}</span><span class="m">${o.dt}</span></div><span class="amt num ${o.a>0?'in':''}"><bdi dir="ltr">${o.a>0?"+":"−"}${mil(o.a)}</bdi> <small>م</small></span></button>`).join('')}</div>`});

R.report=()=>{const k=S.week,o=S.rptOpt.map(Number).join('');const pages=reportPages(ST,k,S.rptOpt);
  return {noTab:true,flow:true,html:`${bar('گزارش هفتگی')}
  <div class="between"><button class="icon-btn glass press" aria-label="هفته بعد" data-act="week:1" ${k===2?'disabled style="opacity:.3"':''}>${I('chevR','sm')}</button><div class="stack" style="text-align:center;flex:1"><span class="t">${WEEKS[k].label}</span><span class="m">${k===2?'آماده‌شده امروز ۰۸:۰۰':'آرشیو'} · ${fa(pages.length)} صفحه</span></div><button class="icon-btn glass press" aria-label="هفته قبل" data-act="week:-1" ${k===0?'disabled style="opacity:.3"':''}>${I('chevL','sm')}</button></div>
  <div class="pages" id="pages">${pages.map(p=>`<div class="paper" dir="rtl">${p}</div>`).join('')}</div>
  <div class="pdots" id="pdots">${pages.map((_,i)=>`<i class="${i==0?'on':''}"></i>`).join('')}</div>
  <section class="sec"><span class="eyebrow">محتوای گزارش</span><div class="list glass">${[['مالی','مانده، تراکنش‌ها، تفکیک هزینه','wallet'],['رزروها و درخواست‌ها','نوبت‌ها، کلاس‌ها، لغوها','cal'],['مصرف خدمات','ساعات استفاده از امکانات','chart']].map((r,i)=>`<div class="between"><span class="tile-ic neutral">${I(r[2],'sm')}</span><div class="stack"><span class="t">${r[0]}</span><span class="m">${r[1]}</span></div><button class="toggle" role="switch" aria-checked="${S.rptOpt[i]}" data-act="ropt:${i}" aria-label="${r[0]}"></button></div>`).join('')}</div></section>
  <div class="list glass"><div class="between"><div class="stack"><span class="t">ارسال خودکار به ایمیل</span><span class="m">هر شنبه ۸ صبح · ${esc(ST.email)}</span></div><button class="toggle" role="switch" aria-checked="${ST.autoReport!==false}" data-act="auto" aria-label="ارسال خودکار"></button></div>
    <a class="press" style="text-decoration:none;color:inherit" href="weekly-report-sample.pdf" target="_blank" rel="noopener"><span class="tile-ic neutral">${I('file','sm')}</span><div class="stack"><span class="t">نمونه PDF آماده</span><span class="m">فایل نمونه ۳ صفحه‌ای</span></div>${I('chevL','sm chev')}</a></div>`,
  bar:`<div class="cta-bar glass" style="flex-direction:row;gap:8px"><button class="btn sec" style="flex:1" data-sheet="emailrpt">${I('mail','sm')} ایمیل</button><a class="btn pri" style="flex:2;text-decoration:none" href="report.html?unit=${ST.unit}&week=${k}&o=${o}&print=1" target="_blank" rel="noopener">${I('download','sm')} دریافت PDF</a></div>`,
  after(){const pg=document.getElementById('pages'),dots=document.querySelectorAll('#pdots i');pg.addEventListener('scroll',()=>{const i=Math.round(Math.abs(pg.scrollLeft)/274);dots.forEach((d,j)=>d.classList.toggle('on',j===i))},{passive:true});}};
};

R.profile=()=>{const u=ME();return {html:`
  <div class="pro-head"><div class="avatar">${u.name[0]}</div><h1 class="h-l">${u.full}</h1><span class="m">${TOWER} · واحد ${faDigits(ST.unit)} · ${u.role}</span></div>
  <section class="sec"><span class="eyebrow">ظاهر برنامه</span><div class="seg">${[['light','روشن','sun'],['dark','تیره','moon']].map(([k,l,i])=>`<button class="${S.mode===k?'on':''}" data-act="mode:${k}" style="display:flex;align-items:center;justify-content:center;gap:6px">${I(i,'sm')}${l}</button>`).join('')}</div></section>
  <section class="sec"><span class="eyebrow">حساب</span><div class="list glass">
    <button class="press" data-sheet="email"><span class="tile-ic neutral">${I('mail','sm')}</span><div class="stack"><span class="t">ایمیل</span><span class="m" dir="ltr" style="text-align:right">${esc(ST.email)}</span></div>${I('chevL','sm chev')}</button>
    <button class="press" data-sheet="password"><span class="tile-ic neutral">${I('lock','sm')}</span><span class="t" style="flex:1">تغییر رمز عبور</span>${I('chevL','sm chev')}</button>
    <button class="press" data-go="report"><span class="tile-ic neutral">${I('file','sm')}</span><span class="t" style="flex:1">گزارش‌های هفتگی</span>${I('chevL','sm chev')}</button></div></section>
  <section class="sec"><span class="eyebrow">ساختمان</span><div class="list glass">
    <button class="press" data-sheet="message"><span class="tile-ic neutral">${I('send','sm')}</span><div class="stack"><span class="t">پیام و عکس به مدیریت</span><span class="m">گزارش مشکل، شکایت یا پیشنهاد</span></div>${I('chevL','sm chev')}</button>
    <button class="press" data-sheet="staff"><span class="tile-ic neutral">${I('star','sm')}</span><span class="t" style="flex:1">ارزیابی پرسنل</span>${I('chevL','sm chev')}</button>
    <button class="press" data-sheet="rules"><span class="tile-ic neutral">${I('book','sm')}</span><span class="t" style="flex:1">آیین‌نامه ساختمان</span>${I('chevL','sm chev')}</button>
    <button class="press" data-sheet="contact"><span class="tile-ic neutral">${I('phone','sm')}</span><span class="t" style="flex:1">تماس با ساختمان</span>${I('chevL','sm chev')}</button></div></section>
  <div class="list glass"><button class="press" data-act="replaytour"><span class="tile-ic neutral">${I('info','sm')}</span><div class="stack"><span class="t">راهنمای برنامه</span><span class="m">مشاهده دوباره آموزش</span></div>${I('chevL','sm chev')}</button></div>
  <div class="list glass"><button class="press" data-act="logout" style="color:var(--bad)"><span class="tile-ic" style="background:var(--bad-soft);color:var(--bad)">${I('logout','sm')}</span><span class="t" style="flex:1">خروج از حساب</span></button></div>`};};

/* ============ SHEETS ============ */
const SH={};Object.assign(SH,MSH);Object.assign(SH,{
 act(id){const a=ST.acts.find(x=>x.id===id);const can=!!a.cancellable;const rated=ST.rated[a.id];
  return [a.t,`
   <div class="row"><div class="tile-ic">${I(a.ic)}</div><div class="stack"><span class="t">${esc(a.d)}</span><span class="m">${a.when}</span></div>${pillFor(a)}</div>
   <div class="card" style="background:var(--fill);padding:16px"><div class="timeline">${a.tl.map(s=>`<div class="tl ${s[2]}"><span class="dotc">${s[2]==='done'?I('check','xs'):''}</span><div class="stack"><span class="t" style="font-size:14px">${s[0]}</span><span class="m">${s[1]||'—'}</span></div></div>`).join('')}</div></div>
   <div><div class="kv"><span>مسئول / مکان</span><span>${esc(a.who)}</span></div><div class="kv"><span>کد پیگیری</span><span class="num">${faDigits(a.code)}</span></div>${a.fullText&&a.fullText.length>48?`<div class="kv"><span>شرح</span><span>${esc(a.fullText)}</span></div>`:''}${a.photoPaths&&a.photoPaths.length?`<div class="thumbs" id="act-photos" data-paths="${a.photoPaths.join(',')}"></div>`:''}${a.price?`<div class="kv"><span>مبلغ</span><span class="num">${fa(a.price)} تومان · ${a.paidBy==='card'?'کارت':'حساب واحد'}</span></div>`:''}${a.note?`<div class="kv"><span>توضیح شما</span><span>${esc(a.note)}</span></div>`:''}</div>
   ${a.st==='done'?`<button class="btn sec block" data-sheet="rate:${a.id}">${I('star','sm')} ${rated?`امتیاز شما: ${fa(rated)} ستاره · ویرایش`:'امتیاز به این خدمت'}</button>`
    :a.st==='bad'?'':`<div class="row" style="gap:8px"><button class="btn sec" style="flex:1" data-sheet="message">${I('msg','sm')} پیام</button><a class="btn pri" style="flex:1;text-decoration:none" href="tel:${a.phone||CONTACTS[0][1]}">${I('phone','sm')} تماس</a></div>${a.cal&&a.st==='ok'?`<button class="btn sec block" data-act="cal:${a.id}">${I('cal','sm')} افزودن به تقویم</button>`:''}${can?`<div class="divider"></div><button class="btn block" style="color:var(--bad)" data-sheet="cancel:${a.id}">لغو رزرو</button>`:''}`}`];},
 cancel(id){const a=ST.acts.find(x=>x.id===id);const ref=a.price&&new Date(a.starts)-Date.now()>=864e5;
  return ['لغو رزرو',`<p class="sub" style="color:var(--ink2)">${esc(a.t)} · ${a.when}</p><div class="note">${I('info','sm')}<span>${!a.price?'این رزرو هزینه‌ای نداشت.':ref?(a.paidBy==='card'?`مبلغ ${fa(a.price)} تومان به کارت برمی‌گردد.`:`مبلغ ${fa(a.price)} تومان به حساب واحد برمی‌گردد.`):'کمتر از ۲۴ ساعت به نوبت مانده و مبلغ برگشت داده نمی‌شود.'}</span></div>
   <button class="btn block" style="background:var(--bad);color:#fff" data-act="docancel:${id}">بله، لغو شود</button><button class="btn sec block" data-sheet="act:${id}">نه، نگه دار</button>`];},
 tx(id){const x=ST.tx.find(t=>t.id===id);return ['جزئیات تراکنش',`
   <div style="text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center"><span class="tile-ic" style="width:56px;height:56px">${I(x.ic)}</span><span class="m">${esc(x.t)}</span><span class="big-num num" style="${x.a>0?'color:var(--ok)':''}"><bdi dir="ltr">${x.a>0?"+":"−"}${T(x.a)}</bdi><small>تومان</small></span></div>
   <div class="card glass" style="padding:4px 16px"><div class="kv"><span>تاریخ</span><span>${x.dt}</span></div><div class="kv"><span>دسته</span><span>${x.c}</span></div><div class="kv"><span>شماره پیگیری</span><span class="num">${faDigits(x.code)}</span></div></div>
   <div class="stack" style="gap:6px"><span class="eyebrow">شرح</span><p class="sub" style="color:var(--ink2)">${esc(x.d)}</p></div>
   <a class="btn sec block" style="text-decoration:none" href="report.html?unit=${ST.unit}&receipt=${x.id}&print=1" target="_blank" rel="noopener">${I('download','sm')} دریافت رسید PDF</a>`];},
 txfilter(){const cats=['all',...new Set(ST.tx.map(x=>x.c))];return ['فیلتر تراکنش‌ها',`<div class="chips" style="flex-wrap:wrap;margin:0;padding:0">${cats.map(c=>`<button class="chip ${S.txCat===c?'on':''}" data-act="txcat:${c}">${c==='all'?'همه':c}</button>`).join('')}</div>`];},
 own(i){const o=OWN[i];return [o.t,`<div class="big-num num" style="${o.a>0?'color:var(--ok)':''}"><bdi dir="ltr">${o.a>0?"+":"−"}${T(o.a)}</bdi><small>تومان</small></div><p class="sub" style="color:var(--ink2)">${o.d}</p><div class="card glass" style="padding:4px 16px"><div class="kv"><span>تاریخ</span><span>${o.dt} ۱۴۰۵</span></div><div class="kv"><span>شماره پیگیری</span><span class="num">${faDigits(o.code)}</span></div><div class="kv"><span>نوع</span><span>${o.a>0?'درآمد':'هزینه'}</span></div></div><a class="btn sec block" style="text-decoration:none" href="report.html?unit=${ST.unit}&own=${i}&print=1" target="_blank" rel="noopener">${I('file','sm')} سند PDF</a>`];},
 fac(i){const m=S.bMonth,f=FAC[i],inc=f.inc*FAC_MULT[m],exp=f.exp*FAC_MULT[m],net=inc-exp;return [f.n,`<div class="kpis"><div class="kpi glass"><span class="m">درآمد</span><span class="v num">${mil(inc)} <small>م</small></span></div><div class="kpi glass"><span class="m">هزینه</span><span class="v num">${mil(exp)} <small>م</small></span></div></div>
   <div class="card glass"><div class="between"><span class="t">مانده خالص ${BLD.mon[m]}</span><span class="amt num" style="color:${net<0?'var(--bad)':'var(--ok)'}"><bdi dir="ltr">${net>0?"+":"−"}${mil(net)}</bdi> میلیون</span></div></div>
   <div class="card glass sec"><span class="eyebrow">مانده خالص ۶ ماه (میلیون تومان)</span>${areaChart(FAC_MULT.map(k=>Math.abs((f.inc-f.exp)*k)/1e6),BLD.mon,{h:110,sel:m})}</div>
   <p class="sub">${f.note}. ${net<0?'کسری این مجموعه از شارژ عمومی پوشش داده می‌شود.':'مازاد این مجموعه به صندوق ساختمان می‌رود.'}</p>`];},
 breakdown(kind){if(kind==='bld'){const m=S.bMonth,te=BLD.exp[m];const bb=BLD.breakdown.map(([n,r,c])=>[n,te*r,c]);return ['هزینه‌های '+BLD.mon[m],`<div class="donut-wrap" style="justify-content:center">${donut(bb,fa(te/1000,2),'میلیارد تومان')}</div>${legend(bb,v=>fa(v)+' م')}`];}
   const bd=breakdown(ST),tot=monthDebits(ST);return ['تفکیک هزینه‌های مهر',`<div class="donut-wrap" style="justify-content:center">${donut(bd,mil(tot),'میلیون تومان')}</div>${legend(bd,v=>mil(v)+' م')}`];},
 months(){return ['انتخاب ماه',`<div class="list glass">${BLD.mon.map((mn,i)=>[mn,i]).reverse().map(([mn,i])=>`<button class="press" data-act="bmonth:${i}"><span class="t" style="flex:1">${mn} ۱۴۰۵</span>${i===S.bMonth?I('check','sm'):''}</button>`).join('')}</div><p class="m">گزارش مهر پس از بسته‌شدن حساب‌ها، ۵ آبان منتشر می‌شود.</p>`];},
 pay(){const due=Math.max(0,-ST.bal),p=S.pay;const amt=p.mode==='full'&&due?due:null;return [ST.bal<0?'پرداخت بدهی':'افزایش اعتبار',`
   ${due?`<div class="stack" style="gap:4px;text-align:center"><span class="m">بدهی فعلی</span><span class="big-num num">${fa(due)}<small>تومان</small></span></div><div class="seg"><button class="${p.mode==='full'?'on':''}" data-act="pmode:full">کل بدهی</button><button class="${p.mode==='custom'?'on':''}" data-act="pmode:custom">مبلغ دلخواه</button></div>`:`<div class="note">${I('check','sm')}<span>حساب شما بدهی ندارد. می‌توانید اعتبار اضافه کنید.</span></div>`}
   ${!amt?`<div class="field"><label for="p-a">مبلغ (تومان)</label><input class="input num" id="p-a" inputmode="numeric" placeholder="مثلاً ۵٬۰۰۰٬۰۰۰"><span class="err" id="p-err" role="alert"></span></div>`:''}
   <button class="radio-card press ${p.method==='gw'?'on':''}" data-act="pmethod:gw"><span class="tile-ic neutral">${I('card','sm')}</span><div class="stack"><span class="t">درگاه بانکی</span><span class="m">پرداخت آنی با کارت عضو شتاب</span></div><span class="rd"></span></button>
   <button class="radio-card press ${p.method==='c2c'?'on':''}" data-act="pmethod:c2c"><span class="tile-ic neutral">${I('receipt','sm')}</span><div class="stack"><span class="t">کارت به کارت و ارسال رسید</span><span class="m">پس از تایید امور مالی ثبت می‌شود</span></div><span class="rd"></span></button>
   ${p.method==='c2c'?`<div class="card glass" style="padding:4px 16px"><div class="kv"><span>شماره کارت</span><span class="num" dir="ltr">${BUILDING_CARD.no}</span></div><div class="kv"><span>به نام</span><span>${BUILDING_CARD.owner}</span></div></div><button class="btn sec block" data-copy="${BUILDING_CARD.no}">${I('copy','sm')} کپی شماره کارت</button>${photoPicker()}`:''}
   <button class="btn pri block" data-act="dopay">${p.method==='gw'?`پرداخت ${amt?fa(amt)+' تومان':''}`:'ارسال رسید'}</button>`];},
 cart(k){const c=cartTotals(k);return ['سبد سفارش',`<div class="card glass" style="padding:4px 16px">${c.lines.map(l=>`<div class="kv"><span>${l.it[0]} × ${fa(l.q)}</span><span class="num">${fa(l.it[2]*l.q)}</span></div>`).join('')}</div>
   ${k==='cafe'?`<div class="kv"><span>تحویل</span><span>${S.cafeServe?'در واحد '+faDigits(ST.unit):'سرو در کافی‌شاپ'}</span></div>`:''}
   ${c.disc?`<div class="kv"><span>تخفیف ۳۰ پرس ۱۰٪</span><span class="num" style="color:var(--ok)">−${fa(c.disc)}</span></div>`:k==='kitchen'?`<p class="m">${fa(30-c.qty)} پرس دیگر تا ۱۰٪ تخفیف</p>`:''}
   <div class="sum-total"><span class="t">جمع</span><span class="big-num num" style="font-size:26px">${fa(c.total)}<small>تومان</small></span></div>
   <span class="m">به حساب واحد ${faDigits(ST.unit)} اضافه می‌شود</span>
   <button class="btn pri block" data-act="order:${k}">ثبت سفارش</button><button class="btn block" style="color:var(--bad)" data-act="clearcart">خالی کردن سبد</button>`];},
 notifs(){if(ST.unread){ST.unread=false;SB.from('notifications').update({read:true}).eq('unit_code',ST.unit).eq('read',false).then(()=>{});}setTimeout(()=>{const d=view.querySelector('.icon-btn .dot');d&&d.remove();},0);
   return ['اعلان‌ها',ST.notifs.length?`<div class="list glass">${ST.notifs.slice(0,12).map(n=>`<div><span class="tile-ic">${I(n.ic,'sm')}</span><div class="stack"><span class="t">${esc(n.t)}</span><span class="m">${esc(n.d)}</span></div><span class="m">${n.w}</span></div>`).join('')}</div>`:empty('اعلان جدیدی ندارید.')];},
 units(){return ['واحدهای شما',`<div class="list glass">${ST.units.map(u=>`<button class="press" data-act="unit:${u.code}"><span class="tile-ic ${u.code===ST.unit?'':'neutral'}">${I('building','sm')}</span><div class="stack"><span class="t">واحد ${faDigits(u.code)}</span><span class="m">${roleLabel(u)} · مانده <bdi dir="ltr">${u.balance<0?"−":""}${mil(u.balance)}</bdi> م</span></div>${u.code===ST.unit?I('check','sm'):''}</button>`).join('')}</div>`];},
 pfilter(k){return ['فیلتر و مرتب‌سازی',`<span class="eyebrow">برای</span><div class="seg">${[['all','همه'],['بانوان','بانوان'],['آقایان','آقایان']].map(([v,l])=>`<button class="${S.provGender===v?'on':''}" data-act="pg:${v}">${l}</button>`).join('')}</div>
   <span class="eyebrow">مرتب‌سازی</span><div class="seg">${[['rate','بیشترین امتیاز'],['price','کمترین قیمت']].map(([v,l])=>`<button class="${S.provSort===v?'on':''}" data-act="ps:${v}">${l}</button>`).join('')}</div>
   <button class="btn pri block" data-act="papply">نمایش نتایج</button>`];},
 email(){return ['ایمیل',`<div class="field"><label for="e-m">آدرس ایمیل</label><input class="input" id="e-m" type="email" dir="ltr" autocomplete="email" value="${esc(ST.email)}"><span class="err" id="e-err" role="alert"></span><span class="help">گزارش هفتگی و رسیدها به این آدرس فرستاده می‌شود.</span></div><button class="btn pri block" data-act="saveemail">ذخیره</button>`];},
 emailrpt(){return ['ارسال گزارش به ایمیل',`<p class="sub" style="color:var(--ink2)">گزارش ${WEEKS[S.week].label} به این آدرس فرستاده می‌شود:</p><div class="card glass" dir="ltr" style="text-align:left;font-weight:500">${esc(ST.email)}</div><button class="btn pri block" data-act="sendrpt">ارسال</button><button class="btn sec block" data-sheet="email">تغییر ایمیل</button>`];},
 password(){return ['تغییر رمز عبور',`${['فعلی','جدید','تکرار رمز جدید'].map((l,i)=>`<div class="field"><label for="pw${i}">رمز ${l}</label><input class="input" id="pw${i}" type="password" autocomplete="${i?'new-password':'current-password'}"></div>`).join('')}<span class="err" id="pw-err" role="alert"></span><span class="help">حداقل ۶ کاراکتر.</span><button class="btn pri block" data-act="savepw">ذخیره رمز جدید</button>`];},
 forgot(){return ['فراموشی رمز عبور',`<p class="sub" style="color:var(--ink2)">برای امنیت واحد شما، رمز جدید فقط از طریق دفتر ساختمان صادر می‌شود. با در دست داشتن کارت شناسایی به دفتر مراجعه کنید یا تماس بگیرید.</p><div class="list glass"><div><span class="tile-ic neutral">${I('phone','sm')}</span><div class="stack"><span class="t">دفتر ساختمان</span><span class="m num" dir="ltr" style="text-align:right">${CONTACTS[0][1]}</span></div><a class="icon-btn" style="background:var(--fill)" href="tel:${CONTACTS[0][1]}" aria-label="تماس">${I('phone','sm')}</a></div></div>`];},
 contact(){return ['تماس با ساختمان',`<div class="list glass">${CONTACTS.map(c=>`<div><span class="tile-ic neutral">${I('phone','sm')}</span><div class="stack"><span class="t">${c[0]}</span><span class="m num" style="direction:ltr;text-align:right;user-select:text">${c[1]}</span></div><button class="icon-btn" style="background:var(--fill)" aria-label="کپی شماره" data-copy="${c[1]}">${I('copy','sm')}</button><a class="icon-btn" style="background:var(--cta);color:var(--cta-ink)" href="tel:${c[1]}" aria-label="تماس با ${c[0]}">${I('phone','sm')}</a></div>`).join('')}</div>`];},
 rules(){return ['آیین‌نامه ساختمان',`<p class="sub" style="color:var(--ink2)">رعایت این آیین‌نامه برای همه ساکنین، مهمانان و کارکنان ساختمان الزامی است.</p>${RULES.map((r,i)=>`<div class="rule"><h3>${fa(i+1)} · ${r[0]}</h3><p>${r[1]}</p></div>`).join('')}`];},
 staff(){return ['ارزیابی پرسنل',`<p class="sub">به کسی که اخیراً به شما خدمت داده امتیاز بدهید.</p><div class="list glass">${STAFF.map((s,i)=>`<button class="press" data-sheet="rate:staff${i}"><span class="avatar" style="width:40px;height:40px">${s[0]}</span><div class="stack"><span class="t">${s[1]}</span><span class="m">${s[2]}</span></div>${ST.rated['staff'+i]?`<span class="m" style="color:var(--gold-ink)">${'★'.repeat(ST.rated['staff'+i])}</span>`:I('chevL','sm chev')}</button>`).join('')}</div>`];},
 rate(key){const who=key.startsWith('staff')?STAFF[+key.slice(5)][1]:(ST.acts.find(a=>a.id===key)||{}).t;S.rate={key,stars:ST.rated[key]||5,tags:[0,1]};return ['امتیاز به '+esc(who),rateBody()];},
 message(){return ['پیام به مدیریت',`<div class="seg">${['مشکل','شکایت','پیشنهاد'].map((t,i)=>`<button class="${S.msgType===i?'on':''}" data-act="mtype:${i}">${t}</button>`).join('')}</div><div class="field"><label for="mm">پیام</label><textarea class="input" id="mm" placeholder="مثلاً نظافت طبقه ۱۰ به‌خوبی انجام نشده"></textarea><span class="err" id="mm-err" role="alert"></span></div>${photoPicker()}<button class="btn pri block" data-act="sendmsg">ارسال</button>`];},
 gateway(){return ['درگاه پرداخت',`<div class="spin"></div><p class="sub" style="text-align:center">در حال اتصال به درگاه بانکی…</p>`];},
});
function rateBody(){const r=S.rate;return `<div class="row" style="justify-content:center;gap:2px;color:var(--gold)">${[1,2,3,4,5].map(i=>`<button class="icon-btn" aria-label="${fa(i)} ستاره" data-act="star:${i}"><svg class="ico" viewBox="0 0 24 24" style="width:34px;height:34px;fill:${i<=r.stars?'currentColor':'none'}">${P.star}</svg></button>`).join('')}</div>
   <div class="chips" style="flex-wrap:wrap;margin:0;padding:0;justify-content:center">${['برخورد خوب','مهارت بالا','وقت‌شناس','نظافت و پوشش'].map((t,i)=>`<button class="chip ${r.tags.includes(i)?'on':''}" data-act="rtag:${i}">${t}</button>`).join('')}</div>
   <div class="field"><label for="rt">نظر شما <span class="m">(اختیاری)</span></label><textarea class="input" id="rt"></textarea></div><button class="btn pri block" data-act="saverate">ثبت امتیاز</button>`;}

let sheetOpen=false,sheetKey=null;
function openSheet(key){const i=key.indexOf(':');const n=i<0?key:key.slice(0,i),p=i<0?undefined:key.slice(i+1);const [title,body]=SH[n](p);sheetKey=key;
  if(sheetOpen){const sh=overlay.querySelector('.sheet');sh.setAttribute('aria-label',title);sh.querySelector('.sheet-h h2').innerHTML=title;sh.querySelector('.sheet-b').innerHTML=body;showActPhotos();showUnitTx();return;}
  overlay.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${title}"><div class="grab"></div><div class="sheet-h"><h2 class="h-m">${title}</h2><button class="icon-btn" style="background:var(--fill)" data-act="close" aria-label="بستن">${I('x','sm')}</button></div><div class="sheet-b">${body}</div></div>`;
  requestAnimationFrame(()=>{overlay.querySelector('.scrim')?.classList.add('show');overlay.querySelector('.sheet')?.classList.add('show');});sheetOpen=true;showActPhotos();showUnitTx();}
async function showActPhotos(){const box=document.getElementById('act-photos');if(!box)return;const paths=box.dataset.paths.split(',').filter(Boolean);
  const {data}=await SB.storage.from('attachments').createSignedUrls(paths,3600);(data||[]).forEach(x=>{if(x.signedUrl)box.insertAdjacentHTML('beforeend',`<a href="${x.signedUrl}" target="_blank" rel="noopener"><img src="${x.signedUrl}" alt="عکس پیوست"></a>`);});}
function refreshSheet(){if(sheetOpen&&sheetKey){const b=overlay.querySelector('.sheet-b');const y=b.scrollTop;openSheet(sheetKey);overlay.querySelector('.sheet-b').scrollTop=y;}}
function closeSheet(now){if(!sheetOpen)return;S.mSelId=null;sheetOpen=false;sheetKey=null;const s=overlay.querySelector('.sheet'),c=overlay.querySelector('.scrim');if(now){overlay.innerHTML='';return;}s&&s.classList.remove('show');c&&c.classList.remove('show');setTimeout(()=>{if(!sheetOpen)overlay.innerHTML=''},300);}
let tt;function toast(msg){const t=document.getElementById('toast');t.innerHTML=I('check','sm')+msg;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2800);}
async function gateway(amount,done){openSheet('gateway');await new Promise(r=>setTimeout(r,1500));closeSheet(true);const ok=await done();if(ok!==false)toast(`پرداخت ${fa(amount)} تومان موفق بود`);}

/* ============ ONBOARDING & TOUR ============ */
const ONB=[
 {art:'tower',t:'به آفرینش خوش آمدید',d:'همه کارهای ساختمان در یک جا: رزرو، درخواست، پرداخت و گزارش.'},
 {ic:'cal',t:'رزرو در سه قدم',d:'خدمت را انتخاب کنید، روز و ساعت را بزنید، تایید کنید.'},
 {ic:'pulse',t:'همه‌چیز را دنبال کنید',d:'وضعیت هر درخواست، رزرو و سفارش در «فعالیت‌ها» به‌روز می‌شود.'},
 {ic:'chart',t:'حساب شفاف',d:'مانده، هزینه‌ها و گزارش هفتگی PDF در بخش «مالی» است.'},
];
let onbI=0;
function onbLayer(){let el=document.getElementById('onb');if(!el){el=document.createElement('div');el.id='onb';el.className='onb';app.appendChild(el);}return el;}
function showOnboarding(){const el=onbLayer();
  el.innerHTML=`<div class="onb-card glass onb-ask" role="dialog" aria-modal="true" aria-label="راهنمای برنامه"><div class="onb-body"><span class="onb-ic">${I('sparkle')}</span><h2 class="h-l">راهنمای کوتاه برنامه را می‌خواهید؟</h2><p class="sub">چهار صفحه‌ی کوتاه و چند نکته‌ی کنار هر بخش. اگر رد کنید، دیگر هیچ راهنمایی نشان داده نمی‌شود. هر وقت خواستید از «من» دوباره ببینید.</p><div class="stack" style="gap:10px;width:100%"><button class="btn pri block" data-act="onbstart">بله، نشانم بده</button><button class="btn sec block" data-act="onbskipall">نه، رد کردن همه</button></div></div></div>`;
  el.querySelector('[data-act=onbstart]').focus({preventScroll:true});}
function showSlides(){onbI=0;drawOnb();}
function skipAll(){document.getElementById('onb')?.remove();endTour();ST.onboarded=true;ST.seen=Object.fromEntries(Object.keys(TOURS).map(k=>[k,true]));save();}
function drawOnb(){const o=ONB[onbI],last=onbI===ONB.length-1;const el=onbLayer();
  el.innerHTML=`<div class="onb-card glass" role="dialog" aria-modal="true" aria-label="${o.t}">
    <div class="onb-art">${o.art?ART[o.art]():`<span class="onb-ic">${I(o.ic)}</span>`}</div>
    <div class="onb-body"><span class="eyebrow">${fa(onbI+1)} از ${fa(ONB.length)}</span><h2 class="h-l">${o.t}</h2><p class="sub">${o.d}</p>
    <div class="pdots" style="justify-content:flex-start">${ONB.map((_,i)=>`<i class="${i===onbI?'on':''}"></i>`).join('')}</div>
    <div class="row" style="gap:8px;margin-top:6px">${last?'':`<button class="btn sec" style="flex:1" data-act="onbskip">رد کردن</button>`}<button class="btn pri" style="flex:2" data-act="onbnext">${last?'شروع کنید':'بعدی'}</button></div></div></div>`;
  el.querySelector('[data-act=onbnext]').focus({preventScroll:true});}
function finishOnb(){document.getElementById('onb')?.remove();ST.onboarded=true;ST.seen=ST.seen||{};save();setTimeout(()=>maybeTour(S.stack[S.stack.length-1].split(':')[0]),350);}

const TOURS={
 home:[['.chatbar','پیام بنویسید','هر چیزی بپرسید: رزرو، سفارش، خرابی یا حتی یه سوال عمومی. آف‌بات اول یک کارت نشان می‌دهد و شما تایید می‌زنید.'],['.sumstrip','مانده و وضعیت','مانده حساب و کاری که در جریان است همیشه بالای صفحه است.'],['.tabbar','منوی اصلی','خدمات، فعالیت‌ها، مالی و پروفایل از اینجا باز می‌شوند.']],
 services:[['.search','جستجو','نام خدمت را بنویسید تا سریع پیدا شود.'],['#top-svc','پراستفاده‌ها بالا','ترتیب خدمات بر اساس استفاده شما خودکار عوض می‌شود.'],['#more-svc','سایر خدمات','خدماتی که کمتر استفاده کرده‌اید اینجا هستند.']],
 provider:[['.prov','انتخاب متخصص','امتیاز، اولین زمان آزاد و قیمت را ببینید و بزنید.']],
 booking:[['.stepper','سه قدم','زمان، جزئیات، پرداخت. با دکمه بازگشت هر وقت خواستید برگردید.'],['.days','انتخاب روز','روزهای کم‌رنگ قابل رزرو نیستند.'],['.slots','انتخاب ساعت','یک ساعت آزاد بزنید، بعد «ادامه».']],
 activity:[['.seg','فیلتر','رزروها، درخواست‌ها و سفارش‌ها را جدا ببینید.'],['.act','هر مورد','بزنید تا مراحل، کد پیگیری و لغو را ببینید.']],
 finance:[['.seg','دو نما','حساب واحد خودتان یا گزارش کل ساختمان.'],['.chart','نمودار','روی هر ماه بزنید تا مبلغ دقیق را ببینید.'],['.tx-list','تراکنش‌ها','برای شرح کامل و رسید PDF روی هر ردیف بزنید.'],['[data-go="report"]','گزارش هفتگی','گزارش PDF هفتگی واحد شما اینجاست.']],
 cafe:[['.chips','دسته‌ها','دسته را عوض کنید.'],['.add','افزودن','با + به سبد اضافه کنید. سبد پایین صفحه ظاهر می‌شود.']],
 request:[['.chips','نوع درخواست','نوع کار را انتخاب کنید.'],['#r-d','شرح','کوتاه بنویسید چه مشکلی هست. عکس هم می‌توانید اضافه کنید.']],
 report:[['.pages','پیش‌نمایش','صفحه‌های گزارش را ورق بزنید.'],['.cta-bar','دریافت','PDF را بگیرید یا به ایمیل بفرستید.']],
 profile:[['[data-act="replaytour"]','راهنما','هر وقت خواستید این آموزش را دوباره ببینید.']],
};
let TOUR=null;
const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
function maybeTour(name){if(!ST||!ST.onboarded||TOUR||sheetOpen||document.getElementById('onb'))return;ST.seen=ST.seen||{};if(ST.seen[name]||!TOURS[name])return;
  if(S.stack[S.stack.length-1].split(':')[0]!==name)return;
  const steps=TOURS[name].map(([sel,t,d])=>({el:app.querySelector(sel),t,d})).filter(x=>x.el&&visible(x.el));
  ST.seen[name]=true;save();if(!steps.length)return;TOUR={steps,i:0,name};
  const blk=document.createElement('div');blk.className='tour-block';blk.id='tour';blk.innerHTML='<div class="tour-spot"></div><div class="tour-tip glass" role="dialog" aria-live="polite"></div>';app.appendChild(blk);tourStep();}
function tourStep(){const st=TOUR.steps[TOUR.i],last=TOUR.i===TOUR.steps.length-1;
  const inView=()=>{const r=st.el.getBoundingClientRect();return r.top>=60&&r.bottom<=innerHeight-100;};
  if(!inView()&&view.contains(st.el))st.el.scrollIntoView({block:'center',behavior:'smooth'});
  setTimeout(()=>{if(!TOUR)return;placeTour();const tip=app.querySelector('.tour-tip');
    tip.innerHTML=`<span class="eyebrow">${fa(TOUR.i+1)} از ${fa(TOUR.steps.length)}</span><span class="t" style="font-weight:600;font-size:16px">${st.t}</span><span class="sub" style="color:var(--ink2)">${st.d}</span>
     <div class="row" style="gap:8px;margin-top:4px"><button class="btn sec sm" style="flex:1" data-act="tourskip">${last?'بستن':'رد کردن'}</button>${last?'':`<button class="btn pri sm" style="flex:1" data-act="tournext">بعدی</button>`}</div>`;
    tip.querySelector('.btn.pri,.btn')?.focus({preventScroll:true});},inView()?0:380);}
function placeTour(){if(!TOUR)return;const st=TOUR.steps[TOUR.i];const r=st.el.getBoundingClientRect(),a=app.getBoundingClientRect();const pad=6;
  const spot=app.querySelector('.tour-spot'),tip=app.querySelector('.tour-tip');
  Object.assign(spot.style,{top:(r.top-a.top-pad)+'px',left:(r.left-a.left-pad)+'px',width:(r.width+pad*2)+'px',height:(r.height+pad*2)+'px'});
  const tw=Math.min(320,a.width-32);tip.style.width=tw+'px';
  let left=r.left-a.left+r.width/2-tw/2;left=Math.max(16,Math.min(a.width-tw-16,left));
  const below=a.height-(r.bottom-a.top);const th=tip.offsetHeight||170;
  const top=below>th+28?(r.bottom-a.top+14):Math.max(16,r.top-a.top-th-14);
  Object.assign(tip.style,{left:left+'px',top:top+'px'});}
function endTour(){TOUR=null;document.getElementById('tour')?.remove();}
addEventListener('resize',()=>{if(TOUR)placeTour();});

/* ============ MODE ============ */
function setMode(m){S.mode=m;document.body.dataset.mode=m;store.set(MODE_KEY,m);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content',m==='dark'?'#0F0E0C':'#F3F0EA');
  document.querySelectorAll('#panel-seg button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));}

/* ============ ACTIONS ============ */
const ACT={};Object.assign(ACT,ACTM,CACT);Object.assign(ACT,{
 back,close:()=>closeSheet(),toast:v=>toast(v),
 cf:v=>{S.catFilter=v;redraw();},
 pg:v=>{S.provGender=v;refreshSheet();},ps:v=>{S.provSort=v;refreshSheet();},papply:()=>{closeSheet();redraw();},pclear:()=>{S.provGender='all';S.provSort='rate';redraw();},
 day:v=>{S.book.day=+v;S.book.slot=null;redraw();},slot:v=>{S.book.slot=+v;redraw();},step:v=>{S.book.step=+v;render('enter');},
 bpay:v=>{S.book.pay=v;redraw();},remind:()=>{S.book.remind=!S.book.remind;redraw();},confirm:v=>confirmBooking(v),
 rtype:v=>{const d=document.getElementById('r-d')?.value;S.reqType=+v;redraw();if(d)document.getElementById('r-d').value=d;},
 rtime:v=>{const d=document.getElementById('r-d')?.value;S.reqTime=+v;redraw();if(d)document.getElementById('r-d').value=d;},
 submitreq:v=>submitRequest(v),
 ccat:v=>{S.cafeCat=+v;redraw();},serve:v=>{S.cafeServe=+v;redraw();},
 qty:(k,d)=>{S.cart[k]=Math.max(0,(S.cart[k]||0)+(+d));redraw();},
 order:k=>placeOrder(k),clearcart:()=>{S.cart={};closeSheet();redraw();},
 atab:v=>{S.actTab=v;redraw();},ftab:v=>{S.finTab=v;redraw();},period:v=>{S.period=+v;redraw();},
 txcat:v=>{S.txCat=v;closeSheet();redraw();},
 bmonth:v=>{S.bMonth=+v;closeSheet();redraw();},
 docancel:async id=>{const a=ST.acts.find(x=>x.id===id);const btn=document.querySelector('[data-act^="docancel"]');busy(btn,true,'در حال لغو…');
   const {data,error}=await SB.rpc('cancel_booking',{p_id:a.rid});if(error){busy(btn,false);toast(dbError(error));return;}
   await refresh();closeSheet();redraw();toast(data&&data.refunded?`رزرو لغو شد · ${fa(data.refunded)} تومان برگشت`:'رزرو لغو شد');},
 pmode:v=>{S.pay.mode=v;refreshSheet();},pmethod:v=>{S.pay.method=v;clearPhotos();refreshSheet();},
 dopay:async()=>{const due=Math.max(0,-ST.bal);let amt=S.pay.mode==='full'&&due?due:+enDigits((document.getElementById('p-a')?.value||'').replace(/[٬,\s]/g,''));const btn=document.querySelector('[data-act="dopay"]');
   if(!amt||amt<10000){const e=document.getElementById('p-err');if(e)e.innerHTML=I('info','xs')+'مبلغ را وارد کنید (حداقل ۱۰٬۰۰۰ تومان).';return;}
   if(S.pay.method==='c2c'){if(!S.photoFiles.length){toast('عکس رسید را اضافه کنید');return;}busy(btn,true,'در حال ارسال…');
     const paths=await uploadFiles(ST.unit,S.photoFiles);if(!paths.length){busy(btn,false);toast('عکس بارگذاری نشد. دوباره امتحان کنید.');return;}
     const {error}=await SB.from('requests').insert({unit_code:ST.unit,kind:'message',type:'رسید کارت به کارت',description:`مبلغ ${fa(amt)} تومان`,photos:paths});
     if(error){busy(btn,false);toast(dbError(error));return;}clearPhotos();await refresh();closeSheet();redraw();toast('رسید ارسال شد');return;}
   busy(btn,true);closeSheet(true);
   await gateway(amt,async()=>{const {error}=await SB.rpc('make_payment',{p_unit:ST.unit,p_amount:amt});if(error){toast(dbError(error));return false;}await refresh();S.pay={mode:'full',method:'gw'};redraw();});},
 unit:async u=>{if(u===ST.unit){closeSheet();return;}try{const keep={seen:ST.seen,rated:ST.rated,onboarded:ST.onboarded,autoReport:ST.autoReport,email:ST.email};ST=Object.assign(await loadState(u),keep);}catch(e){toast(dbError(e));return;}S.cart={};chatReset();subscribe();go('home',{root:true});toast('واحد '+faDigits(u));},
 saveemail:()=>{const v=document.getElementById('e-m').value.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){document.getElementById('e-err').innerHTML=I('info','xs')+'آدرس ایمیل درست نیست. مثال: name@example.com';return;}ST.email=v;save();closeSheet();redraw();toast('ایمیل ذخیره شد');},
 sendrpt:()=>{closeSheet();toast('گزارش به '+ST.email+' فرستاده شد');},
 savepw:async()=>{const [a,b,c]=[0,1,2].map(i=>cleanPw(document.getElementById('pw'+i).value));const e=document.getElementById('pw-err'),btn=document.querySelector('[data-act="savepw"]');
   if(!a){e.innerHTML=I('info','xs')+'رمز فعلی را وارد کنید.';return;}if(b.length<6){e.innerHTML=I('info','xs')+'رمز جدید باید حداقل ۶ کاراکتر باشد.';return;}if(b!==c){e.innerHTML=I('info','xs')+'تکرار رمز با رمز جدید یکی نیست.';return;}
   busy(btn,true,'در حال ذخیره…');
   const chk=await SB.auth.signInWithPassword({email:emailFor(ST.login),password:a});if(chk.error){busy(btn,false);e.innerHTML=I('info','xs')+'رمز فعلی درست نیست.';return;}
   const up=await SB.auth.updateUser({password:b});busy(btn,false);if(up.error){e.innerHTML=I('info','xs')+dbError(up.error);return;}closeSheet();toast('رمز عبور تغییر کرد');},
 mtype:v=>{const t=document.getElementById('mm').value;S.msgType=+v;refreshSheet();document.getElementById('mm').value=t;},
 sendmsg:async()=>{const t=document.getElementById('mm').value.trim(),btn=document.querySelector('[data-act="sendmsg"]');if(t.length<5){document.getElementById('mm-err').innerHTML=I('info','xs')+'پیام را کامل‌تر بنویسید.';return;}
   busy(btn,true,'در حال ارسال…');const paths=S.photoFiles.length?await uploadFiles(ST.unit,S.photoFiles):[];
   const {error}=await SB.from('requests').insert({unit_code:ST.unit,kind:'message',type:['مشکل','شکایت','پیشنهاد'][S.msgType],description:t,photos:paths});
   if(error){busy(btn,false);toast(dbError(error));return;}clearPhotos();await refresh();closeSheet();redraw();toast('پیام ارسال شد · در فعالیت‌ها قابل پیگیری است');},
 star:v=>{S.rate.stars=+v;const b=overlay.querySelector('.sheet-b');b.innerHTML=rateBody();},
 rtag:v=>{const i=+v,t=S.rate.tags;S.rate.tags=t.includes(i)?t.filter(x=>x!==i):[...t,i];overlay.querySelector('.sheet-b').innerHTML=rateBody();},
 saverate:()=>{ST.rated[S.rate.key]=S.rate.stars;save();closeSheet();toast('ممنون، امتیاز شما ثبت شد');},
 week:d=>{S.week=Math.min(2,Math.max(0,S.week+(+d)));redraw();},
 ropt:v=>{S.rptOpt[+v]=!S.rptOpt[+v];if(!S.rptOpt.some(Boolean))S.rptOpt[+v]=true;redraw();},
 auto:()=>{ST.autoReport=ST.autoReport===false;save();redraw();toast(ST.autoReport?'ارسال خودکار فعال شد':'ارسال خودکار خاموش شد');},
 mode:v=>{setMode(v);redraw();},
 onbnext:()=>{if(onbI<ONB.length-1){onbI++;drawOnb();}else finishOnb();},
 onbstart:()=>showSlides(),
 onbskipall:()=>skipAll(),
 onbskip:()=>skipAll(),
 tournext:()=>{TOUR.i++;tourStep();},
 tourskip:()=>{const last=TOUR&&TOUR.i===TOUR.steps.length-1;if(last)endTour();else skipAll();},
 replaytour:()=>{ST.onboarded=false;ST.seen={};save();go('home',{root:true});showSlides();},
 togglemode:()=>{setMode(S.mode==='dark'?'light':'dark');redraw();},
 bcal:()=>{S.book.cal=!S.book.cal;redraw();},
 cal:id=>{const a=ST.acts.find(x=>x.id===id);if(!a||!a.starts)return;const st=new Date(a.starts),en=new Date(st.getTime()+(a.dur||60)*60000);
   const f=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
   const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Afarinesh//Resident App//FA','BEGIN:VEVENT','UID:'+a.code+'@afarinesh','DTSTAMP:'+f(new Date()),'DTSTART:'+f(st),'DTEND:'+f(en),'SUMMARY:'+a.t,'LOCATION:برج '+TOWER+' · '+a.who,'DESCRIPTION:کد پیگیری '+a.code,'BEGIN:VALARM','TRIGGER:-PT1H','ACTION:DISPLAY','DESCRIPTION:'+a.t,'END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
   const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));const l=document.createElement('a');l.href=url;l.download='afarinesh-'+a.code+'.ics';document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('فایل تقویم آماده شد');},
 logout:async()=>{unsubscribe();mUnsub();chatReset();await SB.auth.signOut();ST=null;MG=null;S.cart={};S.book=null;go('login',{root:true});},
 consent:(_,__,el)=>{S.consent=!S.consent;el.setAttribute('aria-checked',S.consent);},
 peek:()=>{const i=document.getElementById('l-p');i.type=i.type==='password'?'text':'password';},
});

/* ============ EVENTS ============ */
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act],[data-go],[data-sheet],[data-tab],[data-tabgo],[data-tip],[data-copy]');if(!el)return;
  if(el.dataset.tip){const [l,v]=el.dataset.tip.split('|');const card=el.closest('.card');const ro=card&&card.querySelector('[data-readout]');
    if(ro)ro.innerHTML=`<span class="m">${l}</span><b class="num">${v}</b>`;
    el.closest('svg').querySelectorAll('.pt').forEach(p=>{p.classList.remove('on');p.setAttribute('r',3)});const pt=el.querySelector('.pt');if(pt){pt.classList.add('on');pt.setAttribute('r',5);}return;}
  if(el.dataset.copy){const v=el.dataset.copy;try{navigator.clipboard.writeText(v).then(()=>toast('کپی شد'),()=>toast(v));}catch(err){toast(v);}return;}
  if(el.dataset.tab){go(el.dataset.tab,{root:true});return;}
  if(el.dataset.tabgo){go(el.dataset.tabgo,{root:true});return;}
  if(el.dataset.go){const g=el.dataset.go;if(g.startsWith('booking')){S.book=freshBook();loadSlots(g.split(':')[1]).catch(()=>{}).then(()=>go(g));return;}if(g.startsWith('cafe'))S.cafeCat=0;if(g.startsWith('request')){S.reqType=0;clearPhotos();}if(g.startsWith('provider')){S.provGender='all';S.provSort='rate';}const ck=g.split(':')[1];if(/^(provider|cafe|request):/.test(g)&&ST)bump(ck,1);go(g);return;}
  if(el.dataset.sheet){e.preventDefault();if(['message','pay'].includes(el.dataset.sheet))clearPhotos();openSheet(el.dataset.sheet);return;}
  if(!el.dataset.act)return;const [a,v,w]=el.dataset.act.split(':');ACT[a]&&ACT[a](v,w,el);
});
document.addEventListener('change',e=>{const inp=e.target.closest('[data-photo]');if(!inp)return;
  [...inp.files].slice(0,4).forEach(f=>{S.photoFiles.push(f);const r=new FileReader();r.onload=()=>{S.photos.push(r.result);const th=document.getElementById('thumbs');if(th)th.insertAdjacentHTML('afterbegin',`<img src="${r.result}" alt="عکس پیوست">`);};r.readAsDataURL(f);});});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(TOUR)endTour(true);else if(sheetOpen)closeSheet();}});

/* ============ BOOT ============ */
setMode(store.get(MODE_KEY)||'light');
(async()=>{
  if(!SB){S.stack=['login'];render('');toast('اتصال به سرور برقرار نشد');return;}
  S.stack=['loading'];render('');
  const {data:{session}}=await SB.auth.getSession();
  if(!session){S.stack=['login'];render('');return;}
  await enter();
})();

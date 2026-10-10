/* Afarinesh resident app — shared data, state, charts and report renderer.
   Used by index.html (the app) and report.html (the printable PDF report).
   All people, phone numbers and amounts here are sample data. */

/* ============ ICONS ============ */
const P={
 home:'<path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2V14.5H9.2v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
 grid:'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
 pulse:'<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
 chart:'<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5"/>',
 bell:'<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
 chevL:'<path d="m14.5 18-6-6 6-6"/>',
 chevR:'<path d="m9.5 18 6-6-6-6"/>',
 chevD:'<path d="m6 9.5 6 6 6-6"/>',
 back:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 sparkle:'<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9z"/><path d="M19 16.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z"/>',
 wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a6 6 0 0 1-7.9 7.9l-6.5 6.5a2.1 2.1 0 0 1-3-3l6.5-6.5a6 6 0 0 1 7.9-7.9z"/>',
 bolt:'<path d="M13 2.5 4.5 13.5h7l-1 8 8.5-11h-7z"/>',
 lotus:'<path d="M12 20.5c-4.8 0-8.5-2.8-8.5-6.5 3 0 6 1.2 8.5 4 2.5-2.8 5.5-4 8.5-4 0 3.7-3.7 6.5-8.5 6.5z"/><path d="M12 18c-1.9-2-3-4.6-3-7.5 0-2.8 1.3-5.2 3-7 1.7 1.8 3 4.2 3 7 0 2.9-1.1 5.5-3 7.5z"/>',
 dumbbell:'<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
 building:'<path d="M4 20.5V5.5l8-2.5 8 2.5v15M9 8.5h1M14 8.5h1M9 12.5h1M14 12.5h1M10 20.5v-4h4v4M2.5 20.5h19"/>',
 coffee:'<path d="M4 8.5h13v4.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17M7.5 2.5v3M11 2.5v3M14.5 2.5v3"/>',
 utensils:'<path d="M7 2.5v19M4 2.5V8a3 3 0 0 0 6 0V2.5M17.5 21.5v-19c-2.2 1.6-3.5 4.6-3.5 8.5h3.5"/>',
 car:'<path d="M5 16.5h14v-4.5l-2-5H7l-2 5z"/><path d="M5 12h14M7.5 16.5v2.5M16.5 16.5v2.5"/>',
 key:'<circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 9.3-9.3M17 6l3 3M14.5 8.5l2 2"/>',
 file:'<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
 download:'<path d="M12 3.5v11.5M7 10.5l5 5 5-5M4.5 20.5h15"/>',
 mail:'<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
 phone:'<path d="M5.5 3.5h3.2l1.8 4.6-2.3 1.4a11 11 0 0 0 6.3 6.3l1.4-2.3 4.6 1.8v3.2a2 2 0 0 1-2 2A16 16 0 0 1 3.5 5.5a2 2 0 0 1 2-2z"/>',
 star:'<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
 check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
 cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 minus:'<path d="M5 12h14"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>',
 msg:'<path d="M4 5.5h16v11H9l-5 4z"/>',
 card:'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
 wallet:'<path d="M4 7.5h15.5a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 4h12v3.5"/><circle cx="16.5" cy="13.8" r="1.2"/>',
 receipt:'<path d="M5.5 3h13v18l-2.6-1.7-2.2 1.7-2.2-1.7-2.2 1.7-2.2-1.7L5.5 21z"/><path d="M9 8h6M9 12h6"/>',
 pin:'<path d="M12 21s-6.5-6-6.5-11.5a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/>',
 camera:'<path d="M4 8h3l2-2.5h6L17 8h3v11.5H4z"/><circle cx="12" cy="13.5" r="3.3"/>',
 filter:'<path d="M4 6.5h10M18 6.5h2M4 12h3M11 12h9M4 17.5h12"/><circle cx="16" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17.5" r="2"/>',
 info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
 lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
 book:'<path d="M4 4.5h6a3 3 0 0 1 2 .8 3 3 0 0 1 2-.8h6v14h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4z"/><path d="M12 5.3v15"/>',
 logout:'<path d="M10 4.5H5.5v15H10M14 8l4 4-4 4M18 12H9"/>',
 arrowUp:'<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
 arrowDown:'<path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
 send:'<path d="M20.5 3.5 3.5 10.5l7 3 3 7z"/><path d="m10.5 13.5 4-4"/>',
 eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
 megaphone:'<path d="M4 10v4h3l7 4.5v-13L7 10z"/><path d="M17.5 9a4 4 0 0 1 0 6"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
 moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 3.5V8h4.5M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20.5V16h-4.5"/>',
};
const I=(n,c='')=>`<svg class="ico ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n]||''}</svg>`;

/* ============ FORMAT ============ */
const fa=(n,d=0)=>Number(n).toLocaleString('fa-IR',{maximumFractionDigits:d,minimumFractionDigits:0});
const T=n=>fa(Math.abs(Math.round(n)));
const mil=(n,d=1)=>fa(Math.abs(n)/1e6,d);
const faDigits=s=>String(s).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const enDigits=s=>String(s).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ============ ART (inline SVG) ============ */
let artId=0;
function tower(){const id='a'+(++artId);let b='';
  for(let i=1;i<20;i++){const t=i/20;b+=`<line x1="${60+50*t}" y1="${260-190*t}" x2="200" y2="${260-230*t}"/><line x1="200" y1="${260-230*t}" x2="${340-50*t}" y2="${260-190*t}"/>`;}
  return `<svg class="art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--art-sky1)"/><stop offset="1" stop-color="var(--art-sky2)"/></linearGradient><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--gold)" stop-opacity=".9"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs><rect width="400" height="260" fill="url(#${id}s)"/><polygon points="60,260 200,260 200,30 110,70" fill="var(--art-l)"/><polygon points="200,260 340,260 290,70 200,30" fill="var(--art-r)"/><g stroke="var(--art-line)">${b}</g><line x1="200" y1="30" x2="200" y2="260" stroke="url(#${id}g)" stroke-width="1.5"/></svg>`;}
function pool(){const id='a'+(++artId);let w='';for(let i=0;i<9;i++){w+=`<path d="M-10 ${60+i*24} q 25 -8 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0"/>`;}
  return `<svg class="art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--art-sky2)"/><stop offset="1" stop-color="var(--art-sky1)"/></linearGradient></defs><rect width="400" height="260" fill="url(#${id})"/><g fill="none" stroke="var(--art-line)" stroke-width="1.2">${w}</g><g stroke="var(--gold)" stroke-opacity=".55" stroke-width="1.2" fill="none"><path d="M300 0v120a14 14 0 0 0 28 0M330 0v100M300 40h30M300 75h30"/></g></svg>`;}
function arches(){let a='';for(let i=0;i<5;i++){const x=20+i*76;a+=`<path d="M${x} 260V120a33 33 0 0 1 66 0v140"/>`;}
  return `<svg class="art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="260" fill="var(--art-sky1)"/><g fill="var(--art-r)" stroke="var(--art-line)">${a}</g><path d="M0 100h400" stroke="var(--gold)" stroke-opacity=".5"/></svg>`;}
function court(){return `<svg class="art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="260" fill="var(--art-r)"/><g stroke="var(--art-line)" stroke-width="1.5" fill="none"><path d="M40 30h320v200H40zM40 150h320M200 150v80M40 190h80v40M280 190h80v40"/></g><path d="M40 70h320" stroke="var(--gold)" stroke-opacity=".6" stroke-width="1.5"/></svg>`;}
function cup(){return `<svg class="art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="260" fill="var(--art-sky1)"/><circle cx="200" cy="140" r="80" fill="var(--art-r)" stroke="var(--art-line)"/><circle cx="200" cy="140" r="52" fill="none" stroke="var(--gold)" stroke-opacity=".6"/></svg>`;}
const ART={tower,pool,arches,court,cup};

/* ============ STATIC DATA ============ */
const TOWER='آفرینش سبز';
const USERS={
 '1204':{pass:'1234',name:'علی',full:'علی بنده‌زاده',role:'مالک · ۱۰ سهم',shares:10,email:'ali@example.com',units:['1204','1408']},
 '1408':{pass:'1234',name:'علی',full:'علی بنده‌زاده',role:'مالک · ۸ سهم',shares:8,email:'ali@example.com',units:['1204','1408']},
 '407':{pass:'4321',name:'سارا',full:'سارا مهرپور',role:'مستاجر · ۶ سهم',shares:6,email:'sara@example.com',units:['407']},
};
const CATS={
 hk:{t:'خانه‌داری',ic:'sparkle',sub:'نظافت کامل واحد',from:'از ۶۲۰ هزار',n:'۲ متخصص',f:['today','popular']},
 spa:{t:'اسپا و زیبایی',ic:'lotus',sub:'ماساژ، مو، ناخن',from:'از ۶۵۰ هزار',n:'۴ متخصص',f:['today','popular','women','men']},
 classes:{t:'کلاس‌ها',ic:'dumbbell',sub:'یوگا، شنا، بدنسازی، پیانو',from:'دوره‌ای',n:'۴ دوره',f:['popular','women','men']},
 spaces:{t:'رزرو فضاها',ic:'building',sub:'استخر، تالار، اسکواش',from:'ساعتی',n:'۴ فضا',f:['today','popular','women','men']},
 tech:{t:'خدمات فنی',ic:'wrench',sub:'برق، مکانیک، تعمیرات',from:'ساعتی ۲۵۰ هزار',n:'پاسخ ۲۴ ساعته',f:['today']},
 carwash:{t:'کارواش',ic:'car',sub:'در پارکینگ شما',from:'از ۳۵۰ هزار',n:'۳ نوع خودرو',f:['today']},
 cafe:{t:'کافی‌شاپ',ic:'coffee',sub:'سرو یا تحویل در واحد',from:'باز تا ۲۳:۰۰',n:'۱۳ آیتم',f:['today','popular']},
 kitchen:{t:'آشپزخانه',ic:'utensils',sub:'هفتگی، مهمانی، مراسم',from:'از ۳۹۰ هزار',n:'منوی هفته',f:['popular']},
 rent:{t:'اجاره و فروش',ic:'key',sub:'واحد و پارکینگ',from:'مشاوره رایگان',n:'۶ نوع درخواست',f:[]},
};
const CAT_FILTERS=[['all','همه'],['today','آزاد امروز'],['popular','پرطرفدار'],['women','بانوان'],['men','آقایان']];
const PROV={
 spa:[
  {id:'spa-1',n:'نگار صادقی',r:'خدمات ناخن',ic:'lotus',rate:4.9,cnt:212,tags:['بانوان'],gold:'ویژه',price:650000,next:'فردا ۱۷:۳۰',dur:60,place:'طبقه منفی ۱ · اسپا'},
  {id:'spa-2',n:'طیبه احمدی',r:'حمام‌کار · کیسه و ماسک',ic:'lotus',rate:4.8,cnt:168,tags:['بانوان','آقایان'],price:850000,next:'فردا ۰۹:۰۰',dur:60,place:'طبقه منفی ۱ · اسپا'},
  {id:'spa-3',n:'مریم حسینی',r:'خدمات موی بانوان',ic:'lotus',rate:4.7,cnt:301,tags:['بانوان'],price:1200000,next:'سه‌شنبه ۱۱:۰۰',dur:90,place:'طبقه منفی ۱ · سالن زیبایی'},
  {id:'spa-4',n:'کاوه نوری',r:'ماساژ ریلکسی',ic:'lotus',rate:4.9,cnt:96,tags:['آقایان'],price:1450000,next:'فردا ۲۰:۰۰',dur:60,place:'طبقه منفی ۱ · مجموعه ماساژ'},
 ],
 classes:[
  {id:'cl-1',n:'یوگا · الناز کریمی',r:'۸ جلسه · شنبه و دوشنبه ۱۷:۰۰',ic:'dumbbell',rate:4.9,cnt:84,tags:['بانوان','گروهی'],gold:'۳ جای خالی',price:4500000,next:'شروع ۲۵ مهر',dur:60,place:'سالن ایروبیک'},
  {id:'cl-2',n:'شنا و آب‌درمانی · سارا فرهمند',r:'۱۲ جلسه · استخر',ic:'dumbbell',rate:4.8,cnt:61,tags:['بانوان'],price:6200000,next:'شروع ۲۷ مهر',dur:60,place:'استخر'},
  {id:'cl-3',n:'بدنسازی خصوصی · پویا شریفی',r:'۸ جلسه تک‌نفره',ic:'dumbbell',rate:5.0,cnt:40,tags:['آقایان'],gold:'ویژه',price:6600000,next:'۲ جای خالی',dur:60,place:'باشگاه'},
  {id:'cl-4',n:'پیانو · آنا بیگلری',r:'۴ جلسه · سالن موسیقی',ic:'dumbbell',rate:4.9,cnt:22,tags:['کودک و بزرگسال'],price:3800000,next:'شروع ۲۰ مهر',dur:60,place:'سالن موسیقی'},
 ],
 hk:[
  {id:'hk-1',n:'رضا امینی',r:'نظافت کامل واحد · ۵ ساعت',ic:'sparkle',rate:4.8,cnt:430,tags:['ظرفیت ۱ واحد'],gold:'ویژه',price:950000,next:'یکشنبه ۰۸:۰۰',dur:300,place:'واحد شما'},
  {id:'hk-2',n:'تیم خانه‌داری',r:'نظافت سبک · ۳ ساعت',ic:'sparkle',rate:4.6,cnt:212,tags:['ظرفیت ۲ واحد'],price:620000,next:'فردا ۱۴:۰۰',dur:180,place:'واحد شما'},
 ],
 spaces:[
  {id:'sp-1',n:'استخر',r:'سانس ۹۰ دقیقه‌ای',art:'pool',ic:'building',rate:4.9,cnt:1240,tags:['آقایان','بانوان','خانوادگی'],price:0,next:'فردا ۱۸:۰۰',dur:90,place:'طبقه منفی ۲'},
  {id:'sp-2',n:'تالار پذیرایی',r:'تا ۸۰ مهمان · با تشریفات',art:'arches',ic:'building',rate:4.8,cnt:58,tags:['مراسم'],gold:'ویژه',price:18000000,next:'پنجشنبه',dur:240,place:'طبقه همکف'},
  {id:'sp-3',n:'اسکواش',r:'سانس ۶۰ دقیقه‌ای',art:'court',ic:'building',rate:4.7,cnt:390,tags:['عمومی'],price:0,next:'فردا ۲۱:۰۰',dur:60,place:'طبقه منفی ۲'},
  {id:'sp-4',n:'کافی‌شاپ · رزرو میز',r:'تا ۱۲ نفر',art:'cup',ic:'coffee',rate:4.8,cnt:211,tags:['دورهمی'],price:0,next:'فردا ۱۹:۳۰',dur:120,place:'لابی'},
 ],
};
const ALLPROV=Object.values(PROV).flat();
const DAYS=[['ش','۱۸'],['ی','۱۹'],['د','۲۰'],['س','۲۱'],['چ','۲۲'],['پ','۲۳'],['ج','۲۴']];
const DAYFULL=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
const SLOTS=['۰۹:۰۰','۰۹:۳۰','۱۰:۰۰','۱۰:۳۰','۱۱:۰۰','۱۴:۰۰','۱۵:۰۰','۱۶:۰۰','۱۷:۳۰'];
const slotOpen=(day,i,pid)=>((i*7+day*3+(pid||'').length)%5)!==1;
const REQ={
 tech:{t:'درخواست خدمات فنی',types:['برق','مکانیک','تعمیرات','اسباب‌کشی'],ic:['bolt','wrench','wrench','building'],info:'تکنسین ساده ساعتی ۲۵۰ هزار تومان، استادکار ساعتی ۴۰۰ هزار تومان. انجام کار ظرف ۲۴ ساعت.',who:'تاسیسات ساختمان'},
 rent:{t:'اجاره و فروش',types:['اجاره دادن واحد','اجاره کردن واحد','فروش واحد','خرید واحد','فروش پارکینگ','اجاره پارکینگ'],ic:['key','key','key','key','car','car'],info:'کارشناس املاک ساختمان تا ۴۸ ساعت با شما تماس می‌گیرد. مشاوره رایگان است.',who:'دفتر املاک ساختمان'},
};
const MENU={
 cafe:{t:'کافی‌شاپ',sub:'باز تا ۲۳:۰۰',cats:['نوشیدنی گرم','نوشیدنی سرد','غذای اصلی','دمنوش','کیک و دسر'],items:[
   [['لاته با سیروپ','وانیل، نارگیل، فندق یا شکلات',216000],['لاته دارچین و عسل','شیر تازه، عسل طبیعی',236000],['کاپوچینو','دبل شات',198000],['اسپرسو','تک یا دبل',145000]],
   [['آیس لاته','',224000],['لیموناد نعنا','',185000],['میلک‌شیک شکلات','',260000]],
   [['پاستا آلفردو با مرغ','۱۰۰ گرم پاستا، فیله مرغ گریل، قارچ، پارمزان',460000],['پاستا آلفردو','بدون مرغ',400000],['کلاب ساندویچ','مرغ، بیکن بوقلمون، سیب‌زمینی',420000]],
   [['دمنوش آرامش','بابونه و اسطوخودوس',150000]],[['چیزکیک','',210000],['کیک شکلات','',190000]]]},
 kitchen:{t:'آشپزخانه',sub:'سفارش تا ۱۸ روز قبل',cats:['منوی هفته','مهمانی و مراسم','غذای مازاد امروز'],items:[
   [['زرشک‌پلو با مرغ','یکشنبه ۱۹ مهر · ۵۰ پرس باقی',680000],['فیله مرغ و سبزیجات','یکشنبه ۱۹ مهر',680000],['پلو کباب تابه‌ای','دوشنبه ۲۰ مهر',780000],['کشک بادمجان','دوشنبه ۲۰ مهر',520000],['لازانیا','چهارشنبه ۲۲ مهر · ۴۹ پرس',780000],['قورمه‌سبزی','جمعه ۲۴ مهر',780000]],
   [['ماکارونی','حداکثر ۱۰۰ پرس',480000],['سبزی‌پلو با ماهی','حداکثر ۱۰۰ پرس',680000]],[['قورمه‌سبزی','۸ پرس باقی · تحویل امروز',390000]]]},
 carwash:{t:'کارواش',sub:'در پارکینگ شما',cats:['هاچ‌بک','سواری','شاسی‌بلند'],items:[[['روشویی','',350000],['روشویی و توشویی','',500000]],[['روشویی','',380000],['روشویی و توشویی','',540000]],[['روشویی','',450000],['روشویی و توشویی','',650000]]]},
};
const MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر'];
const MONTHS12=['آبان','آذر','دی','بهمن','اسفند','فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر'];
const SPEND_PREV=[5.1,6.4,4.8,7.9,6.1,6.4];
const SPEND_PREV12=[4.2,5.0,6.8,5.5,8.1,5.1,6.4,4.8,7.9,6.1,6.4];
const BLD={mon:['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور'],inc:[1210,1302,1188,1355,1401,1428],exp:[2840,2910,2780,3102,2985,3061],shares:11460,
  breakdown:[['پرسنل و حقوق',.385,'--c2'],['انرژی و آب',.21,'--c1'],['نگهداری و تعمیرات',.17,'--c3'],['امکانات رفاهی',.14,'--c4'],['سایر',.095,'--c5']]};
const FAC=[
 {n:'تالار پذیرایی',inc:171000000,exp:92000000,note:'اجاره تالار برای ۶ مراسم'},
 {n:'مجموعه ماساژ',inc:84380000,exp:65821000,note:'۲۱۲ نوبت در ماه'},
 {n:'کافی‌شاپ',inc:61200000,exp:48900000,note:'۱٬۸۴۰ سفارش'},
 {n:'باشگاه ورزشی',inc:42000000,exp:46800000,note:'شامل حقوق ۳ مربی'},
 {n:'استخر',inc:87500000,exp:93414000,note:'هزینه گرمایش و تصفیه بالا'},
 {n:'خانه کودک',inc:30875000,exp:62958600,note:'یارانه ساختمان برای خانواده‌ها'},
];
const FAC_MULT=[.86,.93,.88,1.04,.97,1];
const OWN=[
 {t:'بابت اجاره تالار',a:150000000,dt:'۱۴ مهر',code:'74302',d:'درآمد اجاره تالار پذیرایی برای مراسم واحد ۹۰۲'},
 {t:'اجرت نصب تجهیزات',a:50000000,dt:'۱۴ مهر',code:'74300',d:'دریافت از پیمانکار بابت اجاره فضا برای نصب تجهیزات'},
 {t:'سوخت موتورخانه',a:-137000000,dt:'۲ مهر',code:'73306',d:'خرید گازوئیل ذخیره موتورخانه برای فصل سرما'},
 {t:'مینی‌بوس سرویس',a:-128750000,dt:'۱ مهر',code:'73915',d:'قسط مینی‌بوس سرویس ساکنین'},
 {t:'تابلو برق لابی',a:-15300000,dt:'۱۵ شهریور',code:'71631',d:'تعویض تابلو برق لابی و روشنایی'},
 {t:'نورپردازی نما',a:-14000000,dt:'۱۴ شهریور',code:'71381',d:'تعمیر چراغ‌های نورپردازی نمای شمالی'},
 {t:'بابت اجاره تالار',a:150000000,dt:'۳۰ مرداد',code:'70347',d:'درآمد اجاره تالار پذیرایی'},
];
const OWN_TREND=[410,398,452,431,389,402,362];
const STAFF=[['م','مهدی رضایی','تاسیسات'],['ط','طیبه احمدی','اسپا'],['ل','الناز کریمی','مربی یوگا'],['ح','حمید محمدی','کافی‌شاپ'],['ر','رضا امینی','خانه‌داری'],['ص','صحرا صابری','بازرسی و اداری']];
const CONTACTS=[['دفتر ساختمان','021-22000101'],['لابی','021-22000102'],['مجموعه ورزشی','021-22000103']];
const BUILDING_CARD={no:'6037-0000-0000-1204',iban:'IR00 0000 0000 0000 0000 0000 00',bank:'بانک نمونه',owner:'صندوق ساختمان آفرینش سبز'};
const RULES=[
 ['تعاریف','ساکنین: مالک یا مستاجر و افراد خانواده که به‌طور دائم در واحد سکونت دارند. مهمان: کسی که با دعوت ساکنین وارد ساختمان می‌شود. پرسنل: افرادی که مدیریت ساختمان برای رسیدگی به امور استخدام کرده است.'],
 ['مشاعات و پارکینگ','لابی، راهروها، آسانسورها و پارکینگ مشاع هستند. پارک خودرو فقط در جایگاه اختصاصی مجاز است. نگهداری وسایل شخصی در مشاعات ممنوع است.'],
 ['مهمانان و مراجعین','ورود مهمان با اطلاع لابی انجام می‌شود. مراجعین خدماتی باید ساعت ورود و خروج خود را در لابی ثبت کنند.'],
 ['امکانات رفاهی','استفاده از استخر، باشگاه، اسپا و تالار فقط با رزرو از طریق برنامه ممکن است. لغو رایگان تا ۲۴ ساعت قبل از نوبت انجام می‌شود.'],
 ['حیوانات خانگی','تردد حیوانات خانگی فقط از آسانسور خدماتی و با قلاده مجاز است.'],
 ['تعمیرات و اسباب‌کشی','تعمیرات پرسروصدا فقط از شنبه تا چهارشنبه، ساعت ۹ تا ۱۷ مجاز است. اسباب‌کشی باید از طریق برنامه رزرو شود.'],
];
const WEEKS=[
 {k:0,label:'۴ تا ۱۰ مهر ۱۴۰۵',spend:3200000,days:[0.4,1.1,0.3,0,0.9,0.5,0],res:2,req:1,open:-21300000,paid:0,usage:[['استخر',4.5],['باشگاه',3],['اسپا',0],['تالار',0]]},
 {k:1,label:'۱۱ تا ۱۷ مهر ۱۴۰۵',spend:5900000,days:[0.3,0.2,0.6,0.4,4.3,0.1,0],res:3,req:1,open:-24500000,paid:12000000,usage:[['استخر',3],['باشگاه',4],['اسپا',1],['تالار',4]]},
 {k:2,label:'۱۸ تا ۲۴ مهر ۱۴۰۵',live:true},
];

/* ============ STATE ============ */
const SESSION_KEY='afr-session', MODE_KEY='afr-mode';
const store={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};

function defaultState(unit){
  const big=unit==='1204';
  const acts=[
   {id:'a1',k:'req',st:'live',stt:'در حال انجام',ic:'bolt',t:'تاسیسات برق',d:'تعویض کلید آشپزخانه',when:'امروز · ۱۶:۴۰',who:'مهدی رضایی · تکنسین',phone:'021-22000101',code:'74318',eta:12,
    tl:[['ثبت درخواست','امروز ۱۴:۰۲','done'],['تایید و ارجاع','امروز ۱۴:۲۰','done'],['تکنسین در راه است','از ۱۶:۴۰','cur'],['پایان کار و ثبت هزینه','','']]},
   {id:'a2',k:'res',st:'ok',stt:'تایید شده',ic:'dumbbell',t:'یوگا · الناز کریمی',d:'جلسه ۳ از ۸',when:'یکشنبه ۱۹ مهر · ۱۷:۰۰',day:'۱۹',mon:'مهر',who:'سالن ایروبیک',code:'74302',price:0,
    tl:[['ثبت‌نام دوره','۱۲ مهر','done'],['جلسه ۳','یکشنبه ۱۷:۰۰','cur'],['جلسه ۴','دوشنبه ۱۷:۰۰','']]},
   {id:'a3',k:'res',st:'ok',stt:'تایید شده',ic:'lotus',t:'حمام‌کار · طیبه احمدی',d:'۶۰ دقیقه',when:'جمعه ۲۴ مهر · ۰۹:۳۰',day:'۲۴',mon:'مهر',who:'طبقه منفی ۱ · اسپا',code:'74306',price:765000,paidBy:'acc',
    tl:[['رزرو و پرداخت','۱۶ مهر','done'],['یادآوری','۱ ساعت قبل','cur'],['انجام خدمت','جمعه ۰۹:۳۰','']]},
   {id:'a4',k:'req',st:'wait',stt:'در انتظار تماس',ic:'key',t:'فروش پارکینگ',d:'اجاره و فروش',when:'۱۵ مهر',who:'دفتر املاک ساختمان',code:'74290',
    tl:[['ثبت درخواست','۱۵ مهر','done'],['تماس کارشناس','تا ۴۸ ساعت','cur'],['بازدید','','']]},
   {id:'a5',k:'ord',st:'done',stt:'تحویل شد',ic:'coffee',t:'کافی‌شاپ · ۳ آیتم',d:'تحویل در واحد',when:'دیروز · ۲۱:۱۰',who:'کافی‌شاپ',code:'74288',
    tl:[['ثبت سفارش','۲۰:۵۲','done'],['آماده‌سازی','۲۱:۰۰','done'],['تحویل در واحد','۲۱:۱۰','done']]},
   {id:'a6',k:'req',st:'done',stt:'رسیدگی شد',ic:'msg',t:'پیام به مدیریت',d:'ساب سنگ طبقه ۱۰',when:'۶ مهر',who:'دفتر ساختمان',code:'74112',
    tl:[['ارسال پیام و عکس','۶ مهر ۱۷:۵۲','done'],['ارجاع به تاسیسات','۷ مهر','done'],['انجام شد','۹ مهر','done']]},
  ];
  const tx=[
   {id:'t1',g:'امروز',t:'یوگا · ۸ جلسه',c:'ورزش و کلاس',a:-4500000,ic:'dumbbell',d:'دوره یوگا با الناز کریمی، ۸ جلسه، شنبه و دوشنبه ۱۷:۰۰ تا ۱۸:۰۰',code:'74302',dt:'۱۸ مهر ۱۴۰۵ · ۱۰:۱۴'},
   {id:'t2',g:'امروز',t:'واریز کارت به کارت',c:'واریز',a:15000000,ic:'card',d:'واریز به حساب ساختمان. رسید توسط امور مالی تایید شد.',code:'74300',dt:'۱۸ مهر ۱۴۰۵ · ۰۹:۰۲'},
   {id:'t3',g:'۱۶ مهر',t:'حمام‌کار · طیبه احمدی',c:'اسپا و زیبایی',a:-765000,ic:'lotus',d:'نوبت جمعه ۲۴ مهر ۰۹:۳۰ با ۱۰٪ تخفیف مالکین',code:'74306',dt:'۱۶ مهر ۱۴۰۵ · ۱۹:۰۵'},
   {id:'t4',g:'۱۶ مهر',t:'سفارش آشپزخانه',c:'غذا و کافه',a:-780000,ic:'utensils',d:'منوی هفته: زرشک‌پلو با مرغ ×۱، سرو ۱۹ مهر',code:'74296',dt:'۱۶ مهر ۱۴۰۵ · ۱۳:۴۰'},
   {id:'t5',g:'۱۶ مهر',t:'تخفیف ۱۰٪ رزرو',c:'تخفیف',a:400000,ic:'sparkle',d:'۱۰٪ تخفیف رزرو تالار پذیرایی برای مالکین',code:'74294',dt:'۱۶ مهر ۱۴۰۵ · ۱۳:۲۲'},
   {id:'t6',g:'۱۶ مهر',t:'تالار پذیرایی',c:'رزرو فضا',a:-4000000,ic:'building',d:'رزرو تالار پذیرایی برای ۴۰ نفر با دو مهماندار، پنجشنبه ۲۳ مهر',code:'74293',dt:'۱۶ مهر ۱۴۰۵ · ۱۳:۲۰'},
   {id:'t7',g:'۱ مهر',t:'شارژ ماهانه مهر',c:'شارژ ساختمان',a:-1425018,ic:'building',d:'سهم واحد از هزینه‌های جاری شهریور: ۱۰ سهم × ۱۴۲٬۵۰۲ تومان',code:'73915',dt:'۱ مهر ۱۴۰۵ · ۰۰:۰۰'},
  ];
  const s={unit,bal:big?-12634541:unit==='407'?-2140000:3850000,
    acts:big?acts:acts.filter(a=>['a2','a5','a6'].includes(a.id)),
    tx:big?tx:tx.filter(t=>['t2','t7'].includes(t.id)),
    notifs:big?[{ic:'bolt',t:'تکنسین برق در راه است',d:'حدود ۱۲ دقیقه دیگر می‌رسد',w:'الان'},{ic:'file',t:'گزارش هفتگی آماده است',d:'۱۸ تا ۲۴ مهر',w:'۰۸:۰۰'},{ic:'megaphone',t:'شستشوی مخزن آب',d:'پنجشنبه ۲۳ مهر، ۹ تا ۱۲',w:'دیروز'}]:[{ic:'megaphone',t:'شستشوی مخزن آب',d:'پنجشنبه ۲۳ مهر، ۹ تا ۱۲',w:'دیروز'}],
    unread:true,seq:74322,rated:{},email:USERS[unit].email};
  if(!big){s.tx=s.tx.map(t=>t.id==='t7'?{...t,a:-Math.round(142502*USERS[unit].shares),d:`سهم واحد از هزینه‌های جاری شهریور: ${fa(USERS[unit].shares)} سهم × ۱۴۲٬۵۰۲ تومان`}:t);}
  return s;
}
function loadState(unit){return store.get('afr-state-'+unit)||defaultState(unit);}
function saveState(s){store.set('afr-state-'+s.unit,s);}

/* derived numbers */
function monthDebits(s){return s.tx.filter(t=>t.a<0&&t.c!=='واریز').reduce((a,t)=>a+Math.abs(t.a),0);}
function breakdown(s){const m={};s.tx.filter(t=>t.a<0).forEach(t=>{m[t.c]=(m[t.c]||0)+Math.abs(t.a)});
  const vars=['--c2','--c1','--c3','--c4','--c5'];
  let arr=Object.entries(m).sort((a,b)=>b[1]-a[1]);
  if(arr.length>5){const rest=arr.slice(4).reduce((a,x)=>a+x[1],0);arr=[...arr.slice(0,4),['سایر',rest]];}
  return arr.map((x,i)=>[x[0],x[1],vars[i]]);}
function weekData(s,k){const w=WEEKS[k];if(!w.live)return w;
  const sp=monthDebits(s);return {...w,spend:Math.round(sp*0.62),days:[1.2,4.6,0.3,0.8,1.4,0.5,0],res:s.acts.filter(a=>a.k==='res').length,req:s.acts.filter(a=>a.k==='req').length,open:s.bal-15000000+Math.round(sp*0.62),paid:15000000,usage:[['استخر',6],['باشگاه',4.5],['اسپا',1],['تالار',4]]};}

/* ============ CHARTS ============ */
let cid=0;
function areaChart(vals,labels,{h=150,sel=vals.length-1,unit='میلیون تومان',d=1}={}){
  const id='g'+(++cid),W=320,pl=8,pr=8,pt=14,pb=22,max=Math.max(...vals)*1.15||1;
  const x=i=>pl+i*(W-pl-pr)/(vals.length-1), y=v=>pt+(h-pt-pb)*(1-v/max);
  let dd=`M${x(0)},${y(vals[0])}`;
  for(let i=1;i<vals.length;i++){const cx=(x(i-1)+x(i))/2;dd+=` C${cx},${y(vals[i-1])} ${cx},${y(vals[i])} ${x(i)},${y(vals[i])}`;}
  const grid=[.25,.5,.75].map(g=>`<line class="grid" x1="0" x2="${W}" y1="${pt+(h-pt-pb)*g}" y2="${pt+(h-pt-pb)*g}"/>`).join('');
  const pts=vals.map((v,i)=>`<g data-tip="${labels[i]}|${fa(v,d)} ${unit}"><rect class="hit" x="${x(i)-W/vals.length/2}" y="0" width="${W/vals.length}" height="${h}"/><circle class="pt ${i==sel?'on':''}" cx="${x(i)}" cy="${y(v)}" r="${i==sel?5:3}"/></g>`).join('');
  const step=labels.length>8?2:1;
  const lab=labels.map((l,i)=>(i%step&&i!==labels.length-1)?'':`<text x="${x(i)}" y="${h-4}" text-anchor="${i==0?'start':i==labels.length-1?'end':'middle'}">${l}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="نمودار روند از ${labels[0]} تا ${labels[labels.length-1]}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--gold)" stop-opacity=".28"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${dd} L${x(vals.length-1)},${h-pb} L${x(0)},${h-pb}Z" fill="url(#${id})"/><path class="line" d="${dd}"/>${pts}${lab}</svg>`;
}
function donut(segs,center,sub){
  const total=segs.reduce((s,x)=>s+x[1],0)||1,r=52,C=2*Math.PI*r;let off=0;
  const arcs=segs.map(s=>{const len=C*s[1]/total;const a=`<circle cx="66" cy="66" r="${r}" fill="none" stroke="var(${s[2]})" stroke-width="15" stroke-dasharray="${Math.max(len-2.5,0.1)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 66 66)"/>`;off+=len;return a;}).join('');
  return `<svg viewBox="0 0 132 132" role="img" aria-label="${sub}"><circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--fill)" stroke-width="15"/>${arcs}<text x="66" y="64" text-anchor="middle" style="font:300 19px var(--f);fill:var(--ink)">${center}</text><text x="66" y="82" text-anchor="middle" style="font:400 10px var(--f);fill:var(--muted)">${sub}</text></svg>`;
}
function legend(segs,fmt){const tot=segs.reduce((s,x)=>s+x[1],0)||1;
  return `<div class="legend">${segs.map(s=>`<div class="leg"><span class="sw" style="background:var(${s[2]})"></span><span>${s[0]}</span><span class="amt num">${fmt(s[1])}</span><span class="pct num">${fa(Math.round(s[1]/tot*100))}٪</span></div>`).join('')}</div>`;}
function groupedBars(labels,a,b,sel,h=160){
  const W=320,pb=22,pt=10,max=Math.max(...a,...b)*1.1,gw=W/labels.length,bw=13;
  const y=v=>pt+(h-pt-pb)*(1-v/max);
  let s=`<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--c2)" fill-opacity=".18"/><line x1="0" y1="0" x2="0" y2="5" stroke="var(--c2)" stroke-opacity=".45" stroke-width="2"/></pattern></defs>`;
  s+=[.33,.66].map(g=>`<line class="grid" x1="0" x2="${W}" y1="${pt+(h-pt-pb)*g}" y2="${pt+(h-pt-pb)*g}"/>`).join('');
  labels.forEach((l,i)=>{const cx=gw*i+gw/2,op=i===sel?1:.55;
    s+=`<g data-act="bmonth:${i}" style="cursor:pointer"><rect class="hit" x="${cx-gw/2}" y="0" width="${gw}" height="${h}"/>`;
    s+=`<rect x="${cx-bw-1.5}" y="${y(a[i])}" width="${bw}" height="${h-pb-y(a[i])}" rx="4" fill="var(--gold)" opacity="${op}"/>`;
    s+=`<rect x="${cx+1.5}" y="${y(b[i])}" width="${bw}" height="${h-pb-y(b[i])}" rx="4" fill="url(#hatch)" opacity="${op}"/>`;
    s+=`<text x="${cx}" y="${h-5}" text-anchor="middle" style="${i===sel?'fill:var(--ink);font-weight:600':''}">${l}</text></g>`;});
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="درآمد و هزینه ماهانه ساختمان">${s}</svg>`;
}
function miniBars(vals,labels,h=70){const W=220,max=Math.max(...vals)||1,bw=W/vals.length-8;
  return `<svg class="chart" viewBox="0 0 ${W} ${h}">${vals.map((v,i)=>{const bh=(h-16)*v/max;const x=W-(i+1)*(bw+8)+4;return `<rect x="${x}" y="${h-14-bh}" width="${bw}" height="${Math.max(bh,1)}" rx="3" fill="${v===max?'#A27A2C':'rgba(23,20,15,.22)'}"/><text x="${x+bw/2}" y="${h-3}" text-anchor="middle">${labels[i]}</text>`}).join('')}</svg>`;}

/* ============ WEEKLY REPORT PAGES ============ */
function reportPages(s,k,opts=[true,true,true]){
  const u=USERS[s.unit],w=weekData(s,k),bd=breakdown(s);
  const foot=(n,t)=>`<div class="pfoot"><span>برج ${TOWER} · گزارش خودکار</span><span>صفحه ${fa(n)} از ${fa(t)}</span></div>`;
  const sections=[];
  if(opts[0])sections.push(`<h4>۱ · مالی</h4>
   <div class="prow"><span>مانده ابتدای هفته</span><b>${w.open<0?'−':''}${mil(w.open)} م</b></div><div class="prow"><span>هزینه‌های هفته</span><b>−${mil(w.spend)} م</b></div><div class="prow"><span>واریزی</span><b style="color:#2C7553">+${mil(w.paid)} م</b></div><div class="prow"><span>مانده پایان هفته</span><b>${(w.live?s.bal:w.open-w.spend+w.paid)<0?'−':''}${mil(w.live?s.bal:w.open-w.spend+w.paid)} م</b></div>
   <h4 style="font-size:9px;margin-top:6px">تفکیک هزینه</h4>
   <div style="display:flex;gap:8px;align-items:center"><div style="width:70px">${donut(bd,mil(monthDebits(s)),'میلیون')}</div><div style="flex:1">${bd.map(b=>`<div class="prow"><span><span style="display:inline-block;width:6px;height:6px;border-radius:2px;background:var(${b[2]});margin-left:4px"></span>${b[0]}</span><span>${mil(b[1])}</span></div>`).join('')}</div></div>
   <h4 style="font-size:9px;margin-top:6px">تراکنش‌های اخیر</h4>${s.tx.slice(0,6).map(x=>`<div class="prow"><span>${esc(x.t)}</span><span>${x.a>0?'+':'−'}${T(x.a)}</span></div>`).join('')}`);
  if(opts[1]||opts[2])sections.push(`${opts[1]?`<h4>۲ · رزروها و درخواست‌ها</h4>
   ${s.acts.slice(0,7).map(a=>`<div class="prow"><span>${esc(a.t)}</span><span>${a.when} · ${a.stt}</span></div>`).join('')}`:''}
   ${opts[2]?`<h4 style="font-size:${opts[1]?9:12}px;margin-top:6px">${opts[1]?'':'۲ · '}ساعات استفاده از امکانات</h4>
   ${w.usage.map(([n,h])=>`<div style="display:flex;gap:6px;align-items:center;padding:2px 0"><span style="width:44px">${n}</span><div style="flex:1;height:5px;background:rgba(23,20,15,.07);border-radius:3px;direction:rtl"><div style="width:${h/6*100}%;height:100%;background:#A27A2C;border-radius:3px"></div></div><span>${fa(h,1)} ساعت</span></div>`).join('')}
   <h4 style="font-size:9px;margin-top:6px">ساختمان این هفته</h4><span>شستشوی مخزن آب · سرویس آسانسور B · ۳ پیام ساکنین رسیدگی شد</span>`:''}`);
  const total=sections.length+1;
  const cover=`<div class="between" style="display:flex;justify-content:space-between;align-items:center"><span class="pbrand">AFARINESH</span><span>گزارش هفتگی</span></div><div style="height:1px;background:#A27A2C;opacity:.5"></div>
   <h4>واحد ${faDigits(s.unit)} · ${u.full}</h4><span style="color:#6C6458">هفته ${w.label}</span>
   <div class="pk"><div><span style="color:#6C6458">هزینه هفته</span><b>${mil(w.spend)} م</b></div><div><span style="color:#6C6458">رزروها</span><b>${fa(w.res)}</b></div><div><span style="color:#6C6458">درخواست‌ها</span><b>${fa(w.req)}</b></div></div>
   <h4 style="font-size:9px">خلاصه</h4><span>مانده حساب واحد ${s.bal<0?mil(s.bal)+' میلیون تومان بدهکار':mil(s.bal)+' میلیون تومان بستانکار'} است. سررسید شارژ مهر ۲۳ مهر است. بیشترین هزینه این ماه در دسته «${bd[0]?bd[0][0]:'—'}» بوده است.</span>
   ${miniBars(w.days,['ش','ی','د','س','چ','پ','ج'])}
   <span style="color:#6C6458">هزینه روزانه (میلیون تومان)</span>`;
  return [cover,...sections].map((p,i)=>p+foot(i+1,total));
}

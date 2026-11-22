(()=>{'use strict';
const $=id=>document.getElementById(id);
const data={places:[],meta:{}};
const state={view:'home',gps:null,gpsAccuracy:null,gpsError:'',watch:null,date:'',nearFilter:'all',nearLimit:40,search:'',route:[],nearSorted:[],maps:{},deferredInstall:null,nearOpen:false,liveOpen:false};
Object.assign(state,{area:'',liveLimit:25,gpsTime:0,autoDate:true});
const tr=(key,vars)=>window.MaslulI18n?window.MaslulI18n.tr(key,vars):key;
const locale=()=>window.MaslulI18n?.get()||'he';
const fullName=p=>locale()==='he'?(p.nameHe||p.name):(p.nameEn||p.name);
const otherName=p=>locale()==='he'?(p.nameEn||p.name):(p.nameHe||p.name);
const factoryTag=p=>p.factory?`<span class="factoryTag">${esc(tr("factoryLabel"))}</span>`:"";
function visitedPlace(p){try{return localStorage.getItem('visited-place:'+p.id)==='1';}catch{return false;}}
function placeButton(p){
 const marked=visitedPlace(p), labels={he:['סמן שביקרתי בבית הכנסת','ביקרתי בבית הכנסת'],en:['Mark synagogue as visited','Visited synagogue'],es:['Marcar sinagoga visitada','Sinagoga visitada']};
 return `<button class="ghost slim" data-visit-place="${esc(p.id)}" aria-pressed="${marked}">${marked?'✓ ':''}${esc(labels[locale()][Number(marked)])}</button>`;
}
const nameCard=p=>`${factoryTag(p)}<h3 dir="auto">${esc(fullName(p))}</h3><p class="translatedName" dir="auto">${esc(otherName(p)===fullName(p)?'':otherName(p))}</p>${p.isAddressOnly?`<p class="nameCaution">${esc(tr('addressOnly'))}</p>`:''}`;
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function nowDate(){return new Date()}
function dateKey(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function parseDate(s){let [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12,0,0);}
function defaultDate(){return dateKey(nowDate());}
function getDayIndex(){return parseDate(state.date).getDay();}
function mins(t){const [h,m]=t.split(':').map(Number);return h*60+m;}
function stamp(m){return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0');}
function selectedDateText(){return new Intl.DateTimeFormat({he:'he-IL',en:'en-US',es:'es-ES'}[locale()],{weekday:'long',day:'numeric',month:'long'}).format(parseDate(state.date));}
function km(a,b){let r=Math.PI/180,dlat=(b[0]-a[0])*r,dlon=(b[1]-a[1])*r;let h=Math.sin(dlat/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dlon/2)**2;return 12742*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
function precise(p){return p.addressLocated||p.sourceType==='maps'||(p.precision||'').includes('מיקום מתוך');}
function dist(p,from=state.gps){if(!from||p.lat==null||p.lon==null)return null;if(p.addressOptions)return Math.min(...p.addressOptions.filter(o=>o.point).map(o=>km(from,o.point)));return km(from,[p.lat,p.lon]);}
function distText(d,approx=false){if(d==null)return tr('distUnknown');return (approx?'≈ ':'')+(d<1?tr('meters',{distance:Math.round(d*1000)}):tr('kilometers',{distance:d.toFixed(1)}));}
function availableSlots(p,dt=state.date){const index=parseDate(dt).getDay();if(index===6&&!p.schedule?.some(e=>e.day==='sat'))return[];let times=new Map();for(const e of p.schedule||[]){let eligible=false,tm=e.time;
 if(e.day==='all')eligible=true;
 else if(e.day==='sun')eligible=index===0;
 else if(e.day==='wk')eligible=index>=1&&index<=5;
 else if(e.day==='mon-thu')eligible=index===1||index===4;
 else if(['mon','tue','wed','thu','fri','sat'].includes(e.day))eligible=index===['sun','mon','tue','wed','thu','fri','sat'].indexOf(e.day);
 else if(e.day==='mon-thu-offset'){eligible=true;if(index===1||index===4)tm=stamp(mins(tm)-10);}
 if(eligible&&/^\d\d:\d\d$/.test(tm)){let specificity=e.day==='all'?0:1;if(!times.has(tm)||times.get(tm).specificity<specificity)times.set(tm,{time:tm,source:e.source,page:e.page,specificity});}}
 return [...times.values()].sort((a,b)=>a.time.localeCompare(b.time));}
function isMarked(p,t){try{return localStorage.getItem(`visited:${state.date}:${p.id}:${t}`)==='1';}catch{return false;}}
function toggleMarked(p,t){try{const k=`visited:${state.date}:${p.id}:${t}`;localStorage.setItem(k,isMarked(p,t)?'0':'1');}catch{}renderCurrent();}
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('visible'),2900);}
function openView(view){state.view=view;document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===view));$('topHome').style.visibility=view==='home'?'hidden':'visible';window.scrollTo({top:0,behavior:'instant'});if(view!=='home'){requestGPS();renderCurrent();}}
function requestGPS(){if(!navigator.geolocation){state.gpsError=tr('gpsUnsupported');gpsMessage();return;}
 if(state.watch!==null){navigator.geolocation.clearWatch(state.watch);state.watch=null;}
 state.gpsError=tr('gpsWaiting');gpsMessage();
 state.watch=navigator.geolocation.watchPosition(pos=>{
  state.gpsTime=pos.timestamp||Date.now();state.gps=[pos.coords.latitude,pos.coords.longitude];state.gpsAccuracy=Math.round(pos.coords.accuracy);state.gpsError='';gpsMessage();
  renderCurrent();
 },err=>{state.gps=null;state.gpsTime=0;state.gpsError=err.code===1?tr('gpsDenied'):err.code===2?tr('gpsUnavailable'):tr('gpsTimeout');gpsMessage();renderCurrent();},{enableHighAccuracy:true,maximumAge:30000,timeout:16000});
}
function gpsMessage(){let msg=state.gps?tr('gpsActive',{accuracy:state.gpsAccuracy??'?'})+' · '+new Date(state.gpsTime).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'}):`${state.gpsError||tr('gpsNoPermission')} • ${tr('gpsCanNavigate')}`;
 $('gpsLine').textContent=msg;$('nearGpsLine').textContent=msg;$('gpsState').textContent=tr(state.gps?'active':'inactive');}
function navUrl(p,service){let query=encodeURIComponent([p.address||p.name,p.city].filter(Boolean).join(', '));
 if(service==='waze')return precise(p)&&p.lat!=null&&p.lon!=null?`https://www.waze.com/ul?ll=${p.lat}%2C${p.lon}&navigate=yes`:`https://www.waze.com/ul?q=${query}&navigate=yes`;
 return p.mapUrl&&/^https:\/\//.test(p.mapUrl)?p.mapUrl:`https://www.google.com/maps/search/?api=1&query=${query}`;}
function addressText(p){return p.addressOptions?p.addressOptions.map(o=>o.address).join('  /  '):p.address;}
function addressChoices(p){
 return `<div class="addressReview"><strong>${esc(tr('conflict'))}</strong>${p.addressOptions.map((o,i)=>{
 const q=encodeURIComponent(o.address);
 return `<div><span>${esc(tr(i?'archiveAddress':'photoAddress'))} · <bdi>${esc(o.address)}</bdi></span><div class="actions"><a target="_blank" rel="noopener noreferrer" href="https://www.waze.com/ul?q=${q}&amp;navigate=yes">Waze</a><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&amp;query=${q}">Google Maps</a></div></div>`;
 }).join('')}</div>`;
}
function actionHTML(p){if(p.addressOptions)return placeButton(p)+addressChoices(p);return placeButton(p)+`<div class="actions"><a href="${esc(navUrl(p,'waze'))}" target="_blank" rel="noopener noreferrer">↗ Waze</a><a href="${esc(navUrl(p,'google'))}" target="_blank" rel="noopener noreferrer">◉ Google Maps</a></div>`;}
function markedButtonsHTML(p,slots){return slots.map(({time})=>{let m=isMarked(p,time);return `<button class="slot${m?' active':''}" data-mark-place="${esc(p.id)}" data-mark-time="${time}" aria-pressed="${m}" title="${esc(tr(m?'unmarkTitle':'markTitle'))}"><span>${time}</span>${p.factory?`<span class="factorySlot">${esc(tr("factoryLabel"))}</span>`:''}<span class="mark">${esc(tr(m?'iWasThere':'markVisit'))}</span></button>`;}).join('');}
function sourceHTML(p){if(p.bookletPage)return `<p class="sourceTag">${esc(p.scheduleSource)} · ${p.bookletPage}</p>`;if((p.scheduleSource||p.source||'').includes('GoDavening'))return `<p class="sourceTag">${esc(tr('photoTiming'))}</p>`;return p.sourceType==='maps'?`<p class="sourceTag">${esc(tr('googleSource'))}</p>`:`<p class="sourceTag">${esc(tr('timesSource',{source:p.source||'CLICK613'}))}</p>`;}
const weekdayLabels=Object.fromEntries(['he','en','es'].map(lang=>{const fmt=new Intl.DateTimeFormat(lang,{weekday:'long'});return [lang,[1,2,3,4,5,7].map(d=>fmt.format(new Date(2024,0,d,12)))];}));
function factoryInfo(p){
 if(!p.factory)return '';
 const lines=Object.entries(p.factory.ranges).flatMap(([day,ranges])=>ranges.map(([start,end,minutes])=>
  `<div>${esc(tr({all:'factoryDays',wk:'weekdays',sun:'factorySunday'}[day]))} · <bdi>${start}–${end}</bdi> · ${esc(tr('factoryInterval',{minutes}))}</div>`));
 return `<aside class="factoryInfo"><strong>${esc(tr('factoryLabel'))}</strong> · CLICK613 · Minyan Factories · 256 / 2${lines.join('')}</aside>`;
}
function hasSchedule(p){return Boolean(p.clickWeek?.regularWeekday?.length || p.clickWeek?.erevShabbos?.length || p.clickWeek?.shabbos?.length || p.schedule?.length || p.scheduleNote || p.bookletNotes);}
function clickSchedule(p){
 if(!p.clickWeek)return '';
 const he=locale()==='he',groups={regularWeekday:he?'ראשון–חמישי':'Sun–Thu',exceptions:he?'ימים מיוחדים':'Exceptions',erevShabbos:he?'יום שישי':'Friday',shabbos:he?'שבת':'Shabbos',erevYomTov:he?'ערב יום טוב':'Erev Yom Tov',highHolidays:he?'ימים נוראים':'High holidays'};
 const blocks=Object.entries(groups).flatMap(([k,label])=>(p.clickWeek[k]||[]).map(r=>`<p><b>${esc(label)} · ${esc(r.dayShort||'')} ${esc(r.label)}</b><br><bdi>${esc(r.times.join(' · '))}</bdi></p>`));
 if(!blocks.length)for(const e of p.clickCardTimes||[])blocks.push(`<p>${esc(e.label)} · ${esc(e.time)}</p>`);
 return blocks.length?`<details class="hoursRow"><summary>${he?'כל זמני התפילות':'Prayer schedule'} · Click613</summary>${esc(p.clickWeek.weekLabel)}${blocks.join('')}</details>`:'';
}
function weekHTML(p){
 const days=['2024-01-01','2024-01-02','2024-01-03','2024-01-04','2024-01-05','2024-01-07'];
 const groups=new Map(),rows=[];
 for(const [index,date] of days.entries()){
  const slots=availableSlots(p,date);
  const label=weekdayLabels[locale()][index];
  const signature=slots.map(s=>s.time).join(',');
  if(index===5){rows.push({labels:[label],slots,sunday:true});continue;}
  if(!groups.has(signature))groups.set(signature,{labels:[],slots});
  groups.get(signature).labels.push(label);
 }
 const regular=[...groups.values()];
 if(regular.length===1)regular[0].labels=[tr('weekdays')];
 if(p.schedule?.some(e=>e.day==='sat'))rows.push({labels:[new Intl.DateTimeFormat(locale(),{weekday:'long'}).format(parseDate('2024-01-06'))],slots:availableSlots(p,'2024-01-06')});
 return factoryInfo(p)+(p.bookletNotes?`<p class="hoursRow" dir="rtl">${esc(p.bookletNotes)}</p>`:'')+[...regular,...rows].map(row=>`<div class="hoursRow"><strong>${esc(row.labels.join(' · '))}</strong> ${factoryTag(p)} ${p.scheduleNote?esc(tr('sunrisePrayer')):''}${row.slots.length?`<div class="slotWrap">${markedButtonsHTML(p,row.slots)}</div>`:`<span>${esc(tr('noPublished'))}</span>`}</div>`).join('');
}
function nearCard(p,rank){const slots=availableSlots(p),d=dist(p,cityOrigin(selectedCity())),approx=!precise(p);const bud=`<span class="miniBadge${approx?' approx':''}">${esc(tr(approx?'approxPlace':p.addressLocated?'locatedAddress':'exactPlace'))}</span>`;
 return `<article class="placeCard"><div class="headRow"><div>${nameCard(p)}<p>${esc(addressText(p)||tr('addressNotKnown'))}</p>${bud}</div><span class="stopNum">${rank}</span><span class="routeDistance">${esc(distText(d,approx))}</span></div>
 ${hasSchedule(p)?weekHTML(p):esc(tr('noTimes'))}${clickSchedule(p)}${actionHTML(p)}${sourceHTML(p)}</article>`;}
function insideRing(x,y,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [ax,ay]=ring[i],[bx,by]=ring[j];
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
function gpsCity(){
 if(!state.gps)return '';
 const [y,x]=state.gps;
 const shape=data.shapes?.find(s=>{
  const [west,south,east,north]=s.bounds;
  return x>=west&&x<=east&&y>=south&&y<=north&&s.polygons.some(poly=>insideRing(x,y,poly[0])&&!poly.slice(1).some(h=>insideRing(x,y,h)));
 });
 if(shape && data.places.some(p=>p.localities.includes(shape.name)))return shape.name;
 let best=3,city='';for(const p of data.places){if(!precise(p)||p.lat==null||p.lon==null)continue;const d=dist(p,state.gps);if(d!=null&&d<best){best=d;city=p.localities[0];}}return city;
}
function selectedCity(){return state.area||gpsCity();}
function cityOrigin(city){return state.gps&&(!state.area||gpsCity()===city)?state.gps:data.centers?.[city];}
function localList(){
 const city=selectedCity();
 const origin=cityOrigin(city);
 return data.places.filter(p=>p.localities.includes(city)).sort((a,b)=>{
  return Number(precise(b))-Number(precise(a))||(precise(a)&&origin?dist(a,origin)-dist(b,origin):0)||fullName(a).localeCompare(fullName(b));
 });
}
function cityMessage(){
 const city=selectedCity();
 $('cityStatus').textContent=city||tr(state.gps?'outsideCity':'selectOrigin');
}
function renderNearby(){const search=state.search.trim().toLocaleLowerCase(),filter=state.nearFilter;
 let items=localList().filter(p=>(!search||((p.name||'')+' '+(p.nameHe||'')+' '+(p.nameEn||'')+' '+(addressText(p)||'')+' '+(p.area||'')+' '+(p.factory?'שטיבלך Minyan Factories Minyonim Factory Shtieblach':'')).toLocaleLowerCase().includes(search))&&(filter==='all'||(filter==='with'?hasSchedule(p):!hasSchedule(p))));
 state.nearSorted=items;
 $('nearSummary').textContent=tr('nearSummary',{count:items.length,google:data.meta.googleMapsRows??0});
 $('nearItems').innerHTML=items.map((p,i)=>nearCard(p,i+1)).join('')||`<div class="empty">${esc(tr('noneFound'))}</div>`;
 $('morePlaces').classList.toggle('hidden',true);
 if(state.nearOpen)drawMap('nearMap',items,true);
}
function renderLive(){
 const city=selectedCity(),origin=cityOrigin(city);
 const distance=p=>dist(p,origin)??Infinity;
 state.route=localList();
 $('nearMatches').textContent=state.route.length;
 $('liveCount').textContent=state.route.filter(hasSchedule).length;
 $('routeItems').innerHTML=state.route.map((p,i)=>{
  const exact=precise(p),d=distance(p);
  const drive=exact&&state.gps&&origin===state.gps?tr('drive',{min:Math.max(1,Math.round(d*1.3/32*60))}):'';
  const slots=availableSlots(p),now=nowDate(),today=state.date===dateKey(now);
  const t=today?slots.find(s=>mins(s.time)>=now.getHours()*60+now.getMinutes()):slots[0];
  return `<article class="placeCard"><div class="headRow"><div>${nameCard(p)}<p>${esc([addressText(p),p.localities.length>1?p.localities.join(' / '):p.area].filter(Boolean).join(' · '))}</p></div><span class="stopNum">${i+1}</span></div>
   <p class="estimated">${esc(exact?distText(d)+' · '+(drive||tr('fromCenter')):tr('approxOnly'))}</p>
   ${t?`<p>${esc(tr(today?'nextTime':'firstTime',{time:t.time}))}</p>`:''}
   ${hasSchedule(p)?weekHTML(p):esc(tr('noTimes'))}${clickSchedule(p)}${actionHTML(p)}${sourceHTML(p)}</article>`;
 }).join('')||`<p class="empty">${esc(tr(!city&&!state.gps?'selectOrigin':'noLocal'))}</p>`;
 if(state.liveOpen)drawMap('liveMap',state.route,true);
}
function renderCurrent(){cityMessage();if(state.view==='live')renderLive();else if(state.view==='nearby')renderNearby();}
function initMap(id){if(state.maps[id])return state.maps[id];if(!window.L){$(id+'Hint').textContent=tr('mapUnavailable');return null;}
 let m=L.map(id,{scrollWheelZoom:false});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(m);state.maps[id]=m;return m;
}
function drawMap(id,places,route){let map=initMap(id);if(!map)return; if(map._customMarkers){map._customMarkers.forEach(x=>map.removeLayer(x));}
 let created=[],bounds=[];if(state.gps&&(!state.area||gpsCity()===state.area)){let user=L.circleMarker(state.gps,{radius:9,color:'#154c68',fillColor:'#24d4c1',fillOpacity:1,weight:3}).bindPopup(tr('myGps')).addTo(map);created.push(user);bounds.push(state.gps);}
 places.forEach((p,i)=>{if(p.lat==null||p.lon==null)return;if(!precise(p))return;
 const points=p.addressOptions?p.addressOptions.map(o=>o.point).filter(Boolean):[[p.lat,p.lon]];for(const ll of points){let marker=(route?L.marker(ll,{icon:L.divIcon({className:"rankPin",html:String(i+1),iconSize:[30,30],iconAnchor:[15,15]})}):L.circleMarker(ll,{radius:route?11:5,color:route?'#034b6d':'#156c6d',fillColor:route?'#0c9cab':'#3fbbb5',fillOpacity:.85,weight:1})).bindPopup(`<strong>${esc(fullName(p))} / ${esc(otherName(p))}</strong><br>${p.addressOptions?addressChoices(p):esc(p.address||'')}${p.addressOptions?'':actionHTML(p)}`).addTo(map);created.push(marker);bounds.push(ll);}});
 map._customMarkers=created;
 if(bounds.length>=2)map.fitBounds(bounds,{padding:[20,20],maxZoom:14});else if(bounds.length===1)map.setView(bounds[0],13);else map.setView(data.centers?.[state.area]||[40.085,-74.21],10);
 setTimeout(()=>map.invalidateSize(),100);
}
function refreshClock(){
 if(state.autoDate){state.date=defaultDate();$('dateSelect').value=state.date;}
 if(state.gps&&Date.now()-state.gpsTime>120000){state.gps=null;state.gpsError=tr('gpsWaiting');if(state.view!=='home')requestGPS();}
 gpsMessage();renderCurrent();
}
function bind(){
 $('areaSelect').addEventListener('change',e=>{state.area=e.target.value;if(state.view==='home')openView('live');else renderCurrent();});
 setInterval(()=>{if(!document.hidden)refreshClock();},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshClock();if(state.view!=='home')requestGPS();}});
 $('topHome').addEventListener('click',()=>openView('home'));$('goLive').addEventListener('click',()=>openView('live'));$('goNearby').addEventListener('click',()=>openView('nearby'));
 $('refreshPosition').addEventListener('click',requestGPS);$('refreshNearby').addEventListener('click',requestGPS);
 $('dateSelect').addEventListener('change',e=>{if(e.target.value){state.autoDate=false;state.date=e.target.value;renderCurrent();}});
 $('setAutoDate').addEventListener('click',()=>{state.autoDate=true;state.date=defaultDate();$('dateSelect').value=state.date;renderCurrent();});
 $('searchShuls').addEventListener('input',e=>{state.search=e.target.value;state.nearLimit=40;renderNearby();});
 $('clearSearch').addEventListener('click',()=>{state.search='';$('searchShuls').value='';renderNearby();});
 document.querySelectorAll('.pill').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.pill').forEach(e=>e.classList.remove('active'));b.classList.add('active');state.nearFilter=b.dataset.f;state.nearLimit=40;renderNearby();}));
 $('morePlaces').addEventListener('click',()=>{state.nearLimit+=50;renderNearby();});
 document.body.addEventListener('click',e=>{const place=e.target.closest('[data-visit-place]');if(place){const p=data.places.find(x=>x.id===place.dataset.visitPlace);if(p){try{localStorage.setItem('visited-place:'+p.id,visitedPlace(p)?'0':'1');}catch{}renderCurrent();}return;}let b=e.target.closest('[data-mark-place]');if(!b)return;let p=data.places.find(x=>x.id===b.dataset.markPlace);if(p)toggleMarked(p,b.dataset.markTime);});
 $('mapToggle').addEventListener('click',()=>{state.liveOpen=!state.liveOpen;$('liveMapWrap').classList.toggle('hidden',!state.liveOpen);$('mapToggle').textContent=tr(state.liveOpen?'hideMap':'showMap');if(state.liveOpen)renderLive();});
 window.addEventListener('maslul-languagechange',()=>{
  $('mapToggle').textContent=tr(state.liveOpen?'hideMap':'showMap');$('nearMapToggle').textContent=tr(state.nearOpen?'hideMap':'showMap');
  $('countSmall').textContent=tr('fromMapCount',{count:data.meta.googleMapsRows||0});gpsMessage();renderCurrent();});
 $('nearMapToggle').addEventListener('click',()=>{state.nearOpen=!state.nearOpen;$('nearMapWrap').classList.toggle('hidden',!state.nearOpen);$('nearMapToggle').textContent=tr(state.nearOpen?'hideMap':'showMap');if(state.nearOpen)renderNearby();});

}
async function load(){try{let r=await fetch('./data/places.json',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);let json=await r.json();data.places=json.places;data.meta=json.meta;data.shapes=json.cityShapes;data.centers={...json.clickCenters,...Object.fromEntries(data.shapes.map(s=>[s.name,s.center]))};
 const cities=[...new Set(data.places.flatMap(p=>p.localities))].sort();
 for(const city of cities)$('areaSelect').add(new Option(city,city));
 renderCurrent();
 $('countSmall').textContent=tr('fromMapCount',{count:data.meta.googleMapsRows});$('dateSelect').value=state.date;
 }catch(err){$('countSmall').textContent='';$('gpsLine').textContent=tr('loadFailed',{reason:err.message});$('nearItems').textContent=tr('dataMissing');toast(tr('missingFileToast'));}}

async function setupAutomaticUpdates(){
 if(!('serviceWorker' in navigator)||location.protocol!=='https:')return;
 // First installation should not interrupt onboarding. Subsequent deployed updates reload automatically.
 let previousController=!!navigator.serviceWorker.controller;
 let reloading=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(reloading)return;
  if(!previousController){previousController=true;return;}
  reloading=true;
  window.location.reload();
 });
 try{
  const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  const check=()=>{if(navigator.onLine!==false)reg.update().catch(()=>{});};
  check();
  window.addEventListener('online',check);
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  setInterval(check,5*60*1000);
 }catch(e){const status=$('versionStatus');if(status)status.textContent=tr('updatesNotAvailable');}
}

async function init(){state.date=defaultDate();bind();await load();gpsMessage();setupAutomaticUpdates();
 try{const params=new URLSearchParams(location.search);if(params.get('screen')==='nearby')openView('nearby');else if(params.get('screen')==='live')openView('live');}catch{}
}
window.__routeAppTest={availableSlots,dist,precise,dateKey,parseDate,from:()=>({data,state}),defaultDate};
init();})();

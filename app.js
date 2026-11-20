(()=>{'use strict';
const $=id=>document.getElementById(id);
const data={places:[],meta:{}};
const state={view:'home',gps:null,gpsAccuracy:null,gpsError:'',watch:null,date:'',nearFilter:'all',nearLimit:40,search:'',route:[],nearSorted:[],maps:{},deferredInstall:null,nearOpen:false,liveOpen:false};
const tr=(key,vars)=>window.MaslulI18n?window.MaslulI18n.tr(key,vars):key;
const locale=()=>window.MaslulI18n?.get()||'he';
const fullName=p=>locale()==='he'?(p.nameHe||p.name):(p.nameEn||p.name);
const otherName=p=>locale()==='he'?(p.nameEn||p.name):(p.nameHe||p.name);
const nameCard=p=>`<h3 dir="auto">${esc(fullName(p))}</h3><p class="translatedName" dir="auto">${esc(otherName(p))}</p>${p.isAddressOnly?`<p class="nameCaution">${esc(tr('addressOnly'))}</p>`:''}`;
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function nowDate(){return new Date()}
function dateKey(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function parseDate(s){let [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12,0,0);}
function defaultDate(){let d=nowDate();if(d.getHours()>=13){d.setDate(d.getDate()+1);}while(d.getDay()===6)d.setDate(d.getDate()+1);return dateKey(d);}
function getDayIndex(){return parseDate(state.date).getDay();}
function mins(t){const [h,m]=t.split(':').map(Number);return h*60+m;}
function stamp(m){return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0');}
function selectedDateText(){return new Intl.DateTimeFormat({he:'he-IL',en:'en-US',es:'es-ES'}[locale()],{weekday:'long',day:'numeric',month:'long'}).format(parseDate(state.date));}
function km(a,b){let r=Math.PI/180,dlat=(b[0]-a[0])*r,dlon=(b[1]-a[1])*r;let h=Math.sin(dlat/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dlon/2)**2;return 12742*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
function precise(p){return p.sourceType==='maps'||(p.precision||'').includes('מיקום מתוך');}
function dist(p,from=state.gps){if(!from||p.lat==null||p.lon==null)return null;return km(from,[p.lat,p.lon]);}
function distText(d,approx=false){if(d==null)return tr('distUnknown');return (approx?'≈ ':'')+(d<1?tr('meters',{distance:Math.round(d*1000)}):tr('kilometers',{distance:d.toFixed(1)}));}
function availableSlots(p,dt=state.date){const index=parseDate(dt).getDay();if(index===6)return[];let times=new Map();for(const e of p.schedule||[]){let eligible=false,tm=e.time;
 if(e.day==='all')eligible=true;
 else if(e.day==='sun')eligible=index===0;
 else if(e.day==='wk')eligible=index>=1&&index<=5;
 else if(e.day==='mon-thu')eligible=index===1||index===4;
 else if(['mon','tue','wed','thu','fri'].includes(e.day))eligible=index===['sun','mon','tue','wed','thu','fri','sat'].indexOf(e.day);
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
  const old=state.gps;state.gps=[pos.coords.latitude,pos.coords.longitude];state.gpsAccuracy=Math.round(pos.coords.accuracy);state.gpsError='';gpsMessage();
  if(!old||km(old,state.gps)>.02)renderCurrent();
 },err=>{state.gpsError=err.code===1?tr('gpsDenied'):err.code===2?tr('gpsUnavailable'):tr('gpsTimeout');gpsMessage();renderCurrent();},{enableHighAccuracy:true,maximumAge:30000,timeout:16000});
}
function gpsMessage(){let msg=state.gps?tr('gpsActive',{accuracy:state.gpsAccuracy??'?'}):`${state.gpsError||tr('gpsNoPermission')} • ${tr('gpsCanNavigate')}`;
 $('gpsLine').textContent=msg;$('nearGpsLine').textContent=msg;$('gpsState').textContent=tr(state.gps?'active':'inactive');}
function navUrl(p,service){let query=encodeURIComponent(p.address||p.name);
 if(service==='waze')return precise(p)&&p.lat!=null&&p.lon!=null?`https://www.waze.com/ul?ll=${p.lat}%2C${p.lon}&navigate=yes`:`https://www.waze.com/ul?q=${query}&navigate=yes`;
 return p.mapUrl&&/^https:\/\//.test(p.mapUrl)?p.mapUrl:`https://www.google.com/maps/search/?api=1&query=${query}`;}
function actionHTML(p){return `<div class="actions"><a href="${esc(navUrl(p,'waze'))}" target="_blank" rel="noopener noreferrer">↗ Waze</a><a href="${esc(navUrl(p,'google'))}" target="_blank" rel="noopener noreferrer">◉ Google Maps</a></div>`;}
function markedButtonsHTML(p,slots){return slots.map(({time})=>{let m=isMarked(p,time);return `<button class="slot${m?' active':''}" data-mark-place="${esc(p.id)}" data-mark-time="${time}" aria-pressed="${m}" title="${esc(tr(m?'unmarkTitle':'markTitle'))}"><span>${time}</span><span class="mark">${esc(tr(m?'iWasThere':'markVisit'))}</span></button>`;}).join('');}
function sourceHTML(p){return p.sourceType==='maps'?`<p class="sourceTag">${esc(tr('googleSource'))}</p>`:`<p class="sourceTag">${esc(tr('timesSource',{source:p.source||'CLICK613'}))}</p>`;}
function sundayNoteHTML(p){
 if(getDayIndex()===0||!(p.schedule||[]).length)return '';
 const sun=availableSlots(p,'2026-11-22').map(x=>x.time);
 if(!sun.length)return '';
 const regular=availableSlots(p,state.date).map(x=>x.time);
 if(sun.join(',')===regular.join(','))return '';
 return `<p class="extraTimes"><strong>${esc(tr('sundayNote'))}</strong> ${esc(sun.join(' · '))}. ${esc(tr('sunInstruction'))}</p>`;
}
function nearCard(p){const slots=availableSlots(p),d=dist(p),approx=!precise(p);const bud=`<span class="miniBadge${approx?' approx':''}">${esc(tr(approx?'approxPlace':'exactPlace'))}</span>`;
 return `<article class="placeCard"><div class="headRow"><div>${nameCard(p)}<p>${esc(p.address||tr('addressNotKnown'))}</p>${bud}</div><span class="routeDistance">${esc(distText(d,approx))}</span></div>
 ${slots.length?`<span class="minorLabel">${esc(tr('prayerTimesFor',{date:selectedDateText()}))}</span><div class="slotWrap">${markedButtonsHTML(p,slots)}</div>`:`<p class="extraTimes">${esc(tr('noTimes'))}</p>`}
 ${sundayNoteHTML(p)}${actionHTML(p)}${sourceHTML(p)}</article>`;}
function renderNearby(){const search=state.search.trim().toLocaleLowerCase(),filter=state.nearFilter;
 let items=data.places.filter(p=>(!search||((p.name||'')+' '+(p.nameHe||'')+' '+(p.nameEn||'')+' '+(p.address||'')+' '+(p.area||'')).toLocaleLowerCase().includes(search))&&(filter==='all'||(filter==='with'?!!p.schedule?.length:!p.schedule?.length)));
 if(state.gps)items.sort((a,b)=>{const pa=precise(a)?0:1,pb=precise(b)?0:1;let da=dist(a)??1e7,db=dist(b)??1e7;return (da+(pa?8:0))-(db+(pb?8:0));});
 state.nearSorted=items;
 $('nearSummary').textContent=tr('nearSummary',{count:items.length,google:data.meta.googleMapsRows??0});
 $('nearItems').innerHTML=items.slice(0,state.nearLimit).map(nearCard).join('')||`<div class="empty">${esc(tr('noneFound'))}</div>`;
 $('morePlaces').classList.toggle('hidden',state.nearLimit>=items.length);
 if(state.nearOpen)drawMap('nearMap',items.filter(precise),false);
}
function candidateList(){let rows=[];const today=dateKey(nowDate())===state.date;const base=today?nowDate().getHours()*60+nowDate().getMinutes():5*60+50;
 for(const p of data.places){let ss=availableSlots(p);if(!ss.length)continue;for(const s of ss){let time=mins(s.time);if(time+35<base)continue;rows.push({p,t:s.time,start:time,d:dist(p),approx:!precise(p),visited:isMarked(p,s.time)});}}
 return rows;
}
function buildRoute(){let all=candidateList();$('nearMatches').textContent=all.length;
 if(!state.gps){all.sort((a,b)=>a.start-b.start||a.p.name.localeCompare(b.p.name));state.route=all.slice(0,14).map((e,i)=>({...e,order:i+1,category:tr('startAt'),arrival:e.start,score:0}));return;}
 const selected=[],used=new Set();let position=state.gps;const today=dateKey(nowDate())===state.date;
 let clock=today?nowDate().getHours()*60+nowDate().getMinutes():5*60+50;
 for(let ii=0;ii<10;ii++){
  let choices=[];
  for(const e of all){const key=e.p.id+':'+e.t;if(used.has(key))continue;
   const journey=dist(e.p,position);
   if(journey==null)continue;
   // Straight-line distance with a moderate heuristic speed; never described as live traffic.
   const eta=e.approx?6:Math.ceil(journey/28*60+2);
   const reach=clock+eta;if(reach>e.start+35)continue;
   let arrive,category;
   if(reach<=e.start+10){arrive=Math.max(reach,e.start+7);category=tr('preferredWindow');}
   else {arrive=Math.max(reach,e.start+28);category=tr('secondaryWindow');}
   let wait=Math.max(0,arrive-reach),score=eta*2.7+wait*.26+(e.approx?28:0)+(arrive>e.start+10?12:0)+(e.visited?18:0);
   choices.push({...e,score,arrival:arrive,eta,category});
  }
  if(!choices.length)break;
  choices.sort((a,b)=>a.score-b.score || a.start-b.start);
  const best=choices[0];selected.push({...best,order:selected.length+1});used.add(best.p.id+':'+best.t);
  position=[best.p.lat,best.p.lon];clock=best.arrival+8;
 }
 if(selected.length===0){all.sort((a,b)=>{
   let da=a.d??1e7,db=b.d??1e7;return da-db||a.start-b.start;});
   state.route=all.slice(0,12).map((e,i)=>({...e,order:i+1,arrival:e.start,category:tr('closeSuggestion')}));
 }else state.route=selected;
}
function routeCard(e){const p=e.p,slots=availableSlots(p),time=e.t,approx=e.approx,d=e.d;
 const dayNote=slots.length>1?`<p class="extraTimes">${esc(tr('otherMinyanim'))}</p>`:'';
 return `<article class="placeCard"><div class="headRow"><div>${nameCard(p)}<p>${esc(p.address||p.area||'')}</p><p class="routeNote"><strong>${esc(tr('chosenMinyan',{time}))}</strong> • ${esc(tr('arrivalApprox',{time:stamp(e.arrival)}))}<br>${esc(e.category)}${approx?` • ${esc(tr('approxShort'))}`:''}</p></div><span class="stopNum">${e.order}</span></div>
 <p class="estimated">${state.gps?esc(tr('distanceApprox',{distance:distText(d,approx)})):esc(tr('gpsNotYet'))}</p>
 ${dayNote}<div class="slotWrap">${markedButtonsHTML(p,slots)}</div>${sundayNoteHTML(p)}${actionHTML(p)}${sourceHTML(p)}</article>`;}
function renderLive(){buildRoute();$('liveCount').textContent=state.route.length;
 $('routeItems').innerHTML=state.route.map(routeCard).join('')||`<div class="empty">${esc(tr('noneUpcoming'))}</div>`;
 if(!state.gps)$('routeItems').insertAdjacentHTML('afterbegin',`<div class="notice">${esc(tr('gpsFallback'))}</div>`);
 if(state.liveOpen)drawMap('liveMap',state.route.map(e=>e.p),true);
}
function renderCurrent(){if(state.view==='live')renderLive();else if(state.view==='nearby')renderNearby();}
function initMap(id){if(state.maps[id])return state.maps[id];if(!window.L){$(id+'Hint').textContent=tr('mapUnavailable');return null;}
 let m=L.map(id,{scrollWheelZoom:false});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(m);state.maps[id]=m;return m;
}
function drawMap(id,places,route){let map=initMap(id);if(!map)return; if(map._customMarkers){map._customMarkers.forEach(x=>map.removeLayer(x));}
 let created=[],line=[],bounds=[];if(state.gps){let user=L.circleMarker(state.gps,{radius:9,color:'#154c68',fillColor:'#24d4c1',fillOpacity:1,weight:3}).bindPopup(tr('myGps')).addTo(map);created.push(user);bounds.push(state.gps);line.push(state.gps);}
 places.forEach((p,i)=>{if(p.lat==null||p.lon==null)return;if(!route&&!precise(p))return;
 let ll=[p.lat,p.lon];let marker=L.circleMarker(ll,{radius:route?11:5,color:route?'#034b6d':'#156c6d',fillColor:route?'#0c9cab':'#3fbbb5',fillOpacity:.85,weight:1}).bindPopup(`<strong>${esc(fullName(p))} / ${esc(otherName(p))}</strong><br>${esc(p.address||'')}<br><a href="${esc(navUrl(p,'google'))}" target="_blank">${esc(tr('navigate'))}</a>`).addTo(map);created.push(marker);bounds.push(ll);if(route)line.push(ll);});
 if(route&&line.length>=2)created.push(L.polyline(line,{color:'#19878e',weight:3,dashArray:'6,8'}).addTo(map));map._customMarkers=created;
 if(bounds.length>=2)map.fitBounds(bounds,{padding:[20,20],maxZoom:14});else if(bounds.length===1)map.setView(bounds[0],13);else map.setView([40.085,-74.21],10);
 setTimeout(()=>map.invalidateSize(),100);
}
function bind(){ $('topHome').addEventListener('click',()=>openView('home'));$('goLive').addEventListener('click',()=>openView('live'));$('goNearby').addEventListener('click',()=>openView('nearby'));
 $('refreshPosition').addEventListener('click',requestGPS);$('refreshNearby').addEventListener('click',requestGPS);
 $('dateSelect').addEventListener('change',e=>{if(e.target.value){state.date=e.target.value;renderCurrent();}});
 $('setAutoDate').addEventListener('click',()=>{state.date=defaultDate();$('dateSelect').value=state.date;renderCurrent();});
 $('searchShuls').addEventListener('input',e=>{state.search=e.target.value;state.nearLimit=40;renderNearby();});
 $('clearSearch').addEventListener('click',()=>{state.search='';$('searchShuls').value='';renderNearby();});
 document.querySelectorAll('.pill').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.pill').forEach(e=>e.classList.remove('active'));b.classList.add('active');state.nearFilter=b.dataset.f;state.nearLimit=40;renderNearby();}));
 $('morePlaces').addEventListener('click',()=>{state.nearLimit+=50;renderNearby();});
 document.body.addEventListener('click',e=>{let b=e.target.closest('[data-mark-place]');if(!b)return;let p=data.places.find(x=>x.id===b.dataset.markPlace);if(p)toggleMarked(p,b.dataset.markTime);});
 $('mapToggle').addEventListener('click',()=>{state.liveOpen=!state.liveOpen;$('liveMapWrap').classList.toggle('hidden',!state.liveOpen);$('mapToggle').textContent=tr(state.liveOpen?'hideMap':'showMap');if(state.liveOpen)renderLive();});
 window.addEventListener('maslul-languagechange',()=>{
  $('mapToggle').textContent=tr(state.liveOpen?'hideMap':'showMap');$('nearMapToggle').textContent=tr(state.nearOpen?'hideMap':'showMap');
  $('countSmall').textContent=tr('fromMapCount',{count:data.meta.googleMapsRows||0});gpsMessage();renderCurrent();});
 $('nearMapToggle').addEventListener('click',()=>{state.nearOpen=!state.nearOpen;$('nearMapWrap').classList.toggle('hidden',!state.nearOpen);$('nearMapToggle').textContent=tr(state.nearOpen?'hideMap':'showMap');if(state.nearOpen)renderNearby();});

}
async function load(){try{let r=await fetch('./places.json',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);let json=await r.json();data.places=json.places;data.meta=json.meta;
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

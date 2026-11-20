'use strict';
/* Static GitHub Pages application. Only CLICK613 data.json supplies Shacharis times.
 * Location snapshot and optional user imports are exclusively for coordinates.
 * Distance/ETAs are estimates, NEVER traffic estimates. GPS remains in the browser.
 */
const $=id=>document.getElementById(id);
const KEY='click613-live-20261120-';
const readStore=(key,fallback)=>{try{const v=localStorage.getItem(KEY+key);return v?JSON.parse(v):fallback}catch{return fallback}};
const saveStore=(key,data)=>{try{localStorage.setItem(KEY+key,JSON.stringify(data))}catch{}};
const state={shuls:[],original:[],extra:readStore('extra',[]),fixes:readStore('locations',{}),visited:readStore('visited',{}),position:null,gps:false,watchId:null,day:'auto',area:'',search:'',mapVisible:false,map:null,markers:null,userMarker:null,editId:null,selectedPoint:null,pickingPoint:false,road:null,lastRoadAt:0,opened:false,lastUpdate:0};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const minute=t=>{const [h,m]=String(t).split(':').map(Number);return h*60+m};
const fmt=t=>`${String(Math.floor(t/60)%24).padStart(2,'0')}:${String(Math.round(t%60)).padStart(2,'0')}`;
const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const weekday=()=>new Date().getDay();
const isSunday=()=>state.day==='sunday'||(state.day==='auto'&&weekday()===0)||(state.day==='auto'&&weekday()===6);
const activeDay=()=>isSunday()?'sunday':'weekday';
const visitKey=(s,t,day)=>`${todayKey()}|${day}|${s.id}|${t}`;
const visited=(s,t,day)=>!!state.visited[visitKey(s,t,day)];
const round=v=>Math.round(v*10)/10;
const validLatLon=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
const normalize=s=>String(s??'').toLowerCase().replace(/east/g,'e').replace(/west/g,'w').replace(/avenue/g,'ave').replace(/street/g,'st').replace(/road/g,'rd').replace(/drive/g,'dr').replace(/court/g,'ct').replace(/lane/g,'ln').replace(/boulevard/g,'blvd').replace(/[^a-z0-9א-ת]/g,'');
const loc=s=>state.fixes[s.id]||((Number.isFinite(s.lat)&&Number.isFinite(s.lon))?{lat:s.lat,lon:s.lon,origin:s.locationConfidence}:null);
const hav=(a,b)=>{const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLon=(b.lon-a.lon)*r,x=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))};
// Conservative approximation on local roads: no live traffic data.
const driveMinutes=km=>Math.max(2,km*2.1+1.7);
const zoneCenters={Lakewood:[40.091,-74.22],Jackson:[40.108,-74.365],'Toms River':[39.975,-74.19],Howell:[40.163,-74.218],Manchester:[39.95,-74.32],'EWR/Linden':[40.67,-74.205]};
let toastHandle=null;
function toast(s){$('toast').textContent=s;$('toast').classList.remove('hidden');clearTimeout(toastHandle);toastHandle=setTimeout(()=>$('toast').classList.add('hidden'),3000)}
function activeShuls(){return state.shuls.concat(state.extra.filter(x=>!state.shuls.some(s=>s.id===x.id)))}
function positionForArea(){if(!state.area)return null;const a=state.area.split('||');let rows=activeShuls().filter(s=>s.city===a[0]&&(!a[1]||s.area===a[1])).map(loc).filter(Boolean);if(!rows.length&&zoneCenters[a[0]])return {lat:zoneCenters[a[0]][0],lon:zoneCenters[a[0]][1],approx:true};if(!rows.length)return null;rows=rows.slice().sort((x,y)=>x.lat-y.lat);const lat=rows[Math.floor(rows.length/2)].lat;rows.sort((x,y)=>x.lon-y.lon);return{lat,lon:rows[Math.floor(rows.length/2)].lon,approx:true}}
function anchor(){return state.position||positionForArea()}
function matchArea(s){if(!state.area)return true;const a=state.area.split('||');return s.city===a[0]&&(!a[1]||s.area===a[1])}
function matchSearch(s){const q=state.search.trim().toLowerCase();return !q||[s.name,s.street,s.address,s.area,...(s.aliases||[])].join(' ').toLowerCase().includes(q)}
function navLinks(s,compact=false){const point=loc(s), precise=point&&point.origin!=='area-only';const q=precise?`${point.lat},${point.lon}`:s.address||s.street;const google=precise?`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`:`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;const waze=precise?`https://waze.com/ul?ll=${encodeURIComponent(q)}&navigate=yes`:`https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;return `<a href="${esc(waze)}" target="_blank" rel="noopener">ווייז</a><a href="${esc(google)}" target="_blank" rel="noopener">גוגל מפות</a>${compact?'':`<button data-action="edit" data-id="${esc(s.id)}">תקן מיקום</button>`}`}
function timeChip(s,t,day){const done=visited(s,t.time,day);const note=(t.notes||[]).join(' · ');return `<button type="button" class="chip ${done?'visited':''}" data-action="visit" data-id="${esc(s.id)}" data-time="${esc(t.time)}" data-day="${day}" aria-pressed="${done}" title="${done?'סומן באדום. לחץ לביטול':'לחץ לסמן שהיית במניין'}${note?' — '+esc(note):''}">${esc(t.time)}${done?' ✓':''}</button>`}
function renderShuls(){const origin=anchor();const sh=activeShuls().filter(s=>matchArea(s)&&matchSearch(s));sh.sort((a,b)=>{if(origin){const aa=loc(a),bb=loc(b),da=aa?hav(origin,aa):99999,db=bb?hav(origin,bb):99999;if(Math.abs(da-db)>0.005)return da-db;}const ta=Math.min(...a.times.weekday.map(x=>minute(x.time)),...a.times.sunday.map(x=>minute(x.time)),99999);const tb=Math.min(...b.times.weekday.map(x=>minute(x.time)),...b.times.sunday.map(x=>minute(x.time)),99999);return ta-tb||a.name.localeCompare(b.name,'he')});
$('shulCount').textContent=`${sh.length} בתי כנסת`;
if(!sh.length){$('shulList').innerHTML='<div class="empty">לא נמצאו בתי כנסת בחיפוש הזה.</div>';return}
const day=activeDay();const maxCards=sh.length;
$('shulList').innerHTML=sh.slice(0,maxCards).map(s=>{
 const primary=s.times[day]||[],other=s.times[day==='weekday'?'sunday':'weekday']||[],isSun=day==='sunday',l=loc(s);
 const chips=primary.length?primary.map(t=>timeChip(s,t,day)).join(''):'<span class="muted">לא פורסמו שעות ליום הזה ב־CLICK613</span>';
 const sunday=isSun?'':(s.times.sunday||[]).length?`<div class="sundaynote"><strong>יום ראשון — שעות מיוחדות:</strong><div class="times" style="margin-top:7px">${s.times.sunday.map(t=>timeChip(s,t,'sunday')).join('')}</div></div>`:'<div class="sundaynote">יום ראשון: לא צוינו שעות נפרדות בחוברת.</div>';
 const extraNote=[...new Set(primary.flatMap(t=>t.notes||[]))].slice(0,3);
 return `<article class="shul"><h3>${esc(s.name)}</h3><div class="addr">${esc(s.address)}</div><div class="hint">${esc(s.city)} · ${esc(s.area)}${l?' · '+(l.origin==='area-only'?'מיקום אזורי בקירוב':(origin?round(hav(origin,l))+' ק״מ בקירוב':'מיקום במפה')):' · <span class="warn">מיקום לא מאומת</span>'}</div><div class="timelabel">${isSun?'שחרית יום ראשון':'שחרית ימי חול'}</div><div class="times">${chips}</div>${extraNote.length?`<div class="smallprint">${esc(extraNote.join(' | '))}</div>`:''}${sunday}<div class="actions">${navLinks(s)}</div></article>`;
}).join('');if(sh.length>maxCards)$('shulList').insertAdjacentHTML('beforeend',`<p class="hint">מוצגות ${maxCards} מתוך ${sh.length} תוצאות. בחר אזור או הוסף חיפוש להצגת האחרות.</p>`)
}
function eligibleArrival(depart,mins){if(depart<=mins+10)return {arrival:Math.max(mins+5,depart),reason:'הגעה 5–10 דק׳ אחרי התחלה'};if(depart<=mins+35)return{arrival:Math.max(mins+25,depart),reason:'הגעה בסוף המניין (25–35 דק׳)'};return null}
function plannedRoute(){const start=anchor();if(!start)return[];
 const now=new Date();let cur=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;
 if(state.day==='auto'&&weekday()===6)cur=0;
 const today=activeDay();const places=activeShuls().filter(s=>(s.times[today]||[]).length&&matchArea(s)&&matchSearch(s));
 const items=[];
 for(const s of places){const l=loc(s);if(!l)continue;for(const t of s.times[today]||[]){const m=minute(t.time);if(m<cur-35||m>cur+140||visited(s,t.time,today))continue;items.push({s,t,m,l,key:s.id+'|'+t.time})}}
 let here=start,depart=cur,chosen=[];const used=new Set();
 for(let stop=0;stop<7;stop++){
  let best=null;
  for(const item of items){if(used.has(item.key))continue;const km=hav(here,item.l);const travel=driveMinutes(km);const arrival=eligibleArrival(depart+travel,item.m);if(!arrival||arrival.arrival-depart>85)continue;
   const wait=Math.max(0,arrival.arrival-(depart+travel));
   const score=travel*2+wait*.34+Math.max(0,item.m-cur)*.14+(item.m<depart-20?10:0)+(item.l.origin==='area-only'?18:0);
   if(!best||score<best.score)best={...item,score,km,travel,wait,...arrival};
  }
  if(!best)break;chosen.push(best);used.add(best.key);here=best.l;depart=best.arrival+7;
 }
 return chosen;
}
function renderPlan(){const route=plannedRoute();$('planCount').textContent=`${route.length} תחנות`;const origin=anchor();let explanation='';if(!origin)explanation='הפעל GPS או בחר אזור למעלה כדי לחשב את המניינים הקרובים.';
else if(state.position)explanation=`מחושב לפי מיקום GPS (${Math.round(state.position.accuracy||0)} מטר דיוק) · ${isSunday()?'יום ראשון':'ימי חול'} · זמנים ומרחקים משוערים`;
else explanation=`מחושב לפי מרכז אזור שנבחר, בקירוב בלבד · ${isSunday()?'יום ראשון':'ימי חול'}`;
$('planExplanation').textContent=explanation;
if(!route.length){$('routeList').innerHTML=`<div class="empty">${origin?'אין כרגע מניינים מתאימים עם מיקום מזוהה בחלון השעות הקרוב. שעות כל בתי הכנסת מופיעות בהמשך.':'נדרש מיקום GPS או בחירת אזור כדי לחשב מסלול חי.'}</div>`;return}
$('routeList').innerHTML=route.map((r,i)=>`<article class="step"><div class="stepno">${i+1}</div><div><h3>${esc(r.s.name)}</h3><div class="meta">${esc(r.s.address)} · ${r.l.origin==='area-only'?'מיקום אזורי — מרחק לא מדויק':round(r.km)+' ק״מ בקירוב'}</div><div class="badges">${timeChip(r.s,r.t,activeDay())} <span class="smalltag">${esc(r.reason)}</span></div><div class="actions" style="display:flex;gap:8px;margin-top:8px">${navLinks(r.s,true)}</div></div><div class="time"><div>${esc(r.t.time)}</div><div class="arrival">הגעה כ־${esc(fmt(r.arrival))}</div><div class="arrival">נסיעה כ־${Math.round(r.travel)} דק׳</div></div></article>`).join('');
if(state.position&&Date.now()-state.lastRoadAt>65000)fetchRoadForFirst(route[0]);
}
async function fetchRoadForFirst(first){if(!first||!state.position||!navigator.onLine)return;state.lastRoadAt=Date.now();const start=state.position,goal=first.l;
 const url=`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${goal.lon},${goal.lat}?overview=false`;
 try{const response=await fetch(url,{signal:AbortSignal.timeout(9000)});if(!response.ok)return;const d=await response.json();if(d.routes?.[0]){const km=d.routes[0].distance/1000,min=d.routes[0].duration/60;const step=$('routeList').querySelector('.step .time');if(step){const info=document.createElement('div');info.className='arrival';info.textContent=`כביש: כ־${Math.round(min)} דק׳ (${round(km)} ק״מ; ללא פקקים)`;step.appendChild(info)}}}catch{}
}
function renderDay(){const d=new Date();let daytext=d.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});if(state.day!=='auto')daytext+=' · תצוגת '+(isSunday()?'יום ראשון':'ימי חול');if(state.day==='auto'&&weekday()===6)daytext+=' · הצגת שעות יום ראשון הבא';$('dayInfo').textContent=daytext}
function render(){if(!state.opened)return;renderDay();renderPlan();renderShuls();if(state.mapVisible)drawMap()}
function chooseArea(){const areas=[...new Set(activeShuls().map(s=>`${s.city}||${s.area}`))].sort((a,b)=>a.localeCompare(b,'he'));const cityLabels={'Lakewood':'לייקווד','Jackson':'ג׳קסון','Toms River':'טומס ריבר','Howell':'האוול','Manchester':'מנצ׳סטר','EWR/Linden':'ניוארק / לינדן'};
$('areaSelect').innerHTML='<option value="">כל האזורים</option>'+areas.map(a=>{const [city,zone]=a.split('||');return `<option value="${esc(a)}">${esc(cityLabels[city]||city)} — ${esc(zone)}</option>`}).join('');$('areaSelect').value=state.area;
}
function startGPS(){if(!('geolocation' in navigator)){$('gpsTitle').textContent='GPS אינו זמין בדפדפן הזה';return}if(state.watchId!==null){navigator.geolocation.clearWatch(state.watchId);state.watchId=null} $('gpsTitle').textContent='מאתר מיקום…';$('gpsSubtitle').textContent='כדי להציג קרבה אמיתית, אפשר מיקום בדפדפן';
state.watchId=navigator.geolocation.watchPosition(p=>{const last=state.position;state.position={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};state.gps=true;$('gpsTitle').textContent='GPS פעיל — המסלול מתעדכן';$('gpsSubtitle').textContent=`דיוק דיווח: כ־${Math.round(p.coords.accuracy)} מטר · עודכן ${new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}`;
if(!last||hav(last,state.position)>0.04||Date.now()-state.lastUpdate>25000){state.lastUpdate=Date.now();render()}},e=>{$('gpsTitle').textContent=e.code===1?'גישה ל-GPS נחסמה':'לא ניתן לקבל GPS כרגע';$('gpsSubtitle').textContent='אפשר להשתמש בבחירת אזור ידנית או להפעיל הרשאת מיקום';render()},{enableHighAccuracy:true,maximumAge:10000,timeout:20000})}
function toggleVisit(id,t,day){const s=activeShuls().find(s=>s.id===id);if(!s)return;const k=visitKey(s,t,day);if(state.visited[k]){delete state.visited[k];toast(`הסימון של ${t} בוטל`)}else{state.visited[k]=true;toast(`המניין בשעה ${t} סומן באדום`)}saveStore('visited',state.visited);render()}
function parseCoordinate(input){const v=String(input||'').trim();let m=v.match(/^\s*(-?\d{1,2}\.\d+)\s*[,; ]\s*(-?\d{1,3}\.\d+)\s*$/);if(m&&validLatLon(+m[1],+m[2]))return{lat:+m[1],lon:+m[2]};m=v.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/)||v.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/)||v.match(/[?&](?:q|ll)=(-?\d{1,2}\.\d+)%2C(-?\d{1,3}\.\d+)/i);if(m&&validLatLon(+m[1],+m[2]))return{lat:+m[1],lon:+m[2]};try{const u=new URL(v);m=u.searchParams.get('q')?.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);if(m&&validLatLon(+m[1],+m[2]))return{lat:+m[1],lon:+m[2]}}catch{}return null}
function editLocation(id){const s=activeShuls().find(s=>s.id===id);if(!s)return;state.editId=id;state.selectedPoint=null;$('modalTitle').textContent=`מיקום: ${s.name}`;$('modalDescription').textContent=`${s.address} · ניתן לבחור מיקום מאותו רחוב או להזין קואורדינטות. תיקון נשמר במכשיר בלבד.`;
const choices=s.locationChoices||[];$('candidateSelect').innerHTML='<option value="">בחר מיקום אפשרי</option>'+choices.map((c,i)=>`<option value="${i}">${esc(c.name||'ללא שם')} · ${esc(c.address)} ${c.owner?'(מהרשימה שלי)':''}</option>`).join('');$('locationInput').value='';$('modalStatus').textContent='';$('locationDialog').classList.remove('hidden');$('candidateSelect').focus()}
function saveLocation(){const s=activeShuls().find(s=>s.id===state.editId);if(!s)return;const selected=$('candidateSelect').value;let pt=state.selectedPoint||parseCoordinate($('locationInput').value);if(!pt&&selected!==''){const c=s.locationChoices?.[Number(selected)];if(c)pt={lat:c.lat,lon:c.lon}}if(!pt||!validLatLon(pt.lat,pt.lon)){$('modalStatus').textContent='יש לבחור מיקום או להדביק קואורדינטות תקינות';return}state.fixes[s.id]={lat:+pt.lat,lon:+pt.lon,origin:'manual'};saveStore('locations',state.fixes);$('locationDialog').classList.add('hidden');toast('המיקום תוקן ונשמר במכשיר');render()}
function openMap(){state.mapVisible=!state.mapVisible;$('mapHolder').classList.toggle('hidden',!state.mapVisible);$('toggleMap').setAttribute('aria-expanded',String(state.mapVisible));$('toggleMap').textContent=state.mapVisible?'הסתר מפה':'הצג מפה';if(!state.mapVisible)return;if(typeof L==='undefined'){toast('המפה דורשת חיבור לאינטרנט כדי לטעון');return}if(!state.map){const origin=anchor()||{lat:40.09,lon:-74.21};state.map=L.map('map',{scrollWheelZoom:false}).setView([origin.lat,origin.lon],11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(state.map);state.markers=L.layerGroup().addTo(state.map);state.map.on('click',e=>{if(state.pickingPoint&&state.editId){state.pickingPoint=false;state.selectedPoint={lat:e.latlng.lat,lon:e.latlng.lng};$('locationInput').value=`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;$('locationDialog').classList.remove('hidden');$('modalStatus').textContent='הנקודה נבחרה. לחץ שמור מיקום.' }});}setTimeout(()=>{state.map.invalidateSize();drawMap()},110)}
function drawMap(){if(!state.map||!state.markers)return;state.markers.clearLayers();const shuls=activeShuls().filter(s=>matchArea(s)&&matchSearch(s)&&loc(s));for(const s of shuls){const p=loc(s);const timed=!!(s.times.weekday.length+s.times.sunday.length);const marker=L.circleMarker([p.lat,p.lon],{radius:timed?5:3,weight:1,color:timed?'#1c6950':'#7d9083',fillColor:timed?'#3b9b73':'#c0d2c6',fillOpacity:.85});marker.bindPopup(`<b>${esc(s.name)}</b><div>${esc(s.address)}</div><div>שחרית: ${esc((s.times[activeDay()]||[]).map(t=>t.time).join(', ')||'לא פורסם')}</div><button onclick="window.selectShulLocation('${esc(s.id)}')">תקן מיקום</button>`);marker.addTo(state.markers)}if(state.position){if(state.userMarker)state.map.removeLayer(state.userMarker);state.userMarker=L.circleMarker([state.position.lat,state.position.lon],{radius:10,weight:3,color:'#245fda',fillColor:'#80b6f4',fillOpacity:.9}).bindPopup('המיקום שלי').addTo(state.map)}else if(state.userMarker){state.map.removeLayer(state.userMarker);state.userMarker=null}}
window.selectShulLocation=id=>editLocation(id);
function csvRows(text){const out=[];let row=[],cur='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cur+='"';i++}else if(c==='"')quoted=false;else cur+=c}else if(c==='"')quoted=true;else if(c===','){row.push(cur);cur=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cur);if(row.some(x=>x))out.push(row);row=[];cur=''}else cur+=c}row.push(cur);if(row.some(x=>x))out.push(row);const headers=(out.shift()||[]).map(x=>x.toLowerCase().trim().replace(/^\ufeff/,''));return out.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])))}
function coerceLocation(raw){const props=raw.properties||raw;let name=String(props.name||props.title||props.Title||props.shul||props.Name||'').trim();let addr=String(props.address||props.Address||props.location||props.Location||props.note||props.Note||'').trim();let lat=Number(props.lat??props.latitude??props.Latitude),lon=Number(props.lon??props.lng??props.longitude??props.Longitude);
 if(raw.geometry?.type==='Point'&&Array.isArray(raw.geometry.coordinates)){lon=Number(raw.geometry.coordinates[0]);lat=Number(raw.geometry.coordinates[1])}
 if(!validLatLon(lat,lon)||!lat||!lon){const parsed=parseCoordinate(props.url||props.URL||props.googlemapsurl||props.link||'');if(parsed){lat=parsed.lat;lon=parsed.lon}}
 return validLatLon(lat,lon)&&lat&&lon?{name,address:addr,lat,lon}:null}
async function importLocations(file){const raw=await file.text();let points=[],corrections=false;
 try{if(/\.kml$/i.test(file.name)){const xml=new DOMParser().parseFromString(raw,'application/xml');points=[...xml.querySelectorAll('Placemark')].map(p=>{const name=p.querySelector('name')?.textContent||'',description=p.querySelector('description')?.textContent||'',coordinates=p.querySelector('Point > coordinates')?.textContent||'';const [lon,lat]=coordinates.split(',').map(Number);return{name,address:description,lat,lon}}).filter(p=>validLatLon(p.lat,p.lon)&&p.lat&&p.lon)}
 else if(/\.csv$/i.test(file.name)){points=csvRows(raw).map(coerceLocation).filter(Boolean)}
 else{const data=JSON.parse(raw);if(data.locationOverrides&&typeof data.locationOverrides==='object'){for(const [id,v] of Object.entries(data.locationOverrides)){if(validLatLon(v.lat,v.lon))state.fixes[id]={lat:v.lat,lon:v.lon,origin:'imported-correction'}}saveStore('locations',state.fixes);corrections=true}points=(Array.isArray(data)?data:data.features||data.places||data.shuls||data.addedPlaces||[]).map(coerceLocation).filter(Boolean)}
 }catch(e){$('importStatus').textContent=`שגיאה בפתיחת הקובץ: ${e.message}`;return}
 const all=activeShuls();let matched=0,added=0,ignored=0;
 for(const p of points){const key=normalize(p.address.split(',')[0]);const name=normalize(p.name);const candidates=all.filter(s=>(key&&normalize(s.street)===key)||(name&&normalize(s.name)===name));let match=null;if(candidates.length===1)match=candidates[0];else if(candidates.length>1){const addrMatches=candidates.filter(s=>key&&normalize(s.street)===key);if(addrMatches.length===1)match=addrMatches[0]}
  if(match){state.fixes[match.id]={lat:p.lat,lon:p.lon,origin:'imported-map'};matched++}
  else if(p.name||p.address){const id='import-'+normalize(p.name+' '+p.address).slice(0,60);if(!all.some(s=>s.id===id)){const sh={id,name:p.name||p.address,aliases:[],address:p.address||p.name,street:p.address?.split(',')[0]||'',area:'רשימה מיובאת',city:'New Jersey',lat:p.lat,lon:p.lon,times:{weekday:[],sunday:[]},sourcePages:[]};state.extra.push(sh);all.push(sh);added++}else ignored++}else ignored++
 }
 saveStore('locations',state.fixes);saveStore('extra',state.extra);$('importStatus').textContent=`עודכנו ${matched} מיקומים; נוספו ${added} בתי כנסת ללא זמני שחרית; ${ignored} רשומות לא נוספו.${corrections?' יובאו גם תיקונים קודמים.':''}${!points.length?' לא נמצאו קואורדינטות בקובץ; ניתן לייצא מיקומים עם GPS מתוך Google Takeout או KML.':''}`;chooseArea();render();toast('קובץ המיקומים נקלט')
}
function exportFixes(){const obj={format:'CLICK613_LOCATION_CORRECTIONS',exportedAt:new Date().toISOString(),source:'coordinates only (NO schedule times)',locationOverrides:state.fixes,addedPlaces:state.extra.map(s=>({name:s.name,address:s.address,latitude:s.lat,longitude:s.lon}))};const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Click613_Location_Corrections.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
async function init(){try{const r=await fetch('./data.json',{cache:'no-store'});if(!r.ok)throw new Error('לא ניתן לטעון רשימה');const data=await r.json();state.original=data.shuls;state.shuls=data.shuls;
 const timed=state.shuls.filter(s=>s.times.sunday.length+s.times.weekday.length).length;$('sourceNotice').textContent=`CLICK613 גליון 256 (15–20 בנובמבר 2026) · ${timed} בתי כנסת עם שעות · זמני שחרית בלבד. חלק מהשעות בחוברת לא אושרו מחדש; יש לוודא לפני נסיעה.`;chooseArea();
 }catch(e){$('sourceNotice').textContent=`נתוני החוברת לא נטענו (${e.message}). יש להעלות את כל הקבצים ל-GitHub Pages.`;toast('שגיאה בטעינת data.json')}
}
$('openLive').addEventListener('click',()=>{state.opened=true;$('intro').classList.add('hidden');$('live').classList.remove('hidden');render();startGPS()});
$('startGPS').addEventListener('click',startGPS);
$('dayMode').addEventListener('change',e=>{state.day=e.target.value;render()});
$('areaSelect').addEventListener('change',e=>{state.area=e.target.value;render()});
$('search').addEventListener('input',e=>{state.search=e.target.value;render()});
$('refresh').addEventListener('click',()=>{state.road=null;state.lastRoadAt=0;render();toast('המסלול חושב מחדש')});
$('toggleMap').addEventListener('click',openMap);
for(const id of ['shulList','routeList'])$(id).addEventListener('click',e=>{const button=e.target.closest('button[data-action]');if(!button)return;const {action,id,time,day}=button.dataset;if(action==='visit')toggleVisit(id,time,day);if(action==='edit')editLocation(id)});
$('candidateSelect').addEventListener('change',e=>{const s=activeShuls().find(x=>x.id===state.editId),candidate=s?.locationChoices?.[Number(e.target.value)];if(e.target.value!==''&&candidate)$('locationInput').value=`${candidate.lat}, ${candidate.lon}`});
$('saveLocation').addEventListener('click',saveLocation);
$('clearLocation').addEventListener('click',()=>{delete state.fixes[state.editId];saveStore('locations',state.fixes);$('locationDialog').classList.add('hidden');toast('חזר למיקום המקורי');render()});
$('pickMap').addEventListener('click',()=>{if(typeof L==='undefined'){toast('המפה לא נטענה; נסה להזין קואורדינטות');return}state.pickingPoint=true;$('locationDialog').classList.add('hidden');if(!state.mapVisible)openMap();$('mapHolder').scrollIntoView({behavior:'smooth',block:'center'});toast('לחץ על הנקודה הרצויה במפה')});
$('closeDialog').addEventListener('click',()=>{$('locationDialog').classList.add('hidden');state.editId=null});
$('locationDialog').addEventListener('click',e=>{if(e.target.id==='locationDialog'){$('locationDialog').classList.add('hidden');state.editId=null}});
$('importFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await importLocations(f);e.target.value='' });
$('exportFixes').addEventListener('click',exportFixes);
function renderClock(){$('clock').textContent=new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',hour12:false});if(state.opened&&Date.now()-state.lastUpdate>60000){state.lastUpdate=Date.now();render()}}
renderClock();setInterval(renderClock,15000);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
init();

"use strict";
(function(){
const API="/api";
const app=document.getElementById("app");
const esc=v=>String(v==null?"":v).replace(/[&<>"'`=\/]/g,c=>"&#"+c.charCodeAt(0)+";");
const naira=n=>"\u20A6"+Number(n||0).toLocaleString("en-NG");
const safeUrl=u=>{try{const x=new URL(String(u||""),location.href);return x.origin===location.origin?x.pathname+x.search:""}catch(e){return""}};
const slugify=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,200);
const DEFAULT_AMEN=["Fully furnished short let apartments","Quick booking","24/7 electricity","24/7 Wi-Fi","DStv and smart TV","Attached Ubers","Ample parking space","CCTV-covered compound","24/7 customer support"];
const MAX_BYTES=5*1024*1024,MAX_PHOTOS=20,TYPES=["image/jpeg","image/png","image/webp"];
let csrf="",me=null,settingsCache=null;

/* ---------- toasts / confirm ---------- */
function toast(msg,type){const t=document.createElement("div");t.className="toast"+(type==="error"?" error":"");t.setAttribute("role",type==="error"?"alert":"status");t.textContent=msg;document.getElementById("toasts").appendChild(t);setTimeout(()=>t.remove(),type==="error"?6000:3200)}
const ok=m=>toast(m,"ok"),bad=m=>toast(m,"error");
function confirmBox(title,body,label){return new Promise(res=>{const d=document.getElementById("confirm");document.getElementById("confirm-title").textContent=title;document.getElementById("confirm-body").textContent=body;document.getElementById("confirm-ok").textContent=label||"Delete";d.returnValue="";d.addEventListener("close",()=>res(d.returnValue==="ok"),{once:true});d.showModal()})}

/* ---------- api ---------- */
async function getCsrf(){const r=await fetch(API+"/admin/csrf",{credentials:"same-origin",cache:"no-store"});const d=await r.json().catch(()=>({}));if(d&&d.csrfToken)csrf=d.csrfToken;return csrf}
async function req(method,path,body,retried){
 const h={Accept:"application/json"};const mut=method!=="GET";
 if(mut){if(!csrf)await getCsrf();h["X-CSRF-Token"]=csrf}
 if(body!==undefined)h["Content-Type"]="application/json";
 let r;try{r=await fetch(API+path,{method,headers:h,credentials:"same-origin",cache:"no-store",body:body!==undefined?JSON.stringify(body):undefined})}catch(e){throw new Error("Network error. Check your connection.")}
 let d=null;if(r.status!==204){d=await r.json().catch(()=>null)}
 if(r.status===403&&mut&&!retried){await getCsrf();return req(method,path,body,true)}
 if(r.status===401&&path!=="/admin/login"&&path!=="/admin/me"){me=null;await getCsrf().catch(()=>{});bad("Your session has expired. Please sign in again.");renderLogin();throw Object.assign(new Error("Session expired"),{status:401,silent:true})}
 if(!r.ok){throw Object.assign(new Error((d&&d.error)||("Request failed ("+r.status+")")),{status:r.status})}
 return d;
}
function upload(path,files,onProg){return new Promise(async(res,rej)=>{
 if(!csrf)await getCsrf();
 const send=retried=>{const fd=new FormData();files.forEach(f=>fd.append("photos",f,f.name));
  const x=new XMLHttpRequest();x.open("POST",API+path);x.withCredentials=true;x.setRequestHeader("X-CSRF-Token",csrf);x.setRequestHeader("Accept","application/json");
  x.upload.onprogress=e=>{if(e.lengthComputable)onProg(e.loaded/e.total)};
  x.onerror=()=>rej(new Error("Upload failed. Check your connection."));
  x.onload=async()=>{let d=null;try{d=JSON.parse(x.responseText)}catch(e){}
   if(x.status===403&&!retried){await getCsrf();return send(true)}
   if(x.status===401){me=null;bad("Your session has expired. Please sign in again.");renderLogin();return rej(Object.assign(new Error("Session expired"),{silent:true}))}
   if(x.status>=200&&x.status<300)res(d);else rej(new Error((d&&d.error)||("Upload failed ("+x.status+")")))};
  x.send(fd)};
 send(false);
})}
const fail=e=>{if(!e||!e.silent)bad(e&&e.message?e.message:"Something went wrong.")};

/* ---------- shell ---------- */
const TABS=[["#/","Apartments"],["#/gallery","Gallery"],["#/settings","Settings"],["#/account","Account"]];
function shell(active,inner){
 app.innerHTML=`<header class="top"><div class="mark">The Don's Place<small>Manager</small></div><span class="sp"></span><nav class="tabs" aria-label="Admin">${TABS.map(([h,t])=>`<a href="${h}" data-testid="link-tab-${t.toLowerCase()}"${h===active?' aria-current="page"':""}>${t}</a>`).join("")}</nav><button class="b ghost sm" id="logout" data-testid="button-logout">Sign out</button></header><main class="main" id="view">${inner}</main>`;
 document.getElementById("logout").onclick=logout;
 return document.getElementById("view");
}
const skeleton=n=>`<div class="sk sk-line w40"></div>${'<div class="sk sk-card"></div>'.repeat(n||3)}`;
function errBox(view,msg,retry){view.innerHTML=`<div class="err" role="alert"><span>${esc(msg)}</span><button class="b sm plum" data-retry data-testid="button-retry">Try again</button></div>`;view.querySelector("[data-retry]").onclick=retry}

/* ---------- auth ---------- */
function renderLogin(){
 app.innerHTML=`<div class="login"><div class="card"><img src="/assets/logo.png" alt="The Don's Place" width="150" height="54"><h1>Welcome back</h1><p>Sign in to manage apartments, photos and contact details.</p><form class="grid" id="lf" novalidate><label class="fld"><span>Username</span><input class="in" name="username" autocomplete="username" required maxlength="100" data-testid="input-username"></label><label class="fld"><span>Password</span><input class="in" type="password" name="password" autocomplete="current-password" required maxlength="200" data-testid="input-password"></label><button class="b plum" type="submit" data-testid="button-login">Sign in</button></form></div></div>`;
 const f=document.getElementById("lf");f.username.focus();
 f.onsubmit=async e=>{e.preventDefault();const u=f.username.value.trim(),p=f.password.value;if(!u||!p)return bad("Enter your username and password.");
  const btn=f.querySelector("button");btn.disabled=true;btn.textContent="Signing in...";
  try{await getCsrf();const d=await req("POST","/admin/login",{username:u,password:p});if(d&&d.csrfToken)csrf=d.csrfToken;me={username:d&&d.username||u};ok("Signed in.");if(!location.hash||location.hash==="#")location.hash="#/";route()}
  catch(e){fail(e);btn.disabled=false;btn.textContent="Sign in";f.password.value="";f.password.focus()}};
}
async function logout(){try{await req("POST","/admin/logout");}catch(e){if(e.silent)return}me=null;csrf="";await getCsrf().catch(()=>{});ok("Signed out.");renderLogin()}

/* ---------- dashboard ---------- */
async function dashboard(){
 const view=shell("#/",skeleton(3));
 let list;try{list=await req("GET","/admin/apartments")}catch(e){if(e.silent)return;return errBox(view,e.message,dashboard)}
 list=(Array.isArray(list)?list:[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
 const avail=list.filter(a=>a.is_available).length,samples=list.filter(a=>a.is_sample).length;
 view.innerHTML=`<div class="head"><div><p class="eyebrow">Short lets in Ajah</p><h1>Apartments</h1></div><a class="b" href="#/new" data-testid="button-add-apartment">Add apartment</a></div>
 <div class="stats"><div class="stat"><b>${list.length}</b><span>Listed</span></div><div class="stat"><b>${avail}</b><span>Available</span></div><div class="stat"><b>${samples}</b><span>Sample entries</span></div></div>
 ${samples?`<p class="card muted" style="margin-bottom:1rem">Entries tagged <span class="tag sample">Sample</span> are placeholder data. Edit them with real details and untick "sample", or delete them.</p>`:""}
 ${list.length?`<div class="apts">${list.map(a=>{const th=safeUrl((a.thumbnails||[])[0]||(a.photos||[])[0]);return `<article class="apt" data-testid="card-apartment-${esc(a.id)}"><div class="th">${th?`<img src="${esc(th)}" alt="" loading="lazy">`:'<div class="none">No photo yet</div>'}</div><div><h3>${esc(a.name)}</h3><div class="meta"><span class="price" data-testid="text-price-${esc(a.id)}">${naira(a.price_per_night)}</span><span class="muted">/ night</span>${a.is_sample?'<span class="tag sample">Sample</span>':""}${a.is_featured?'<span class="tag feat">Featured</span>':""}${a.is_available?"":'<span class="tag off">Hidden</span>'}<span class="muted" style="font-size:.8rem">${(a.photos||[]).length} photo${(a.photos||[]).length===1?"":"s"}</span></div></div><div class="acts"><label class="sw"><input type="checkbox" data-avail="${esc(a.id)}" ${a.is_available?"checked":""} data-testid="toggle-available-${esc(a.id)}"><span>Available</span></label><a class="b sm ghost" href="#/apt/${encodeURIComponent(a.id)}" data-testid="button-edit-${esc(a.id)}">Edit</a><button class="b sm danger" data-del="${esc(a.id)}" data-testid="button-delete-${esc(a.id)}">Delete</button></div></article>`}).join("")}</div>`
 :`<div class="empty"><h3>No apartments yet</h3><p>Add your first apartment, then upload its photos.</p><p class="mt"><a class="b" href="#/new">Add apartment</a></p></div>`}`;
 view.querySelectorAll("[data-avail]").forEach(c=>c.onchange=async()=>{c.disabled=true;try{await req("PATCH","/admin/apartments/"+encodeURIComponent(c.dataset.avail),{is_available:c.checked});ok(c.checked?"Apartment is now visible on the site.":"Apartment hidden from the site.");dashboard()}catch(e){c.checked=!c.checked;fail(e)}finally{c.disabled=false}});
 view.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{const a=list.find(x=>x.id===b.dataset.del);if(!await confirmBox("Delete "+a.name+"?","This removes the apartment and all of its photos permanently.","Delete apartment"))return;b.disabled=true;try{await req("DELETE","/admin/apartments/"+encodeURIComponent(a.id));ok("Apartment deleted.");dashboard()}catch(e){fail(e);b.disabled=false}});
}

/* ---------- apartment editor ---------- */
async function getSettings(){if(settingsCache)return settingsCache;settingsCache=await req("GET","/admin/settings");return settingsCache}
async function editor(id){
 const view=shell("#/",skeleton(2));
 let a=null,amenOpts=DEFAULT_AMEN;
 try{
  const [list,s]=await Promise.all([id?req("GET","/admin/apartments"):Promise.resolve(null),getSettings().catch(()=>null)]);
  if(s&&Array.isArray(s.amenities)&&s.amenities.length)amenOpts=s.amenities;
  if(id){a=(list||[]).find(x=>x.id===id);if(!a){view.innerHTML=`<div class="empty"><h3>Apartment not found</h3><p class="mt"><a class="b" href="#/">Back to apartments</a></p></div>`;return}}
 }catch(e){if(e.silent)return;return errBox(view,e.message,()=>editor(id))}
 const v=a||{name:"",slug:"",blurb:"",description:"",price_per_night:"",highlights:[],amenities:amenOpts.slice(),is_available:true,is_featured:false,is_sample:false,sort_order:0};
 const allAmen=[...new Set([...amenOpts,...(v.amenities||[])])];
 let highlights=(v.highlights||[]).slice(),slugTouched=!!a;
 view.innerHTML=`<div class="head"><div><a href="#/" class="muted" data-testid="link-back">&larr; All apartments</a><h1>${a?esc(a.name):"New apartment"}</h1></div>${a&&a.is_sample?'<span class="tag sample">Sample data</span>':""}</div>
 <form class="grid card" id="af" novalidate>
  <div class="two"><label class="fld"><span>Name</span><input class="in" name="name" required maxlength="200" value="${esc(v.name)}" data-testid="input-name"></label>
  <label class="fld"><span>Web address (slug)</span><input class="in" name="slug" maxlength="200" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${esc(v.slug)}" data-testid="input-slug"><small>Made from the name automatically. Lowercase letters, numbers and dashes.</small></label></div>
  <div class="two"><label class="fld"><span>Price per night</span><span class="prefix"><b>\u20A6</b><input class="in" name="price" inputmode="numeric" required value="${esc(v.price_per_night)}" data-testid="input-price"></span><small>Whole naira. Changes show on the site straight away.</small></label>
  <label class="fld"><span>Display order</span><input class="in" name="sort_order" type="number" min="0" value="${esc(v.sort_order||0)}" data-testid="input-sort"><small>Lower numbers show first.</small></label></div>
  <label class="fld"><span>Short blurb</span><textarea class="in" name="blurb" maxlength="1000" required style="min-height:80px" data-testid="input-blurb">${esc(v.blurb)}</textarea></label>
  <label class="fld"><span>Description</span><textarea class="in" name="description" maxlength="10000" data-testid="input-description">${esc(v.description||"")}</textarea><small>Leave a blank line between paragraphs.</small></label>
  <div class="fld"><span>Highlights</span><div class="row"><input class="in" id="hl" maxlength="200" placeholder="e.g. 24/7 electricity" style="flex:1" data-testid="input-highlight"><button type="button" class="b sm plum" id="hladd" data-testid="button-add-highlight">Add</button></div><div class="chips" id="chips"></div><small>Up to 30. Shown on the apartment card.</small></div>
  <div class="fld"><span>Amenities</span><div class="checks">${allAmen.map((m,i)=>`<label class="chk"><input type="checkbox" name="amen" value="${esc(m)}" ${(v.amenities||[]).includes(m)?"checked":""} data-testid="checkbox-amenity-${i}">${esc(m)}</label>`).join("")}</div></div>
  <div class="row" style="gap:1.4rem"><label class="sw"><input type="checkbox" name="is_available" ${v.is_available?"checked":""} data-testid="toggle-available">Available</label><label class="sw"><input type="checkbox" name="is_featured" ${v.is_featured?"checked":""} data-testid="toggle-featured">Featured on home</label><label class="sw"><input type="checkbox" name="is_sample" ${v.is_sample?"checked":""} data-testid="toggle-sample">Sample data</label></div>
  <div class="bar">${a?`<button type="button" class="b danger" id="adel" data-testid="button-delete-apartment">Delete</button>`:""}<button class="b plum" type="submit" data-testid="button-save-apartment">${a?"Save changes":"Create apartment"}</button></div>
 </form>
 <section class="sec" id="photosec">${a?"":`<h2>Photos</h2><div class="empty"><p>Create the apartment first, then you can upload photos.</p></div>`}</section>`;
 const f=document.getElementById("af");
 const chips=()=>{document.getElementById("chips").innerHTML=highlights.map((h,i)=>`<span class="chip">${esc(h)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(h)}">&times;</button></span>`).join("")};chips();
 document.getElementById("chips").onclick=e=>{const b=e.target.closest("[data-rm]");if(b){highlights.splice(+b.dataset.rm,1);chips()}};
 const addHl=()=>{const i=document.getElementById("hl"),t=i.value.trim();if(!t)return;if(highlights.length>=30)return bad("You can add up to 30 highlights.");if(!highlights.includes(t))highlights.push(t);i.value="";chips();i.focus()};
 document.getElementById("hladd").onclick=addHl;document.getElementById("hl").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addHl()}};
 f.name.oninput=()=>{if(!slugTouched)f.slug.value=slugify(f.name.value)};f.slug.oninput=()=>{slugTouched=true};
 f.onsubmit=async e=>{e.preventDefault();
  const name=f.name.value.trim(),slug=slugify(f.slug.value||name),blurb=f.blurb.value.trim(),price=Number(String(f.price.value).replace(/[,\s\u20A6]/g,""));
  if(!name)return bad("Give the apartment a name.");if(!slug)return bad("The web address cannot be empty.");if(!blurb)return bad("Add a short blurb.");
  if(!Number.isInteger(price)||price<0)return bad("Enter the price as a whole number of naira.");
  const body={name,slug,blurb,description:f.description.value.trim(),price_per_night:price,highlights,amenities:[...f.querySelectorAll('[name=amen]:checked')].map(x=>x.value),is_available:f.is_available.checked,is_featured:f.is_featured.checked,is_sample:f.is_sample.checked,sort_order:Math.max(0,parseInt(f.sort_order.value,10)||0)};
  const btn=f.querySelector("[type=submit]");btn.disabled=true;
  try{if(a){await req("PATCH","/admin/apartments/"+encodeURIComponent(a.id),body);ok("Changes saved.");editor(a.id)}else{const c=await req("POST","/admin/apartments",body);ok("Apartment created. Now add photos.");location.hash=c&&c.id?"#/apt/"+encodeURIComponent(c.id):"#/"}}
  catch(err){fail(err);btn.disabled=false}};
 if(a){document.getElementById("adel").onclick=async()=>{if(!await confirmBox("Delete "+a.name+"?","This removes the apartment and all of its photos permanently.","Delete apartment"))return;try{await req("DELETE","/admin/apartments/"+encodeURIComponent(a.id));ok("Apartment deleted.");location.hash="#/"}catch(e){fail(e)}};
  photoManager(document.getElementById("photosec"),{apt:a,reload:async()=>{const l=await req("GET","/admin/apartments");return(l||[]).find(x=>x.id===a.id)}});}
}

/* ---------- photo manager (apartment or general gallery) ---------- */
function photoManager(el,opt){
 let apt=opt.apt||null,photos=[];
 const isApt=!!apt,base=isApt?"/admin/apartments/"+encodeURIComponent(apt.id)+"/photos":"/admin/gallery";
 const sortP=p=>(p||[]).slice().sort((x,y)=>(x.sort_order||0)-(y.sort_order||0));
 photos=isApt?sortP(apt.photo_records):sortP(opt.photos);
 el.innerHTML=`<div class="head" style="margin-bottom:.6rem"><div><h2>${isApt?"Photos":"General photos"}</h2><p>${isApt?"Drag to reorder or use the arrows. The cover photo shows first everywhere.":"Photos of the building, compound and shared spaces."}</p></div><span class="muted" id="pcount"></span></div>
 <div class="drop" tabindex="0" role="button" id="drop" data-testid="dropzone-photos"><strong>Tap to choose photos</strong><p>or drag them here. JPG, PNG or WebP, up to 5 MB each, ${MAX_PHOTOS} per ${isApt?"apartment":"upload"}.</p><input type="file" id="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-testid="input-photos"></div>
 <div class="prog" id="prog"><div class="track"><div class="fill" id="fill"></div></div><p id="ptext">Uploading...</p></div>
 <div id="plist"></div>`;
 const drop=el.querySelector("#drop"),file=el.querySelector("#file"),prog=el.querySelector("#prog"),fill=el.querySelector("#fill"),ptext=el.querySelector("#ptext"),plist=el.querySelector("#plist");
 let busy=false,dragId=null;
 const coverId=()=>isApt?(apt.cover_photo_id||(photos[0]&&photos[0].id)):null;
 function draw(){
  el.querySelector("#pcount").textContent=photos.length+(isApt?" / "+MAX_PHOTOS:"")+" photos";
  if(!photos.length){plist.innerHTML=`<div class="empty mt"><h3>No photos yet</h3><p>${isApt?"Guests see a placeholder image until you add some.":"Upload photos to fill the public gallery."}</p></div>`;return}
  const cid=coverId();
  plist.innerHTML=`<div class="photos">${photos.map((p,i)=>{const src=safeUrl(p.thumb_url||p.url);return `<div class="ph" draggable="${isApt}" data-id="${esc(p.id)}" data-testid="card-photo-${esc(p.id)}"><div class="img">${src?`<img src="${esc(src)}" alt="${esc(p.alt||"")}" loading="lazy">`:""}${isApt&&p.id===cid?'<span class="cov">COVER</span>':""}<span class="num">${i+1}</span></div><div class="bd"><input class="in" maxlength="500" placeholder="Describe this photo" value="${esc(p.alt||"")}" data-alt="${esc(p.id)}" aria-label="Alt text for photo ${i+1}" data-testid="input-alt-${esc(p.id)}"><div class="row">${isApt?`<button class="b sm ghost icon" data-up="${i}" ${i===0?"disabled":""} aria-label="Move earlier" data-testid="button-up-${esc(p.id)}">&uarr;</button><button class="b sm ghost icon" data-down="${i}" ${i===photos.length-1?"disabled":""} aria-label="Move later" data-testid="button-down-${esc(p.id)}">&darr;</button>${p.id===cid?"":`<button class="b sm" data-cover="${esc(p.id)}" data-testid="button-cover-${esc(p.id)}">Cover</button>`}`:""}<button class="b sm danger" data-pdel="${esc(p.id)}" style="margin-left:auto" data-testid="button-delete-photo-${esc(p.id)}">Delete</button></div></div></div>`}).join("")}</div>`;
 }
 async function refresh(){try{if(isApt){apt=await opt.reload();photos=sortP(apt&&apt.photo_records)}else{photos=sortP(await opt.reload())}draw()}catch(e){fail(e)}}
 async function saveOrder(){draw();try{await req("PUT",base+"/order",{photoIds:photos.map(p=>p.id)});ok("Photo order saved.")}catch(e){fail(e);refresh()}}
 async function handle(list){
  if(busy)return bad("Please wait for the current upload to finish.");
  let files=[...list];const good=[];
  for(const f of files){if(!TYPES.includes(f.type)){bad(f.name+": only JPG, PNG or WebP files are allowed.");continue}if(f.size>MAX_BYTES){bad(f.name+" is larger than 5 MB.");continue}good.push(f)}
  const room=isApt?MAX_PHOTOS-photos.length:MAX_PHOTOS;
  if(room<=0)return bad("This apartment already has "+MAX_PHOTOS+" photos. Delete some first.");
  if(good.length>room){bad("Only the first "+room+" photos will be uploaded (limit "+MAX_PHOTOS+").");good.length=room}
  if(!good.length)return;
  busy=true;prog.classList.add("on");fill.style.width="0";ptext.textContent="Uploading "+good.length+" photo"+(good.length>1?"s":"")+"... 0%";
  try{await upload(base,good,r=>{const pc=Math.round(r*100);fill.style.width=pc+"%";ptext.textContent=pc<100?"Uploading "+good.length+" photo"+(good.length>1?"s":"")+"... "+pc+"%":"Processing photos..."});ok(good.length+" photo"+(good.length>1?"s":"")+" uploaded.");await refresh()}
  catch(e){fail(e)}finally{busy=false;prog.classList.remove("on");file.value=""}
 }
 drop.onclick=()=>file.click();drop.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();file.click()}};
 file.onchange=()=>handle(file.files);
 ["dragenter","dragover"].forEach(t=>drop.addEventListener(t,e=>{if(dragId)return;e.preventDefault();drop.classList.add("on")}));
 ["dragleave","drop"].forEach(t=>drop.addEventListener(t,()=>drop.classList.remove("on")));
 drop.addEventListener("drop",e=>{if(dragId)return;e.preventDefault();if(e.dataTransfer.files.length)handle(e.dataTransfer.files)});
 plist.addEventListener("click",async e=>{const t=e.target.closest("button");if(!t)return;
  if(t.dataset.up){const i=+t.dataset.up;[photos[i-1],photos[i]]=[photos[i],photos[i-1]];return saveOrder()}
  if(t.dataset.down){const i=+t.dataset.down;[photos[i+1],photos[i]]=[photos[i],photos[i+1]];return saveOrder()}
  if(t.dataset.cover){t.disabled=true;try{await req("PUT","/admin/apartments/"+encodeURIComponent(apt.id)+"/cover/"+encodeURIComponent(t.dataset.cover));ok("Cover photo updated.");await refresh()}catch(err){fail(err);t.disabled=false}return}
  if(t.dataset.pdel){if(!await confirmBox("Delete this photo?","The photo is removed from the site and from storage. This cannot be undone.","Delete photo"))return;t.disabled=true;try{await req("DELETE","/admin/photos/"+encodeURIComponent(t.dataset.pdel));ok("Photo deleted.");await refresh()}catch(err){fail(err);t.disabled=false}}
 });
 plist.addEventListener("change",async e=>{const i=e.target.closest("[data-alt]");if(!i)return;const p=photos.find(x=>x.id===i.dataset.alt);const val=i.value.trim();if(p&&(p.alt||"")===val)return;try{await req("PATCH","/admin/photos/"+encodeURIComponent(i.dataset.alt),{alt:val});if(p)p.alt=val;ok("Photo description saved.")}catch(err){fail(err)}});
 plist.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches("[data-alt]")){e.preventDefault();e.target.blur()}});
 if(isApt){
  plist.addEventListener("dragstart",e=>{const c=e.target.closest(".ph");if(!c)return;dragId=c.dataset.id;c.classList.add("drag");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",dragId)});
  plist.addEventListener("dragend",()=>{dragId=null;plist.querySelectorAll(".ph").forEach(x=>x.classList.remove("drag","over"))});
  plist.addEventListener("dragover",e=>{const c=e.target.closest(".ph");if(!c||!dragId)return;e.preventDefault();plist.querySelectorAll(".over").forEach(x=>x.classList.remove("over"));if(c.dataset.id!==dragId)c.classList.add("over")});
  plist.addEventListener("drop",e=>{const c=e.target.closest(".ph");if(!c||!dragId)return;e.preventDefault();const from=photos.findIndex(p=>p.id===dragId),to=photos.findIndex(p=>p.id===c.dataset.id);dragId=null;if(from<0||to<0||from===to)return draw();const [m]=photos.splice(from,1);photos.splice(to,0,m);saveOrder()});
 }
 draw();
}

/* ---------- gallery ---------- */
async function gallery(){
 const view=shell("#/gallery",skeleton(2));
 const load=async()=>{const all=await req("GET","/gallery");return(Array.isArray(all)?all:[]).filter(p=>!p.apartment_id)};
 let photos;try{photos=await load()}catch(e){if(e.silent)return;return errBox(view,e.message,gallery)}
 view.innerHTML=`<div class="head"><div><p class="eyebrow">Public gallery</p><h1>Gallery</h1><p>Apartment photos appear in the gallery automatically. Add extra photos of the property here.</p></div></div><section id="gsec"></section>`;
 photoManager(document.getElementById("gsec"),{photos,reload:load});
}

/* ---------- settings ---------- */
async function settings(){
 const view=shell("#/settings",skeleton(2));
 let s;try{settingsCache=null;s=await getSettings()}catch(e){if(e.silent)return;return errBox(view,e.message,settings)}
 let amen=Array.isArray(s.amenities)?s.amenities.slice():[];
 view.innerHTML=`<div class="head"><div><p class="eyebrow">Shown across the public site</p><h1>Settings</h1></div></div>
 <form class="grid card" id="sf" novalidate>
  <h2>Contact details</h2>
  <div class="two"><label class="fld"><span>WhatsApp number</span><input class="in" name="whatsapp_number" inputmode="numeric" maxlength="15" value="${esc(s.whatsapp_number)}" data-testid="input-wa-number"><small>Digits only with country code, e.g. 2348066164126. Used for every booking link.</small></label>
  <label class="fld"><span>WhatsApp (as displayed)</span><input class="in" name="whatsapp_display" maxlength="50" value="${esc(s.whatsapp_display)}" data-testid="input-wa-display"></label></div>
  <div class="two"><label class="fld"><span>Email</span><input class="in" type="email" name="email" maxlength="200" value="${esc(s.email)}" data-testid="input-email"></label>
  <label class="fld"><span>Owner</span><input class="in" name="owner" maxlength="200" value="${esc(s.owner)}" data-testid="input-owner"></label></div>
  <label class="fld"><span>Address</span><input class="in" name="address" maxlength="500" value="${esc(s.address)}" data-testid="input-address"></label>
  <h2 class="mt">Amenities</h2>
  <div class="fld"><div class="row"><input class="in" id="am" maxlength="200" placeholder="Add an amenity" style="flex:1" data-testid="input-amenity"><button type="button" class="b sm plum" id="amadd" data-testid="button-add-amenity">Add</button></div><div class="chips" id="achips"></div><small>Listed on the home page and offered as checkboxes on each apartment.</small></div>
  <h2 class="mt">Terms and house rules</h2>
  <label class="fld"><textarea class="in" name="terms" maxlength="20000" style="min-height:260px" data-testid="input-terms">${esc(s.terms||"")}</textarea><small>Start a line with "## " for a heading and "- " for a bullet point. Plain lines become paragraphs.</small></label>
  <div class="bar"><button class="b plum" type="submit" data-testid="button-save-settings">Save settings</button></div>
 </form>`;
 const f=document.getElementById("sf");
 const draw=()=>{document.getElementById("achips").innerHTML=amen.map((m,i)=>`<span class="chip">${esc(m)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(m)}">&times;</button></span>`).join("")};draw();
 document.getElementById("achips").onclick=e=>{const b=e.target.closest("[data-rm]");if(b){amen.splice(+b.dataset.rm,1);draw()}};
 const add=()=>{const i=document.getElementById("am"),t=i.value.trim();if(!t)return;if(amen.length>=30)return bad("You can list up to 30 amenities.");if(!amen.includes(t))amen.push(t);i.value="";draw()};
 document.getElementById("amadd").onclick=add;document.getElementById("am").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();add()}};
 f.onsubmit=async e=>{e.preventDefault();
  const body={...s,whatsapp_number:f.whatsapp_number.value.replace(/\D/g,""),whatsapp_display:f.whatsapp_display.value.trim(),email:f.email.value.trim(),address:f.address.value.trim(),owner:f.owner.value.trim(),business_name:"The Don's Place",amenities:amen,terms:f.terms.value};
  if(!/^[0-9]{8,15}$/.test(body.whatsapp_number))return bad("WhatsApp number must be 8 to 15 digits.");
  if(!body.address)return bad("Address cannot be empty.");if(!body.owner)return bad("Owner cannot be empty.");
  const btn=f.querySelector("[type=submit]");btn.disabled=true;
  try{const r=await req("PUT","/admin/settings",body);s=r&&typeof r==="object"?r:body;settingsCache=s;ok("Settings saved.")}catch(err){fail(err)}finally{btn.disabled=false}};
}

/* ---------- account ---------- */
function account(){
 const view=shell("#/account","");
 view.innerHTML=`<div class="head"><div><p class="eyebrow">Signed in as ${esc(me&&me.username||"")}</p><h1>Account</h1></div></div>
 <form class="grid card" id="pf" novalidate style="max-width:480px"><h2>Change password</h2>
  <label class="fld"><span>Current password</span><input class="in" type="password" name="cur" autocomplete="current-password" maxlength="200" data-testid="input-current-password"></label>
  <label class="fld"><span>New password</span><input class="in" type="password" name="nw" autocomplete="new-password" minlength="12" maxlength="72" data-testid="input-new-password"><small>At least 12 characters.</small></label>
  <label class="fld"><span>Confirm new password</span><input class="in" type="password" name="cf" autocomplete="new-password" maxlength="72" data-testid="input-confirm-password"></label>
  <button class="b plum" type="submit" data-testid="button-change-password">Update password</button></form>`;
 const f=document.getElementById("pf");
 f.onsubmit=async e=>{e.preventDefault();const c=f.cur.value,n=f.nw.value;
  if(!c)return bad("Enter your current password.");if(n.length<12||n.length>72)return bad("New password must be 12 to 72 characters.");if(n!==f.cf.value)return bad("The new passwords do not match.");
  const btn=f.querySelector("button");btn.disabled=true;
  try{await req("POST","/admin/password",{currentPassword:c,newPassword:n});ok("Password changed.");f.reset()}catch(err){fail(err)}finally{btn.disabled=false}};
}

/* ---------- router ---------- */
function route(){
 if(!me)return renderLogin();
 const h=location.hash||"#/";let m;
 if(h==="#/new")return editor(null);
 if((m=h.match(/^#\/apt\/([^/]+)$/)))return editor(decodeURIComponent(m[1]));
 if(h==="#/gallery")return gallery();
 if(h==="#/settings")return settings();
 if(h==="#/account")return account();
 return dashboard();
}
window.addEventListener("hashchange",route);
(async function boot(){
 try{const r=await fetch(API+"/admin/me",{credentials:"same-origin",cache:"no-store"});if(r.ok){const d=await r.json();me={username:d.username};if(d.csrfToken)csrf=d.csrfToken}}catch(e){}
 if(!csrf)await getCsrf().catch(()=>{});
 route();
})();
})();

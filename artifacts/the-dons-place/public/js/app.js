"use strict";
/* Defaults are used only until /api/settings responds (or if it fails). */
const SITE={name:"The Don's Place",owner:"DAH Properties",wa:"2348066164126",waShow:"+234 8066 164 126",email:"info.thedonsplace@gmail.com",address:"25A Addo Road, Opp. Ecobank, Ajah, Lagos"};
let AMENITIES=["Fully furnished short let apartments","Quick booking","24/7 electricity","24/7 Wi-Fi","DStv and smart TV","Attached Ubers","Ample parking space","CCTV-covered compound","24/7 customer support"];
let TERMS=null;
/* Apartments are loaded live from /api/apartments (shape: {slug,name,price,blurb,highlights[],photos[]}). */
let APARTMENTS=[];
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v==null?"":v).replace(/[&<>"'`=\/]/g,c=>"&#"+c.charCodeAt(0)+";");
const FALLBACK_IMG="assets/sample-room.jpg";
const safeUrl=u=>{try{if(typeof u!=="string"||!u)return FALLBACK_IMG;const x=new URL(u,location.href);if(x.origin!==location.origin||!/^https?:$/.test(x.protocol))return FALLBACK_IMG;return x.pathname+x.search}catch(e){return FALLBACK_IMG}};
const safeSlug=s=>encodeURIComponent(String(s||""));
const wa=t=>`https://wa.me/${encodeURIComponent(SITE.wa)}?text=${encodeURIComponent(t)}`;
const naira=n=>"₦"+Number(n||0).toLocaleString("en-NG");
const waGeneral=()=>wa(`Hello, I'd like to make an enquiry about ${SITE.name}.`);
const aptMsg=a=>`Hello, I'd like to book the ${a.name} at ${SITE.name}.`;
const NAV=[["index.html","Home"],["apartments.html","Apartments"],["gallery.html","Gallery"],["contact.html","Contact"],["terms.html","Terms"]];
async function api(path){const r=await fetch("/api"+path,{headers:{Accept:"application/json"},credentials:"same-origin"});let d=null;try{d=await r.json()}catch(e){}if(!r.ok){const err=new Error((d&&d.error)||"Request failed");err.status=r.status;throw err}return d}
const list=v=>Array.isArray(v)?v.filter(x=>typeof x==="string"):[];
const norm=a=>({slug:String(a.slug||""),name:String(a.name||"Apartment"),price:Number(a.price!=null?a.price:a.price_per_night)||0,blurb:String(a.blurb||""),description:String(a.description||""),highlights:list(a.highlights),amenities:list(a.amenities),photos:list(a.photos),thumbnails:list(a.thumbnails),featured:!!a.is_featured,records:Array.isArray(a.photo_records)?a.photo_records:[]});
const loadingHTML=msg=>`<p class="empty" role="status" aria-live="polite">${esc(msg)}</p>`;
const errorHTML=msg=>`<div class="empty" role="alert"><p>${esc(msg)}</p><p style="margin-top:1rem"><button type="button" class="btn ghost" data-retry style="color:var(--plum)">Try again</button></p></div>`;
function withRetry(box,run){box.innerHTML=errorHTML("We could not load this right now. Please check your connection and try again.");const b=box.querySelector("[data-retry]");if(b)b.addEventListener("click",run,{once:true})}

function layout(){
 const here=location.pathname.split("/").pop()||"index.html";
 const cur=here==="apartment.html"?"apartments.html":here;
 const W=esc(waGeneral()),N=esc(SITE.name);
 $("#hd").outerHTML=`<header class="hd" id="hd"><div class="wrap"><a class="brand" href="index.html" aria-label="${N} home"><img src="assets/logo.png" alt="${N}, ${esc(SITE.owner)}" width="170" height="50"></a><nav id="nav" aria-label="Main">${NAV.map(([h,t])=>`<a href="${h}"${h===cur?' aria-current="page"':""}>${t}</a>`).join("")}</nav><a class="btn gold" data-wa href="${W}" target="_blank" rel="noopener">Book on WhatsApp</a><button class="burger" aria-label="Open menu" aria-expanded="false" aria-controls="nav">☰</button></div></header>`;
 $("#ft").outerHTML=footer();
 const b=$(".burger"),n=$("#nav");
 b.addEventListener("click",()=>{const o=n.classList.toggle("open");b.setAttribute("aria-expanded",o);b.setAttribute("aria-label",o?"Close menu":"Open menu")});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&n.classList.contains("open")){n.classList.remove("open");b.setAttribute("aria-expanded","false");b.focus()}});
}
function footer(){const W=esc(waGeneral()),N=esc(SITE.name);return `<div id="ftwrap"><footer class="ft"><div class="wrap"><div><h3>${N}</h3><p>Fully furnished short let apartments in Ajah, Lagos.</p></div><div><h3>Visit</h3><p>${esc(SITE.address)}</p></div><div><h3>Contact</h3><a href="${W}" target="_blank" rel="noopener">WhatsApp ${esc(SITE.waShow)}</a><a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a></div><div><h3>Pages</h3>${NAV.map(([h,t])=>`<a href="${h}">${t}</a>`).join("")}</div><p class="copy">© ${new Date().getFullYear()} ${esc(SITE.owner)}. All rights reserved.</p></div></footer><a class="float" href="${W}" target="_blank" rel="noopener" aria-label="Chat with ${N} on WhatsApp">Chat on WhatsApp</a></div>`}
function applySettings(s){
 if(!s||typeof s!=="object")return;
 if(/^[0-9]{8,15}$/.test(s.whatsapp_number||""))SITE.wa=s.whatsapp_number;
 if(s.whatsapp_display)SITE.waShow=String(s.whatsapp_display);
 if(s.email)SITE.email=String(s.email);
 if(s.address)SITE.address=String(s.address);
 if(s.owner)SITE.owner=String(s.owner);
 if(Array.isArray(s.amenities))AMENITIES=list(s.amenities);
 if(typeof s.terms==="string")TERMS=s.terms;
 const f=$("#ftwrap");if(f)f.outerHTML=footer();
 document.querySelectorAll("[data-wa]").forEach(a=>a.href=waGeneral());
 document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a=>{const u=new URL(a.href);u.pathname="/"+SITE.wa;a.href=u.href});
}
const card=a=>{const s=safeSlug(a.slug),img=safeUrl(a.thumbnails[0]||a.photos[0]);return `<article class="card"><a class="ph" href="apartment.html?slug=${s}" tabindex="-1" aria-hidden="true"><img src="${esc(img)}" alt="" loading="lazy"></a><div class="bd"><h3>${esc(a.name)}</h3><p class="price">${naira(a.price)} <small>/ night</small></p><p>${esc(a.blurb)}</p><p>${esc(a.highlights.join(", "))}</p><div class="acts"><a class="btn ghost" href="apartment.html?slug=${s}">View details</a><a class="btn gold" href="${esc(wa(aptMsg(a)))}" target="_blank" rel="noopener">Book on WhatsApp</a></div></div></article>`};
const amen=(x=AMENITIES)=>x.map(v=>`<li>${esc(v)}</li>`).join("");
async function loadApartments(box,render){
 box.innerHTML=loadingHTML("Loading apartments...");box.setAttribute("aria-busy","true");
 try{const d=await api("/apartments");APARTMENTS=(Array.isArray(d)?d:[]).map(norm);render()}
 catch(e){withRetry(box,()=>loadApartments(box,render))}
 finally{box.removeAttribute("aria-busy")}
}
function termsHTML(t){
 /* Blocks separated by blank lines. "## x" or a short first line without end punctuation (in a multi-line block) becomes a heading; "- x" lines become a list. */
 const isLi=l=>/^[-*•]\s+/.test(l),li=l=>l.replace(/^[-*•]\s+/,"");
 return t.replace(/\r/g,"").split(/\n\s*\n/).map(block=>{
  let lines=block.split("\n").map(x=>x.trim()).filter(Boolean),out="";
  if(!lines.length)return"";
  if(/^#{1,3}\s+/.test(lines[0])){out+=`<h2>${esc(lines.shift().replace(/^#{1,3}\s+/,""))}</h2>`}
  else if(lines.length>1&&!isLi(lines[0])&&lines[0].length<=80&&!/[.:!?]$/.test(lines[0])){out+=`<h2>${esc(lines.shift())}</h2>`}
  else if(lines.length===1&&lines[0].length<=60&&!/[.:!?]$/.test(lines[0])&&!isLi(lines[0])){return `<h2>${esc(lines[0])}</h2>`}
  let ul=false;
  lines.forEach(l=>{if(isLi(l)){if(!ul){out+="<ul>";ul=true}out+=`<li>${esc(li(l))}</li>`;return}if(ul){out+="</ul>";ul=false}
   if(/^#{1,3}\s+/.test(l))out+=`<h2>${esc(l.replace(/^#{1,3}\s+/,""))}</h2>`;else if(/^(management|note)\b/i.test(l))out+=`<p class="note">${esc(l)}</p>`;else out+=`<p>${esc(l)}</p>`});
  if(ul)out+="</ul>";return out}).join("");
}
const pages={
 home(){$("#h1wa").href=waGeneral();$("#ctawa").href=waGeneral();$("#h1wa").setAttribute("data-wa","");$("#ctawa").setAttribute("data-wa","");$("#amen").innerHTML=amen();
  const box=$("#featured");loadApartments(box,()=>{const show=[...APARTMENTS.filter(a=>a.featured),...APARTMENTS.filter(a=>!a.featured)].slice(0,3);box.innerHTML=show.length?show.map(card).join(""):'<p class="empty">No apartments are listed right now. Message us on WhatsApp to ask about availability.</p>'})},
 apartments(){const box=$("#list");loadApartments(box,()=>{box.innerHTML=APARTMENTS.length?APARTMENTS.map(card).join(""):'<p class="empty">No apartments are listed right now. Message us on WhatsApp to ask about availability.</p>'})},
 async apartment(){
  const box=$("#detail"),slug=new URLSearchParams(location.search).get("slug")||"";
  const notFound=()=>{document.title=`Apartment not found | ${SITE.name}`;box.innerHTML='<div class="wrap empty"><h2>We could not find that apartment</h2><p><a href="apartments.html">See all apartments</a></p></div>'};
  if(!slug||!/^[a-z0-9-]{1,200}$/.test(slug))return notFound();
  box.innerHTML=`<div class="wrap">${loadingHTML("Loading apartment...")}</div>`;
  let a;
  try{a=norm(await api("/apartments/"+safeSlug(slug)))}
  catch(e){if(e.status===404)return notFound();box.innerHTML='<div class="wrap" id="derr"></div>';withRetry($("#derr"),()=>pages.apartment());return}
  const photos=(a.photos.length?a.photos:[FALLBACK_IMG]).map(safeUrl);
  const thumbs=photos.map((p,i)=>a.thumbnails[i]?safeUrl(a.thumbnails[i]):p);
  const alts=photos.map((p,i)=>{const r=a.records.find(x=>x&&safeUrl(x.url)===p);return r&&r.alt?String(r.alt):`${a.name} photo ${i+1}`});
  const amenItems=a.amenities;
  document.title=`${a.name} | ${SITE.name}`;
  const desc=a.description?a.description.split(/\r?\n\s*\r?\n/).map(p=>`<p style="margin-top:1rem">${esc(p.trim())}</p>`).join(""):"";
  box.innerHTML=`<section class="page"><div class="wrap"><a class="crumb" href="apartments.html">‹ All apartments</a><h1>${esc(a.name)}</h1><p class="lead">${esc(a.blurb)}</p></div></section><div class="wrap det"><div><div class="main-ph"><img id="big" src="${esc(photos[0])}" alt="${esc(alts[0])}"></div><div class="thumbs" ${photos.length<2?"hidden":""}>${thumbs.map((p,i)=>`<button type="button" data-i="${i}" aria-label="Show photo ${i+1}" aria-current="${i===0}"><img src="${esc(p)}" alt="" loading="lazy"></button>`).join("")}</div>${desc?`<h2 style="margin-top:2.5rem">About this apartment</h2>${desc}`:""}<h2 style="margin-top:2.5rem">Included in your stay</h2><ul class="amen">${amen(amenItems)}</ul></div><aside class="panel" aria-label="Book this apartment"><p class="price">${naira(a.price)} <small>/ night</small></p><div class="f"><label>Check-in<input type="date" id="in"></label><label>Check-out<input type="date" id="out"></label><label>Guests<input type="number" id="g" min="1" max="20" value="1" inputmode="numeric"></label></div><p class="hint" id="hint" role="status"></p><a class="btn gold" id="go" href="#" target="_blank" rel="noopener" style="width:100%">Book on WhatsApp</a><p style="margin-top:.8rem;color:var(--mute);font-size:.9rem">Availability and payment are confirmed with us on WhatsApp.</p></aside></div>`;
  box.onclick=e=>{const t=e.target.closest("[data-i]");if(!t)return;const k=+t.dataset.i;$("#big").src=photos[k];$("#big").alt=alts[k];box.querySelectorAll("[data-i]").forEach(x=>x.setAttribute("aria-current",x===t))};
  const i=$("#in"),o=$("#out"),g=$("#g"),h=$("#hint"),go=$("#go"),day=d=>d.toISOString().slice(0,10);
  i.min=day(new Date());
  const upd=()=>{let m=aptMsg(a),bad=i.value&&o.value&&o.value<=i.value;h.textContent=bad?"Check-out must be after check-in.":"";o.min=i.value||i.min;
   if(i.value)m+=` Check-in: ${i.value}.`;if(o.value&&!bad)m+=` Check-out: ${o.value}.`;if(g.value>0)m+=` Guests: ${g.value}.`;go.href=wa(m)};
  [i,o,g].forEach(x=>x.addEventListener("input",upd));upd();
 },
 async gallery(){
  const box=$("#mason");let all=[];
  const run=async()=>{box.innerHTML=loadingHTML("Loading photos...");
   try{const d=await api("/gallery");all=(Array.isArray(d)?d:[]).filter(p=>p&&p.url).map(p=>({p:safeUrl(p.url),th:safeUrl(p.thumb_url||p.url),t:String(p.alt||SITE.name)}))}
   catch(e){withRetry(box,run);return}
   box.innerHTML=all.length?all.map((x,k)=>`<button type="button" data-k="${k}" aria-label="Enlarge photo: ${esc(x.t)}"><img src="${esc(x.th)}" alt="${esc(x.t)}" loading="lazy"></button>`).join(""):'<p class="empty">Photos are coming soon.</p>'};
  const d=$("#lb");box.addEventListener("click",e=>{const b=e.target.closest("[data-k]");if(!b)return;const x=all[b.dataset.k];if(!x)return;$("#lbimg").src=x.p;$("#lbimg").alt=x.t;d.showModal()});
  d.addEventListener("click",e=>{if(e.target===d)d.close()});
  run();
 },
 contact(){$("#cwa").href=waGeneral();$("#cwa2").href=waGeneral()},
 terms(){}
};
function refreshContact(){
 if(document.body.dataset.page==="contact"){const c=$("#cwa");c.href=waGeneral();c.textContent=SITE.waShow;$("#cwa2").href=waGeneral();const m=$("#cemail");m.href="mailto:"+SITE.email;m.textContent=SITE.email;$("#caddr").textContent=SITE.address}
 if(document.body.dataset.page==="terms"&&TERMS!==null){$("#terms").innerHTML=TERMS.trim()?termsHTML(TERMS):'<p class="empty">Please contact us on WhatsApp for the current terms.</p>'}
 if(document.body.dataset.page==="home"){$("#amen").innerHTML=amen()}
}
layout();
async function loadSettings(){
 try{const s=await api("/settings");applySettings(s);refreshContact();document.getElementById("settings-error")?.remove()}
 catch(e){if(document.getElementById("settings-error"))return;const notice=document.createElement("div");notice.id="settings-error";notice.className="wrap empty";notice.setAttribute("role","alert");notice.textContent="Contact details could not be refreshed. Showing the original contact details. ";const retry=document.createElement("button");retry.type="button";retry.className="btn ghost";retry.style.color="var(--plum)";retry.textContent="Try again";retry.addEventListener("click",loadSettings);notice.appendChild(retry);document.getElementById("main").prepend(notice)}
}
const settingsReady=loadSettings();
const page=pages[document.body.dataset.page];
/* Apartment links need the final WhatsApp number, so wait briefly for settings first. */
Promise.race([settingsReady,new Promise(r=>setTimeout(r,1500))]).then(()=>{if(page)page()});

"use strict";
/* Adds canonical URL and LocalBusiness JSON-LD from /api/seo (built from SITE_URL on the server). */
(function(){
 fetch("/api/seo",{headers:{Accept:"application/json"}}).then(r=>r.ok?r.json():null).then(d=>{
  if(!d||typeof d!=="object")return;
  var base=String(d.siteUrl||d.site_url||d.canonicalBase||"");
  if(base)try{var b=new URL(base);if(/^https?:$/.test(b.protocol)){
   var path=location.pathname==="/index.html"?"/":location.pathname;
   var slug=new URLSearchParams(location.search).get("slug");
   var href=b.origin+path+(slug&&/^[a-z0-9-]{1,200}$/.test(slug)?"?slug="+slug:"");
   if(!document.querySelector('link[rel="canonical"]')){var l=document.createElement("link");l.rel="canonical";l.href=href;document.head.appendChild(l)}}
  }catch(e){}
  var ld=d.business||d.jsonLd||d.jsonld||d.localBusiness;
  if(ld&&typeof ld==="object"&&!document.getElementById("ld-business")){
   var s=document.createElement("script");s.type="application/ld+json";s.id="ld-business";
   s.textContent=JSON.stringify(ld).replace(/</g,"\\u003c");document.head.appendChild(s)}
 }).catch(function(){});
})();

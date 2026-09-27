"use client";
import {useState} from "react";

export default function TweetWriter({eventId}:{eventId:string}){
 const [style,setStyle]=useState("investigative");
 const [language,setLanguage]=useState("ar");
 const [tweet,setTweet]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function write(){
  setBusy(true);setError("");setTweet("");
  try{
   const r=await fetch("/api/tweet",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId,style,language})});
   const j=await r.json();
   if(!r.ok||!j.tweet)throw new Error(j.error||"تعذر إنشاء التغريدة");
   setTweet(j.tweet);
  }catch(e:any){setError(e?.message||"تعذر إنشاء التغريدة");}
  finally{setBusy(false);}
 }
 return <section style={{marginTop:14,background:"#0b1827",border:"1px solid #29435d",borderRadius:16,padding:18}}>
  <div style={{color:"#8196ab",fontSize:12}}>X Intelligence Writer</div>
  <h2 style={{marginTop:8}}>صياغة التغريدة</h2>
  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:14}}>
   <button onClick={()=>setStyle("investigative")} style={btn(style==="investigative")}>استقصائية</button>
   <button onClick={()=>setStyle("analysis")} style={btn(style==="analysis")}>تحليلية</button>
   <button onClick={()=>setStyle("breaking")} style={btn(style==="breaking")}>عاجلة</button>
   <button onClick={()=>setStyle("human")} style={btn(style==="human")}>بشرية</button>
   <button onClick={()=>setLanguage("ar")} style={btn(language==="ar")}>عربي</button>
   <button onClick={()=>setLanguage("en")} style={btn(language==="en")}>English</button>
  </div>
  <button onClick={write} disabled={busy} style={{marginTop:14,background:"#e3b34b",color:"#07111f",border:0,borderRadius:12,padding:"12px 22px",fontWeight:800,fontSize:16}}>
   {busy?"يتم إعداد النص…":"صياغة"}
  </button>
  {error&&<div style={{marginTop:14,color:"#ffb4b4"}}>{error}</div>}
  {tweet&&<div style={{marginTop:14,border:"1px solid #29435d",borderRadius:14,padding:16,lineHeight:1.9,whiteSpace:"pre-wrap",direction:language==="ar"?"rtl":"ltr",textAlign:language==="ar"?"right":"left"}}>
   {tweet}
   <div style={{marginTop:12,display:"flex",gap:8}}>
    <button onClick={()=>navigator.clipboard?.writeText(tweet)} style={btn(false)}>نسخ النص</button>
   </div>
  </div>}
 </section>;
}
function btn(active:boolean):any{return{background:"#0b1b2d",color:active?"#f0c45b":"#b8c7d5",border:active?"1px solid #e0ad3f":"1px solid #29435d",borderRadius:12,padding:"10px 8px",fontWeight:700,fontSize:15}};

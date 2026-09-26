import {redirect} from "next/navigation";
import {createClient} from "../../../lib/supabase/server";

export default async function EventPage({params}:any){
 const p=await params; const id=p.id;
 const sb=await createClient();
 const {data:{user}}=await sb.auth.getUser();
 if(!user)redirect("/login");
 const {data:event}=await sb.from("events").select("*").eq("id",id).eq("owner_id",user.id).maybeSingle();
 if(!event) return <main style={{padding:24,fontFamily:"system-ui",direction:"rtl"}}><a href="/">← العودة للمرصد</a><h1>الحدث غير موجود</h1></main>;
 const {data:links}=await sb.from("event_items").select("monitored_item_id").eq("event_id",id).eq("owner_id",user.id);
 const ids=(links||[]).map((x:any)=>x.monitored_item_id);
 const {data:items}=ids.length?await sb.from("monitored_items").select("id,title,url,summary,published_at,verification_status,source_id").in("id",ids).order("published_at",{ascending:false}):{data:[]};
 const sourceIds=[...new Set((items||[]).map((x:any)=>x.source_id).filter(Boolean))];
 const {data:sources}=sourceIds.length?await sb.from("sources").select("id,name,url,source_type,region,priority").in("id",sourceIds):{data:[]};
 const {data:analyses}=await sb.from("analyses").select("analysis,model,created_at").eq("event_id",id).eq("owner_id",user.id).order("created_at",{ascending:false}).limit(3);
 const safeAnalyses=analyses||[];
 const confidence=event.verification_confidence==="high"?"عالية":event.verification_confidence==="medium"?"متوسطة":event.verification_confidence==="low"?"منخفضة":"غير محددة";
 return <main style={{minHeight:"100vh",background:"#07111f",color:"#e7edf5",fontFamily:"-apple-system,BlinkMacSystemFont,Segoe UI,Tahoma,Arial,sans-serif",padding:"18px",direction:"rtl"}}>
  <div style={{maxWidth:980,margin:"0 auto"}}>
   <a href="/" style={{display:"inline-flex",alignItems:"center",gap:8,background:"#f2d58f",color:"#07111f",padding:"10px 15px",borderRadius:10,fontWeight:800,textDecoration:"none"}}>← العودة إلى المرصد الرئيسي</a>
   <div style={{marginTop:18,background:"#0b1827",border:"1px solid #29435d",borderRadius:18,padding:20}}>
    <div style={{color:"#8196ab",fontSize:12}}>ملف الحدث · OSINT</div>
    <h1 style={{lineHeight:1.6,fontSize:25}}>{event.title}</h1>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
     <div style={{background:"#091523",padding:12,borderRadius:10}}><b>{event.status||"غير محدد"}</b><small style={{display:"block",color:"#8196ab"}}>حالة التحقق</small></div>
     <div style={{background:"#091523",padding:12,borderRadius:10}}><b>{sourceIds.length}</b><small style={{display:"block",color:"#8196ab"}}>مصادر</small></div>
     <div style={{background:"#091523",padding:12,borderRadius:10}}><b>{confidence}</b><small style={{display:"block",color:"#8196ab"}}>ثقة التحقق</small></div>
     <div style={{background:"#091523",padding:12,borderRadius:10}}><b>{event.update_kind==="new"?"جديد":"تحديث"}</b><small style={{display:"block",color:"#8196ab"}}>طبيعة الحدث</small></div>
    </div>
   </div>
   <section style={{marginTop:14,background:"#0b1827",border:"1px solid #1c3045",borderRadius:16,padding:18}}>
    <h2>ما نعرفه</h2><p style={{lineHeight:1.9,color:"#b8c7d5"}}>{event.synopsis||"لا يوجد ملخص بعد."}</p>
    <h2>ملخص الأدلة</h2><p style={{whiteSpace:"pre-wrap",lineHeight:1.9,color:"#b8c7d5"}}>{event.evidence_summary||"لم تكتمل طبقة التحليل بعد."}</p>
   </section>
   {safeAnalyses.length>0&&<section style={{marginTop:14,background:"#0b1827",border:"1px solid #29435d",borderRadius:16,padding:18}}><h2>قراءة المرصد</h2>{safeAnalyses.map((a:any,i:number)=><div key={i} style={{whiteSpace:"pre-wrap",lineHeight:1.9,color:"#d1dbe5"}}>{a.analysis}</div>)}</section>}
   <section style={{marginTop:14,background:"#0b1827",border:"1px solid #1c3045",borderRadius:16,padding:18}}>
    <h2>المصادر</h2>{(sources||[]).map((s:any)=><div key={s.id} style={{padding:"11px 0",borderBottom:"1px solid #1c3045"}}><a href={s.url} target="_blank" rel="noreferrer" style={{color:"#f2d58f"}}>{s.name}</a><div style={{color:"#8196ab",fontSize:12}}>{s.source_type||""} · {s.region||""}</div></div>)}
   </section>
   <section style={{marginTop:14,background:"#0b1827",border:"1px solid #1c3045",borderRadius:16,padding:18}}>
    <h2>المواد المرتبطة · {items?.length||0}</h2>{(items||[]).map((it:any)=><div key={it.id} style={{padding:"12px 0",borderBottom:"1px solid #1c3045"}}><a href={it.url} target="_blank" rel="noreferrer" style={{color:"#e7edf5",fontWeight:700,textDecoration:"none"}}>{it.title}</a><div style={{color:"#8196ab",fontSize:12,marginTop:4}}>{it.published_at?new Date(it.published_at).toLocaleString("ar-SA"):""} · {it.verification_status||"غير متحقق"}</div></div>)}</section>
  </div>
 </main>;
}

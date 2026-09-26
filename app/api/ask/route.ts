import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";
export async function POST(req:Request){
 const sb=await createClient(); const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>({})); const question=String(body.question||"").trim();
 if(!question)return NextResponse.json({error:"السؤال مطلوب"},{status:400});
 const openai=process.env.OPENAI_API_KEY; if(!openai)return NextResponse.json({answer:"مفتاح OpenAI غير مفعّل في بيئة Vercel."});
 const since=new Date(Date.now()-72*3600000).toISOString();
 const {data:items}=await sb.from("monitored_items").select("id,title,url,summary,category,published_at,event_id").eq("owner_id",user.id).gte("published_at",since).order("published_at",{ascending:false}).limit(120);
 const ids=[...new Set((items||[]).map((x:any)=>x.event_id).filter(Boolean))];
 const {data:events}=ids.length?await sb.from("events").select("id,title,category,region,synopsis,evidence_summary,status,priority_score,alert_level,last_updated_at").eq("owner_id",user.id).in("id",ids):{data:[]};
 const evidence=(items||[]).map((x:any,i:number)=>`[M${i+1}] ${x.title}\n${x.summary||""}\n${x.url}\nحدث: ${x.event_id||"غير مرتبط"}`).join("\n\n");
 const eventText=(events||[]).map((e:any)=>`[E:${e.id}] ${e.title}\n${e.category} | ${e.region} | ${e.alert_level}\n${e.synopsis||""}\n${e.evidence_summary||""}`).join("\n\n");
 const prompt=`السؤال: ${question}\n\nالأحداث:\n${eventText}\n\nالمواد الأصلية:\n${evidence}`;
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+openai,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"system",content:"أنت محرك اسأل المرصد. أجب بالعربية من البيانات المرفقة فقط. ميّز بين المؤكد وغير المؤكد والمتعارض. لا تخترع معلومات. اختم بقسم مصادر يذكر روابط المواد ذات الصلة كما وردت، وبقسم ثقة مختصر. لا تقدّم تنبؤات سياسية."},{role:"user",content:prompt}],max_output_tokens:2400})});
 const j=await r.json(); if(!r.ok)return NextResponse.json({error:j.error?.message||"OpenAI request failed"},{status:502}); const answer=j.output_text||((j.output||[]).flatMap((o:any)=>o.content||[]).map((x:any)=>x.text||"").join("\n"))||"لم يتم توليد إجابة."; return NextResponse.json({answer,events:events||[],items:items||[]});
}
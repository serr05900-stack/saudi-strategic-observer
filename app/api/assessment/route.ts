import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";

export async function POST(req:Request){
 const sb=await createClient(); const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json(); const topic=(body.topic||"").trim();
 if(!topic)return NextResponse.json({error:"topic required"},{status:400});
 const since=new Date(Date.now()-72*60*60*1000).toISOString();
 const {data:events}=await sb.from("events").select("id,title,category,region,synopsis,evidence_summary,status,importance,priority_score,last_updated_at").eq("owner_id",user.id).gte("last_updated_at",since).or("title.ilike.%"+topic+"%,synopsis.ilike.%"+topic+"%").order("last_updated_at",{ascending:false}).limit(35);
 const {data:studies}=await sb.from("strategic_studies").select("id,title,organization,published_at,summary,key_findings,saudi_implications,confidence").eq("owner_id",user.id).gte("published_at",since).or("title.ilike.%"+topic+"%,summary.ilike.%"+topic+"%,saudi_implications.ilike.%"+topic+"%").order("published_at",{ascending:false}).limit(20);
 const evidence=JSON.stringify({events:events||[],studies:studies||[]});
 const key=process.env.OPENAI_API_KEY;if(!key)return NextResponse.json({error:"OpenAI key missing"},{status:500});
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"system",content:"أنت محلل استراتيجي داخل مرصد OSINT خاص. استخدم الأدلة المرفقة فقط. لا تخترع معلومات ولا تتنبأ بنتائج سياسية أو عسكرية. افصل بوضوح بين الوقائع المثبتة والتقدير التحليلي ونقاط عدم اليقين. أخرج JSON صالحًا بالمفاتيح: title,assessment,confirmed_facts,analytical_judgments,uncertainties,watch_items,confidence."},{role:"user",content:"الموضوع: "+topic+"\nالأدلة خلال آخر 72 ساعة:\n"+evidence.slice(0,50000)}],max_output_tokens:2200})});
 const j=await r.json(); if(!r.ok)return NextResponse.json({error:j.error?.message||"OpenAI request failed"},{status:502}); const rawText=j.output_text||((j.output||[]).map((o:any)=>(o.content||[]).map((x:any)=>x.text||"").join("\n")).join("\n"))||""; let raw=rawText||"{}"; let out:any;try{out=JSON.parse(raw)}catch{out={title:topic,assessment:raw,confirmed_facts:[],analytical_judgments:[],uncertainties:[],watch_items:[],confidence:"medium"}}
 const {data,error}=await sb.from("strategic_assessments").insert({owner_id:user.id,title:out.title||topic,scope:topic,assessment:out.assessment||"",confirmed_facts:out.confirmed_facts||[],analytical_judgments:out.analytical_judgments||[],uncertainties:out.uncertainties||[],watch_items:out.watch_items||[],confidence:out.confidence||"medium",event_ids:(events||[]).map((e:any)=>e.id),study_ids:(studies||[]).map((s:any)=>s.id)}).select().single();
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({assessment:data,events:events||[],studies:studies||[]});
}
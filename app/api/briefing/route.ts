import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";

export async function GET(){
 const sb=await createClient(); const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data,error}=await sb.from("briefings").select("*").eq("owner_id",user.id).order("created_at",{ascending:false}).limit(10);
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({briefings:data||[]});
}
export async function POST(req:Request){
 const sb=await createClient(); const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>({})); const hours=Math.min(Math.max(Number(body.hours||24),6),72);
 const since=new Date(Date.now()-hours*3600000).toISOString();
 const {data:events}=await sb.from("events").select("id,title,category,region,synopsis,evidence_summary,status,importance,priority_score,alert_level,alert_reason,last_updated_at").eq("owner_id",user.id).gte("last_updated_at",since).order("priority_score",{ascending:false}).limit(30);
 const {data:studies}=await sb.from("strategic_studies").select("title,organization,published_at,summary,key_findings,saudi_implications,confidence").eq("owner_id",user.id).gte("published_at",since).order("published_at",{ascending:false}).limit(12);
 const key=process.env.OPENAI_API_KEY;if(!key)return NextResponse.json({error:"OpenAI key missing"},{status:500});
 const evidence=JSON.stringify({events:events||[],studies:studies||[]}).slice(0,60000);
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"system",content:"أنت محرر إحاطة استخباراتية OSINT خاصة. استخدم الأدلة المرفقة فقط. أنشئ إحاطة عربية عملية ومنظمة: أهم التطورات، لماذا تهم، ما تغير، ما يستحق المتابعة، والدراسات ذات الصلة. لا تخترع وقائع ولا تتنبأ بنتائج سياسية أو عسكرية. افصل الخبر عن التحليل."},{role:"user",content:"الفترة: آخر "+hours+" ساعة\nالأدلة:\n"+evidence}],max_output_tokens:2600})});
 const j=await r.json(); const content=j.output_text||"لم يتم توليد الإحاطة.";
 const {data,error}=await sb.from("briefings").insert({owner_id:user.id,window_hours:hours,title:"الإحاطة الاستراتيجية · آخر "+hours+" ساعة",content,event_count:(events||[]).length}).select().single();
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({briefing:data,events:events||[],studies:studies||[]});
}
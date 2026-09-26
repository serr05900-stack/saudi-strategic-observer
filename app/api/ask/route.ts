import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";
export async function POST(req:Request){
 const sb=await createClient();
 const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>({}));
 const question=String(body.question||"").trim();
 if(!question)return NextResponse.json({error:"السؤال مطلوب"},{status:400});
 const openai=process.env.OPENAI_API_KEY;
 if(!openai)return NextResponse.json({answer:"مفتاح OpenAI غير مفعّل في بيئة Vercel."});
 const since=new Date(Date.now()-24*3600000).toISOString();
 const {data}=await sb.from("monitored_items").select("title,url,summary,category,published_at").gte("published_at",since).order("published_at",{ascending:false}).limit(80);
 const evidence=(data||[]).map((x:any)=>["["+x.category+"] "+x.title,x.summary||"",x.url].join("\n")).join("\n\n");
 const prompt="السؤال: "+question+"\n\nالمواد المتاحة من المرصد:\n"+evidence;
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+openai,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"system",content:"أنت محلل OSINT سعودي محايد. أجب فقط من المواد المرفقة. افصل المؤكد عن غير المؤكد، اذكر المصادر، ولا تخترع معلومات."},{role:"user",content:prompt}],max_output_tokens:1800})});
 const j=await r.json();
 return NextResponse.json({answer:j.output_text||"لم يتم توليد إجابة."});
}
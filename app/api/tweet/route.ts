import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";

function clean(v:string){return (v||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();}
function fallbackArabic(e:any, items:any[], style:string){
  const title=clean(e.title);
  const summary=clean(e.synopsis)||clean(e.evidence_summary).replace(/\n/g," ");
  const source=items.find(x=>x?.title)?.title ? clean(items.find(x=>x?.title).title) : "";
  if(style==="breaking") return `عاجل | ${title}. ${summary ? summary.slice(0,280) : "المعطيات المتاحة حاليًا محدودة، والمتابعة مستمرة."}`;
  if(style==="investigative") return `${title}\n\nالمعلومة الأبرز: ${summary ? summary.slice(0,320) : "لا يزال ملخص التطور بحاجة إلى مزيد من الأدلة."}\n\nالمهم هنا متابعة ما إذا كانت ستظهر معطيات مستقلة تؤكد الصورة الحالية.`;
  if(style==="human") return `${title}\n\n${summary ? summary.slice(0,360) : "التطور ما زال قيد المتابعة، ولا توجد حتى الآن تفاصيل كافية للجزم بأكثر من ذلك."}`;
  return `${title}\n\n${summary ? summary.slice(0,360) : "التفاصيل المتاحة حتى الآن محدودة، لذلك الأفضل التعامل معه كتطور قيد التحقق."}\n\nالمتابعة مستمرة.`;
}
function fallbackEnglish(e:any){
  const title=clean(e.title); const summary=clean(e.synopsis||e.evidence_summary).slice(0,420);
  return summary ? `${title}\n\n${summary}\n\nMonitoring for further independent confirmation.` : `${title}\n\nFurther details are still being verified.`;
}
export async function POST(req:Request){
  const sb=await createClient(); const {data:{user}}=await sb.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {eventId,style="analysis",language="ar"}=await req.json();
  const {data:e}=await sb.from("events").select("id,title,category,region,synopsis,evidence_summary,status,priority_score,alert_level").eq("id",eventId).eq("owner_id",user.id).single();
  if(!e)return NextResponse.json({error:"Event not found"},{status:404});
  const {data:links}=await sb.from("event_items").select("monitored_item_id").eq("event_id",eventId).limit(12);
  const ids=(links||[]).map((x:any)=>x.monitored_item_id);
  const {data:items}=ids.length?await sb.from("monitored_items").select("title,url,summary,published_at").in("id",ids):{data:[]};
  const evidence=(items||[]).map((x:any)=>x.title+" | "+x.summary+" | "+x.url).join("\n");
  const key=process.env.OPENAI_API_KEY;
  const styleGuide=style==="investigative"?"أسلوب صحفي استقصائي وتحليلي: ابدأ من المعلومة الأهم، ثم اربط الوقائع والسياق، وأظهر ما الذي تغير وما الذي يستحق المراقبة. لا تكتب كخبر وكالة.":style==="breaking"?"أسلوب عاجل: جملة افتتاحية قوية ومباشرة، ثم أهم التفاصيل المؤكدة فقط، ثم سطر قصير يوضح ما الذي نراقبه.":style==="human"?"أسلوب بشري طبيعي: صوت كاتب يتابع الملف منذ فترة، لغة واضحة وحادة عند الحاجة، دون عبارات آلية.":"أسلوب تحليلي: ركز على معنى التطور وسياقه وما تغير، مع فصل الحقيقة عن القراءة.";
  const prompt="اكتب نصًا أصليًا للنشر على X. "+styleGuide+" استخدم الوقائع المدعومة فقط. لا تضف أرقامًا أو أسماء أو دوافع غير موجودة. لا تنسب نوايا. إذا كانت الأدلة ناقصة أو متعارضة، اعكس ذلك. لا تنسخ جمل المصادر. اجعل النص موجزًا ومناسبًا لـ X. اللغة: "+language+"\nالحدث: "+e.title+"\nملخص: "+(e.synopsis||"")+"\nالأدلة: "+(e.evidence_summary||"")+"\nالمصادر: "+evidence;
  if(!key){
    const tweet=language==="en"?fallbackEnglish(e):fallbackArabic(e,items||[],style);
    return NextResponse.json({tweet,language,mode:"offline_fallback"});
  }
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"system",content:"أنت محرر محتوى OSINT. أنشئ نصًا أصليًا فقط ولا تختلق وقائع."},{role:"user",content:prompt}],max_output_tokens:700})});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error?.message||"OpenAI request failed");
    const generated=j.output_text||((j.output||[]).map((o:any)=>(o.content||[]).map((x:any)=>x.text||"").join("\n")).join("\n"))||"";
    if(language==="en"){
      const tr=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"system",content:"Translate this Arabic X post into natural professional English. Preserve meaning, nuance and uncertainty. Do not add facts."},{role:"user",content:generated}],max_output_tokens:700})});
      const tj=await tr.json(); if(!tr.ok) throw new Error(tj.error?.message||"English translation failed");
      const translated=tj.output_text||((tj.output||[]).map((o:any)=>(o.content||[]).map((x:any)=>x.text||"").join("\n")).join("\n"))||"";
      return NextResponse.json({tweet:translated,arabic_tweet:generated,language:"en",mode:"openai"});
    }
    return NextResponse.json({tweet:generated,language:"ar",mode:"openai"});
  }catch{
    const tweet=language==="en"?fallbackEnglish(e):fallbackArabic(e,items||[],style);
    return NextResponse.json({tweet,language,mode:"offline_fallback"});
  }
}
import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";

function clean(v:string){return (v||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();}
function fallbackArabic(e:any, items:any[], style:string){
  const title=clean(e.title);
  const summary=clean(e.synopsis)||clean(e.evidence_summary);
  const sources=(items||[]).filter((x:any)=>x?.title).slice(0,5).map((x:any)=>clean(x.title)).join(" | ");
  if(style==="breaking") return `عاجل | ${title}

${summary ? summary.slice(0,520) : "التفاصيل المتاحة حتى الآن محدودة، والمتابعة مستمرة."}

المؤكد حاليًا يقتصر على ما ورد في المواد المرصودة، وأي تفاصيل إضافية تحتاج إلى تأكيد مستقل.`;
  if(style==="investigative") return `${title}

المعلومة الأساسية ليست في الخبر وحده، بل في ما يثبته وما لا يثبته: ${summary ? summary.slice(0,420) : "المعطيات المتاحة لا تكفي بعد لبناء صورة مكتملة."}

المفارقة/الفجوة التي تستحق الفحص: هل توجد جهة مستقلة تؤكد الادعاء، وهل تتطابق التفاصيل مع التسلسل الزمني والمصادر الأخرى؟ ${sources ? "المواد المرصودة حتى الآن تتضمن: "+sources.slice(0,420) : ""}

الخلاصة الاستقصائية: المعطى الحالي يثبت وجود الادعاء، لكنه لا يكفي وحده لإثبات كل ما يُستنتج منه. ما نبحث عنه الآن هو دليل مستقل يرفع درجة الثقة.`;
  if(style==="human") return `${title}

${summary ? summary.slice(0,650) : "التطور ما زال قيد المتابعة."}

اللافت هنا أن الصورة لم تكتمل بعد؛ المهم ليس تكرار الخبر، بل معرفة ما الذي تأكد فعلاً وما الذي ما زال مجرد ادعاء.`;
  return `${title}

ما الذي تغير فعلًا؟ ${summary ? summary.slice(0,430) : "المعطيات الحالية محدودة."}

قراءة المرصد: أهمية التطور لا تأتي من الخبر المجرد، بل من السياق وما قد يعنيه إذا تأكدت المعطيات. يجب الفصل بين الوقائع المثبتة وبين الاستنتاجات التي لا تزال بحاجة إلى أدلة.

المؤشر الأهم للمتابعة: ظهور تأكيد مستقل أو تفاصيل إضافية تغير مستوى الثقة في الرواية الحالية.`;
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
  const styleGuide=style==="investigative"?`استقصاء فعلي، وليس إعادة صياغة للخبر. ابنِ النص على: (1) الادعاء/المعلومة الأساسية، (2) ماذا تقول الأدلة والمصادر المرصودة تحديدًا، (3) مقارنة أو تقاطع بين المصادر إن وُجد، (4) التناقضات أو الفجوات وما الذي لا يمكن إثباته، (5) السياق والتسلسل الزمني ذي الصلة، (6) الاستنتاج التحليلي المعلَّم بوضوح كاستنتاج لا كحقيقة، (7) ما الدليل الذي نحتاجه لتأكيد الصورة. إذا كان لدينا مصدر واحد فقط، لا تختلق تعدد مصادر؛ حوّل ذلك إلى نقطة استقصائية واضحة. لا تكتب كخبر وكالة ولا تكتفِ بعبارات مثل "المتابعة مستمرة". اجعل النص عميقًا وكثيفًا ومناسبًا لتغريدة طويلة متعددة الفقرات.`:style==="analysis"?`تحليل فعلي وعميق، وليس تلخيصًا للخبر. اشرح: ماذا حدث، ما الذي تغير مقارنة بالسياق السابق المتاح في الأدلة، لماذا يهم، ما الآلية أو العلاقة التي تفسر أهميته، وما السيناريوهات/المؤشرات التي ينبغي مراقبتها دون التنبؤ بالنتيجة. افصل الوقائع عن القراءة التحليلية بوضوح. لا تستخدم عبارات عامة؛ كل استنتاج يجب أن يستند إلى مادة في الأدلة. اجعل النص كثيفًا ومناسبًا لتغريدة طويلة متعددة الفقرات.`:style==="breaking"?`عاجل ومركز: ابدأ بالحدث المؤكد، ثم أهم التفاصيل، ثم سطر يوضح ما يزال غير مؤكد. لا تضف تفسيرًا غير مدعوم.`:`أسلوب بشري طبيعي لكن عميق: اكتب بصوت محلل يتابع الملف منذ فترة، مع سياق واضح واستنتاجات محدودة ومسنودة، دون عبارات آلية أو تلخيص سطحي.`;
  const prompt="اكتب نصًا أصليًا للنشر على X. "+styleGuide+" استخدم الوقائع المدعومة فقط. لا تضف أرقامًا أو أسماء أو دوافع غير موجودة. لا تنسب نوايا. إذا كانت الأدلة ناقصة أو متعارضة، اعكس ذلك. لا تنسخ جمل المصادر. لا تختصر النص لمجرد الاختصار؛ أعطِ مساحة كافية لبناء الحجة والاستقصاء والتحليل، مع الحفاظ على كثافة عالية ومناسبة لـ X. اللغة: "+language+"\nالحدث: "+e.title+"\nملخص: "+(e.synopsis||"")+"\nالأدلة: "+(e.evidence_summary||"")+"\nالمصادر: "+evidence;
  if(!key){
    const tweet=language==="en"?fallbackEnglish(e):fallbackArabic(e,items||[],style);
    return NextResponse.json({tweet,language,mode:"offline_fallback"});
  }
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"system",content:"أنت محرر محتوى OSINT. أنشئ نصًا أصليًا فقط ولا تختلق وقائع."},{role:"user",content:prompt}],max_output_tokens:1400})});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error?.message||"OpenAI request failed");
    const generated=j.output_text||((j.output||[]).map((o:any)=>(o.content||[]).map((x:any)=>x.text||"").join("\n")).join("\n"))||"";
    if(language==="en"){
      const tr=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"system",content:"Translate this Arabic X post into natural professional English. Preserve meaning, nuance and uncertainty. Do not add facts."},{role:"user",content:generated}],max_output_tokens:1400})});
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
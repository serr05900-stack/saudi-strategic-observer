import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";

function clean(v:string){return (v||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();}
function fallbackArabic(e:any, items:any[], style:string){
  const title=clean(e.title);
  const summary=clean(e.synopsis)||clean(e.evidence_summary);
  const sourceNames=(items||[]).filter((x:any)=>x?.title).slice(0,4).map((x:any)=>clean(x.title)).join(" | ");
  if(style==="breaking") return `عاجل | ${title}\n\n${summary||"التفاصيل المتاحة حتى الآن محدودة."}\n\nالمؤكد: ما ورد في المادة المرصودة. غير المؤكد: أي تفاصيل إضافية لم تؤكدها مواد مستقلة.`;
  if(style==="investigative") return `${title}\n\nالمعلومة تستحق التدقيق لأن الرواية المتاحة تقول: ${summary||"لا يوجد ملخص كافٍ بعد."}\n\nما الذي يمكن إثباته؟ المواد المرصودة تتقاطع عند وجود هذا الادعاء، لكن قوة الاستنتاج تعتمد على استقلال المصادر وتطابق التفاصيل. ${sourceNames ? "المواد المتاحة: "+sourceNames : ""}\n\nالفجوة الأهم: لا يجوز تحويل الادعاء إلى حقيقة ما لم يظهر تأكيد مستقل أو دليل مباشر. لذلك الاستنتاج الحالي محدود: لدينا رواية مرصودة، لا إثبات مكتمل. أي معلومة جديدة يجب أن تغيّر درجة الثقة فقط إذا أضافت دليلًا مستقلًا أو تفصيلًا قابلًا للتحقق.`;
  if(style==="analysis") return `${title}\n\nما حدث: ${summary||"المعطيات الحالية محدودة."}\n\nالتحليل: أهمية التطور لا تُقاس بالخبر المجرد، بل بما يضيفه إلى السياق القائم. إذا تأكدت المعطيات، فالنقطة التي تستحق المراقبة هي ما إذا كانت ستظهر مؤشرات إضافية تؤكد اتساق الرواية مع التسلسل الزمني والمعلومات الأخرى. أما الآن، فيجب الفصل بين الواقعة المرصودة وبين أي استنتاج يتجاوز الأدلة المتاحة.\n\nمؤشر المتابعة: تأكيد مستقل أو تفاصيل جديدة قابلة للمقارنة.`;
  return `${title}\n\n${summary||"التطور ما زال قيد المتابعة."}\n\nاللافت هنا ليس الخبر وحده، بل الفجوة بين ما نعرفه وما يمكن استنتاجه منه. المعطيات الحالية تسمح بقراءة أولية، لكنها لا تبرر إضافة تفاصيل غير مثبتة. لذلك تبقى قيمة التطور مرتبطة بما سيظهر من أدلة وسياق إضافي.`;
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
  const styleGuide=style==="investigative"?`استقصاء حقيقي. اكتب تغريدة طويلة ومتماسكة كأنها نتيجة عمل محلل OSINT، وليست ملخصًا أو إعادة صياغة للخبر. لا تضع حدًا اصطناعيًا لعدد الأحرف؛ اكتب بالقدر الذي تحتاجه الحجة، ويمكن أن تكون التغريدة طويلة جدًا إذا كانت الأدلة والسياق يستحقان ذلك. ابنِ الحجة على فقرات واضحة: 1) المعلومة التي تستحق التحقيق، 2) ماذا تقول الأدلة فعلًا ومن أين جاءت، 3) المقارنة بين المصادر أو غياب التأكيد المستقل، 4) التناقضات والفجوات وما لا يمكن إثباته، 5) السياق الزمني أو التشغيلي الذي يجعل المعلومة مهمة، 6) الاستنتاج الذي تسمح به الأدلة فقط، 7) ما الذي سيؤكد أو ينفي الرواية. لا تكتفِ بسؤال "هل توجد جهة مستقلة؟"؛ نفّذ المقارنة من المواد المرفقة. إذا كان المصدر واحدًا، قل ذلك بوضوح واستخرج قيمة استقصائية من أحادية المصدر. لا تخترع تفاصيل غير موجودة. لا تستخدم عبارات حشو مثل "المتابعة مستمرة" إلا إذا كانت هناك نقطة متابعة محددة. لا تكتب كخبر وكالة.`:
  style==="analysis"?`تحليل حقيقي وعميق. اكتب تغريدة طويلة ومتماسكة، دون حد اصطناعي للطول؛ اكتب بالقدر الذي تحتاجه الفكرة والتحليل، وليس بالقدر الذي يجعله مختصرًا. ابدأ بالحدث، ثم فسّر ما الذي تغيّر، واربطه بالسياق الموجود في الأدلة، واشرح لماذا يهم للسعودية أو للمشهد الإقليمي عندما يكون ذلك مدعومًا، ثم استخرج الدلالة العملياتية/الاستراتيجية من الوقائع، ثم اختم بمؤشرات محددة للمراقبة. استخدم عبارات مثل "هذا يعني..." فقط عندما يكون الاستنتاج مستندًا إلى الأدلة. افصل بوضوح بين الحقيقة والاستنتاج. ممنوع ملء النص بعبارات عامة أو إعادة سرد العنوان.`:
  style==="breaking"?`عاجل ومباشر، لكن ليس سطرين. الطول المستهدف دون حد اصطناعي للطول؛ كن مركزًا لأن الأسلوب عاجل، لكن لا تحذف التفاصيل الضرورية. اذكر الحدث المؤكد، أهم التفاصيل، مصدر/مصادر التأكيد إن وجدت، وما بقي غير مؤكد. لا تضف تحليلًا غير مدعوم.`:
  `صياغة بشرية عميقة، دون حد اصطناعي للطول؛ اجعل الطول تابعًا للمحتوى. لا تلخص الخبر فقط؛ أعطِ سياقه ومعناه وما الذي لفت الانتباه فيه، مع استنتاج محدود ومسنود بالأدلة.`;
  const prompt="اكتب نصًا أصليًا للنشر على X. "+styleGuide+" نفّذ النمط المطلوب حرفيًا؛ إذا طُلب تحليل فلا تعطِ ملخصًا، وإذا طُلب استقصاء فلا تعطِ تحليلًا عامًا فقط. استخدم الوقائع المدعومة فقط. لا تضف أرقامًا أو أسماء أو دوافع غير موجودة. لا تنسب نوايا. إذا كانت الأدلة ناقصة أو متعارضة، اجعل هذا جزءًا من النص. لا تنسخ جمل المصادر. لا تضع عنوانًا منفصلًا ثم تنتهي؛ ابنِ حجة كاملة وممتدة عند الحاجة. لا تختصر النص لتناسب حدًا افتراضيًا للأحرف؛ الطول ليس مشكلة هنا، وجودة الحجة أهم من الإيجاز. اللغة: "+language+"\nالحدث: "+e.title+"\nملخص: "+(e.synopsis||"")+"\nالأدلة: "+(e.evidence_summary||"")+"\nالمصادر: "+evidence;
  if(!key){
    const tweet=language==="en"?fallbackEnglish(e):fallbackArabic(e,items||[],style);
    return NextResponse.json({tweet,language,mode:"offline_fallback"});
  }
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"system",content:"أنت محرر محتوى OSINT. أنشئ نصًا أصليًا فقط ولا تختلق وقائع."},{role:"user",content:prompt}],max_output_tokens:5000})});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error?.message||"OpenAI request failed");
    const generated=j.output_text||((j.output||[]).map((o:any)=>(o.content||[]).map((x:any)=>x.text||"").join("\n")).join("\n"))||"";
    if(language==="en"){
      const tr=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",input:[{role:"system",content:"Translate this Arabic X post into natural professional English. Preserve meaning, nuance and uncertainty. Do not add facts."},{role:"user",content:generated}],max_output_tokens:5000})});
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
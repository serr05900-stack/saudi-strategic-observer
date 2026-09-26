import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";

function topicOf(e:any){
  const s=(e.title+" "+(e.category||"")+" "+(e.region||"")+" "+(e.synopsis||"")+" "+(e.evidence_summary||"")).toLowerCase();
  const saudi=/(saudi|السعودية|السعودي|riyadh|الرياض|kingdom|المملكة|aramco|أرامكو|jeddah|جدة|najran|نجران|yanbu|ينبع|gulf|الخليج|gcc|مجلس التعاون)/i.test(s);
  const theater=/(yemen|اليمن|houth|حوث|sanaa|صنعاء|red sea|البحر الأحمر|bab al-mandeb|باب المندب|iran|إيران|tehran|طهران|hormuz|هرمز|gulf security|أمن الخليج|shipping security|أمن الملاحة)/i.test(s);
  const military=/(defen|military|armed forces|army|navy|air force|missile|drone|air defense|defense|دفاع|عسكري|قوات مسلحة|جيش|بحرية|جوية|صاروخ|مسيرة|طيران|اعتراض|هجوم|ضربة|قاعدة عسكرية)/i.test(s);
  const political=/(president|prime minister|foreign minister|king|crown prince|government|cabinet|diplom|bilateral|relations|agreement|talks|negotiat|sanction|policy|political|رئيس|رئيس الوزراء|وزير الخارجية|ملك|ولي العهد|حكومة|مجلس الوزراء|دبلوماس|علاقات|اتفاق|مفاوض|عقوبات|سياسة|سياسي|قمة|بيان مشترك)/i.test(s);
  const strategic=/(strategy|strategic|national security|security architecture|geopolit|energy security|critical infrastructure|maritime security|security|استراتيجي|استراتيجية|أمن قومي|أمن|جيوسياس|أمن الطاقة|بنية تحتية|أمن بحري|ممرات|ملاحة)/i.test(s);
  if((saudi||theater) && military)return "Military";
  if((saudi||theater) && political)return "Political";
  if((saudi||theater) && strategic)return "Strategic";
  return null;
}

export async function GET(req:Request){
 const sb=await createClient();
 const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const u=new URL(req.url);
 const hours=Math.min(Math.max(Number(u.searchParams.get("hours")||24),1),168);
 const limit=Math.min(Math.max(Number(u.searchParams.get("limit")||160),20),300);
 const since=new Date(Date.now()-hours*3600000).toISOString();
 const {data,error}=await sb.from("events")
   .select("id,event_key,title,category,region,first_seen_at,last_updated_at,importance,status,synopsis,priority_score,alert_level,alert_reason")
   .gte("last_updated_at",since).order("last_updated_at",{ascending:false}).limit(limit);
 if(error)return NextResponse.json({events:[],error:error.message},{status:500});
 const base=(data||[]).map((e:any)=>({...e,topic:topicOf(e)})).filter((e:any)=>!!e.topic);
 const ids=base.map((e:any)=>e.id); const counts=new Map<string,Set<string>>();
 if(ids.length){const {data:links}=await sb.from("event_items").select("event_id,monitored_items(source_id)").in("event_id",ids);for(const l of links||[]){const sid=(l as any).monitored_items?.source_id;if(sid){if(!counts.has(l.event_id))counts.set(l.event_id,new Set());counts.get(l.event_id)!.add(sid)}}}
 const events=base.map((e:any)=>({...e,source_count:counts.get(e.id)?.size||0,independent_source_count:counts.get(e.id)?.size||0}));
 const {count:sourceCount}=await sb.from("sources").select("id",{count:"exact",head:true});
 const {count:itemCount}=await sb.from("monitored_items").select("id",{count:"exact",head:true});
 return NextResponse.json({events,sourceCount:sourceCount||0,itemCount:itemCount||0,updatedAt:new Date().toISOString()});
}
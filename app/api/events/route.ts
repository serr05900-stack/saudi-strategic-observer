import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";

function topicOf(e:any){
  const s=(e.title+" "+(e.category||"")+" "+(e.region||"")).toLowerCase();
  if(/saudi|سعود|riyadh|السعودية|الرياض|aramco|aramco/i.test(s)) return "Saudi";
  if(/yemen|اليمن|houth|حوث|صنعاء|bab al-mandeb|البحر الأحمر|red sea/i.test(s)) return /red sea|البحر الأحمر|bab al-mandeb/i.test(s) ? "Red Sea" : "Yemen";
  if(/iran|إيران|tehran|طهران|hormuz|هرمز/i.test(s)) return "Iran";
  if(/defen|military|army|navy|air force|missile|drone|defense|دفاع|عسكري|صاروخ|طائرة|بحرية|جوية/i.test(s)) return "Defense";
  if(/oil|energy|aramco|opec|نفط|طاقة/i.test(s)) return "Energy";
  if(/market|stock|econom|economy|سوق|أسهم|اقتصاد|inflation|فائدة/i.test(s)) return "Markets";
  return "Global";
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
   .select("id,event_key,title,category,region,first_seen_at,last_updated_at,importance,status,synopsis")
   .gte("last_updated_at",since).order("last_updated_at",{ascending:false}).limit(limit);
 if(error)return NextResponse.json({events:[],error:error.message},{status:500});
 const events=(data||[]).map((e:any)=>({...e,topic:topicOf(e)}));
 const {count:sourceCount}=await sb.from("sources").select("id",{count:"exact",head:true});
 const {count:itemCount}=await sb.from("monitored_items").select("id",{count:"exact",head:true});
 return NextResponse.json({events,sourceCount:sourceCount||0,itemCount:itemCount||0,updatedAt:new Date().toISOString()});
}
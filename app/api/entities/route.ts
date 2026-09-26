import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";

const catalog=[
 ["السعودية","state",["السعودية","Saudi Arabia","Riyadh","الرياض"]],
 ["إيران","state",["إيران","Iran","Tehran","طهران"]],
 ["الحوثيون","armed_group",["الحوث","Houthi","Houthis","صنعاء"]],
 ["الولايات المتحدة","state",["الولايات المتحدة","United States","US","U.S."]],
 ["إسرائيل","state",["إسرائيل","Israel"]],
 ["اليمن","state",["اليمن","Yemen"]],
 ["البحر الأحمر","region",["البحر الأحمر","Red Sea","باب المندب","Bab al-Mandeb"]],
 ["روسيا","state",["روسيا","Russia","Moscow"]],
 ["الصين","state",["الصين","China","Beijing"]],
 ["أرامكو","company",["أرامكو","Aramco","Saudi Aramco"]]
] as const;

export async function GET(){
 const sb=await createClient(); const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const since=new Date(Date.now()-30*24*3600000).toISOString();
 const {data:events}=await sb.from("events").select("id,title,synopsis,category,region,last_updated_at").eq("owner_id",user.id).gte("last_updated_at",since).order("last_updated_at",{ascending:false}).limit(500);
 const rows:any[]=[];
 for(const [name,type,aliases] of catalog){
   const hits=(events||[]).filter((e:any)=>aliases.some(a=>(e.title+" "+(e.synopsis||"")).toLowerCase().includes(a.toLowerCase())));
   if(hits.length) rows.push({name,type,mention_count:hits.length,last_seen_at:hits[0].last_updated_at,event_count:hits.length,events:hits.slice(0,8)});
   const {data:ent}=await sb.from("tracked_entities").upsert({owner_id:user.id,name,entity_type:type,aliases:[...aliases],mention_count:hits.length,last_seen_at:hits[0]?.last_updated_at||null},{onConflict:"owner_id,name"}).select().single();
   if(ent) for(const ev of hits.slice(0,50)) await sb.from("entity_event_links").upsert({entity_id:ent.id,event_id:ev.id,mentions:1,last_seen_at:ev.last_updated_at},{onConflict:"entity_id,event_id"});
 }
 return NextResponse.json({entities:rows.sort((a,b)=>b.mention_count-a.mention_count)});
}
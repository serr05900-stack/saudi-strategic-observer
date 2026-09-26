import {NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server";

export async function GET(req:Request,{params}:{params:{id:string}}){
 const sb=await createClient();
 const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:event,error}=await sb.from("events").select("*").eq("id",params.id).eq("owner_id",user.id).maybeSingle();
 if(error||!event)return NextResponse.json({error:"Event not found"},{status:404});
 const {data:links}=await sb.from("event_items").select("monitored_item_id,relation").eq("event_id",event.id).eq("owner_id",user.id);
 const ids=(links||[]).map((x:any)=>x.monitored_item_id);
 const {data:items}=ids.length?await sb.from("monitored_items").select("id,title,url,summary,category,published_at,collected_at,verification_status,source_id").in("id",ids).order("published_at",{ascending:false}):{data:[]};
 const sourceIds=[...new Set((items||[]).map((x:any)=>x.source_id).filter(Boolean))];
 const {data:sources}=sourceIds.length?await sb.from("sources").select("id,name,url,source_type,region,language,priority,last_checked_at").in("id",sourceIds):{data:[]};
 const {data:children}=await sb.from("events").select("id,title,category,region,first_seen_at,last_updated_at,status,synopsis").eq("parent_event_id",event.id).eq("owner_id",user.id).order("first_seen_at",{ascending:true});
 const {data:analyses}=await sb.from("analyses").select("id,model,analysis,created_at").eq("event_id",event.id).eq("owner_id",user.id).order("created_at",{ascending:false}).limit(5);
 const sourceCount=new Set((items||[]).map((x:any)=>x.source_id).filter(Boolean)).size;
 const independentSourceCount=sourceCount;
 const ageHours=(Date.now()-new Date(event.first_seen_at).getTime())/3600000;
 const update_kind=event.update_kind||((ageHours<2)?"new":"updated");
 return NextResponse.json({event:{...event,source_count:sourceCount,independent_source_count:independentSourceCount,update_kind,verification_confidence:event.verification_confidence||((analyses||[])[0]?.analysis?.confidence||null)},items:items||[],sources:sources||[],analyses:analyses||[],children:children||[]});
}
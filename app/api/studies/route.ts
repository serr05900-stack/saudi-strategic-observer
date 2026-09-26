import {NextResponse} from "next/server"; import {createClient} from "../../../lib/supabase/server";
export async function GET(){
 const sb=await createClient(); const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data,error}=await sb.from("strategic_studies").select("*").eq("owner_id",user.id).order("published_at",{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:error.message},{status:500});
 const studies=data||[]; const ids=studies.map((s:any)=>s.id);
 let links:any[]=[];
 if(ids.length){const r=await sb.from("study_event_links").select("study_id,event_id,relevance").in("study_id",ids);links=r.data||[];}
 const eventIds=links.map(x=>x.event_id);
 let events:any[]=[];
 if(eventIds.length){const r=await sb.from("events").select("id,title,category,region,last_updated_at").in("id",eventIds);events=r.data||[];}
 const byStudy=new Map<string,any[]>();
 for(const l of links){const e=events.find(x=>x.id===l.event_id);if(e){if(!byStudy.has(l.study_id))byStudy.set(l.study_id,[]);byStudy.get(l.study_id)!.push({...e,relevance:l.relevance});}}
 return NextResponse.json({studies:studies.map((s:any)=>({...s,linked_events:(byStudy.get(s.id)||[]).sort((a,b)=>(b.relevance||0)-(a.relevance||0)).slice(0,6)}))});
}
export async function POST(req:Request){const sb=await createClient();const {data:{user}}=await sb.auth.getUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});const b=await req.json();const {data,error}=await sb.from("strategic_studies").insert({...b,owner_id:user.id}).select().single();if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({study:data});}
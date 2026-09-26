import {NextResponse} from "next/server"; import {createClient} from "../../../lib/supabase/server";
function tokens(s:string){return new Set((s||"").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(x=>x.length>3));}
function similarity(a:string,b:string){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.max(1,Math.min(A.size,B.size));}
export async function GET(){
 const sb=await createClient(); const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data,error}=await sb.from("strategic_studies").select("*").eq("owner_id",user.id).order("published_at",{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:error.message},{status:500});
 const since=new Date(Date.now()-72*3600000).toISOString();
 const {data:events}=await sb.from("events").select("id,title,category,region,last_updated_at,synopsis").eq("owner_id",user.id).gte("last_updated_at",since).limit(250);
 const studies=data||[];
 return NextResponse.json({studies:studies.map((s:any)=>{const base=s.title+" "+(s.summary||"")+" "+(s.saudi_implications||"");const linked=(events||[]).map((e:any)=>({...e,relevance:similarity(base,e.title+" "+(e.synopsis||""))})).filter((e:any)=>e.relevance>=0.28).sort((a:any,b:any)=>b.relevance-a.relevance).slice(0,6);return {...s,linked_events:linked};})});
}
export async function POST(req:Request){const sb=await createClient();const {data:{user}}=await sb.auth.getUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});const b=await req.json();const {data,error}=await sb.from("strategic_studies").insert({...b,owner_id:user.id}).select().single();if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({study:data});}
import {NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server";
export async function GET(req:Request){
 const sb=await createClient(); const {data:{user}}=await sb.auth.getUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {searchParams}=new URL(req.url); const q=(searchParams.get("q")||"").trim(); const hours=Math.min(Number(searchParams.get("hours")||720),2160);
 if(!q)return NextResponse.json({items:[]});
 const since=new Date(Date.now()-hours*3600000).toISOString();
 const {data,error}=await sb.from("monitored_items").select("id,title,url,published_at,summary,source_id").eq("owner_id",user.id).gte("published_at",since).ilike("title","%"+q+"%").order("published_at",{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:error.message},{status:500}); return NextResponse.json({items:data||[],query:q});
}
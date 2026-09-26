import {NextResponse} from "next/server";
import {createClient} from "../../../lib/supabase/server";
export async function GET(){
 const sb=await createClient(); const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:sources,error}=await sb.from("sources").select("id,name,url,category,region,source_type,language,priority,is_active,last_checked_at").eq("owner_id",user.id).order("priority",{ascending:false});
 if(error)return NextResponse.json({error:error.message},{status:500});
 const now=Date.now(); const rows=(sources||[]).map((s:any)=>{const age=s.last_checked_at?now-new Date(s.last_checked_at).getTime():Infinity; return {...s,health:age<25*60*1000?"healthy":age<90*60*1000?"delayed":"stale",age_minutes:Number.isFinite(age)?Math.round(age/60000):null}});
 return NextResponse.json({sources:rows,updatedAt:new Date().toISOString()});
}
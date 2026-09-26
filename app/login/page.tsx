"use client";
import {useState} from "react";
import {createClient} from "../../lib/supabase/client";
import {Shield} from "lucide-react";

export default function Login(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [signup,setSignup]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const supabase=createClient();

    if(signup){
      const {data,error}=await supabase.auth.signUp({email,password});
      if(error) setError(error.message);
      else if(data.session) location.href="/";
      else setMessage("تم إنشاء الحساب. إذا طُلب منك تأكيد البريد الإلكتروني، أكّد الرسالة ثم ارجع وسجّل الدخول.");
    }else{
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error) setError(error.message);
      else location.href="/";
    }
    setBusy(false);
  }

  return <main className="shell login">
    <form className="card loginBox" onSubmit={submit}>
      <div className="brand">
        <div className="mark"><Shield size={21}/></div>
        <div><div className="eyebrow">PRIVATE ACCESS</div><div className="title">المرصد الاستراتيجي</div></div>
      </div>
      <p className="summary">{signup?"إنشاء حساب المالك للدخول إلى غرفة الرصد الخاصة.":"الدخول إلى غرفة الرصد الخاصة."}</p>
      <input className="field" type="email" placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)} required/>
      <input className="field" type="password" placeholder="كلمة المرور" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required/>
      {error&&<div className="error">{error}</div>}
      {message&&<div className="summary" style={{fontSize:14}}>{message}</div>}
      <button className="gold" style={{width:"100%",height:46}} disabled={busy}>{busy?"جارٍ التنفيذ...":signup?"إنشاء الحساب":"دخول"}</button>
      <button type="button" className="field" style={{width:"100%",height:46,background:"transparent",cursor:"pointer"}} onClick={()=>{setSignup(!signup);setError("");setMessage("")}}>
        {signup?"لدي حساب — تسجيل الدخول":"إنشاء حساب المالك"}
      </button>
    </form>
  </main>
}
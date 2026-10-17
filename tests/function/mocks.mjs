import http from 'node:http';
const rd = r => new Promise(res => { let b=''; r.on('data',c=>b+=c); r.on('end',()=>res(b)); });
// mock Supabase: auth + the few RPCs the assistant uses
http.createServer(async (req,res)=>{ const send=(c,j)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(j));};
  const body = await rd(req);
  if(req.url.startsWith('/auth/v1/user')){ return (req.headers.authorization==='Bearer good-token')?send(200,{id:'u1',aud:'authenticated',email:'ali@afarinesh.test'}):send(401,{msg:'invalid token'}); }
  if(req.headers.authorization!=='Bearer good-token'&&req.url.includes('/rpc/'))return send(401,{message:'no'});
  const m=req.url.match(/\/rest\/v1\/rpc\/(\w+)/); if(!m)return send(404,{});
  const a=body?JSON.parse(body):{};
  const out={ai_limit_ok:true,ai_history:[],ai_account:{name:'علی',unit:a.p_unit,role:'owner',balance:-100},ai_log:'00000000-0000-0000-0000-000000000001'}[m[1]];
  return send(200,out===undefined?null:out);
}).listen(54321);
// mock OpenAI
http.createServer(async (req,res)=>{ const send=(c,j)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(j));};
  const b=JSON.parse(await rd(req)||'{}'); const key=(req.headers.authorization||'').replace('Bearer ','');
  globalThis.last={key,model:b.model,tools:(b.tools||[]).length,hasMaxCompletion:'max_completion_tokens' in b};
  if(req.url==='/__last')return send(200,globalThis.last);
  if(key==='sk-bad')return send(401,{error:{message:'Incorrect API key'}});
  if(key==='sk-quota')return send(429,{error:{message:'You exceeded your current quota, billing',code:'insufficient_quota'}});
  if(key==='sk-fallback'&&b.model==='gpt-4.1-mini')return send(404,{error:{message:'The model gpt-4.1-mini does not exist',code:'model_not_found'}});
  const hasTool=b.messages.some(m=>m.role==='tool');
  if(!hasTool)return send(200,{choices:[{message:{content:null,tool_calls:[{id:'c1',type:'function',function:{name:'get_account',arguments:'{}'}}]}}]});
  const tool=JSON.parse(b.messages.filter(m=>m.role==='tool').pop().content);
  send(200,{choices:[{message:{content:`سلام ${tool.name}! موجودیت ${tool.balance} تومانه (مدل: ${b.model})`}}]});
}).listen(54322);
console.log('mocks up');

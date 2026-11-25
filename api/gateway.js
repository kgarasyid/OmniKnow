import {gateway} from '../server/gateway.mjs';
export default async function handler(req,res){
 const url=new URL(req.url,'http://internal'),route=typeof req.query?.route==='string'?req.query.route:'';
 const origin=process.env.AUTH_ORIGIN||'http://127.0.0.1:5173',target=new URL('/'+route.replace(/^\/+/,''),origin);for(const [k,v] of url.searchParams)if(k!=='route')target.searchParams.append(k,v);
 let body='';if(!['GET','HEAD'].includes(req.method)){for await(const chunk of req){body+=chunk;if(body.length>4096){res.statusCode=413;return res.end('Too large')}}}
 const request=new Request(target,{method:req.method,headers:req.headers,...(body?{body}:{})}),response=await gateway(request);
 res.statusCode=response.status;for(const [k,v] of response.headers)if(k!=='set-cookie')res.setHeader(k,v);const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);res.end(Buffer.from(await response.arrayBuffer()));
}

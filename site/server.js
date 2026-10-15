const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=fs.realpathSync(__dirname),PORT=+process.env.PORT||8081;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.txt':'text/plain; charset=utf-8','.dmg':'application/x-apple-diskimage','.zip':'application/zip','.map':'application/json'};
const GZ=new Set(['.html','.css','.js','.json','.svg','.txt','.map']);
const SEC={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Strict-Transport-Security':'max-age=31536000'};
const HIDDEN=new Set(['server.js','serve.sh','serve.log','serve.pid']);
function send(res,code,body,type='text/plain; charset=utf-8',extra={}){res.writeHead(code,{...SEC,'Content-Type':type,'Content-Length':Buffer.byteLength(body),...extra});res.end(body)}
function nf(req,res){let b='404 Not Found';try{b=fs.readFileSync(path.join(ROOT,'404.html'))}catch{};res.writeHead(404,{...SEC,'Content-Type':'text/html; charset=utf-8','Content-Length':b.length,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:b)}
http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,'Method Not Allowed','text/plain',{Allow:'GET, HEAD'});
 let p;try{p=decodeURIComponent(new URL(req.url,'http://x').pathname)}catch{return send(res,400,'Bad Request')}
 if(p.includes('\0'))return send(res,400,'Bad Request');
 if(p.endsWith('/'))p+='index.html';
 const parts=p.split('/').filter(Boolean);
 if(parts.some(x=>x.startsWith('.'))||HIDDEN.has(parts[0]))return nf(req,res);
 let f=path.join(ROOT,p),real;
 try{real=fs.realpathSync(f)}catch{return nf(req,res)}
 const dl=path.join(ROOT,'downloads')+path.sep;
 if(!(real.startsWith(ROOT+path.sep)||(f.startsWith(dl)&&['.dmg','.zip'].includes(path.extname(real)))))return nf(req,res);
 let st;try{st=fs.statSync(real)}catch{return nf(req,res)}
 if(!st.isFile())return nf(req,res);
 const ext=path.extname(f).toLowerCase(),h={...SEC,'Content-Type':MIME[ext]||'application/octet-stream','Accept-Ranges':'bytes','Last-Modified':st.mtime.toUTCString()};
 const etag='W/"'+st.size.toString(16)+'-'+st.mtimeMs.toString(16)+'"';h.ETag=etag;
 h['Cache-Control']=p.startsWith('/_next/static/')?'public, max-age=31536000, immutable':ext==='.html'?'no-cache':'public, max-age=3600';
 if(ext==='.dmg'||ext==='.zip')h['Content-Disposition']='attachment; filename="'+path.basename(f)+'"';
 if(req.headers['if-none-match']===etag){res.writeHead(304,h);return res.end()}
 let range=req.headers.range,start=0,end=st.size-1,code=200;
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(m&&(m[1]||m[2])){if(m[1]===''){start=Math.max(0,st.size-+m[2])}else{start=+m[1];if(m[2])end=Math.min(end,+m[2])}
   if(start>end||start>=st.size){res.writeHead(416,{...SEC,'Content-Range':'bytes */'+st.size});return res.end()}
   code=206;h['Content-Range']=`bytes ${start}-${end}/${st.size}`}}
 const ae=req.headers['accept-encoding']||'';h.Vary='Accept-Encoding';
 if(code===200&&GZ.has(ext)&&/\bgzip\b/.test(ae)&&st.size>256){h['Content-Encoding']='gzip';res.writeHead(200,h);if(req.method==='HEAD')return res.end();return fs.createReadStream(real).pipe(zlib.createGzip({level:6})).pipe(res)}
 h['Content-Length']=end-start+1;res.writeHead(code,h);
 if(req.method==='HEAD')return res.end();
 const s=fs.createReadStream(real,{start,end});s.on('error',()=>res.destroy());res.on('close',()=>s.destroy());s.pipe(res);
}).listen(PORT,'127.0.0.1',()=>console.log('listening',PORT));

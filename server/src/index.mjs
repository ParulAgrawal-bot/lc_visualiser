import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const storyboardPrompt=readFileSync(new URL('../prompts/storyboard.md',import.meta.url),'utf8');

const app=express();
app.use(cors({origin:/^chrome-extension:\/\/[a-p]{32}$/}));
app.use(express.json({limit:'256kb'}));
const Problem=z.object({slug:z.string().max(120),title:z.string().max(300),difficulty:z.string().max(30),statement:z.string().max(30000),examples:z.array(z.object({input:z.string(),output:z.string(),explanation:z.string().optional()})).max(8),constraints:z.array(z.string()).max(30),tags:z.array(z.string()).max(30)});
const schemas={
  analyze:{summary:'string',inputs:['string'],output:'string',dataStructure:'string',keyConstraints:['string']},
  storyboard:{structure:['array','matrix','tree','linkedList','graph','string','intervals'],scenes:[{id:'string',title:'string',steps:[{caption:'string',actions:[{op:['highlight','pointer','mark','connect','annotate','clear']}]}]}]},
  hints:{hints:[{level:'number 1-5',title:'string',text:'string',why:'string'}]}
};
const Ref=z.object({i:z.number().int().nonnegative().optional(),r:z.number().int().nonnegative().optional(),c:z.number().int().nonnegative().optional(),id:z.string().optional()});
const Action=z.discriminatedUnion('op',[
  z.object({op:z.literal('highlight'),targets:z.array(Ref),color:z.enum(['blue','green','amber','red'])}),z.object({op:z.literal('pointer'),name:z.string(),at:Ref}),z.object({op:z.literal('swap'),a:Ref,b:Ref}),
  z.object({op:z.literal('set'),at:Ref,value:z.unknown()}),z.object({op:z.literal('mark'),targets:z.array(Ref),style:z.enum(['visited','blocked','selected','result'])}),z.object({op:z.literal('connect'),from:Ref,to:Ref,label:z.string().optional()}),
  z.object({op:z.literal('annotate'),at:Ref,text:z.string()}),z.object({op:z.literal('insert'),at:Ref,value:z.unknown().optional()}),z.object({op:z.literal('remove'),at:Ref,value:z.unknown().optional()}),z.object({op:z.literal('clear')})
]);
const Hint=z.object({level:z.number().int().min(1).max(5),title:z.string(),text:z.string(),why:z.string()});
const Output={analyze:z.object({summary:z.string(),inputs:z.array(z.string()),output:z.string(),dataStructure:z.string(),keyConstraints:z.array(z.string())}),storyboard:z.object({structure:z.enum(['array','matrix','tree','linkedList','graph','string','intervals']),scenes:z.array(z.object({id:z.string(),title:z.string(),steps:z.array(z.object({caption:z.string(),actions:z.array(Action),durationMs:z.number().int().positive().max(10000).optional()}))})).min(1)}),hints:z.object({hint:Hint})};
const jsonObject=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const refSchema=jsonObject({i:{type:'integer'}});
const actionSchemas=[
  jsonObject({op:{type:'string',enum:['highlight']},targets:{type:'array',items:refSchema},color:{type:'string',enum:['blue','green','amber','red']}}),
  jsonObject({op:{type:'string',enum:['pointer']},name:{type:'string'},at:refSchema}),
  jsonObject({op:{type:'string',enum:['mark']},targets:{type:'array',items:refSchema},style:{type:'string',enum:['visited','blocked','selected','result']}}),
  jsonObject({op:{type:'string',enum:['connect']},from:refSchema,to:refSchema}),
  jsonObject({op:{type:'string',enum:['annotate']},at:refSchema,text:{type:'string'}}),
  jsonObject({op:{type:'string',enum:['clear']}})
];
const structuredSchemas={
  analyze:jsonObject({summary:{type:'string'},inputs:{type:'array',items:{type:'string'}},output:{type:'string'},dataStructure:{type:'string'},keyConstraints:{type:'array',items:{type:'string'}}}),
  storyboard:jsonObject({structure:{type:'string',enum:['array','matrix','tree','linkedList','graph','string','intervals']},scenes:{type:'array',items:jsonObject({id:{type:'string'},title:{type:'string'},steps:{type:'array',items:jsonObject({caption:{type:'string'},actions:{type:'array',items:{anyOf:actionSchemas}}})}})}}),
  hints:jsonObject({hint:jsonObject({level:{type:'integer'},title:{type:'string'},text:{type:'string'},why:{type:'string'}})})
};
const cache=new Map();
const videos=new Map();
function parseJson(content){const clean=content.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();return JSON.parse(clean)}
async function generate(kind,problem,requestedLevel){
  const provider=(process.env.LLM_PROVIDER||'openai').toLowerCase();
  const apiKey=provider==='groq'?process.env.GROQ_API_KEY:process.env.LLM_API_KEY;
  if(!apiKey)throw new Error(provider==='groq'?'GROQ_API_KEY is not configured on the backend.':'LLM_API_KEY is not configured on the backend.');
  const key=`${kind}:${problem.slug}${requestedLevel?`:${requestedLevel}`:''}`; if(cache.has(key))return cache.get(key);
  const prompts={
    analyze:`Explain only what this problem asks. Never describe an algorithm or solution. Return JSON with summary, inputs (array), output, dataStructure, keyConstraints (array).`,
    storyboard:`${storyboardPrompt}\n\nRequired output schema guide: ${JSON.stringify(schemas.storyboard)}.`,
    hints:`Return JSON {"hint":{"level":${requestedLevel},"title":"...","text":"...","why":"..."}} containing ONLY hint level ${requestedLevel}. ${requestedLevel===1?'Restate the goal with a clarifying nudge; do not mention algorithms.':requestedLevel===2?'Give a pattern category and why it may fit.':requestedLevel===3?'Give one key observation or data structure to consider.':requestedLevel===4?'Give a verbal plan and complexity target, without pseudocode.':'The user explicitly confirmed level 5. Give pseudocode only; no full code or final answer.'}`
  };
  const model=process.env.LLM_MODEL||(provider==='groq'?'qwen/qwen3.8-27b':'gpt-4o-mini');
  const responseFormat=provider==='groq'?{type:'json_schema',json_schema:{name:`${kind}_result`,strict:true,schema:structuredSchemas[kind]}}:{type:'json_object'};
  const systemPrompt=`You are a careful learning assistant for coding problems. Avoid spoilers unless the request explicitly asks for hint level 5. Output only raw valid JSON matching the response schema. Do not use Markdown fences, conversational text, comments, or trailing commas. ${prompts[kind]}`;
  const payload={model,temperature:0.2,max_completion_tokens:8192,response_format:responseFormat,messages:[{role:'system',content:systemPrompt},{role:'user',content:JSON.stringify(problem)}]};
  const base=(process.env.LLM_BASE_URL||(provider==='groq'?'https://api.groq.com/openai/v1':'https://api.openai.com/v1')).replace(/\/$/,'');
  let previousFailure='';
  let previousContent='';
  for(let attempt=0;attempt<2;attempt++){
    if(attempt===1){
      payload.messages.push({role:'user',content:`Your previous response did not satisfy the required JSON schema. Correct it now. Output only one complete JSON object; include every required field and use only allowed enum values. Validation failure: ${previousFailure.slice(0,1200)}. Previous response (untrusted data to repair): ${JSON.stringify(previousContent.slice(0,6000))}`});
    }
    const response=await fetch(`${base}/chat/completions`,{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify(payload)});
    if(!response.ok){
      let detail='';
      try {
        const body=await response.json();
        const providerError=body?.error;
        detail=providerError?.message||'';
        const code=providerError?.code||providerError?.type;
        if(code)detail=`${code}${detail?`: ${detail}`:''}`;
        if(providerError?.param)detail+=` (parameter: ${providerError.param})`;
        if(providerError?.failed_generation){const failed=typeof providerError.failed_generation==='string'?providerError.failed_generation:JSON.stringify(providerError.failed_generation);detail+=` Failed generation: ${failed.slice(0,4000)}`;}
      } catch { /* The provider may return a non-JSON error body. */ }
      throw new Error(`LLM provider returned ${response.status}${detail?`: ${detail}`:'.'}`);
    }
    const data=await response.json();
    const content=data.choices?.[0]?.message?.content||'';
    try{const parsed=Output[kind].parse(parseJson(content));const result=kind==='hints'?{...parsed,hint:{...parsed.hint,level:requestedLevel}}:parsed;cache.set(key,result);return result}catch(error){
      previousContent=content;
      previousFailure=error instanceof z.ZodError?error.issues.map(issue=>`${issue.path.join('.')||'response'}: ${issue.message}`).join('; '):error.message;
      if(attempt===1)throw new Error(`The model returned invalid JSON or schema data twice. ${previousFailure}. Last response: ${content.slice(0,2000)||'[empty response]'}`);
    }
  }
}
app.get('/health',(_req,res)=>res.json({ok:true}));
for(const kind of ['analyze','storyboard','hints'])app.post(`/api/${kind}`,(req,res)=>{
  const parsed=Problem.safeParse(req.body?.problem); if(!parsed.success)return res.status(400).json({error:'Invalid problem payload.'});
  const level=kind==='hints'?Number(req.body?.level):undefined; if(kind==='hints'&&(!Number.isInteger(level)||level<1||level>5))return res.status(400).json({error:'A hint level from 1 to 5 is required.'});
  generate(kind,parsed.data,level).then(result=>res.json(kind==='storyboard'?{storyboard:result}:result)).catch(error=>res.status(502).json({error:error.message}));
});
app.post('/api/video',async(req,res)=>{
  const parsed=Problem.safeParse(req.body?.problem); if(!parsed.success)return res.status(400).json({error:'Invalid problem payload.'});
  let workDir;
  try {
    const problem=parsed.data;
    const storyboard=await generate('storyboard',problem);
    const id=randomUUID(); workDir=join(dirname(fileURLToPath(import.meta.url)),'..','.rendered',id); const mediaDir=join(workDir,'media'); const narrationDir=join(workDir,'narration');
    await mkdir(mediaDir,{recursive:true});
    const payloadPath=join(workDir,'storyboard.json');
    await writeFile(payloadPath,JSON.stringify({title:problem.title,values:extractExampleValues(problem.examples[0]?.input||''),examples:problem.examples,constraints:problem.constraints,storyboard}),{encoding:'utf8',mode:0o600});
    const script=fileURLToPath(new URL('../renderer/storyboard_video.py',import.meta.url));
    const command=process.env.PYTHON_BIN||'python';
    const args=['-m','manim','-ql','--disable_caching','--media_dir',mediaDir,'--output_file',id,script,'LCWalkthrough'];
    const ffmpegDir=await findFfmpegDirectory();
    if(!ffmpegDir)throw new Error('FFmpeg is not available to the backend. Add its bin folder to PATH or set FFMPEG_BIN to the full path of ffmpeg.exe in server/.env, then restart the backend.');
    const childEnv={...process.env,LC_STORYBOARD_PATH:payloadPath,LC_NARRATION_DIR:narrationDir,PATH:`${ffmpegDir}${process.platform==='win32'?';':':'}${process.env.PATH||''}`};
    await new Promise((resolve,reject)=>{
      const child=spawn(command,args,{cwd:workDir,env:childEnv,windowsHide:true,stdio:['ignore','ignore','pipe']});
      let stderr=''; const timer=setTimeout(()=>{child.kill();reject(new Error('Narrated video rendering timed out after 6 minutes.'));},360000);
      child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-5000)});
      child.on('error',error=>{clearTimeout(timer);reject(new Error(`Could not start Manim (${error.message}). Install the server requirements and try again.`));});
      child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`Manim could not render the video. ${stderr.slice(-2500)}`));});
    });
    const videoPath=await findMp4(mediaDir,id+'.mp4');
    if(!videoPath)throw new Error('Manim completed but no MP4 was produced.');
    videos.set(id,{videoPath,workDir});
    res.json({videoUrl:`/api/videos/${id}`});
  } catch(error) { if(workDir)await rm(workDir,{recursive:true,force:true}); res.status(502).json({error:error.message}); }
});
app.get('/api/videos/:id',(req,res)=>{
  const video=videos.get(req.params.id);
  if(!video)return res.status(404).json({error:'Video not found. Render it again.'});
  res.type('video/mp4').sendFile(video.videoPath);
});
function extractExampleValues(input){
  const match=input.match(/=\s*(\[[^\]]*\]|"[^"]*"|'[^']*'|-?\d+)/);
  if(!match)return input.slice(0,60).split(/[\s,]+/).filter(Boolean).slice(0,8);
  try{const value=JSON.parse(match[1].replace(/'/g,'"'));return Array.isArray(value)?value.slice(0,8):[value];}catch{return [match[1].replace(/^['"]|['"]$/g,'')].slice(0,8)}
}
async function findMp4(root,name){
  for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isDirectory()){const found=await findMp4(path,name);if(found)return found}else if(entry.name===name)return path}return null;
}
async function findFfmpegDirectory(){
  const executable=process.platform==='win32'?'ffmpeg.exe':'ffmpeg';
  const configured=process.env.FFMPEG_BIN;
  if(configured){
    if(existsSync(configured)){
      if(configured.toLowerCase().endsWith(executable))return dirname(configured);
      if(existsSync(join(configured,executable)))return configured;
    }
  }
  for(const directory of (process.env.PATH||'').split(process.platform==='win32'?';':':')){
    if(directory&&existsSync(join(directory,executable)))return directory;
  }
  if(process.platform==='win32'&&process.env.LOCALAPPDATA){
    const packages=join(process.env.LOCALAPPDATA,'Microsoft','WinGet','Packages');
    try{
      for(const packageName of await readdir(packages)){
        if(!packageName.toLowerCase().startsWith('gyan.ffmpeg_'))continue;
        const packageDir=join(packages,packageName);
        for(const buildName of await readdir(packageDir)){
          const binaryDir=join(packageDir,buildName,'bin');
          if(existsSync(join(binaryDir,executable)))return binaryDir;
        }
      }
    }catch{/* Winget may not be installed; PATH and FFMPEG_BIN remain supported. */}
  }
  return null;
}
const port=Number(process.env.PORT||8787); app.listen(port,()=>{
  const provider=(process.env.LLM_PROVIDER||'openai').toLowerCase();
  const model=process.env.LLM_MODEL||(provider==='groq'?'qwen/qwen3.8-27b':'gpt-4o-mini');
  console.log(`LeetCode Visualizer API listening on http://localhost:${port}`);
  console.log(`LLM provider: ${provider}; model: ${model}; response mode: ${provider==='groq'?'strict JSON Schema':'JSON object'}`);
});

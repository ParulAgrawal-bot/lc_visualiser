import { ProblemSchema, type Problem } from './schema';

const text = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g,' ').trim();
export function slugFromUrl(url=location.href) { return url.match(/\/problems\/([^/]+)/)?.[1] ?? ''; }
export async function scanProblem(): Promise<Problem> {
  const slug=slugFromUrl();
  if (!slug) throw new Error('Open a LeetCode problem page first.');
  // A stale content script can outlive an extension reload, and older unpacked
  // builds may not expose storage. In either case scan from the page without cache.
  const localStorage = typeof chrome !== 'undefined' ? chrome.storage?.local : undefined;
  const cached=localStorage ? await localStorage.get(`problem:${slug}`) : {};
  if (cached[`problem:${slug}`]) return ProblemSchema.parse(cached[`problem:${slug}`]);
  let question: Record<string,unknown> | undefined;
  try {
    const response=await fetch('https://leetcode.com/graphql/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { title difficulty content exampleTestcases topicTags { name } } }',variables:{titleSlug:slug}})});
    const data=await response.json(); question=data?.data?.question;
  } catch { /* LeetCode may block GraphQL; use the active page DOM below. */ }
  const statement=String(question?.content ?? text(document.querySelector('[data-track-load="description_content"], .elfjS, [class*="description"]')));
  const title=String(question?.title ?? (text(document.querySelector('[data-cy="question-title"], h1')) || slug.replaceAll('-',' ')));
  const seenExamples=new Set<string>();
  const examples=[...document.querySelectorAll('[class*="example"], pre')].map(el=>el.textContent?.trim() ?? '').filter(value=>/Input:/i.test(value)&&/Output:/i.test(value)).map(value=>({input:value.match(/Input:\s*([\s\S]*?)(?=Output:|$)/i)?.[1]?.replace(/\s+/g,' ').trim() ?? '',output:value.match(/Output:\s*([\s\S]*?)(?=Explanation:|$)/i)?.[1]?.replace(/\s+/g,' ').trim() ?? '',explanation:value.match(/Explanation:\s*([\s\S]*)/i)?.[1]?.replace(/\s+/g,' ').trim()})).filter(example=>{if(!example.input||!example.output||seenExamples.has(example.input))return false;seenExamples.add(example.input);return true}).slice(0,4);
  const constraints=[...document.querySelectorAll('li')].map(text).filter(x=>/[<>≤≥]|10\^|10⁵|10⁴/.test(x)).slice(-12);
  const tags=Array.isArray(question?.topicTags)?(question.topicTags as {name:string}[]).map(x=>x.name):[];
  const problem=ProblemSchema.parse({slug,title,difficulty:String(question?.difficulty ?? (text(document.querySelector('[diff]')) || 'Unknown')),statement:statement||'Problem description could not be read from this page.',examples,constraints,tags});
  if (localStorage) await localStorage.set({[`problem:${slug}`]:problem});
  return problem;
}

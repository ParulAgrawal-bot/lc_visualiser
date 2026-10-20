import type { Action, Frame, Storyboard } from '../shared/schema';
import { RefSchema } from '../shared/schema';

const indexOf = (ref: {i?:number}, length: number) => {
  const parsed = RefSchema.parse(ref);
  if (parsed.i === undefined || parsed.i >= length) throw new Error('Storyboard reference is outside the example input.');
  return parsed.i;
};
export function applyAction(frame: Frame, action: Action): Frame {
  const next: Frame = structuredClone(frame);
  switch (action.op) {
    case 'highlight': action.targets.forEach(ref => { next.marks[indexOf(ref,next.values.length)] = action.color; }); break;
    case 'mark': action.targets.forEach(ref => { next.marks[indexOf(ref,next.values.length)] = action.style; }); break;
    case 'pointer': next.pointers[action.name] = indexOf(action.at,next.values.length); break;
    case 'swap': { const a=indexOf(action.a,next.values.length), b=indexOf(action.b,next.values.length); [next.values[a],next.values[b]]=[next.values[b],next.values[a]]; break; }
    case 'set': next.values[indexOf(action.at,next.values.length)] = action.value; break;
    case 'annotate': next.annotations[action.at.id ?? String(indexOf(action.at,next.values.length))] = action.text; break;
    case 'insert': { const i=Math.min(action.at.i ?? next.values.length,next.values.length); next.values.splice(i,0,action.value ?? null); break; }
    case 'remove': next.values.splice(indexOf(action.at,next.values.length),1); break;
    case 'connect': indexOf(action.from,next.values.length); indexOf(action.to,next.values.length); break;
    case 'clear': next.marks={}; next.pointers={}; next.annotations={}; break;
  }
  return next;
}
export function buildFrames(initial: unknown[], storyboard: Storyboard): { frames: Frame[]; captions: string[]; sceneStarts: number[] } {
  const frames: Frame[]=[{values:structuredClone(initial),marks:{},pointers:{},annotations:{},caption:''}], captions:string[]=[], sceneStarts:number[]=[];
  for (const scene of storyboard.scenes) { sceneStarts.push(frames.length-1); for (const step of scene.steps) { const prev=frames[frames.length-1]; let next={...structuredClone(prev),caption:step.caption}; for (const action of step.actions) next=applyAction(next,action); frames.push(next); captions.push(step.caption); } }
  return {frames,captions,sceneStarts};
}

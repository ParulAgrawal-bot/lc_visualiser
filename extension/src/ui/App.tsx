import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronUp, Lightbulb, Pause, Play, RotateCcw, Sparkles, X } from 'lucide-react';
import { buildFrames } from '../engine/reducer';
import { scanProblem } from '../shared/problem';
import { ProblemVisual } from './ProblemVisual';
import { StoryboardSchema, type Problem, type Storyboard } from '../shared/schema';

const plainText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
const asSentence = (text: string, max = 250) => {
  const clean = text.slice(0, max).trim();
  if (!clean) return '';
  return /[.!?]$/.test(clean) ? clean : `${clean.replace(/[,:;\s]+$/, '')}…`;
};
const buildFallbackStoryboard = (problem?: Problem): Storyboard => {
  const example = problem?.examples[0], secondExample = problem?.examples[1];
  const description = problem ? plainText(problem.statement) : '';
  const promptSummary = asSentence(description.split(/(?<=[.!?])\s+/).slice(0, 2).join(' '), 260);
  const constraints = problem?.constraints.slice(0, 3) ?? [];
  const steps = (captions: string[]) => captions.map(caption => ({ caption, actions: [] }));
  return {
    structure: 'array',
    scenes: [
      { id: 'setup', title: 'Setup', steps: steps([
        `We are looking at “${problem?.title ?? 'this problem'}.” The colored diagram is a picture of the sample input${example?.input ? ` (${example.input})` : ''}.`,
        'The small labels under the values are just visual guides. They help you track what is in the example; they do not show a solution method.'
      ]) },
      { id: 'rules', title: 'What the prompt asks', steps: steps([
        promptSummary ? `In plain language, the prompt says: ${promptSummary}` : 'Read the description as the source of truth for what the input means and what result is required.',
        'Separate two questions as you read: what information are you given, and what must the output describe? The rules in the statement define the connection.'
      ]) },
      { id: 'example', title: 'Example run', steps: steps([
        example?.input ? `Example 1 starts with this input: ${example.input}. Find the same values in the picture above.` : 'Start with the first example shown in the problem statement and locate its input in the picture above.',
        example?.explanation ? `The problem’s explanation says: ${asSentence(example.explanation, 220)}` : 'Read the example from left to right: the input is the case being described, and the output is the result the statement expects for that case.',
        example?.output ? `For this exact input, the expected output is ${example.output}. This is the example’s result; it is not a sequence of steps for computing it.` : 'Compare the displayed result with the output shown in the problem statement.'
      ]) },
      { id: 'output', title: 'Output', steps: steps([
        `The example output is ${example?.output || 'shown in the statement'}. Pay attention to its shape: a number, string, list, or another structure can each communicate a different kind of result.`,
        'The output format is part of the problem. Check both what the result means and how the statement asks you to return it.'
      ]) },
      { id: 'edges', title: 'Compare examples', steps: steps([
        secondExample ? `Example 2 changes the input to ${secondExample.input} and expects ${secondExample.output}. Compare it with Example 1 to see how a different case is represented.` : 'Only one example was available to scan. Think about how the same rule should read for a smallest valid input and for repeated or boundary values, when the constraints allow them.',
        secondExample?.explanation ? `The statement explains this case as: ${asSentence(secondExample.explanation, 200)}` : 'Examples illustrate the rules; the constraints tell you which other cases are still valid.'
      ]) },
      { id: 'scale', title: 'Constraints', steps: steps([
        constraints[0] ? `The first stated limit is: ${constraints[0]}. It tells you which values or sizes are allowed in the input.` : 'The constraints section defines which input values and sizes are valid.',
        constraints[1] ? `Also note: ${constraints[1]}. Taken together, these limits describe the range of cases the prompt covers.` : 'Look for both lower and upper bounds. They describe the smallest and largest cases covered by the prompt.',
        constraints[2] ? `One more boundary to keep in view: ${constraints[2]}. These limits help you understand the scale of the examples and valid inputs.` : 'The visualization stays focused on the small sample; the stated limits describe larger valid inputs.'
      ]) }
    ]
  };
};

const asArray = (input: string): unknown[] => {
  try { const parsed: unknown = JSON.parse(input); return Array.isArray(parsed) ? parsed : [parsed]; }
  catch {
    const start = input.indexOf('[');
    if (start >= 0) {
      let depth = 0, quote = '', escaped = false;
      for (let i = start; i < input.length; i++) {
        const char = input[i];
        if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = ''; continue; }
        if (char === '"' || char === "'") quote = char;
        else if (char === '[') depth++;
        else if (char === ']' && --depth === 0) {
          const candidate = input.slice(start, i + 1).replace(/'/g, '"');
          try { const parsed: unknown = JSON.parse(candidate); if (Array.isArray(parsed)) return parsed; } catch { /* A malformed sample falls through to the scalar parser. */ }
          break;
        }
      }
    }
    const string = input.match(/(?:^|[,\s])\w+\s*=\s*"([^"]*)"/);
    if (string) return [string[1]];
    const number = input.match(/(?:^|[,\s])\w+\s*=\s*(-?\d+(?:\.\d+)?)/);
    return number ? [Number(number[1])] : input.split(/[\s,]+/).filter(Boolean);
  }
};

const fallbackHint = (problem: Problem, level: number) => ({
  level,
  title: ['Clarify the goal', 'Pattern category', 'Key observation', 'Plan & complexity', 'Pseudocode'][level - 1],
  text: level === 1 ? 'Restate the required input/output relationship in your own words.'
    : level === 2 ? `Review the prompt tags for possible context: ${problem.tags.join(', ') || 'no tags were available'}.`
      : level === 3 ? 'Which constraint or rule most limits the valid answers?'
        : level === 4 ? 'Before coding, describe a plan in words and estimate its time and space needs.'
          : 'Write pseudocode only after you have settled on your own approach.',
  why: 'This hint refers to the prompt and constraints without supplying a full solution.'
});

export function App() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'visualize' | 'hints'>('visualize');
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hintLevel, setHintLevel] = useState(0);
  const [hints, setHints] = useState<{ level: number; title: string; text: string; why: string }[]>([]);
  const [hintLoading, setHintLoading] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [storyboard, setStoryboard] = useState(buildFallbackStoryboard());
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLoading, setVideoLoading] = useState(false);
  const values = useMemo(() => problem?.examples[0]?.input ? asArray(problem.examples[0].input) : [], [problem]);
  const frames = useMemo(() => buildFrames(values, storyboard), [values, storyboard]);
  const frame = frames.frames[Math.min(frameIndex, frames.frames.length - 1)];
  const sceneIndex = frames.sceneStarts.findIndex((start, i) => frameIndex >= start && (i === frames.sceneStarts.length - 1 || frameIndex < frames.sceneStarts[i + 1]));

  async function load() {
    setLoading(true); setError('');
    try {
      const nextProblem = await scanProblem();
      setProblem(nextProblem); setStoryboard(buildFallbackStoryboard(nextProblem));
      setVideoUrl('');
      setFrameIndex(0); setHints([]); setHintLevel(0); setOpen(true);
      void loadStoryboard(nextProblem, false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not scan this page.'); }
    finally { setLoading(false); }
  }

  async function request(path: string, body: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const runtime = typeof chrome !== 'undefined' ? chrome.runtime : undefined;
      const reconnectMessage = 'The extension connection is unavailable. Reload it at chrome://extensions, then refresh this LeetCode tab.';
      if (!runtime?.sendMessage) { reject(new Error(reconnectMessage)); return; }
      try {
        runtime.sendMessage({ type: 'API', path, body }, response => {
          let runtimeError: chrome.runtime.LastError | undefined;
          try { runtimeError = runtime.lastError; } catch { reject(new Error(reconnectMessage)); return; }
          if (runtimeError) {
            reject(new Error(runtimeError.message?.includes('context invalidated') || runtimeError.message?.includes('Receiving end does not exist')
              ? reconnectMessage
              : runtimeError.message));
            return;
          }
          if (response?.error) { reject(new Error(response.error)); return; }
          resolve(response);
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        reject(new Error(message.includes('context invalidated') || message.includes("reading 'sendMessage'")
          ? reconnectMessage
          : message || 'Could not contact the extension background service.'));
      }
    });
  }

  async function loadStoryboard(targetProblem: Problem, showError: boolean) {
    try {
      const result = await request('/api/storyboard', { problem: targetProblem });
      if (!result?.storyboard) throw new Error(result?.error || 'The storyboard service is unavailable.');
      const checked = StoryboardSchema.parse(result.storyboard);
      buildFrames(asArray(targetProblem.examples[0]?.input ?? ''), checked);
      if (location.pathname.includes(`/problems/${targetProblem.slug}`)) { setStoryboard(checked); setFrameIndex(0); }
    } catch {
      if (showError) setError('Could not generate a walkthrough. The built-in explanation is still available.');
    }
  }

  async function refreshStoryboard() {
    if (problem) await loadStoryboard(problem, true);
  }

  async function renderVideo() {
    if (!problem) return;
    setVideoLoading(true); setError(''); setVideoUrl('');
    try {
      const result = await request('/api/video', { problem });
      if (!result?.videoUrl) throw new Error(result?.error || 'Could not render the walkthrough video.');
      setVideoUrl(`http://localhost:8787${result.videoUrl}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not render the walkthrough video.'); }
    finally { setVideoLoading(false); }
  }

  async function revealHint(level: number) {
    if (level === 5 && !confirm) { setConfirm(true); return; }
    setConfirm(false);
    if (!problem) return;
    const collected = [...hints];
    setHintLoading(level);
    try {
      for (let n = 1; n <= level; n++) {
        if (collected.some(hint => hint.level === n)) continue;
        const result = await request('/api/hints', { problem, level: n });
        collected.push(result?.hint ? { ...result.hint, level: n } : fallbackHint(problem, n));
      }
      setHints(collected.sort((a, b) => a.level - b.level));
      setHintLevel(level);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this hint.');
    } finally { setHintLoading(null); }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'v') setOpen(value => !value);
      if (e.altKey && e.key.toLowerCase() === 'h') { setOpen(true); setTab('hints'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setFrameIndex(i => {
      if (i >= frames.frames.length - 1) { setPlaying(false); return i; }
      return i + 1;
    }), 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, frames.frames.length]);

  useEffect(() => {
    let previous = location.href;
    const timer = window.setInterval(() => {
      if (location.href !== previous) { previous = location.href; void load(); }
    }, 800);
    return () => window.clearInterval(timer);
  }, []);

  const visibleHints = hints.filter(hint => hint.level <= hintLevel);
  return <>
    <button className="launcher" onClick={() => { setOpen(value => !value); if (!problem) void load(); }} aria-label="Open LeetCode Visualizer"><Sparkles size={18} /></button>
    <AnimatePresence>
      {open && <motion.aside className="panel" initial={reduced ? false : { x: 360, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={reduced ? undefined : { x: 360, opacity: 0 }}>
        <header>
          <div className="brand"><span className="brand-icon"><Sparkles size={16} /></span><div><strong>Visualize & understand</strong><small>LEETCODE COMPANION</small></div></div>
          <button className="icon-btn" onClick={() => setOpen(false)}><X size={18} /></button>
        </header>
        {error && <div className="error">{error}</div>}
        {loading ? <div className="loading"><span /> Reading the active problem…</div> : problem ? <>
          <div className="problem-head"><span className={`difficulty ${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span><h2>{problem.title}</h2><p>{problem.tags.slice(0, 3).join(' · ') || 'Problem walkthrough'}</p></div>
          <nav className="tabs">
            <button className={tab === 'visualize' ? 'active' : ''} onClick={() => setTab('visualize')}><BookOpen size={15} /> Visualizer</button>
            <button className={tab === 'hints' ? 'active' : ''} onClick={() => setTab('hints')}><Lightbulb size={15} /> Hints</button>
          </nav>
          {tab === 'visualize' ? <>
            <div className="stage">
              <div className="stage-top"><span className="eyebrow">{storyboard.scenes[sceneIndex]?.title ?? 'WALKTHROUGH'}</span><span className="counter">{frameIndex}/{frames.frames.length - 1}</span></div>
              <ProblemVisual problem={problem} scene={Math.max(sceneIndex, 0)} progress={frameIndex + 1} pointerIndex={Object.values(frame?.pointers ?? {})[0]} markedIndices={Object.keys(frame?.marks ?? {}).map(Number)} values={frame?.values ?? values} reduced={reduced ?? false} />
              <div className="explanation"><span>{['LOOK AT THE INPUT', 'IN PLAIN LANGUAGE', 'FOLLOW THE EXAMPLE', 'UNDERSTAND THE RESULT', 'COMPARE THE CASES', 'WHAT THE LIMITS MEAN'][sceneIndex] ?? 'PLAIN-LANGUAGE GUIDE'}</span><p className="caption">{frame?.caption || 'A visual guide to the problem statement, examples, and constraints.'}</p></div>
              <div className="scrubber"><input aria-label="Storyboard position" type="range" min="0" max={frames.frames.length - 1} value={frameIndex} onChange={e => setFrameIndex(Number(e.target.value))} /><div className="scene-dots">{frames.sceneStarts.map((start, i) => <button aria-label={storyboard.scenes[i]?.title} key={start} onClick={() => setFrameIndex(start)} className={frameIndex >= start ? 'passed' : ''} />)}</div></div>
              <div className="controls">
                <button onClick={() => setFrameIndex(Math.max(0, frameIndex - 1))} aria-label="Previous step"><ArrowLeft size={17} /></button>
                <button className="play" onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
                <button onClick={() => setFrameIndex(Math.min(frames.frames.length - 1, frameIndex + 1))} aria-label="Next step"><ArrowRight size={17} /></button>
                <button className="reset" onClick={() => { setFrameIndex(0); setPlaying(false); }}><RotateCcw size={14} /> Replay</button>
                <select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option></select>
              </div>
            </div>
            <button className="secondary full" onClick={() => void refreshStoryboard()}>Refresh walkthrough</button>
            <button className="primary full render-video" onClick={() => void renderVideo()} disabled={videoLoading}>{videoLoading ? 'Rendering Manim video… this can take a minute' : 'Render pictorial MP4'}</button>
            {videoUrl && <div className="rendered-video"><div className="eyebrow">MANIM WALKTHROUGH</div><video controls autoPlay playsInline src={videoUrl}>Your browser does not support MP4 playback.</video></div>}
            <details className="statement"><summary>Problem statement <ChevronDown size={14} /></summary><p>{problem.statement.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1800)}</p>{problem.constraints.length > 0 && <ul>{problem.constraints.slice(0, 6).map((constraint, i) => <li key={i}>{constraint}</li>)}</ul>}</details>
          </> : <div className="hint-content">
            <div className="hint-intro"><span className="lightbulb"><Lightbulb size={17} /></span><div><h3>Hints, one step at a time</h3><p>Reveal only as much guidance as you need.</p></div></div>
            <div className="ladder">{[1, 2, 3, 4, 5].map(level => <button key={level} disabled={hintLoading !== null} className={`level ${hintLevel === level ? 'selected' : ''} ${level > hintLevel ? 'locked' : ''}`} onClick={() => void revealHint(level)}><span>{hintLoading === level ? <i className="hint-spinner"/> : level}</span><b>{['Clarify the goal', 'Pattern category', 'Key observation', 'Plan & complexity', 'Pseudocode'][level - 1]}</b>{level <= hintLevel ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>)}</div>
            {confirm && <div className="confirm"><p>Level 5 reveals pseudocode. Continue?</p><button className="secondary" onClick={() => setConfirm(false)}>Keep hidden</button><button className="primary" onClick={() => void revealHint(5)}>Reveal</button></div>}
            {visibleHints.map(hint => <motion.article key={hint.level} className="hint-card" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><span>HINT {hint.level}</span><h3>{hint.title}</h3><p>{hint.text}</p><details><summary>Why this hint?</summary><p>{hint.why}</p></details></motion.article>)}
            <p className="privacy">Hints describe the reasoning path; the full solution stays hidden.</p>
          </div>}
        </> : <div className="empty"><div className="empty-icon"><Sparkles /></div><h2>Open a problem to begin</h2><p>Read the prompt, walk through examples, or ask for a progressive hint.</p><button className="primary" onClick={() => void load()}>Scan this problem</button></div>}
        <footer><span>Built for learning</span><button onClick={() => void load()}><RotateCcw size={13} /> Rescan</button></footer>
      </motion.aside>}
    </AnimatePresence>
  </>;
}

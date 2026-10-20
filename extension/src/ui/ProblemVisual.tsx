import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowRight, Atom, Boxes, Grid2X2, Network, Sparkles, TreeDeciduous } from 'lucide-react';
import type { Problem } from '../shared/schema';

const colors = ['#6567f5', '#0caeaf', '#f59d39', '#ec6d9d', '#4b9eea', '#9b70dc', '#50b889', '#e56f52'];
const label = (value: unknown) => value === null ? '∅' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const isNumberMatrix = (value: unknown[]): value is number[][] => value.length > 0 && value.every(row => Array.isArray(row) && row.every(cell => typeof cell === 'number'));

function CursorPointer({ x, y, reduced }: { x: number; y: number; reduced: boolean }) {
  return <motion.g initial={false} animate={{ x, y }} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 22 }}>
    <circle cx="0" cy="0" r="12" fill="#5148d5" opacity=".16"/>
    <path d="M-5 -9 L-5 5 L-1 1 L3 9 L6 7 L2 0 L8 0 Z" fill="#fff" stroke="#5148d5" strokeWidth="1.7" strokeLinejoin="round"/>
  </motion.g>;
}

function Tiles({ values, scene, progress, pointerIndex, markedIndices, reduced }: { values: unknown[]; scene: number; progress: number; pointerIndex?: number; markedIndices: number[]; reduced: boolean }) {
  const visible = values.slice(0, 10);
  const tile = (i: number) => {
    const w = visible.length > 7 ? 52 : 60, gap = visible.length > 7 ? 7 : 10;
    const rowLength = Math.min(visible.length, 5), row = Math.floor(i / 5), col = i % 5;
    const rowWidth = rowLength * w + (rowLength - 1) * gap, x0 = (340 - rowWidth) / 2;
    const x = x0 + col * (w + gap), y = visible.length > 5 ? 53 + row * 59 : 76;
    return { x, y, w, cx: x + w / 2, cy: y + 21 };
  };
  const revealed = Math.min(visible.length, progress);
  const visited = markedIndices.length ? markedIndices.filter(index => index < visible.length) : Array.from({ length: revealed }, (_, i) => i);
  const activeIndex = pointerIndex !== undefined && pointerIndex < visible.length ? pointerIndex : visited.at(-1);
  const pointer = activeIndex !== undefined ? tile(activeIndex) : null;
  return <svg className="visual-svg" viewBox="0 0 340 184" role="img" aria-label="Illustrated example input">
    <defs><linearGradient id="tileWash" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#eef3ff"/><stop offset="1" stopColor="#fdf0f5"/></linearGradient><filter id="tileShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#53669a" floodOpacity=".16"/></filter></defs>
    <rect x="1" y="1" width="338" height="182" rx="22" fill="url(#tileWash)"/>
    <circle cx="306" cy="32" r="35" fill="#fff" opacity=".45"/><circle cx="28" cy="155" r="42" fill="#fff" opacity=".45"/>
    <g opacity=".65"><path d="M22 47h42M43 27v40M276 144h40M296 124v40" stroke="#b9cafa" strokeWidth="2" strokeLinecap="round"/><circle cx="306" cy="52" r="3" fill="#eb8db2"/><circle cx="42" cy="112" r="3" fill="#efa74e"/></g>
    {visited.slice(1).map((index, i) => {
      const from = tile(visited[i]), to = tile(index);
      return <motion.path key={`trail-${index}-${i}`} d={`M${from.cx} ${from.cy} L${to.cx} ${to.cy}`} fill="none" stroke={colors[index % colors.length]} strokeWidth="3" strokeLinecap="round" strokeDasharray="5 5" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: .72 }} transition={{ duration: reduced ? 0 : .32, delay: reduced ? 0 : .06 }}/>;
    })}
    {visible.map((value, i) => {
      const { x, y, w } = tile(i), marked = visited.includes(i);
      const pop = scene === 0 || scene === 2;
      return <motion.g key={`${i}-${label(value)}`} initial={reduced ? false : { opacity: 0, y: 12, scale: .88 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: reduced ? 0 : i * .055, type: 'spring', stiffness: 270, damping: 20 }}>
        {pop && scene === 2 && <motion.circle cx={x + w / 2} cy={y + 21} r="28" fill={colors[i % colors.length]} opacity=".13" animate={reduced ? {} : { scale: [1, 1.45, 1], opacity: [.12, .24, .12] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * .14 }} />}
        <motion.rect x={x} y={y} width={w} height="43" rx="14" fill="#fff" filter="url(#tileShadow)" animate={{ stroke: marked ? colors[i % colors.length] : 'transparent', strokeWidth: marked ? 2 : 0 }} transition={{ duration: reduced ? 0 : .2 }}/>
        <rect x={x + 1} y={y + 1} width="5" height="41" rx="3" fill={colors[i % colors.length]}/>
        <text x={x + w / 2 + 2} y={y + 26} textAnchor="middle" fill="#263856" fontSize={label(value).length > 7 ? '9' : '13'} fontWeight="750">{label(value).slice(0, 10)}</text>
        <text x={x + w / 2} y={y + 56} textAnchor="middle" fill="#8392ae" fontSize="9" fontWeight="700">{i}</text>
        <motion.g initial={false} animate={{ scale: marked ? 1 : 0, opacity: marked ? 1 : 0 }} transition={{ type: 'spring', stiffness: 340, damping: 18 }}><circle cx={x + w - 2} cy={y + 2} r="8" fill="#fff"/><circle cx={x + w - 2} cy={y + 2} r="6" fill={colors[i % colors.length]}/><text x={x + w - 2} y={y + 5} textAnchor="middle" fill="#fff" fontSize="7" fontWeight="900">{i + 1}</text></motion.g>
      </motion.g>;
    })}
    {pointer && <CursorPointer x={pointer.cx + 11} y={pointer.y - 5} reduced={reduced}/>}
    <g><rect x="118" y="15" width="104" height="23" rx="11" fill="#fff" opacity=".86"/><text x="170" y="30" textAnchor="middle" fill="#7686a1" fontSize="9" fontWeight="800" letterSpacing="1.2">EXAMPLE INPUT</text></g>
  </svg>;
}

function Matrix({ rows, progress, reduced }: { rows: number[][]; progress: number; reduced: boolean }) {
  const flat = rows.flat().slice(0, 30), columns = Math.max(1, Math.min(6, Math.max(...rows.map(row => row.length))));
  const cell = 37, gap = 6, width = columns * (cell + gap) - gap, x0 = (340 - width) / 2;
  const point = (i: number) => ({ x: x0 + (i % columns) * (cell + gap) + cell / 2, y: 40 + Math.floor(i / columns) * (cell + gap) + cell / 2 });
  const revealed = Math.min(flat.length, progress), active = revealed ? point(revealed - 1) : null;
  return <svg className="visual-svg" viewBox="0 0 340 184" role="img" aria-label="Colorful matrix input">
    <defs><linearGradient id="gridWash" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#e8f4ff"/><stop offset="1" stopColor="#f2eaff"/></linearGradient></defs><rect x="1" y="1" width="338" height="182" rx="22" fill="url(#gridWash)"/>
    <text x="170" y="25" textAnchor="middle" fill="#7385a3" fontSize="9" fontWeight="800" letterSpacing="1">ROWS × COLUMNS</text>
    {Array.from({ length: Math.max(0, revealed - 1) }, (_, i) => { const a = point(i), b = point(i + 1); return <motion.path key={i} d={`M${a.x} ${a.y} L${b.x} ${b.y}`} fill="none" stroke="#655fe4" strokeWidth="2.5" strokeDasharray="4 4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .28 }}/>; })}
    {flat.map((value, i) => { const row = Math.floor(i / columns), col = i % columns, x = x0 + col * (cell + gap), y = 40 + row * (cell + gap), color = colors[(row * 3 + col) % colors.length]; return <motion.g key={i} initial={reduced ? false : { opacity: 0, scale: .65 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: reduced ? 0 : i * .035, type: 'spring' }}><motion.rect x={x} y={y} width={cell} height={cell} rx="11" fill={color} animate={{ opacity: i < revealed ? .25 : .15 }} transition={{ duration: reduced ? 0 : .2 }}/><rect x={x + 2} y={y + 2} width={cell - 4} height={cell - 4} rx="9" fill="#fff"/><circle cx={x + 9} cy={y + 9} r="3" fill={color}/><text x={x + cell / 2} y={y + 25} textAnchor="middle" fill="#344561" fontSize="12" fontWeight="800">{label(value)}</text>{i < revealed && <motion.circle cx={x + cell - 4} cy={y + 4} r="5" fill={color} initial={reduced ? false : { scale: 0 }} animate={{ scale: 1 }} />}</motion.g>; })}
    {active && <CursorPointer x={active.x + 10} y={active.y - 10} reduced={reduced}/>}
  </svg>;
}

function Tree({ values, progress, reduced }: { values: unknown[]; progress: number; reduced: boolean }) {
  const nodes = values.slice(0, 7).map((value, index) => ({ value, index })).filter(node => node.value !== null);
  const positions = nodes.map(({ index }) => {
    const level = Math.floor(Math.log2(index + 1)), slot = index - (2 ** level - 1), leaves = 2 ** level;
    return { x: ((slot + 1) * 340) / (leaves + 1), y: 43 + level * 54 };
  });
  return <svg className="visual-svg" viewBox="0 0 340 184" role="img" aria-label="Illustrated tree shaped input">
    <defs><linearGradient id="treeWash" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#e9f8f0"/><stop offset="1" stopColor="#fff1e4"/></linearGradient></defs><rect x="1" y="1" width="338" height="182" rx="22" fill="url(#treeWash)"/>
    {nodes.map(({ index }, n) => { const parent = Math.floor((index - 1) / 2), p = positions[n], pp = positions[nodes.findIndex(node => node.index === parent)], active = index < progress; return index > 0 && pp ? <motion.path key={`edge-${index}`} d={`M${pp.x} ${pp.y + 15} Q${(pp.x + p.x) / 2} ${(pp.y + p.y) / 2 - 2} ${p.x} ${p.y - 15}`} fill="none" stroke={active ? colors[n % colors.length] : '#9cb8ac'} strokeWidth={active ? 4 : 2.5} strokeLinecap="round" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: active ? 1 : .55, opacity: active ? .9 : .38 }} transition={{ duration: reduced ? 0 : .32, delay: reduced ? 0 : n * .04 }} /> : null; })}
    {nodes.map(({ value, index }, n) => { const p = positions[n], c = colors[n % colors.length], visited = index < progress; return <motion.g key={index} initial={reduced ? false : { scale: .45, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: reduced ? 0 : n * .1, type: 'spring' }}><motion.circle cx={p.x} cy={p.y} r="21" fill={c} animate={{ opacity: visited ? .32 : .16, scale: visited ? 1 : .85 }} transition={{ duration: reduced ? 0 : .22 }}/><circle cx={p.x} cy={p.y} r="15" fill={c}/><text x={p.x} y={p.y + 4} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">{label(value).slice(0, 4)}</text>{visited && <motion.circle cx={p.x + 14} cy={p.y - 13} r="5" fill="#fff" stroke={c} strokeWidth="2" initial={reduced ? false : { scale: 0 }} animate={{ scale: 1 }}/>}</motion.g>; })}
    {nodes[Math.min(progress - 1, nodes.length - 1)] && <CursorPointer x={positions[Math.min(progress - 1, nodes.length - 1)].x + 11} y={positions[Math.min(progress - 1, nodes.length - 1)].y - 13} reduced={reduced}/>}
    <rect x="116" y="12" width="108" height="22" rx="11" fill="#fff" opacity=".8"/><text x="170" y="27" textAnchor="middle" fill="#738a7d" fontSize="9" fontWeight="800" letterSpacing="1">TREE EXAMPLE</text>
  </svg>;
}

function EdgeGraph({ edges, progress, reduced }: { edges: unknown[][]; progress: number; reduced: boolean }) {
  const nums = [...new Set(edges.flat().filter((n): n is number => typeof n === 'number'))].slice(0, 8);
  const points = nums.map((_, i) => ({ x: 170 + Math.cos((i / Math.max(nums.length, 1)) * Math.PI * 2 - Math.PI / 2) * 65, y: 99 + Math.sin((i / Math.max(nums.length, 1)) * Math.PI * 2 - Math.PI / 2) * 58 }));
  return <svg className="visual-svg" viewBox="0 0 340 184" role="img" aria-label="Graph example with its listed edges">
    <defs><linearGradient id="graphWash" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#eff0ff"/><stop offset="1" stopColor="#ffeaf2"/></linearGradient></defs><rect x="1" y="1" width="338" height="182" rx="22" fill="url(#graphWash)"/>
    {edges.slice(0, 12).map((edge, i) => { const a = nums.indexOf(edge[0] as number), b = nums.indexOf(edge[1] as number), shown = i < progress; if (a < 0 || b < 0) return null; return <motion.line key={i} x1={points[a].x} y1={points[a].y} x2={points[b].x} y2={points[b].y} stroke={colors[i % colors.length]} strokeOpacity={shown ? .78 : .2} strokeWidth={shown ? 4 : 2} strokeLinecap="round" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: shown ? 1 : .28 }} transition={{ delay: reduced ? 0 : i * .05, duration: reduced ? 0 : .3 }} />; })}
    {nums.map((n, i) => <motion.g key={n} initial={reduced ? false : { scale: .5 }} animate={{ scale: 1 }} transition={{ delay: i * .09, type: 'spring' }}><circle cx={points[i].x} cy={points[i].y} r="18" fill={colors[i % colors.length]} opacity=".18"/><circle cx={points[i].x} cy={points[i].y} r="13" fill={colors[i % colors.length]}/><text x={points[i].x} y={points[i].y + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">{n}</text></motion.g>)}
    {nums[Math.min(progress, nums.length) - 1] !== undefined && <CursorPointer x={points[Math.min(progress, nums.length) - 1].x + 10} y={points[Math.min(progress, nums.length) - 1].y - 12} reduced={reduced}/>}
    <rect x="118" y="12" width="104" height="22" rx="11" fill="#fff" opacity=".8"/><text x="170" y="27" textAnchor="middle" fill="#77769c" fontSize="9" fontWeight="800" letterSpacing="1">EDGE LIST INPUT</text>
  </svg>;
}

export function ProblemVisual({ problem, scene, progress, pointerIndex, markedIndices, values, reduced }: { problem: Problem; scene: number; progress: number; pointerIndex?: number; markedIndices: number[]; values: unknown[]; reduced: boolean }) {
  const words = `${problem.title} ${problem.tags.join(' ')} ${problem.statement}`.toLowerCase();
  const edges = values.filter(Array.isArray) as unknown[][];
  const graphLike = /graph|vertices|edges/.test(words) && edges.length > 0 && edges.every(edge => edge.length === 2 && edge.every(item => typeof item === 'number'));
  const matrix = isNumberMatrix(values) && !graphLike;
  const treeLike = /binary tree|tree node|invert tree/.test(words) && values.some(value => value === null || typeof value === 'number');
  const stringLike = !treeLike && !matrix && /string|character|substring|palindrome/.test(words) && values.length === 1 && typeof values[0] === 'string';
  const items = stringLike ? [...String(values[0])] : values;
  const currentExample = problem.examples[0];
  const pointCount = matrix ? Math.min(30, (values as number[][]).flat().length) : graphLike ? Math.min(8, new Set(edges.flat().filter((n): n is number => typeof n === 'number')).size) : treeLike ? Math.min(7, items.filter(value => value !== null).length) : Math.min(10, items.length);
  const markedCount = Math.min(pointCount, markedIndices.length || progress);
  const Icon = matrix ? Grid2X2 : graphLike ? Network : treeLike ? TreeDeciduous : stringLike ? Atom : Boxes;
  const sceneLabel = ['SHAPE THE INPUT', 'READ THE RULES', 'WALK THE EXAMPLE', 'SEE THE OUTPUT', 'COMPARE CASES', 'INPUT SCALE'][scene] ?? 'EXAMPLE';
  const typeLabel = matrix ? 'GRID' : graphLike ? 'GRAPH' : treeLike ? 'TREE' : stringLike ? 'STRING' : 'VALUES';
  return <AnimatePresence mode="wait" initial={false}>
    <motion.section key={`${problem.slug}-${scene}`} className={`illustration illustration-scene-${scene}`} initial={reduced ? false : { opacity: 0, y: 12, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduced ? undefined : { opacity: 0, y: -8, scale: .99 }} transition={{ duration: reduced ? 0 : .24, ease: 'easeOut' }}>
    <div className="illustration-head"><span className="illustration-icon"><Icon size={15}/></span><div><span>{sceneLabel}</span><b>{problem.title}</b></div><Sparkles className="illustration-sparkle" size={17}/></div>
    <motion.div className="drawing" layout transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
      {graphLike ? <EdgeGraph edges={edges} progress={progress} reduced={reduced}/> : treeLike ? <Tree values={items} progress={progress} reduced={reduced}/> : matrix ? <Matrix rows={values as number[][]} progress={progress} reduced={reduced}/> : <Tiles values={items} scene={scene} progress={progress} pointerIndex={pointerIndex} markedIndices={markedIndices} reduced={reduced}/>} 
    </motion.div>
    <div className="trail-legend"><span className="trail-pointer">➤</span><span>Each click marks the next input point.</span><span className="trail-count">{markedCount} / {pointCount}</span></div>
    {scene === 1 && <div className="visual-callouts"><span><i className="callout-dot dot-purple"/> Read the input</span><ArrowRight size={14}/><span><i className="callout-dot dot-teal"/> Apply the stated rule</span><ArrowRight size={14}/><span><i className="callout-dot dot-orange"/> Match the output</span></div>}
    {scene === 3 && <motion.div className="visual-output" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><span>EXPECTED OUTPUT</span><ArrowDown size={15}/><b>{currentExample?.output || 'See the example in the prompt'}</b></motion.div>}
    {scene === 4 && <div className="case-strip">{problem.examples.slice(0, 3).map((example, i) => <motion.div key={i} className={`case-chip case-${i}`} initial={reduced ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : i * .1 }}><span>EXAMPLE {i + 1}</span><b>{example.input.slice(0, 22)}</b><ArrowRight size={12}/><b>{example.output.slice(0, 18)}</b></motion.div>)}{problem.examples.length === 0 && <div className="case-chip"><span>THINK ABOUT</span><b>small · repeated · empty inputs</b></div>}</div>}
    {scene === 5 && <div className="scale-visual"><div className="scale-top"><span>VALID INPUT SIZE</span><b>{problem.constraints[0]?.slice(0, 56) || 'Limited by the constraints in the prompt'}</b></div><div className="scale-track"><motion.div className="scale-fill" initial={reduced ? false : { width: '8%' }} animate={{ width: '88%' }} transition={{ duration: reduced ? 0 : .65 }}/></div><div className="scale-labels"><span>SMALL</span><span>GROWING</span><span>MAXIMUM</span></div></div>}
    {scene === 0 && <div className="visual-footer"><span className="footer-pip"/> One problem · one concrete example <span className="footer-count">{items.length} {typeLabel.toLowerCase()}</span></div>}
    {scene === 2 && <div className="example-ribbon"><span className="ribbon-badge">EXAMPLE 1</span><span>{currentExample?.explanation || 'Watch how the example is described in the prompt.'}</span></div>}
    </motion.section>
  </AnimatePresence>;
}

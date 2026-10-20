import { z } from 'zod';

export const ExampleSchema = z.object({ input: z.string(), output: z.string(), explanation: z.string().optional() });
export const ProblemSchema = z.object({ slug: z.string(), title: z.string(), difficulty: z.string(), statement: z.string(), examples: z.array(ExampleSchema), constraints: z.array(z.string()), tags: z.array(z.string()) });
export type Problem = z.infer<typeof ProblemSchema>;
export const RefSchema = z.object({ i: z.number().int().nonnegative().optional(), r: z.number().int().nonnegative().optional(), c: z.number().int().nonnegative().optional(), id: z.string().optional() });
const ActionSchema = z.discriminatedUnion('op', [
  z.object({op:z.literal('highlight'),targets:z.array(RefSchema),color:z.enum(['blue','green','amber','red'])}),
  z.object({op:z.literal('pointer'),name:z.string(),at:RefSchema}), z.object({op:z.literal('swap'),a:RefSchema,b:RefSchema}),
  z.object({op:z.literal('set'),at:RefSchema,value:z.unknown()}), z.object({op:z.literal('mark'),targets:z.array(RefSchema),style:z.enum(['visited','blocked','selected','result'])}),
  z.object({op:z.literal('connect'),from:RefSchema,to:RefSchema,label:z.string().optional()}), z.object({op:z.literal('annotate'),at:RefSchema,text:z.string()}),
  z.object({op:z.literal('insert'),at:RefSchema,value:z.unknown().optional()}), z.object({op:z.literal('remove'),at:RefSchema,value:z.unknown().optional()}), z.object({op:z.literal('clear')})
]);
export const StoryboardSchema = z.object({ structure:z.enum(['array','matrix','tree','linkedList','graph','string','intervals']), scenes:z.array(z.object({id:z.string(),title:z.string(),steps:z.array(z.object({caption:z.string(),actions:z.array(ActionSchema),durationMs:z.number().int().positive().max(10000).optional()}))})).min(1) });
export type Storyboard = z.infer<typeof StoryboardSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Frame = { values: unknown[]; marks: Record<number,string>; pointers: Record<string,number>; annotations: Record<string,string>; caption: string };
export const AnalysisSchema = z.object({ summary:z.string(), inputs:z.array(z.string()), output:z.string(), dataStructure:z.string(), keyConstraints:z.array(z.string()) });
export const HintsSchema = z.object({ hints:z.array(z.object({level:z.number().int().min(1).max(5),title:z.string(),text:z.string(),why:z.string()})).length(5) });

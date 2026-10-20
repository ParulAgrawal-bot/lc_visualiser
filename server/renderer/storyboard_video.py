import asyncio
import json
import os
import textwrap
from pathlib import Path

from manim import (
    BLUE, GOLD, GREEN, MAROON, PURPLE, TEAL, WHITE, YELLOW,
    Arrow, Create, FadeIn, FadeOut, LaggedStart, Line, RoundedRectangle,
    Scene, Text, VGroup, Write, Transform, linear,
)


PALETTE = [PURPLE, TEAL, GOLD, BLUE, MAROON, GREEN, "#E879F9", "#F97316"]
SECTION_COLORS = ["#818CF8", "#F59E0B", "#14B8A6", "#60A5FA", "#F472B6", "#34D399"]
SECTION_NAMES = ["Understand the input", "Translate the rule", "Read the example", "Understand the output", "Compare the examples", "Read the limits"]


class LCWalkthrough(Scene):
    def construct(self):
        with open(os.environ["LC_STORYBOARD_PATH"], encoding="utf-8") as source:
            data = json.load(source)

        narration_dir = Path(os.environ["LC_NARRATION_DIR"])
        narration_dir.mkdir(parents=True, exist_ok=True)
        narration = asyncio.run(self.create_narration(data, narration_dir))

        problem_title = Text(data.get("title", "Problem walkthrough"), font_size=25, color=WHITE)
        problem_title.set_width(11.4).to_edge(__import__("manim").UP, buff=0.32)
        header_rule = Line([-5.7, 2.83, 0], [5.7, 2.83, 0], color="#334155", stroke_width=1.4)
        section = Text(SECTION_NAMES[0], font_size=17, color=SECTION_COLORS[0], weight="BOLD")
        section.move_to([0, 2.48, 0])
        track = RoundedRectangle(width=11.2, height=0.075, corner_radius=0.035, stroke_width=0, fill_color="#334155", fill_opacity=1).move_to([0, 2.15, 0])
        progress = RoundedRectangle(width=11.2 / max(1, len(data["storyboard"]["scenes"])), height=0.075, corner_radius=0.035, stroke_width=0, fill_color=SECTION_COLORS[0], fill_opacity=1)
        progress.align_to(track, __import__("manim").LEFT)
        self.play(Write(problem_title), Create(header_rule), FadeIn(section), FadeIn(track), FadeIn(progress), run_time=0.65)

        caption_box = RoundedRectangle(width=11.4, height=1.42, corner_radius=0.18, stroke_color="#334155", stroke_width=1, fill_color="#111B2D", fill_opacity=0.98)
        caption_box.move_to([0, -2.68, 0])
        caption_label = Text("WHY THIS MATTERS", font_size=10, color="#94A3B8", weight="BOLD")
        caption_label.move_to(caption_box.get_top() + __import__("manim").DOWN * 0.25)
        caption = self.make_paragraph("We will unpack the prompt in sections, then connect its wording to the supplied example.", 15, 78, 4).set_width(10.8)
        caption.move_to([0, -2.78, 0])
        speech_track = Line([-5.25, -3.29, 0], [5.25, -3.29, 0], color="#29364B", stroke_width=3)
        speech_progress = Line([-5.25, -3.29, 0], [-5.23, -3.29, 0], color="#22D3EE", stroke_width=3)
        self.play(FadeIn(caption_box), FadeIn(caption_label), FadeIn(caption), Create(speech_track), Create(speech_progress), run_time=0.35)

        scenes = data["storyboard"]["scenes"]
        examples = data.get("examples", [])
        constraints = data.get("constraints", [])
        visual = VGroup()
        narration_index = 0
        self.example_pointer_index = None
        for scene_index, scene in enumerate(scenes):
            color = SECTION_COLORS[scene_index % len(SECTION_COLORS)]
            section_name = SECTION_NAMES[scene_index] if scene_index < len(SECTION_NAMES) else scene.get("title", "Walkthrough")
            new_section = Text(section_name, font_size=17, color=color, weight="BOLD").move_to(section)
            new_progress = RoundedRectangle(
                width=11.2 * (scene_index + 1) / max(1, len(scenes)), height=0.075, corner_radius=0.035,
                stroke_width=0, fill_color=color, fill_opacity=1,
            ).align_to(track, __import__("manim").LEFT)
            self.play(Transform(section, new_section), Transform(progress, new_progress), run_time=0.3)

            new_visual = self.make_scene_visual(scene_index, scene, data, examples, constraints)
            if len(visual):
                self.play(FadeOut(visual, shift=__import__("manim").DOWN * 0.12), run_time=0.2)
            self.animate_scene_reveal(new_visual, scene_index)
            visual = new_visual

            for step_index, step in enumerate(scene["steps"]):
                caption_text = step["caption"].strip()
                new_caption = self.make_paragraph(caption_text, 15, 78, 4).set_width(10.8).move_to(caption)
                self.play(Transform(caption, new_caption), run_time=0.3)
                self.emphasize_step(visual, scene_index, step_index, color)
                clip = narration[narration_index] if narration_index < len(narration) else None
                narration_index += 1
                spoken_at = self.time
                if clip:
                    # Explicit time is essential: the default zero timestamp makes
                    # separate clips overlap at the start of the video.
                    self.add_sound(clip["path"], time_offset=spoken_at)
                if scene_index == 2:
                    self.animate_actions(step.get("actions", []), visual, data.get("values", []))
                if clip:
                    remaining = max(0.2, clip["duration"] - (self.time - spoken_at) + 0.25)
                    start = [-5.25, -3.29, 0]
                    self.play(speech_progress.animate.put_start_and_end_on(start, [5.25, -3.29, 0]), run_time=remaining, rate_func=linear)
                    self.play(speech_progress.animate.put_start_and_end_on(start, [-5.23, -3.29, 0]), run_time=0.08)
                else:
                    self.wait(0.6)

        ending = Text("The prompt defines the task. The example shows one case; the constraints define the rest.", font_size=20, color=YELLOW)
        ending.set_width(10.8).move_to([0, 0.35, 0])
        self.play(FadeOut(visual), FadeIn(ending, shift=__import__("manim").UP * 0.1), run_time=0.45)
        self.wait(1.2)

    def animate_scene_reveal(self, visual, scene_index):
        from manim import UP
        if scene_index in (0, 2) and len(visual):
            cells, label = visual[0], visual[1]
            self.play(LaggedStart(*(FadeIn(cell, shift=UP * 0.12) for cell in cells), lag_ratio=0.16), FadeIn(label), run_time=0.9)
        else:
            self.play(LaggedStart(*(FadeIn(item, shift=UP * 0.1) for item in visual), lag_ratio=0.22), run_time=0.8)

    def emphasize_step(self, visual, scene_index, step_index, color):
        if scene_index not in (1, 3, 5) or step_index >= len(visual):
            return
        for index, card in enumerate(visual):
            stroke = color if index == step_index else "#334155"
            opacity = 3 if index == step_index else 1
            self.play(card[0].animate.set_stroke(stroke, width=opacity), run_time=0.16)

    def make_scene_visual(self, scene_index, scene, data, examples, constraints):
        if scene_index in (0, 2):
            return self.make_array_visual(data.get("values", [])[:8], "SAMPLE INPUT" if scene_index == 0 else "EXAMPLE · READ VALUES IN ORDER")
        if scene_index == 1:
            steps = scene.get("steps", [])
            cards = []
            for i, step in enumerate(steps[:3]):
                cards.append(self.make_card(f"RULE {i + 1}", step["caption"], SECTION_COLORS[(i + 1) % len(SECTION_COLORS)], 9.6, 1.0))
            result = VGroup(*cards).arrange(__import__("manim").DOWN, buff=0.12).move_to([0, 0.35, 0])
            return result
        if scene_index == 3:
            cards = []
            for index, example in enumerate(examples[:3]):
                cards.append(self.make_card(f"EXPECTED OUTPUT · EXAMPLE {index + 1}", example.get("output", "Not supplied"), SECTION_COLORS[index % len(SECTION_COLORS)], 9.5, 1.08, input_text=example.get("input", "")))
            if not cards:
                cards.append(self.make_card("RETURN REQUIREMENT", scene["steps"][0]["caption"], SECTION_COLORS[3], 9.5, 1.0))
            return VGroup(*cards).arrange(__import__("manim").DOWN, buff=0.14).move_to([0, 0.35, 0])
        if scene_index == 4:
            if len(examples) > 1:
                cards = [self.make_card(f"EXAMPLE {index + 1}", f"Input: {example.get('input', '')}\nOutput: {example.get('output', '')}", SECTION_COLORS[index % len(SECTION_COLORS)], 4.65, 1.45) for index, example in enumerate(examples[:2])]
                return VGroup(*cards).arrange(__import__("manim").RIGHT, buff=0.22).move_to([0, 0.4, 0])
            text = "The prompt supplies one example." if len(examples) == 1 else "No examples were supplied in the scanned statement."
            return self.make_card("WHAT THE EXAMPLES COVER", text, SECTION_COLORS[4], 9.3, 1.1)
        if scene_index == 5:
            if constraints:
                cards = [self.make_card(f"LIMIT {index + 1}", value, SECTION_COLORS[index % len(SECTION_COLORS)], 9.5, 0.67) for index, value in enumerate(constraints[:4])]
                return VGroup(*cards).arrange(__import__("manim").DOWN, buff=0.1).move_to([0, 0.4, 0])
            return self.make_card("VALID INPUT RANGE", "The statement does not include readable constraints. Refer to the original prompt for the allowed range.", SECTION_COLORS[5], 9.5, 1.0)
        return self.make_card(scene.get("title", "Walkthrough"), scene["steps"][0]["caption"], SECTION_COLORS[scene_index % len(SECTION_COLORS)], 9.5, 1.0)

    def make_card(self, label, content, color, width, height, input_text=""):
        from manim import DOWN, UP
        card = RoundedRectangle(width=width, height=height, corner_radius=0.18, stroke_color=color, stroke_width=2, fill_color="#17243A", fill_opacity=0.96)
        top = card.get_top() + DOWN * 0.19
        heading = Text(str(label)[:52].upper(), font_size=10, color=color, weight="BOLD").move_to(top)
        body_text = str(content).replace("\n", " ").strip() or "Not supplied in the example."
        body = self.make_paragraph(body_text, 16, max(24, int(width * 7.2)), 3)
        body.move_to(card.get_center() + DOWN * (0.07 if not input_text else 0.03))
        group = VGroup(card, heading, body)
        if input_text:
            sample = self.make_paragraph(f"INPUT: {input_text}", 11, max(26, int(width * 8)), 2)
            sample.move_to(card.get_center() + DOWN * 0.31)
            body.move_to(card.get_center() + UP * 0.03)
            group.add(sample)
        group.set_z_index(1)
        return group

    def make_paragraph(self, text, font_size, line_width, max_lines):
        from manim import Paragraph
        normalized = " ".join(str(text).split())
        lines = textwrap.wrap(normalized, width=line_width, break_long_words=True, break_on_hyphens=False) or [""]
        if len(lines) > max_lines:
            lines = lines[:max_lines]
            lines[-1] = lines[-1].rstrip(" .,;:") + "…"
        return Paragraph(*lines, font_size=font_size, line_spacing=0.8, alignment="center", color="#E2E8F0")

    def make_array_visual(self, values, label):
        from manim import DOWN, UP
        values = values or ["sample input"]
        values = values[:8]
        width = min(1.25, 10.2 / max(1, len(values)))
        gap = 0.12
        total = len(values) * width + (len(values) - 1) * gap
        start_x = -total / 2 + width / 2
        items = []
        for index, value in enumerate(values):
            x = start_x + index * (width + gap)
            color = PALETTE[index % len(PALETTE)]
            box = RoundedRectangle(width=width, height=0.95, corner_radius=0.16, stroke_color=color, stroke_width=3, fill_color=color, fill_opacity=0.2).move_to([x, 0.35, 0])
            text = Text(str(value)[:10], font_size=22, color=WHITE).scale_to_fit_width(width - 0.12).move_to(box)
            index_label = Text(str(index), font_size=13, color="#94A3B8").next_to(box, DOWN, buff=0.12)
            items.append(VGroup(box, text, index_label))
        array = VGroup(*items)
        label_text = Text(label, font_size=11, color="#A5B4FC", weight="BOLD").next_to(array, UP, buff=0.42)
        return VGroup(array, label_text)

    def animate_actions(self, actions, visual, values):
        from manim import DOWN, UP
        cells = [member for member in visual[0]] if len(visual) else []
        for action in actions:
            op = action.get("op")
            if op == "pointer":
                index = action.get("at", {}).get("i", -1)
                if 0 <= index < len(cells):
                    pointer = Arrow(start=cells[index][0].get_top() + UP * 0.8, end=cells[index][0].get_top() + UP * 0.08, color=YELLOW, buff=0.05, stroke_width=5)
                    tag = Text(action.get("name", "reading pointer")[:16], font_size=12, color=YELLOW).next_to(pointer, UP, buff=0.04)
                    previous_index = self.example_pointer_index
                    if previous_index is not None and previous_index < len(cells) and previous_index != index:
                        trail = Line(cells[previous_index][0].get_center(), cells[index][0].get_center(), color=PALETTE[index % len(PALETTE)], stroke_width=3)
                        self.play(Create(trail), run_time=0.2)
                        visual.add(trail)
                    self.play(FadeIn(pointer), FadeIn(tag), cells[index][0].animate.set_fill(YELLOW, opacity=0.42), run_time=0.25)
                    self.wait(0.18)
                    self.play(FadeOut(pointer), FadeOut(tag), run_time=0.18)
                    self.example_pointer_index = index
            elif op == "highlight":
                refs = action.get("targets", [])
                for ref in refs:
                    index = ref.get("i", -1)
                    if 0 <= index < len(cells):
                        self.play(cells[index][0].animate.set_fill(YELLOW, opacity=0.42), run_time=0.2)
            elif op == "mark":
                refs = action.get("targets", [])
                style = action.get("style", "visited")
                color = {"visited": TEAL, "blocked": MAROON, "selected": GOLD, "result": GREEN}.get(style, TEAL)
                for ref in refs:
                    index = ref.get("i", -1)
                    if 0 <= index < len(cells):
                        self.play(cells[index][0].animate.set_fill(color, opacity=0.48), run_time=0.2)
            elif op == "annotate":
                annotation = Text(action.get("text", "")[:45], font_size=13, color=TEAL).move_to([0, -1.2, 0])
                self.play(FadeIn(annotation), run_time=0.2)
                self.wait(0.25)
                self.play(FadeOut(annotation), run_time=0.2)

    async def create_narration(self, data, narration_dir):
        try:
            import edge_tts
        except ImportError as error:
            raise RuntimeError("Spoken narration needs edge-tts. Install server requirements with: python -m pip install -r server/requirements.txt") from error

        voice = os.environ.get("TTS_VOICE", "en-US-AriaNeural")
        clips = []
        index = 0
        for scene in data["storyboard"]["scenes"]:
            for step in scene["steps"]:
                text = step.get("caption", "").strip()[:300]
                if not text:
                    clips.append(None)
                    continue
                path = narration_dir / f"step-{index:03d}.mp3"
                communicate = edge_tts.Communicate(text, voice)
                with path.open("wb") as audio_file:
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            audio_file.write(chunk["data"])
                if not path.stat().st_size:
                    raise RuntimeError(f"Text-to-speech returned an empty audio clip for storyboard step {index + 1}.")
                from pydub import AudioSegment
                duration = AudioSegment.from_file(path).duration_seconds
                clips.append({"path": str(path), "duration": duration})
                index += 1
        return clips

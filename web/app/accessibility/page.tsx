import type { Metadata } from "next";
import { Bullets, Clause, LegalPage } from "@/components/Legal";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "How this site is built to be usable with a keyboard, a screen reader, zoom, and without relying on colour. Includes the parts that are not good enough yet.",
};

export default function Accessibility() {
  return (
    <LegalPage
      title="Accessibility"
      summary="I have tried to make this usable with a keyboard, with a screen reader, at high zoom, and without relying on colour to carry meaning. This page says what has been done and what has not."
    >
      <Clause n={1} title="What I aimed for">
        <p>
          The target is the Web Content Accessibility Guidelines version 2.2 at level AA. I
          have not had the site audited by anyone else, so treat this as a statement of effort
          rather than a certificate.
        </p>
      </Clause>

      <Clause n={2} title="Keyboard">
        <Bullets items={[
          "Everything you can click, you can reach with the Tab key and use with Enter or Space.",
          "A skip link appears when you first press Tab, so you can jump past the navigation straight to the content.",
          "Focus is always visible as a blue outline. I have not removed focus rings anywhere.",
          "The sliders on the demo and results pages work with the arrow keys.",
          "Points on the curve chart can be focused one by one, and each reads out what that cut-off would mean.",
          "There are no keyboard traps and no custom shortcuts that could clash with assistive software.",
        ]} />
      </Clause>

      <Clause n={3} title="Screen readers">
        <Bullets items={[
          "Pages use real headings in order, so you can navigate by heading.",
          "Every chart drawn as graphics also exists as a plain data table, hidden visually but read out in full. You get the numbers, not a description of a picture.",
          "Images have text alternatives that describe what the figure shows rather than repeating the caption.",
          "The confusion matrix is a real table with proper row and column headers.",
          "The current page is marked in the navigation.",
          "Buttons that toggle a view report whether they are pressed.",
        ]} />
      </Clause>

      <Clause n={4} title="Colour and contrast">
        <Bullets items={[
          "Body text is near-black on a warm off-white, which is comfortably above the contrast level the guidelines ask for.",
          "Colour is never the only signal. In the example gallery a correct prediction is marked with a tick and text as well as green. Chart categories are labelled, not just coloured.",
          "The four stages use green, olive, amber and red, which stay distinguishable for the most common forms of colour blindness because they also differ in lightness.",
        ]} />
      </Clause>

      <Clause n={5} title="Zoom, text size and motion">
        <Bullets items={[
          "The layout reflows down to a 320 pixel wide window and up to 200 percent zoom without losing content or needing sideways scrolling.",
          "Wide items such as tables and charts scroll inside their own box, so the page itself never scrolls sideways.",
          "Text is set in relative units and respects your browser's font size.",
          "If your system asks for reduced motion, transitions are switched off.",
          "Nothing flashes, blinks, autoplays or moves on its own.",
        ]} />
      </Clause>

      <Clause n={6} title="Where it falls short">
        <p>
          Being honest about the gaps is more useful than claiming full compliance.
        </p>
        <Bullets items={[
          "The scientific figures rendered from the analysis are bitmap images. Their alt text describes what the figure shows, but a screen reader cannot explore the individual panels the way it can with the interactive charts.",
          "The attention map on the demo is a colour overlay. There is no non-visual equivalent for the shape of that map, only a description of what it means.",
          "The site has not been tested with every screen reader. I have checked keyboard order, headings, labels and contrast, but I do not have access to the full range of assistive software.",
          "Some numbers are dense. I have tried to write plainly around them, but a table of results is still a table of results.",
        ]} />
      </Clause>

      <Clause n={7} title="Telling me about a problem">
        <p>
          If something here does not work for you, please open an issue on the project&apos;s
          public code repository and describe what happened, what you were using and what you
          expected. Accessibility bugs are real bugs and I would rather know.
        </p>
      </Clause>
    </LegalPage>
  );
}

import type { EmailTemplate } from "@/lib/templates/types";

/**
 * MAXPRO EMAIL TEMPLATE LIBRARY
 * =============================
 * `structure` is the only field the AI sees. Presentation lives in the HTML
 * files under `src/lib/templates/html/` — the model never emits markup.
 */

const INTRO_SAMPLE = {
  subject: "Field coverage visibility at Northline",
  body: `Hi Anita,

Distribution businesses running a field team usually hit the same wall: the numbers arrive at month end, but nobody can say what coverage actually looked like day to day.

We build Rockey at Maxpro Infotech — it handles beat planning, order capture on the rep's phone and coverage reporting, so that activity is recorded as it happens rather than reconstructed later.

Is field visibility something your team is looking at this quarter?

Best regards,
Zamba`,
  cta: "Is field visibility something your team is looking at this quarter?",
  ctaLabel: "Explore the idea",
};

const PROBLEM_SAMPLE = {
  subject: "Retyping orders that arrive on WhatsApp",
  body: `Hi Vikram,

Most distributors we speak to still receive a large share of orders as messages and email — and somebody in the back office retypes every one of them into the order system before it can be processed.

RocketOrder AI reads those incoming orders as they arrive, matches items and customers against your existing master data, and puts a structured order on a review screen. Your team confirms or corrects it instead of keying it in.

The practical difference is that the order desk stops being the bottleneck during peak weeks.

Would it be worth a short call to see how it handles your order formats?

Best regards,
Zamba`,
  cta: "Would it be worth a short call to see how it handles your order formats?",
  ctaLabel: "See how it works",
};

const LETTER_SAMPLE = {
  subject: "Follow-up on recurring POS service issues",
  body: `Hi Gravity Tech Support Team,

We've valued our partnership over the years, which is why we wanted to bring several ongoing concerns to your attention. Unfortunately, recurring issues with our POS system and related equipment have started affecting our restaurant's daily operations and the experience we provide to our guests.

Unexpected POS outages, delayed equipment maintenance, and slower response times have disrupted service during busy periods, resulting in longer wait times for guests and added pressure on our team.

We'd appreciate your support in reviewing our recent service history, identifying the cause of these recurring issues, and providing a proactive maintenance plan to help prevent future disruptions. We believe these concerns can be resolved and look forward to working together on a reliable long-term solution.

Thank you for your prompt attention to this matter. We appreciate your partnership and look forward to your response.

Sincerely,
Maeva Ahearn`,
  cta: "",
  ctaLabel: "",
};

export const emailTemplates: EmailTemplate[] = [
  {
    id: "intro-plain",
    name: "Plain Intro",
    category: "Introduction",
    purpose:
      "Dark, text-led first touch. Strong headline, no images, one clear ask.",
    bestFor: "First emails where the copy should do all the work",
    skin: "html",
    htmlFile: "intro-plain.html",
    style: "bold",
    objectives: ["start-conversation", "introduce-product"],
    industries: [],
    tags: ["introduction", "plain", "dark", "first touch"],
    source: null,
    structure: `STRUCTURE — Plain Introduction
1. Greeting using the contact's first name.
2. One opening line that shows you understand their business or role. No compliments, no flattery.
3. One or two sentences on the operational problem companies like theirs run into.
4. One sentence introducing the Maxpro product and what it does about that problem.
5. A small, easy ask. Never "let me know a good time for a 30 minute call".
6. Sign off with the sender's name.
Keep it under six short paragraphs. Do not mention how you found them.`,
    sample: INTRO_SAMPLE,
  },
  {
    id: "intro-one-image",
    name: "One Image Intro",
    category: "Introduction",
    purpose:
      "Introduction with a two-photo header. Same copy as a plain intro, with a visual opener.",
    bestFor: "First-touch emails that should still look designed",
    skin: "html",
    htmlFile: "intro-one-image.html",
    style: "branded",
    objectives: ["start-conversation", "introduce-product"],
    industries: [],
    tags: ["introduction", "visual", "dark", "first touch"],
    source: null,
    imageSettings: {
      imageMode: "hero",
      showProductCard: false,
      showHero: true,
      heroKey: "hero01",
    },
    structure: `STRUCTURE — Visual Introduction
1. Greeting using the contact's first name.
2. One opening line that shows you understand their business or role.
3. One or two sentences on the operational problem companies like theirs run into.
4. One sentence introducing the Maxpro product and what it does about that problem.
5. A small, easy ask.
6. Sign off with the sender's name.
Keep it under six short paragraphs.`,
    sample: INTRO_SAMPLE,
  },
  {
    id: "intro-two-image",
    name: "Two Image Intro",
    category: "Introduction",
    purpose:
      "Editorial cream layout with a full-width photograph under the letter.",
    bestFor: "Warm or considered first emails",
    skin: "html",
    htmlFile: "intro-two-image.html",
    style: "editorial",
    objectives: ["start-conversation", "introduce-product"],
    industries: [],
    tags: ["introduction", "editorial", "serif", "first touch"],
    source: null,
    imageSettings: {
      imageMode: "hero",
      showProductCard: false,
      showHero: true,
      heroKey: "hero02",
    },
    structure: `STRUCTURE — Editorial Introduction
1. Greeting using the contact's first name.
2. One opening line that shows you understand their business or role.
3. One or two sentences on the operational problem companies like theirs run into.
4. One sentence introducing the Maxpro product and what it does about that problem.
5. A small, easy ask.
6. Sign off with the sender's name.
Write in short paragraphs. No slogans.`,
    sample: INTRO_SAMPLE,
  },
  {
    id: "letter-hero",
    name: "Letter · Hero Header",
    category: "Introduction",
    purpose:
      "Professional letter layout with a full-width hero image, warm body copy, and branded footer.",
    bestFor: "Formal outreach, partnership notes, and longer letter-style emails",
    skin: "html",
    htmlFile: "letter-hero.html",
    style: "editorial",
    objectives: ["start-conversation", "follow-up", "partnership"],
    industries: [],
    tags: ["letter", "hero", "formal", "footer"],
    source: null,
    imageSettings: {
      imageMode: "hero",
      showProductCard: false,
      showHero: true,
      heroKey: "hero01",
    },
    structure: `STRUCTURE — Letter with Hero Header
1. Greeting using the contact's name or team name.
2. Paragraph one: opening context that sets up why you are writing.
3. Paragraph two: the specific operational issue or concern in concrete terms.
4. Paragraph three: what you are asking for or proposing as a next step.
5. Paragraph four: a brief thank-you and forward-looking close.
6. Sign off with the sender's name, title, and organization.
Write as a professional letter in full sentences. No bullet lists. No CTA button.`,
    sample: LETTER_SAMPLE,
  },
  {
    id: "problem-solution-product",
    name: "Problem to Solution · Product",
    category: "Problem to solution",
    purpose:
      "Names the operational gap, then the Maxpro product that closes it. Dark visual layout.",
    bestFor: "Prospects with a clearly identified pain point",
    skin: "html",
    htmlFile: "problem-solution-product.html",
    style: "branded",
    objectives: ["start-conversation", "book-demo"],
    industries: [],
    tags: ["problem", "solution", "product", "dark"],
    source: null,
    imageSettings: {
      imageMode: "product",
      showProductCard: true,
      showHero: false,
    },
    structure: `STRUCTURE — Problem to Solution
1. Greeting using the contact's first name.
2. Paragraph one: describe the problem in the prospect's own operational language. Be concrete about the symptom, not the theory.
3. Paragraph two: explain what the Maxpro product changes about that specific problem. Name the mechanism, not a benefit adjective.
4. Paragraph three: one sentence on what that means for their team day to day.
5. The ask, phrased as a question.
6. Sign off with the sender's name.
Do not list features as bullets. Write in prose.`,
    sample: PROBLEM_SAMPLE,
  },
  {
    id: "problem-solution-story",
    name: "Problem to Solution · Story",
    category: "Problem to solution",
    purpose:
      "Editorial story: what is getting in the way, then a better way, then the product.",
    bestFor: "Longer reads and nurture-style problem emails",
    skin: "html",
    htmlFile: "problem-solution-story.html",
    style: "editorial",
    objectives: ["start-conversation", "book-demo"],
    industries: [],
    tags: ["problem", "solution", "story", "editorial"],
    source: null,
    imageSettings: {
      imageMode: "hero",
      showProductCard: false,
      showHero: true,
      heroKey: "hero01",
    },
    structure: `STRUCTURE — Problem to Solution Story
1. Greeting using the contact's first name.
2. Open on the operational pattern, written as an observation about how this kind of business works.
3. Paragraph developing why the pattern persists and what it costs in operational terms. No invented numbers.
4. Paragraph on where the Maxpro product fits into that picture.
5. A low-pressure ask.
6. Sign off with the sender's name.
Never invent a customer story, a statistic or a named reference.`,
    sample: PROBLEM_SAMPLE,
  },
  {
    id: "problem-solution-two",
    name: "Problem to Solution · Split",
    category: "Problem to solution",
    purpose:
      "Side-by-side problem and solution cards, then the product. Light, scannable layout.",
    bestFor: "Prospects who will skim rather than read a letter",
    skin: "html",
    htmlFile: "problem-solution-two.html",
    style: "branded",
    objectives: ["start-conversation", "book-demo"],
    industries: [],
    tags: ["problem", "solution", "split", "cards"],
    source: null,
    imageSettings: {
      imageMode: "hero",
      showProductCard: false,
      showHero: true,
      heroKey: "hero02",
    },
    structure: `STRUCTURE — Problem to Solution Split
1. Greeting using the contact's first name.
2. Paragraph one: the problem, concrete and operational.
3. Paragraph two: the change the Maxpro product makes to that problem.
4. One sentence on the day-to-day difference.
5. The ask, phrased as a question.
6. Sign off with the sender's name.
Write in prose. The template will split problem and solution into two cards.`,
    sample: PROBLEM_SAMPLE,
  },
  {
    id: "problem-solution-premium",
    name: "Problem to Solution · Premium",
    category: "Problem to solution",
    purpose:
      "Premium friction-to-solution layout with hero image, problem bullets, transition band, and product showcase.",
    bestFor: "High-impact problem emails with a designed, editorial feel",
    skin: "html",
    htmlFile: "problem-solution-premium.html",
    style: "editorial",
    objectives: ["start-conversation", "book-demo"],
    industries: [],
    tags: ["problem", "solution", "premium", "friction", "showcase"],
    source: null,
    imageSettings: {
      imageMode: "hero",
      showProductCard: true,
      showHero: true,
      heroKey: "hero02",
    },
    structure: `STRUCTURE — Premium Problem to Solution
1. Greeting using the contact's first name.
2. Hero headline: one sharp line on why the operational friction is costly.
3. Hero intro: two sentences on how the problem shows up day to day.
4. Problem section: title and body describing the friction in concrete terms.
5. Three short bullet points naming specific symptoms (manual work, fragmentation, visibility).
6. Solution section: title and body on how the Maxpro product removes that friction.
7. Product name, one-line blurb, and three capability bullets drawn from the product.
8. A low-pressure ask.
9. Sign off with the sender's name.
Write in prose for paragraphs; bullets should be short phrases, not full sentences with sub-clauses.`,
    sample: PROBLEM_SAMPLE,
  },
];

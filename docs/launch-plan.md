# Physics Sandbox — 30-Day Launch Plan

**Live URL:** https://physics.stacklis.com
**Status:** Production-ready as of 2026-05-17. Fulfillment, polish, OG tags shipped.
**Scope:** Web launch only. Android wrapper exists but Play Store launch is blocked on IAP wiring — not in scope here.

---

## 1. Positioning + pitch

**The wedge is the 4-level educator system.** Phun was a toy. Algodoo bolted some text on. PhET is rigorous but airless. Nothing in this market scales the same live simulation from a one-sentence "Curious" caption to a full Expert derivation in one click. That's the line everything else hangs from.

**One-liner (consumer / homeschool / social):**
> A physics sandbox that explains itself — from "what's happening here?" to the full derivation, in one click.

**Paragraph (educator / press / longform):**
> Physics Sandbox is a browser-based 2D physics playground with a 4-level educator system built in. Drag in empty space to spawn objects, watch energy and momentum update live, and toggle the explanation register from Curious to Student to University to Expert. The simulation never changes; the framing does. No signup, no install, free to use; $9 unlocks scene saving and exportable derivations. Built for homeschool parents, K-12 teachers, and anyone who's ever wanted to actually see why a Newton's cradle works.

---

## 2. Subreddits — ranked, with drafted posts

Audience numbers are rough order-of-magnitude. Every sub listed has been chosen because the *post format already works there*, not because it's nominally on-topic.

### Tier 1 — post in Week 1

#### r/homeschool (~250k)
- **Fit:** Highest. Parents actively shop for tools that make abstract subjects visual. $9 is well inside impulse range.
- **Mod culture:** Generally welcoming if you frame as "thing I made/found" with a concrete use case. Self-promotion is tolerated when the post is genuinely useful and you answer questions in comments. Avoid "buy this" framing.
- **Format that lands:** Text post + 1 screenshot of the Curious vs Expert toggle on the same scene. Optional short video.
- **Drafted post:**

> **Title:** I built a free physics sandbox that scales explanations from "Curious" to "Expert" — looking for feedback from homeschoolers
>
> Hi all — I've been working on a browser-based physics playground aimed partly at homeschoolers, and I wanted to share it before I keep building in a vacuum.
>
> The thing I'm proudest of is the 4-level educator system. You drop in some balls, click on one, and the readout starts with a plain-English "this ball is moving and pushing on the next one." Toggle up to Student and it shows kinetic energy and momentum with units. Toggle up to University and it shows the conservation equations. Expert shows the full derivation. Same simulation, four registers — kids can grow into it instead of outgrowing it.
>
> No signup, no install, works on a phone. Free to use. There's a $9 one-time unlock for saving scenes if you want it, but the whole sim is free.
>
> Link: https://physics.stacklis.com
>
> What I'd love to know: what concepts are hardest to get across with static textbook diagrams? If there's a specific scenario you wish you had a sandbox for, tell me — I'm still adding scenes.

#### r/HomeschoolRecovery + r/secularhomeschool (~40k + ~30k)
- **Fit:** Secular crowd skews toward STEM-positive parents. r/HomeschoolRecovery is more cynical but values genuinely good tools.
- **Format:** Same post body as r/homeschool, slightly softened on the "feedback" frame for HSRecovery (they hate anything that smells like marketing research). Skip HSRecovery if it feels off.

#### r/SideProject (~250k)
- **Fit:** Builders showing builders. Forgiving of self-promotion, hungry for novel mechanics.
- **Format:** Screenshot + short story. Lead with the educator-level toggle as the interesting mechanic.
- **Drafted post:**

> **Title:** Newton's cradle, but you can click any ball and ask it to explain itself at 4 levels of detail
>
> I've spent the last few months on a 2D physics sandbox where every readout has 4 registers: Curious (plain English), Student (formulas with units), University (conservation equations), Expert (derivation).
>
> Same physics, four framings. The bet is that "sandbox" and "textbook" don't have to be separate apps.
>
> No signup, no install. The default scene is a Newton's cradle so the first frame is moving. https://physics.stacklis.com
>
> Tech: hand-rolled 2D solver in plain Canvas, no build step, static site on Vercel. 3D mode is Three.js + Rapier3D. Happy to talk shop.

### Tier 2 — post in Week 2

#### r/Teachers (~2M) and r/ScienceTeachers (~40k)
- **Fit:** ScienceTeachers is the real target. r/Teachers is broader and will likely fizzle but the upside is occasional virality.
- **Mod culture:** ScienceTeachers tolerates tool announcements *if* you post as a teacher or you address teachers directly without sales language. Read pinned rules — some require flair.
- **Format:** Text + short demo video. *This is the post that benefits most from a 20-second screen recording.*
- **Drafted post:**

> **Title:** Free browser physics sim with built-in 4-tier explanations — sharing in case it's useful for class
>
> Sharing this in case it's useful for anyone teaching mechanics. It's a 2D physics sandbox that runs in any browser, no install, no logins, no data collection. The thing that might actually be useful for class is the explanation toggle: same simulation, four registers from Curious (for younger students) up to Expert (full derivation). You can demo a concept at the level your section is at and then bump it up a tier to show where it's heading.
>
> Free for any classroom use. There's a $9 one-time Pro tier for saving scenes, but it's not gated for demo use.
>
> https://physics.stacklis.com
>
> Curious whether the level-toggle approach feels useful or gimmicky to people actually in the room — would value the gut check.

#### r/EducationalGames (~25k)
- **Fit:** Niche but exact match. Mods curate hard for quality.
- **Format:** Text + screenshot. Lead with the toggle, not the price.
- **Drafted post (short, this sub doesn't reward long posts):**

> **Title:** Physics Sandbox — 4-level explanation toggle on a live 2D sim, free in browser
>
> Drag to spawn, click any object, pick your explanation level from Curious to Expert. No signup. https://physics.stacklis.com
>
> Built it because every physics sim I tried was either a toy with no math, or a textbook with no toy. Tried to make one thing that's both.

### Tier 3 — likely to fizzle, post anyway in Week 2-3 because cost is low

#### r/InternetIsBeautiful (~17M)
- **Fit:** Wrong sub for educator framing. Lead with the *aesthetic* of the Newton's cradle and the explanation toggle as a flourish.
- **Mod culture:** Strict. URL-only titles, no marketing. You get one shot.
- **Format:** Short title, link only.
- **Drafted post:**

> **Title:** A physics sandbox in your browser that scales its own explanations from one-sentence to full derivation

#### r/PhysicsStudents (~200k)
- **Fit:** Students looking for intuition aids. They tolerate self-promo more than r/Physics does.
- **Format:** Frame around the *Expert* register — "here's a tool where you can poke at the simulation while reading the derivation."
- **Drafted post:**

> **Title:** Made a 2D physics sandbox where you can flip between the simulation and its derivation side-by-side
>
> Built mostly for my own intuition. The thing I find useful is being able to click any object and pull up the conservation equations at the level you want them — Student, University, or full Expert derivation. The simulation keeps running while you read.
>
> Free to use, no signup. https://physics.stacklis.com — feedback welcome, especially "this derivation is wrong" or "this scene is misleading."

### Tier 4 — do NOT post in Week 1

#### r/Physics (~3M)
- **Why not:** The community is allergic to commercial tools, even free ones. A post here in Week 1 with a $9 mention anywhere in the link tree will get auto-flagged and torpedo your reputation in adjacent subs. Wait until Week 3-4 and only after the tool has independent traction. When you do post, frame as "tool I made for derivation practice," skip the price page entirely, link to `/app/?free=1` not `/`.

---

## 3. Hacker News / Show HN strategy

**Title:**
> Show HN: A physics sandbox that scales its explanations from "Curious" to "Expert"

**Why this title:** HN rewards specificity and rewards the educator-toggle hook over anything else this product does. Don't lead with "free," don't lead with "$9," don't use the word "playground."

**Ideal post time:** Tuesday or Wednesday, **15:00–16:00 UTC** (10–11am Eastern). Submissions land into a moderately busy front page and have ~3 hours to gather upvotes before the EU-evening / US-lunch wave.

**OP first comment (post within 60 seconds of submitting):**

> Author here. The 4-level educator toggle is the thing I'd most like feedback on. Same simulation, four explanation registers — Curious is plain English, Student has formulas with units, University has the conservation equations, Expert has the derivation. The bet is that "intuition tool" and "rigorous tool" don't have to be different apps.
>
> 2D mode is a hand-rolled solver in plain Canvas, no build step. 3D mode is Three.js + Rapier3D. Static site on Vercel — no analytics, no telemetry, no third-party scripts beyond Stripe and Google Fonts.
>
> Free to use; $9 one-time unlock for scene saving and exportable derivations. Fulfillment is honor-system at $9 — I ship the localStorage flag and trust people.
>
> Happy to talk about the solver, the educator content pipeline, or anything else.

**If it hits the front page (top 30):**
1. Be present for the next 6 hours. HN comments thread fast and dead-author posts lose momentum.
2. Reply to every top-level comment that isn't pure flame. Especially reply to corrections — physics people on HN will find real bugs in your derivations and that's a gift, not an attack.
3. Don't argue about price. If someone says $9 is too much or too little, thank them and move on.
4. Do not edit the title or repost. Don't ask for upvotes anywhere else (HN detects this and shadow-buries).
5. Expected outcome: front-page Show HN typically drives 5–25k uniques over 24 hours. Realistic Pro conversion on that traffic is 0.3–1.5%.

---

## 4. Twitter / X plan

Voice is Khan Academy meets old Phun. Confident, slightly playful, never hype.

**Tweet 1 — Launch tweet (anchor of the thread):**

> spent the last few months building a physics sandbox that explains itself
>
> click any object, pick your level: Curious / Student / University / Expert
>
> same simulation, four registers. free in your browser, no signup
>
> https://physics.stacklis.com

**Thread continuation (post these as replies if Tweet 1 gets any traction):**

> 2/ the wedge is the toggle. Phun was a great toy with no math. PhET is great math with no toy. I wanted one thing that's both.
>
> Curious mode says "this ball is moving and pushes the next one"
> Expert mode shows the full momentum conservation derivation
> same scene. you pick.

> 3/ 2D mode is hand-rolled Canvas + a custom solver. no build step, no bundler, no analytics, no telemetry. static site.
>
> 3D mode is Three.js + Rapier3D. the importmap loads everything from CDN.
>
> the whole thing is MIT licensed.

> 4/ free is fully featured for play. $9 one-time unlock adds scene saving (2D + 3D) and derivation export. that's it — no subscription, no tiers, no "Pro+".
>
> if you teach, share with your class. if a student needs a comp, DM me.

**Tweet 2 — Newton's cradle GIF tweet (post Day 2 or 3, separate from launch thread):**

> the default scene is a Newton's cradle because the first frame should already be moving
>
> drag any ball to pull it out. release. listen for the click in your head.
>
> https://physics.stacklis.com
>
> *[attach 8-second GIF of Newton's cradle being pulled and released]*

**Asset needed:** an 8-second loop GIF of the cradle. Currently missing. Flag for screen recording.

**Tweet 3 — "did you know" educational hook:**

> a Newton's cradle works because the balls are nearly identical mass and the collisions are nearly elastic
>
> if you change either of those, the whole thing breaks down. the middle balls start swinging, energy gets lost as heat, the rhythm dies
>
> you can try it yourself: https://physics.stacklis.com

**Tweet 4 — teacher-targeted reply bait:**

> physics teachers: what's the one concept your students get wrong every single year that you wish you had a better visual for?
>
> asking because i'm building a sandbox with built-in 4-tier explanations and i want to know what to prioritize next
>
> https://physics.stacklis.com

**Tweet 5 — Show HN follow-up (only post if HN hits):**

> the physics sandbox is on Show HN today if you have a minute
>
> [link to HN submission]
>
> would especially value people pointing out where the derivations are wrong

---

## 5. Homeschool Facebook groups + forums

Homeschool parents live in private FB groups and a handful of long-running forums. Posting etiquette is *very* different from Reddit. Lurk for a few days before posting in any of these.

1. **The Well-Trained Mind Forum** (https://forums.welltrainedmind.com) — Classical/rigorous homeschool tradition. High-quality discussion. Post in the *K-8 Curriculum Board* or *High School Board* depending on age. Etiquette: introduce yourself first if you're new. Don't drop a link cold — frame as "I made this, would love feedback from people who actually teach physics at home."

2. **Cathy Duffy Reviews** (cathyduffyreviews.com) — Not a forum but a curriculum review site with significant homeschool-parent trust. Outreach goal here is to get the tool *reviewed*, not to post. Email Cathy or the team via the contact form. One-paragraph pitch. No follow-up for 4 weeks.

3. **Secular Homeschool Community Forum** (secularhomeschool.com) — Smaller than WTM, less Christian-traditional, more STEM-positive. Curriculum board accepts "tool I made" posts if you're transparent it's yours.

4. **r/secularhomeschool** (Reddit, covered above) — same audience, lower stakes.

5. **Facebook: "Homeschool Mom Resources & Curriculum"** and **"Secular, Eclectic, Academic Homeschoolers (SEA)"** — Both are large active groups. Etiquette: admins typically require a "self-promo Friday" thread or pre-approval. Message a mod first. Posting cold gets you banned.

**Anti-pattern:** Do NOT post the same content in 3+ homeschool groups on the same day. Group admins talk to each other. Stagger by at least 48 hours, ideally a week.

---

## 6. Email outreach — 5–10 individual targets

This is a "send 1-paragraph emails over 2 weeks" list, not a press blast. Names + handles + why-them only. Drafting actual emails is a Week 2 task.

1. **Steve Mould** (@SteveMould, YouTube ~3M) — UK science communicator. Newton's cradle is literally in his wheelhouse and he's reviewed physics tools before. Best reach via YouTube channel email.
2. **Dianna Cowern / Physics Girl** (@thephysicsgirl, YouTube ~3M) — Slowly returning to content. Has reviewed sims in the past. Reach via Physics Girl contact form.
3. **Matt Parker / Stand-up Maths** (@standupmaths, YouTube ~1M) — Math-leaning but loves clever tools. High signal-to-noise audience.
4. **Sabine Hossenfelder** (@skdh, YouTube ~1.6M) — Physicist with a critical eye. If she even mentions it, weighty. Long shot.
5. **Cathy Duffy** (cathyduffyreviews.com) — Curriculum reviewer with enormous homeschool trust. Already covered above; lead with her.
6. **Susan Wise Bauer / The Well-Trained Mind** (welltrainedmind.com) — Classical homeschool author. Long shot but her endorsement carries weight in a specific audience.
7. **3Blue1Brown / Grant Sanderson** (@3blue1brown) — Long shot, but the educator-toggle approach is philosophically adjacent to his "explain at the level the viewer is at" instinct.
8. **Vihart** (@vihartvihart) — Math/physics art crossover. Smaller now but cult audience overlaps perfectly.
9. **Henry Reich / MinutePhysics** (@minutephysics, YouTube ~5.6M) — Targets a curious-but-not-expert audience, exactly the Curious-tier framing.
10. **Veritasium / Derek Muller** (@veritasium) — Long shot; huge audience. Don't expect a reply, but if it lands, it's the biggest single channel possible.

**Tradeoff note:** YouTubers #1, #3, and #9 are the realistic hits. Everyone else is a lottery ticket. Spend the most polish on the top three emails.

---

## 7. 30-day launch sequence

Cadence is realistic for one person who also has a day job.

### Week 1 — Soft launch
- **Day 1 (Mon):** Tweet 1 (launch thread). Post in r/SideProject.
- **Day 2:** Record the 20-second screen capture of cradle + 4-level toggle. Post Tweet 2 (cradle GIF).
- **Day 3:** Post in r/homeschool. Spend 2 hours in the comments.
- **Day 4:** Post in r/secularhomeschool. Tweet 3 ("did you know").
- **Day 5:** Quiet day. Watch metrics. Reply to anyone who DMs.
- **Day 6–7:** Write the Show HN comment draft. Email outreach #1 (Steve Mould).

### Week 2 — Educator push + HN
- **Day 8 (Mon):** Post in r/ScienceTeachers with the video. Send email outreach #3 (Matt Parker).
- **Day 9 (Tues) 15:00 UTC:** Show HN. Be present in comments for 6 hours.
- **Day 10:** If HN hit, ride the wave on Twitter (Tweet 5). If HN missed, no big deal, move on.
- **Day 11:** Post in r/EducationalGames. Tweet 4 (teacher reply-bait).
- **Day 12:** Outreach to Cathy Duffy. Outreach to Susan Wise Bauer.
- **Day 13–14:** Lurk in The Well-Trained Mind Forum. Pick the right thread to participate in.

### Week 3 — Deepen + Facebook
- **Day 15:** Post in The Well-Trained Mind Forum.
- **Day 16:** DM mods of one secular homeschool FB group. Wait for approval.
- **Day 17:** Post in r/PhysicsStudents.
- **Day 18:** Post in r/InternetIsBeautiful (low expectations, one-shot).
- **Day 19–21:** Whatever you got right, do more of. If r/homeschool was the channel, find adjacent subs. If Twitter educator-bait worked, do a Pt. 2.

### Week 4 — Iterate, not relaunch
- **Day 22–28:** Don't post a "30 days later" retro unless something is genuinely surprising in the metrics. Instead, ship one new scene or one new educator feature based on the feedback you got. Tweet the ship. Use it as a softer second touchpoint with everyone who saw the launch.
- **End of Day 30:** Read the metrics below. Decide whether to do a Week 5 push or pause and build.

---

## 8. What NOT to do

- **Do not post in r/Physics in Week 1.** The community is hostile to commercial tools, even free ones, even MIT-licensed ones. Wait until Week 3-4 and only if you have independent traction. Strip the price page from the link.
- **Do not fabricate testimonials.** You don't have users yet. Structure social proof around the product *working* — show the toggle, show the cradle, show the derivation. Real social proof comes later or not at all.
- **Do not spam multiple homeschool FB groups same-day.** Admins talk. Stagger by 48+ hours minimum.
- **Do not lead with "$9" anywhere.** Lead with the 4-level toggle. Price is a footnote, not a hook.
- **Do not mention promo codes publicly.** `PS-K7MX2NR4` and `PS-Q9BW5TZL` are for hand-distribution — DMs, individual emails to teachers, one-off support. If you post them on Reddit they get scraped within an hour and you've burned them.
- **Do not auto-DM anyone.** Manual outreach only. If you can't write the email by hand, don't send it.
- **Do not chase r/InternetIsBeautiful.** It's a lottery sub. Post once, don't repost variants.
- **Do not edit the HN title after submission.** HN penalizes title edits and treats them as gaming the algorithm.
- **Do not promise features that aren't shipped.** If someone asks "can it do orbital mechanics?" and it can't, the answer is "not yet" — not "I'll add it this week."
- **Do not respond to flame with flame.** Especially on HN. Especially about price.

---

## 9. Metrics to watch

Set up basic uptime/visit tracking before Day 1 — *not* a heavy analytics suite, just enough to know what worked. The privacy policy commits to no telemetry, so keep this server-side / referrer-only.

**Acquisition (per channel):**
- Unique visits, broken down by referrer (`twitter.com`, `reddit.com/r/...`, `news.ycombinator.com`, `welltrainedmind.com`, etc.).
- Target: any single channel that drives >500 visits in 24h is a "hit." Anything <50 is a "fizzle, deprioritize."

**Activation:**
- `/` → `/app/` click-through rate. Healthy is 35-55%. Below 25% means the landing isn't selling.
- Time-in-app of >60 seconds (only proxy you have without analytics: returning visits within 24h).

**Conversion:**
- Visits → Stripe checkout opens. Realistic baseline: 0.3-0.8% from cold traffic, 1.5-3% from educator-targeted channels.
- Checkout opens → completed purchases. If this is below 60% on a $9 one-time, something is broken in the flow.

**Retention proxy:**
- Returning visitors over 7 days. Without analytics this is referrer + cookie-free heuristics. Acceptable to instrument lightweight server log analysis here without violating the privacy promise — just don't ship a tracker.

**Qualitative signal (more important than the numbers at this stage):**
- Reddit / HN comments that say "I'd actually use this in class."
- Anyone who emails asking for a comp code for a classroom.
- Anyone who finds and reports a real bug in a derivation. That's the gold-standard signal that the right audience saw it.

**Decision rule for end of Day 30:**
- If 2+ channels hit, and 1+ educator emailed about classroom use → do Week 5 push, prioritize the working channels.
- If 0-1 channels hit but qualitative signal is strong → keep building, soft-relaunch in 60 days with one major new feature.
- If 0 channels hit and no qualitative signal → the wedge isn't landing. Talk to 5 homeschool parents directly before posting anything else.

---

## Asset gap — flag before Day 1

The single highest-leverage missing asset is a **20-second screen recording** of:
1. The default Newton's cradle running for 3 seconds.
2. Drag a ball out, release, cradle starts clicking.
3. Click on one ball — readout panel opens at "Student" level.
4. Toggle up to "Expert" — same panel, full derivation appears.
5. Hold on the Expert view for 3 seconds.

That recording is the centerpiece of Tweet 2, r/ScienceTeachers, r/EducationalGames, and the email outreach. Record it before Day 1 of Week 1. OBS at 1080p, no narration, no music — let the toggle do the talking.

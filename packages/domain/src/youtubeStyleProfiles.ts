export type YoutubeStyleProfile = {
  slug: string;
  title: string;
  referenceImage: string;
  useCases: string[];
  semanticMechanic: string;
  composition: {
    layout: string;
    primarySubject: string;
    supportingElements: string[];
    depth: string;
  };
  layers: string[];
  textSystem: {
    role: string;
    placement: string;
    typography: string;
    maxWords: number;
  };
  visualRules: string[];
  promptRules: string[];
  negativeRules: string[];
};

export const YOUTUBE_STYLE_PROFILES: YoutubeStyleProfile[] = [
  {
    slug: "podcast",
    title: "Podcast",
    referenceImage: "brand/reference-styles/youtube/01-podcast.png",
    useCases: ["interview", "expert opinion", "controversial quote", "founder story"],
    semanticMechanic: "Two-person authority conversation with a bold extracted quote as the hook.",
    composition: {
      layout: "Two large cropped speakers on left and right with a clean central text block.",
      primarySubject: "Faces and podcast microphones, both subjects cut close to the frame edges.",
      supportingElements: ["black void or very dark studio background", "microphones as proof of podcast context", "one highlighted text block"],
      depth: "Foreground microphones overlap the people; background is almost invisible."
    },
    layers: ["dark background", "left speaker cutout", "right speaker cutout", "microphones", "central stacked headline", "yellow emphasis block"],
    textSystem: {
      role: "Main hook carries the thumbnail; faces provide trust and emotion.",
      placement: "Centered between faces, stacked in 2-3 lines.",
      typography: "Extra-bold condensed sans, white uppercase, one yellow rectangle with black text.",
      maxWords: 6
    },
    visualRules: ["high contrast", "clean face cutouts", "eyes visible", "no busy background", "yellow highlight for number or key phrase"],
    promptRules: ["Use two podcast guests or one host plus guest.", "Keep the center readable at mobile size.", "Make microphones visible but not dominant."],
    negativeRules: ["Do not create a flat poster.", "Do not add small subtitles.", "Do not copy real podcast logos."]
  },
  {
    slug: "center-stage",
    title: "Center Stage",
    referenceImage: "brand/reference-styles/youtube/02-center-stage.png",
    useCases: ["personal lesson", "business advice", "repeatable method", "creator authority"],
    semanticMechanic: "A calm expert centered in a realistic room, with a premium editorial claim above.",
    composition: {
      layout: "Single person centered at a desk; large headline crosses the top; small proof line at bottom.",
      primarySubject: "Speaker looking directly at camera with hands visible.",
      supportingElements: ["soft interior background", "thin arrow or annotation", "subtle desk props"],
      depth: "Subject is sharp; background has natural blur and muted colors."
    },
    layers: ["blurred room background", "center person", "red horizontal banner", "large elegant headline", "small proof text", "minimal annotation"],
    textSystem: {
      role: "Headline sells the concept; lower caption adds proof or credibility.",
      placement: "Large top text over banner, small bottom-center proof line.",
      typography: "Large italic serif headline, white on red; bottom text bold white.",
      maxWords: 5
    },
    visualRules: ["editorial feel", "soft daylight", "premium serif title", "subject centered", "low clutter"],
    promptRules: ["Use a confident teacher or founder at a table.", "Keep background believable and lightly blurred.", "Add one small visual annotation only if it clarifies the claim."],
    negativeRules: ["Avoid screaming colors except one red banner.", "Avoid cartoon UI elements.", "Avoid excessive text."]
  },
  {
    slug: "podcast-countdown",
    title: "Podcast Countdown",
    referenceImage: "brand/reference-styles/youtube/03-podcast-countdown.png",
    useCases: ["challenge", "deadline", "transformation", "promise with number"],
    semanticMechanic: "Podcast authority plus a numeric countdown or deadline that creates urgency.",
    composition: {
      layout: "Same as podcast, but the number becomes the central visual anchor.",
      primarySubject: "Two people in podcast setting, cropped large on both sides.",
      supportingElements: ["microphones", "black negative space", "yellow countdown block"],
      depth: "Face and microphone layer in front of the central background."
    },
    layers: ["black background", "two speaker cutouts", "microphones", "white headline", "yellow number block", "bottom word line"],
    textSystem: {
      role: "Deadline, duration, or step count is the click trigger; the yellow box must not imply money.",
      placement: "Center stack, with only the deadline, time window, or step count isolated inside a yellow box.",
      typography: "Condensed bold uppercase; yellow box for countdown/time/steps only.",
      maxWords: 7
    },
    visualRules: ["number-first readability", "urgent contrast", "symmetrical face balance", "no decorative noise"],
    promptRules: ["Use the yellow box only for a deadline, time window, or step count.", "Make the countdown constraint the most memorable element.", "Use black/yellow/white only unless a brand accent is required."],
    negativeRules: ["Do not put money, revenue, price, or salary claims in the yellow box.", "Do not bury the number.", "Do not add long sentences."]
  },
  {
    slug: "simple-text",
    title: "Simple Text",
    referenceImage: "brand/reference-styles/youtube/04-simple-text.png",
    useCases: ["philosophy", "classic lesson", "lecture", "soft authority"],
    semanticMechanic: "A cinematic still plus a minimal title creates intellectual seriousness.",
    composition: {
      layout: "Archival or cinematic subject centered behind one large elegant text line.",
      primarySubject: "Teacher, speaker, or archival person in a contextual environment.",
      supportingElements: ["chalkboard, classroom, lecture hall, or dark contextual background"],
      depth: "Background image is softened; title is the dominant foreground layer."
    },
    layers: ["cinematic background still", "subtle dark overlay", "large serif title", "light vignette"],
    textSystem: {
      role: "Title frames the idea as timeless or important.",
      placement: "Center across the image, often covering the subject slightly.",
      typography: "Elegant serif, mixed italic/roman weight, white or off-white.",
      maxWords: 5
    },
    visualRules: ["minimalism", "cinematic grain", "soft blur", "serif elegance", "no hard badges"],
    promptRules: ["Use one strong conceptual title.", "Keep the image understated and serious.", "Let the text sit as an editorial overlay."],
    negativeRules: ["Avoid clickbait arrows.", "Avoid bright YouTube colors.", "Avoid busy illustrations."]
  },
  {
    slug: "whiteboard",
    title: "Whiteboard",
    referenceImage: "brand/reference-styles/youtube/05-whiteboard.png",
    useCases: ["money", "education", "framework", "how-to", "course promise"],
    semanticMechanic: "A person points at a simplified diagram that makes the promise feel teachable.",
    composition: {
      layout: "Presenter on one side, large whiteboard on the other with icons and one big claim.",
      primarySubject: "Expert holding marker or pointing at board.",
      supportingElements: ["large number or claim", "up to two simple diagram blocks", "one line/underline or connector"],
      depth: "Presenter overlaps the board edge; board remains clean and flat."
    },
    layers: ["soft room background", "presenter", "whiteboard panel", "large number or claim", "two diagram blocks maximum", "blue underline or connector"],
    textSystem: {
      role: "The board is the hook and the explanation at once.",
      placement: "Inside board area, split into no more than two large blocks.",
      typography: "Bold black sans for the main claim; no tiny labels.",
      maxWords: 4
    },
    visualRules: ["white clean surface", "one blue accent", "large readable number", "educational icons", "marker in hand"],
    promptRules: ["Create a teachable diagram, not a complex infographic.", "Use two large explanation blocks maximum.", "Make every board element readable instantly; skip tiny labels."],
    negativeRules: ["No dense charts.", "No tiny labels.", "No handwritten clutter."]
  },
  {
    slug: "text-on-image",
    title: "Text On Image",
    referenceImage: "brand/reference-styles/youtube/06-text-on-image.png",
    useCases: ["vlog essay", "creator story", "personal experiment", "POV"],
    semanticMechanic: "One huge word overlays a real scene, turning the image into a mood statement.",
    composition: {
      layout: "Full-bleed lifestyle scene with gigantic text spanning behind or around the subject.",
      primarySubject: "Creator in environment, often side-lit and not necessarily looking at camera.",
      supportingElements: ["city, workspace, window, desk, laptop", "large word as graphic layer"],
      depth: "Text is integrated with subject masking; scene remains photographic."
    },
    layers: ["cinematic background", "creator", "huge white text", "optional subject mask over text", "color grade"],
    textSystem: {
      role: "A single word sets the emotional frame.",
      placement: "Across the full width, behind or partially behind the subject.",
      typography: "Massive ultra-bold sans, white, cropped by frame edges.",
      maxWords: 2
    },
    visualRules: ["cinematic natural light", "giant text", "subject silhouette readability", "environment tells story"],
    promptRules: ["Use one oversized word only.", "Let the environment explain the niche.", "Mask the subject cleanly in front of the text when possible."],
    negativeRules: ["No multiple text blocks.", "No arrows or stickers.", "No generic stock background."]
  },
  {
    slug: "history",
    title: "History",
    referenceImage: "brand/reference-styles/youtube/07-history.png",
    useCases: ["biography", "sports story", "crime-to-success arc", "origin story", "hidden contrast"],
    semanticMechanic: "Two Worlds / Hidden Contrast: opposing contexts reveal the backstory, contradiction, or transformation.",
    composition: {
      layout: "Central subject between two opposing worlds, either split-body or framed by contrasting backgrounds.",
      primarySubject: "Person, artifact, place, or symbol that connects the two worlds.",
      supportingElements: ["origin or hidden-context environment", "public outcome or opposing environment", "visible divider or contrast boundary"],
      depth: "Subject cutout sits above both backgrounds; the contrast boundary stays clear and central."
    },
    layers: ["left contextual world", "right contrasting world", "central subject", "visible contrast boundary", "symbolic props", "small name/logo if relevant"],
    textSystem: {
      role: "Text is optional; the visual contrast carries the story.",
      placement: "Minimal bottom badge or none.",
      typography: "If used, bold condensed with gritty texture.",
      maxWords: 3
    },
    visualRules: ["dramatic two-world contrast", "cinematic lighting", "symbolic storytelling", "sharp subject cutout", "clear readable stakes"],
    promptRules: ["Represent Two Worlds / Hidden Contrast, not only a literal before-after.", "Use clear left-right or foreground-background opposition.", "Make the contrast boundary visible and central."],
    negativeRules: ["Do not make both halves visually similar.", "Avoid long text.", "Avoid random unrelated backgrounds."]
  },
  {
    slug: "explainer",
    title: "Explainer",
    referenceImage: "brand/reference-styles/youtube/08-explainer.png",
    useCases: ["finance", "analytics", "case study", "business breakdown"],
    semanticMechanic: "A clean data card plus a face makes an abstract result feel concrete and personal.",
    composition: {
      layout: "Large rounded data card on one side, creator face on the other.",
      primarySubject: "Presenter face, calm and credible, occupying right third.",
      supportingElements: ["chart line", "large metric", "growth arrow", "soft office background"],
      depth: "Floating card sits forward with soft shadow; face is sharp."
    },
    layers: ["blurred office background", "floating rounded card", "chart grid", "green metric", "green line graph", "creator face"],
    textSystem: {
      role: "Metric is the hook; labels give context only.",
      placement: "Inside card, top-left hierarchy.",
      typography: "Clean UI sans, big green number, black suffix.",
      maxWords: 4
    },
    visualRules: ["clean SaaS/UI look", "green growth signal", "rounded white card", "soft professional lighting"],
    promptRules: ["Create one data visualization only.", "Make the number huge and believable.", "Keep the presenter secondary but human."],
    negativeRules: ["No dense dashboard.", "No tiny axis labels.", "No red unless the story is negative."]
  },
  {
    slug: "object-in-hand",
    title: "Object In Hand",
    referenceImage: "brand/reference-styles/youtube/09-object-in-hand.png",
    useCases: ["challenge", "experiment", "fitness", "food", "habit", "app result"],
    semanticMechanic: "A surprised face plus held proof objects instantly communicates the premise.",
    composition: {
      layout: "Creator centered close to camera, holding two important objects near the lens.",
      primarySubject: "Face with exaggerated expression, eyes wide, direct camera contact.",
      supportingElements: ["phone/app screen", "physical object", "real environment tied to topic"],
      depth: "Hands and objects in foreground; face behind but sharp; background softly blurred."
    },
    layers: ["contextual room background", "creator close-up", "left-hand object", "right-hand object", "screen content or prop detail"],
    textSystem: {
      role: "Objects and expression should explain the challenge; use a short top headline only when the objects alone do not reveal the conflict.",
      placement: "Optional top headline, otherwise only natural screen/object text.",
      typography: "Bold compact sans if a headline is needed.",
      maxWords: 4
    },
    visualRules: ["wide-angle close-up", "foreground objects", "surprised expression", "natural but bright lighting"],
    promptRules: ["Use hands as composition anchors.", "Make the object readable at small size.", "Add a short top headline only if objects alone do not explain the conflict."],
    negativeRules: ["Do not add a headline when the held objects already make the premise obvious.", "Do not hide the object.", "Avoid neutral facial expression."]
  },
  {
    slug: "contextual-background",
    title: "Contextual Background",
    referenceImage: "brand/reference-styles/youtube/10-contextual-background.png",
    useCases: ["mystery", "travel", "danger", "discovery", "documentary"],
    semanticMechanic: "One environment plus one mystery object creates a clean documentary question.",
    composition: {
      layout: "Creator cutout on one side, one large environment and one mystery object on the other.",
      primarySubject: "Presenter reacting with concern or curiosity.",
      supportingElements: ["one landmark or environment", "one clear mystery object", "optional depth cue"],
      depth: "Creator in foreground; scene extends deep into background."
    },
    layers: ["single large environment", "foreground creator", "one mystery object", "depth haze/light"],
    textSystem: {
      role: "Text is unnecessary if the scene creates the question.",
      placement: "No overlay text by default.",
      typography: "None unless topic absolutely requires one short label.",
      maxWords: 2
    },
    visualRules: ["big readable environment", "symbolic threat or mystery", "clear facial emotion", "bright documentary look"],
    promptRules: ["Use exactly one environment and one mystery object.", "Keep any overlay text to two words maximum.", "Keep the creator large enough for emotion."],
    negativeRules: ["No random fantasy elements.", "No cluttered background.", "No extra props competing with the mystery object."]
  },
  {
    slug: "before-after",
    title: "Before/After",
    referenceImage: "brand/reference-styles/youtube/11-before-after.png",
    useCases: ["transformation", "productivity", "makeover", "fitness", "workflow improvement"],
    semanticMechanic: "A split screen instantly communicates contrast between pain state and improved state.",
    composition: {
      layout: "Vertical split screen with before on left, after on right.",
      primarySubject: "Same person or equivalent subject shown in two contrasting states.",
      supportingElements: ["platform/app icons on before side", "clean workspace or result environment on after side", "center divider"],
      depth: "Both sides feel photographic but with different color and mood."
    },
    layers: ["left before scene", "right after scene", "vertical divider", "before label", "after label", "icons/badges if needed"],
    textSystem: {
      role: "Labels define the comparison and should be instantly readable.",
      placement: "Top-left and top-right.",
      typography: "Large lowercase sans; before white, after yellow or green.",
      maxWords: 2
    },
    visualRules: ["clear left-right contrast", "bad lighting before", "clean bright after", "same person continuity", "simple labels"],
    promptRules: ["Make the transformation obvious without explanation.", "Use different color temperature on each side.", "Keep the split vertical and clean."],
    negativeRules: ["Do not mix before and after elements.", "Do not add more than two labels.", "Do not make both sides equally polished."]
  },
  {
    slug: "multi-pov",
    title: "MULTI POV",
    referenceImage: "brand/reference-styles/youtube/12-multi-pov.png",
    useCases: ["self-improvement", "challenge", "year project", "habit building", "creator journey"],
    semanticMechanic: "Multiple POV slices prove a long journey by showing action, work, and proof object in one cinematic frame.",
    composition: {
      layout: "Three vertical cinematic panels with one giant lowercase word crossing the center.",
      primarySubject: "Different visual proofs of the same journey: action scene, work scene, and object/proof scene.",
      supportingElements: ["calendar or date marker", "book/product/proof object", "dark moody lighting"],
      depth: "Panels feel like separate scenes; giant text unifies them as the foreground graphic layer."
    },
    layers: ["left POV/action panel", "center work panel", "right proof object panel", "giant white word", "small date/calendar detail"],
    textSystem: {
      role: "One huge word names the project while small proof text adds duration.",
      placement: "Huge word across center; small proof/date near lower center.",
      typography: "Massive bold lowercase sans, white; optional handwritten numeric detail.",
      maxWords: 3
    },
    visualRules: ["three-panel storytelling", "dark cinematic grade", "one unifying giant word", "clear proof object", "minimal text"],
    promptRules: ["Use exactly three POV panels.", "Make each panel show a different proof angle of the same topic.", "Keep the main word huge and readable across panels."],
    negativeRules: ["Do not make a random collage.", "Do not use more than one main word.", "Avoid bright sticker-style design."]
  },
  {
    slug: "notifications",
    title: "Notifications",
    referenceImage: "brand/reference-styles/youtube/13-notifications.png",
    useCases: ["jobs", "leads", "sales", "email results", "client wins", "applications"],
    semanticMechanic: "Stacked notification proof turns an abstract result into something instantly visible and believable.",
    composition: {
      layout: "Creator on left with laptop foreground; stacked notification cards dominate the right side.",
      primarySubject: "Focused creator looking toward proof cards or laptop.",
      supportingElements: ["three notification cards", "one curved arrow", "clean neutral room", "laptop foreground"],
      depth: "Laptop and creator sit in foreground; notifications float above background with soft shadows."
    },
    layers: ["neutral room background", "creator on left", "laptop foreground", "stacked notification cards", "top claim", "curved arrow"],
    textSystem: {
      role: "Top claim sets scale; notification cards provide proof.",
      placement: "Large top headline, proof cards stacked mid-right.",
      typography: "Light italic headline with soft shadow; notification text clean UI sans.",
      maxWords: 5
    },
    visualRules: ["clean proof UI", "stacked cards", "soft shadows", "one arrow", "calm credible face"],
    promptRules: ["Create 2-3 large readable notification cards.", "Make the cards the proof, not decoration.", "Use one top claim only."],
    negativeRules: ["No tiny notification text.", "Do not add more than three cards.", "Avoid messy app interfaces."]
  },
  {
    slug: "brain-rot-podcast",
    title: "Brain ROT podcast",
    referenceImage: "brand/reference-styles/youtube/14-brain-rot-podcast.png",
    useCases: ["culture", "social media", "podcast warning", "attention", "AI tools"],
    semanticMechanic: "Two-person podcast debate plus a symbolic center object frames the topic as a cultural warning.",
    composition: {
      layout: "Two large podcast faces on left and right, symbolic object centered above a bottom headline.",
      primarySubject: "Two expressive podcast participants facing inward around one symbolic object.",
      supportingElements: ["microphone", "social/app icons or symbolic object", "dark vignette", "yellow warning strip"],
      depth: "Faces and microphone sit forward; center object floats behind headline."
    },
    layers: ["dark podcast background", "left face", "right face with microphone", "center symbolic object", "bottom white headline", "yellow emphasis block"],
    textSystem: {
      role: "Bottom headline states the warning; yellow block carries the dangerous keyword.",
      placement: "Bottom third, stacked with one yellow emphasized phrase.",
      typography: "Extra-bold uppercase sans; white top line and black text on yellow block.",
      maxWords: 6
    },
    visualRules: ["podcast proof", "symbolic center object", "warning contrast", "yellow keyword block", "faces looking engaged"],
    promptRules: ["Use two people if available; otherwise use one host plus a symbolic object.", "Make the center object explain the threat.", "Keep the yellow block for the dangerous keyword only."],
    negativeRules: ["Do not overcrowd with many icons.", "Do not turn it into a medical ad.", "Avoid tiny app labels."]
  },
  {
    slug: "gaming-card",
    title: "Gaming Card",
    referenceImage: "brand/reference-styles/youtube/15-gaming-card.png",
    useCases: ["gaming", "loot", "skins", "deals", "hidden item", "challenge"],
    semanticMechanic: "A huge game card, shocked face, and arrow create instant curiosity around a valuable or surprising item.",
    composition: {
      layout: "Oversized rounded game card on left; shocked creator face fills right; giant arrow points to the card value.",
      primarySubject: "Game item/card and exaggerated reaction face.",
      supportingElements: ["bright cyan/green background", "large red arrow", "item price/value", "thick white card border"],
      depth: "Card sits as a UI layer; face is a clean cutout on the right."
    },
    layers: ["bright gradient game background", "large item card", "price/value text", "red arrow", "shocked face cutout"],
    textSystem: {
      role: "The card label/value is the hook; extra headline is usually unnecessary.",
      placement: "Inside the game card near lower-left; arrow points to the value.",
      typography: "Bold game UI sans, white/yellow, large enough for mobile.",
      maxWords: 4
    },
    visualRules: ["bright saturated colors", "large arrow", "oversized game card", "exaggerated emotion", "simple UI"],
    promptRules: ["Make one game card the dominant object.", "Use one giant arrow pointing to the surprising value/item.", "Keep the reaction face large and clean."],
    negativeRules: ["No tiny game UI clutter.", "Do not use multiple arrows.", "Avoid realistic muted colors."]
  },
  {
    slug: "story-cards",
    title: "Story Cards",
    referenceImage: "brand/reference-styles/youtube/16-story-cards.png",
    useCases: ["storytelling", "social media analysis", "viral breakdown", "creator strategy", "case studies"],
    semanticMechanic: "Floating story cards around a serious face show multiple examples while the headline names the pattern.",
    composition: {
      layout: "Centered serious face with floating tilted content cards on both sides over a split color grid background.",
      primarySubject: "Calm analyst face centered, often monochrome or muted.",
      supportingElements: ["floating social/video cards", "view counts or tiny play markers", "teal/red split background", "large bottom headline"],
      depth: "Cards float behind and around the face; headline anchors the bottom foreground."
    },
    layers: ["grid background split teal/red", "floating story cards", "central face", "bottom headline", "subtle glow/vignette"],
    textSystem: {
      role: "Headline names the viral pattern being explained.",
      placement: "Large bottom text across the width.",
      typography: "Bold uppercase white sans with subtle shadow.",
      maxWords: 4
    },
    visualRules: ["central authority face", "floating proof cards", "split color tension", "bottom headline", "analysis mood"],
    promptRules: ["Use 3-4 floating cards maximum.", "Make cards feel like examples, not the main text.", "Keep the central face calm and serious."],
    negativeRules: ["Do not add too many cards.", "Avoid unreadable screenshots.", "Do not cover the eyes with cards."]
  },
  {
    slug: "floating-proof",
    title: "Floating Proof",
    referenceImage: "brand/reference-styles/youtube/17-floating-proof.png",
    useCases: ["income proof", "SaaS", "dashboard", "case study", "analytics", "business result"],
    semanticMechanic: "A dashboard screenshot plus huge yellow metric banner makes the promised outcome feel concrete.",
    composition: {
      layout: "Large laptop/dashboard on left, presenter face on right, huge yellow metric banner across bottom.",
      primarySubject: "Proof interface and presenter explaining it.",
      supportingElements: ["dashboard/laptop screen", "curved arrow", "dark grid background", "oversized metric"],
      depth: "Laptop and face are midground; yellow banner dominates foreground."
    },
    layers: ["dark grid background", "laptop/dashboard", "yellow arrow", "presenter face", "huge yellow metric banner"],
    textSystem: {
      role: "The metric is the click trigger and must be the largest element.",
      placement: "Bottom banner across almost full width.",
      typography: "Massive black bold sans on neon yellow banner.",
      maxWords: 3
    },
    visualRules: ["giant metric", "proof screenshot", "neon yellow banner", "dark tech background", "direct eye contact"],
    promptRules: ["Make the bottom metric banner dominate the thumbnail.", "Use one proof screen only.", "Add one arrow from presenter/proof to the key result."],
    negativeRules: ["No dense dashboard details.", "No multiple competing numbers.", "Avoid small unreadable UI labels."]
  },
  {
    slug: "educational",
    title: "Educational",
    referenceImage: "brand/reference-styles/youtube/18-educational.png",
    useCases: ["education", "framework", "analytics", "creator advice", "market explanation"],
    semanticMechanic: "A clean graph-board plus presenter pointing turns an abstract lesson into a simple visual framework.",
    composition: {
      layout: "White grid/graph board fills background; presenter cutout on right points to a simple chart and headline.",
      primarySubject: "Presenter pointing at one chart or diagram.",
      supportingElements: ["hand-drawn axis", "growth curve", "circled insight", "large concept title"],
      depth: "Graph board is flat and clean; presenter overlaps it in foreground."
    },
    layers: ["white grid board", "hand-drawn axis", "simple curve", "circled insight", "large black title", "presenter pointing"],
    textSystem: {
      role: "Title names the concept; chart makes the lesson memorable.",
      placement: "Large center-left title, chart marks around it.",
      typography: "Bold black educational sans; optional hand-drawn labels.",
      maxWords: 4
    },
    visualRules: ["clean white grid", "one simple chart", "one circled insight", "presenter pointing", "high readability"],
    promptRules: ["Use exactly one simple graph or framework.", "Make the title readable at mobile size.", "Keep hand-drawn marks sparse and intentional."],
    negativeRules: ["No dense infographic.", "No tiny handwriting.", "Do not add multiple charts."]
  }
];

export function findYoutubeStyleProfile(slug: string) {
  return YOUTUBE_STYLE_PROFILES.find((profile) => profile.slug === slug);
}

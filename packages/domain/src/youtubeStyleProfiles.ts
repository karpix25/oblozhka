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
      role: "The number or timeframe is the click trigger.",
      placement: "Center stack, with number isolated inside a yellow box.",
      typography: "Condensed bold uppercase; yellow box for countdown.",
      maxWords: 7
    },
    visualRules: ["number-first readability", "urgent contrast", "symmetrical face balance", "no decorative noise"],
    promptRules: ["Include a strong numeric promise or deadline.", "Make the number the most memorable element.", "Use black/yellow/white only unless a brand accent is required."],
    negativeRules: ["Do not bury the number.", "Do not use more than one highlight color.", "Do not add long sentences."]
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
      supportingElements: ["large number", "simple icons", "line/underline", "one arrow or connector"],
      depth: "Presenter overlaps the board edge; board remains clean and flat."
    },
    layers: ["soft room background", "presenter", "whiteboard panel", "large number", "icons", "blue underline or connector"],
    textSystem: {
      role: "The board is the hook and the explanation at once.",
      placement: "Inside board area, top-heavy with icons below.",
      typography: "Bold black sans for number; simple icon labels if needed.",
      maxWords: 4
    },
    visualRules: ["white clean surface", "one blue accent", "large readable number", "educational icons", "marker in hand"],
    promptRules: ["Create a teachable diagram, not a complex infographic.", "Use only 2-3 icons.", "Make the main claim readable instantly."],
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
    useCases: ["biography", "sports story", "crime-to-success arc", "origin story"],
    semanticMechanic: "A split identity and opposing worlds show transformation or hidden backstory.",
    composition: {
      layout: "Central subject split vertically into two identities, with different worlds left and right.",
      primarySubject: "Face/body split down the middle, one side past/context, one side present/status.",
      supportingElements: ["crime scene or origin environment", "stadium or success environment", "torn paper seam"],
      depth: "Subject cutout sits above both backgrounds; split seam is tactile and central."
    },
    layers: ["left contextual world", "right aspirational world", "central split subject", "torn seam", "symbolic props", "small name/logo if relevant"],
    textSystem: {
      role: "Text is optional; the visual contrast carries the story.",
      placement: "Minimal bottom badge or none.",
      typography: "If used, bold condensed with gritty texture.",
      maxWords: 3
    },
    visualRules: ["dramatic split", "high contrast worlds", "cinematic lighting", "symbolic storytelling", "sharp subject cutout"],
    promptRules: ["Represent two life chapters in one face/body.", "Use clear left-right contrast.", "Make the seam visible and central."],
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
      role: "Usually no text; objects and expression explain the challenge.",
      placement: "Only use tiny screen text if naturally part of the object.",
      typography: "Avoid overlay text unless needed.",
      maxWords: 0
    },
    visualRules: ["wide-angle close-up", "foreground objects", "surprised expression", "natural but bright lighting"],
    promptRules: ["Use hands as composition anchors.", "Make the object readable at small size.", "Show the emotional reaction clearly."],
    negativeRules: ["Do not add external headline text.", "Do not hide the object.", "Avoid neutral facial expression."]
  },
  {
    slug: "contextual-background",
    title: "Contextual Background",
    referenceImage: "brand/reference-styles/youtube/10-contextual-background.png",
    useCases: ["mystery", "travel", "danger", "discovery", "documentary"],
    semanticMechanic: "A creator reacts inside a high-concept scene that visually states the question.",
    composition: {
      layout: "Creator cutout on one side, large contextual scene and symbolic danger/object on the other.",
      primarySubject: "Presenter reacting with concern or curiosity.",
      supportingElements: ["landmark or environment", "danger sign", "hole/door/pathway", "clear focal object"],
      depth: "Creator in foreground; scene extends deep into background."
    },
    layers: ["large environment", "foreground creator", "main mystery object", "warning/sign symbol", "depth haze/light"],
    textSystem: {
      role: "Text is unnecessary if the scene creates the question.",
      placement: "No overlay text by default.",
      typography: "None unless topic absolutely requires one short label.",
      maxWords: 2
    },
    visualRules: ["big readable environment", "symbolic threat or mystery", "clear facial emotion", "bright documentary look"],
    promptRules: ["Make the background itself explain the topic.", "Use one symbolic prop to create curiosity.", "Keep the creator large enough for emotion."],
    negativeRules: ["No random fantasy elements.", "No cluttered background.", "No small signs that cannot be read."]
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
  }
];

export function findYoutubeStyleProfile(slug: string) {
  return YOUTUBE_STYLE_PROFILES.find((profile) => profile.slug === slug);
}

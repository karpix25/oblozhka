export type VerticalStyleProfile = {
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

export const VERTICAL_STYLE_PROFILES: VerticalStyleProfile[] = [
  {
    slug: "vertical-timeline",
    title: "Timeline",
    referenceImage: "brand/reference-styles/vertical/01-timeline.png",
    useCases: ["travel story", "creator workflow", "tutorial sequence", "before journey"],
    semanticMechanic: "A vertical timeline collage explains a multi-step story with one large concept title and proof frames.",
    composition: {
      layout: "Large title in the upper third, a horizontal strip of small story frames below, creator in the lower half.",
      primarySubject: "Creator looking or pointing toward the timeline strip.",
      supportingElements: ["3-4 small image frames", "dark gradient background", "small thought or pointer icon"],
      depth: "Frames sit as a mid-layer; creator is foreground with a soft glow behind the head."
    },
    layers: ["dark background", "large title", "image strip", "creator portrait", "small reaction icon", "bottom fade"],
    textSystem: {
      role: "The title names the method or journey; small frames prove that it has steps.",
      placement: "Upper third, centered, with one highlighted keyword.",
      typography: "Bold clean sans, white plus one yellow highlight word.",
      maxWords: 4
    },
    visualRules: ["9:16 vertical hierarchy", "large top title", "3-4 frames maximum", "dark premium glow", "creator eye-line points to story"],
    promptRules: ["Use a clear sequence of small proof frames.", "Keep the creator below the frames.", "Make one keyword brighter than the rest."],
    negativeRules: ["No crowded collage.", "No tiny captions in the frames.", "Do not place the face behind the title."]
  },
  {
    slug: "vertical-podcast",
    title: "Podcast",
    referenceImage: "brand/reference-styles/vertical/02-vertical-podcast.png",
    useCases: ["podcast quote", "expert prediction", "personal statement", "interview insight"],
    semanticMechanic: "A close podcast portrait plus one oversized quote makes the short feel like a decisive statement.",
    composition: {
      layout: "Close-up face fills the upper half; microphone and hands stay low; huge text block crosses the middle.",
      primarySubject: "Podcast speaker with expressive eyes and studio lighting.",
      supportingElements: ["microphone", "dark studio background", "one red emphasis banner"],
      depth: "Text overlays the torso; face stays unobstructed and dominant."
    },
    layers: ["dark studio background", "close-up face", "microphone", "red text banner", "white lower text"],
    textSystem: {
      role: "The quote is the cover; the portrait gives authority and emotion.",
      placement: "Middle third, stacked over torso, never over the eyes.",
      typography: "Extra-bold sans, white text, one red rectangle behind the key word.",
      maxWords: 5
    },
    visualRules: ["tight crop", "face readable", "podcast microphone visible", "red highlight strip", "very large text"],
    promptRules: ["Make the quote short and declarative.", "Place the red banner behind only the strongest word.", "Keep the face in the upper half."],
    negativeRules: ["No small subtitles.", "No multiple quote blocks.", "Do not cover eyes with text."]
  },
  {
    slug: "holding-card",
    title: "Holding Card",
    referenceImage: "brand/reference-styles/vertical/03-holding-card.png",
    useCases: ["confession", "storytime", "personal trauma", "proof note", "challenge"],
    semanticMechanic: "A person holding a handwritten card turns the cover into a direct confession or proof moment.",
    composition: {
      layout: "Seated subject centered, card held in the lower middle, dark background with one color accent.",
      primarySubject: "Person looking straight at camera while holding the card.",
      supportingElements: ["plain white paper card", "handwritten short sentence", "simple studio chair/background"],
      depth: "Card is foreground and partly overlaps hands; face remains sharp above it."
    },
    layers: ["dark background", "seated person", "hands", "white card", "handwritten card text", "subtle side light"],
    textSystem: {
      role: "The card carries the hook as if it is real evidence.",
      placement: "Written naturally on the physical card.",
      typography: "Handwritten marker style, dark gray or black, large enough to read.",
      maxWords: 8
    },
    visualRules: ["confessional mood", "real paper texture", "direct eye contact", "minimal background", "high card readability"],
    promptRules: ["Put the hook on the physical card, not as a floating overlay.", "Use a serious or vulnerable expression.", "Keep the card fully visible."],
    negativeRules: ["Do not add separate overlay text.", "Do not make handwriting tiny.", "Avoid smiling stock-photo energy."]
  },
  {
    slug: "vertical-background",
    title: "Background",
    referenceImage: "brand/reference-styles/vertical/04-background.png",
    useCases: ["extreme experience", "engineering", "travel", "dangerous test", "spectacle"],
    semanticMechanic: "A giant real-world background event plus a reacting creator creates instant scale and danger.",
    composition: {
      layout: "Huge background object/event occupies most of the frame; creator cutout is on one side reacting to it.",
      primarySubject: "Creator in the foreground, reacting with fear, shock, or excitement.",
      supportingElements: ["single massive object", "bright effect or motion", "clean sky or simple environment"],
      depth: "Background object is huge; creator overlaps it in foreground for scale."
    },
    layers: ["large environment", "massive object/event", "light or motion effect", "creator cutout", "foreground ground detail"],
    textSystem: {
      role: "The image should carry the hook; text is optional.",
      placement: "No text by default, unless one short label is needed.",
      typography: "If used, bold white uppercase with shadow.",
      maxWords: 2
    },
    visualRules: ["one giant object", "clear reaction", "bright readable scene", "scale contrast", "minimal text"],
    promptRules: ["Make the background event physically huge.", "Use one clear reaction pose.", "Keep the scene simple enough for a vertical feed."],
    negativeRules: ["No cluttered background.", "No multiple unrelated objects.", "Avoid adding a headline when the scene explains itself."]
  },
  {
    slug: "vertical-simple-text",
    title: "Simple Text",
    referenceImage: "brand/reference-styles/vertical/05-vertical-simple-text.png",
    useCases: ["expert lesson", "motivation", "podcast quote", "personal brand"],
    semanticMechanic: "A raw close-up plus two-line caption feels native to Shorts/Reels and keeps the message instantly readable.",
    composition: {
      layout: "Face fills upper two-thirds; big two-line text sits in the lower third.",
      primarySubject: "Creator or expert close to camera in a real room.",
      supportingElements: ["headphones or mic if relevant", "soft dark background", "one yellow keyword"],
      depth: "Text sits on top of the lower body; face remains unobstructed."
    },
    layers: ["real video still", "subtle dark overlay", "large yellow keyword", "white supporting line"],
    textSystem: {
      role: "Short caption states the insight directly.",
      placement: "Lower third, centered.",
      typography: "Bold sans, key word in yellow, supporting words in white.",
      maxWords: 5
    },
    visualRules: ["native vertical video look", "large lower-third text", "one yellow keyword", "simple background", "face close-up"],
    promptRules: ["Use only one strong phrase.", "Make the yellow word the emotional trigger.", "Keep text away from the face."],
    negativeRules: ["No decorative stickers.", "No top and bottom captions at once.", "No tiny text."]
  },
  {
    slug: "vertical-3d-interface",
    title: "3D Interface",
    referenceImage: "brand/reference-styles/vertical/06-3d-interface.png",
    useCases: ["AI tool", "creative workflow", "app feature", "music", "software trick"],
    semanticMechanic: "Floating 3D UI panels make a software action feel futuristic and tactile.",
    composition: {
      layout: "Creator centered mid-frame, large 3D headline in the lower half, floating UI panels around them.",
      primarySubject: "Creator interacting with transparent interface elements.",
      supportingElements: ["floating menus", "app icon or tool tile", "motion trails", "dark studio"],
      depth: "UI panels float in front and behind the creator with strong perspective."
    },
    layers: ["dark room", "creator", "transparent UI panels", "app icon", "large 3D headline", "glow and motion blur"],
    textSystem: {
      role: "The large action phrase names the trick.",
      placement: "Lower middle, stacked in 2 lines.",
      typography: "Heavy 3D block sans, warm accent on top word, white lower word.",
      maxWords: 3
    },
    visualRules: ["futuristic UI depth", "dark cinematic lighting", "large 3D typography", "one app/tool anchor", "motion blur"],
    promptRules: ["Make interface panels feel spatial, not flat screenshots.", "Use one recognizable tool tile only.", "Keep the main phrase huge."],
    negativeRules: ["No cluttered dashboard.", "No tiny UI text.", "Do not make the creator disappear behind panels."]
  },
  {
    slug: "kling-2-6",
    title: "Kling 2.6",
    referenceImage: "brand/reference-styles/vertical/07-kling-2-6.png",
    useCases: ["AI video model", "new tool release", "cinematic AI", "tech news"],
    semanticMechanic: "Cinematic characters plus model-name typography make a tool update feel like a movie event.",
    composition: {
      layout: "Two cinematic characters in the lower half, glowing action window behind them, large model name at bottom.",
      primarySubject: "Characters looking upward toward the generated scene or launch event.",
      supportingElements: ["rocket/portal/video window", "dark outdoor atmosphere", "lime accent text"],
      depth: "The glowing event sits behind the people; text anchors the bottom foreground."
    },
    layers: ["cinematic background", "glowing AI scene window", "two characters", "small lime label", "huge model title", "bottom subtitle"],
    textSystem: {
      role: "Model name is the main recognition trigger.",
      placement: "Bottom third, centered.",
      typography: "Huge white block sans, lime supporting words.",
      maxWords: 4
    },
    visualRules: ["movie-poster drama", "AI model name huge", "lime accent", "characters looking up", "glowing generated scene"],
    promptRules: ["Use a cinematic generated scene behind the subjects.", "Make the model/tool name the largest text.", "Keep the palette dark with lime highlights."],
    negativeRules: ["No tiny release notes.", "No flat app screenshot.", "Avoid generic sci-fi clutter."]
  },
  {
    slug: "action-scene",
    title: "Action Scene",
    referenceImage: "brand/reference-styles/vertical/08-action-scene.png",
    useCases: ["cinematic story", "movie-style short", "AI action scene", "drama"],
    semanticMechanic: "A first-person action moment pulls the viewer into danger before any text is needed.",
    composition: {
      layout: "Foreground impact/action occupies the bottom-left or center; background fight/action remains blurred.",
      primarySubject: "Immediate action toward camera, with a strong facial reaction or motion.",
      supportingElements: ["background conflict", "dramatic overhead light", "motion blur"],
      depth: "Extreme foreground punch or object is sharp; background action is blurred but readable."
    },
    layers: ["cinematic room", "background action group", "foreground attacker/impact", "motion blur", "overhead spotlight"],
    textSystem: {
      role: "No text by default; the action is the hook.",
      placement: "None unless a tiny title is required.",
      typography: "None.",
      maxWords: 0
    },
    visualRules: ["first-person energy", "motion blur", "foreground impact", "clear danger", "cinematic lighting"],
    promptRules: ["Create a dynamic moment frozen mid-action.", "Keep the strongest action in the foreground.", "Make the background readable but secondary."],
    negativeRules: ["No overlay text.", "No static posing.", "Avoid gore or graphic injury."]
  },
  {
    slug: "laying-down",
    title: "Laying Down",
    referenceImage: "brand/reference-styles/vertical/09-laying-down.png",
    useCases: ["creative work", "game design", "personal project", "music", "craft"],
    semanticMechanic: "Top-down creator scene turns a project into a tactile workspace with objects as proof.",
    composition: {
      layout: "Top-down shot of creator lying or sitting on a textured surface surrounded by topic objects.",
      primarySubject: "Creator centered, looking up or relaxed, framed by tools and references.",
      supportingElements: ["sketches", "camera gear", "notes", "props tied to the project"],
      depth: "Everything is flat-lay readable; large text overlays lower middle."
    },
    layers: ["textured floor/rug", "creator full body", "surrounding props", "white title", "yellow handwritten subtitle", "soft glow"],
    textSystem: {
      role: "Title names the project; handwritten subtitle makes it feel personal.",
      placement: "Middle-to-lower third over legs/body area.",
      typography: "White bold condensed title plus yellow hand-drawn script accent.",
      maxWords: 4
    },
    visualRules: ["top-down composition", "organized creative clutter", "large central text", "warm editorial texture", "full-body framing"],
    promptRules: ["Arrange objects around the creator to explain the topic.", "Use a true overhead camera angle.", "Make the subtitle feel handwritten and energetic."],
    negativeRules: ["No random props.", "Do not crop out too much of the body.", "Avoid flat empty backgrounds."]
  },
  {
    slug: "big-action",
    title: "Big Action",
    referenceImage: "brand/reference-styles/vertical/10-big-action.png",
    useCases: ["fitness", "challenge", "sport", "bold call to action", "lifestyle"],
    semanticMechanic: "A giant physical pose and huge command text create immediate kinetic energy.",
    composition: {
      layout: "Low-angle subject jumps or falls toward camera; huge text sits behind the body.",
      primarySubject: "Full-body action pose with one foot or hand exaggerated near lens.",
      supportingElements: ["clean bright sky/background", "sun flare", "large white command text"],
      depth: "Limb closest to camera is oversized; text is behind the subject."
    },
    layers: ["bright simple background", "large white text", "action body cutout", "foreground shoe/limb", "sun flare"],
    textSystem: {
      role: "A short command or promise amplifies the action.",
      placement: "Upper-middle behind the subject.",
      typography: "Huge italic block sans, white, slightly slanted.",
      maxWords: 3
    },
    visualRules: ["low-angle lens", "oversized foreground limb", "clean color background", "big action text", "high energy"],
    promptRules: ["Use strong perspective distortion.", "Place text behind the subject.", "Keep the background uncluttered."],
    negativeRules: ["No small captions.", "No static standing pose.", "Do not hide the body behind text."]
  },
  {
    slug: "floating-object",
    title: "Floating Object",
    referenceImage: "brand/reference-styles/vertical/11-floating-object.png",
    useCases: ["AI product", "science", "tool review", "object reveal", "tech demo"],
    semanticMechanic: "A glowing oversized object makes a tool or product feel magical and high-value.",
    composition: {
      layout: "Creator on one side reaching toward a huge floating object; title occupies the top.",
      primarySubject: "Oversized glowing object as the main hero.",
      supportingElements: ["lab or tech room", "hologram base", "cyan/yellow glow", "creator hand interaction"],
      depth: "Object floats in front of creator with luminous rim; background is dark and technical."
    },
    layers: ["dark tech background", "top title", "creator", "glowing floating object", "hologram base", "cyan UI glow"],
    textSystem: {
      role: "Title names the object/product and frames it as a premium reveal.",
      placement: "Top third, centered.",
      typography: "Huge condensed sans, neon yellow, strong glow.",
      maxWords: 4
    },
    visualRules: ["single oversized object", "neon glow", "creator interaction", "dark lab feel", "top title"],
    promptRules: ["Make the floating object the largest visual element.", "Use glow to separate it from background.", "Show the creator reacting or reaching toward it."],
    negativeRules: ["No multiple hero objects.", "No flat product photo.", "Do not let text compete with the object."]
  },
  {
    slug: "background-split",
    title: "Background Split",
    referenceImage: "brand/reference-styles/vertical/12-background-split.png",
    useCases: ["future of work", "AI education", "tool overview", "platform explainer"],
    semanticMechanic: "A split between interface cards and a speaker creates a polished explainer poster.",
    composition: {
      layout: "Top half contains floating UI cards; middle has elegant title; lower half has presenter in studio.",
      primarySubject: "Presenter at bottom speaking into a microphone.",
      supportingElements: ["4 interface cards", "dark tech background", "thin border or frame", "premium serif title"],
      depth: "Cards float above; title bridges the cards and presenter."
    },
    layers: ["dark framed background", "top UI cards", "large editorial title", "presenter", "desk props", "soft studio lights"],
    textSystem: {
      role: "Title makes the topic feel like a category shift or future trend.",
      placement: "Middle third, centered.",
      typography: "Elegant serif headline plus bold sans support line.",
      maxWords: 5
    },
    visualRules: ["top-bottom split", "premium UI cards", "editorial title", "presenter bottom", "dark framed poster"],
    promptRules: ["Use exactly four top cards.", "Keep the title elegant and centered.", "Make the presenter feel like a serious explainer."],
    negativeRules: ["No messy UI screenshots.", "No crowded lower third.", "Do not use bright cartoon colors."]
  },
  {
    slug: "vertical-object-in-hand",
    title: "Object in hand",
    referenceImage: "brand/reference-styles/vertical/13-vertical-object-in-hand.png",
    useCases: ["prize", "giveaway", "food", "money", "challenge reward", "product reveal"],
    semanticMechanic: "A smiling creator holding the reward object in front of a value background makes the offer tangible.",
    composition: {
      layout: "Creator centered; large held object in the foreground; proof/value background fills the frame.",
      primarySubject: "Creator smiling with the object held toward the viewer.",
      supportingElements: ["money, prize, product, or reward background", "clean studio lighting", "foreground object detail"],
      depth: "Object overlaps the torso; background communicates abundance or context."
    },
    layers: ["value/proof background", "creator portrait", "held object", "foreground detail", "soft subject shadow"],
    textSystem: {
      role: "The object and background should explain the premise; text is optional.",
      placement: "No overlay text by default.",
      typography: "None unless one short label is required.",
      maxWords: 2
    },
    visualRules: ["held object foreground", "smiling creator", "value-heavy background", "bright clean lighting", "simple vertical frame"],
    promptRules: ["Make the held object crisp and large.", "Use the background to explain the value or stakes.", "Keep the creator centered and trustworthy."],
    negativeRules: ["No extra captions unless necessary.", "Do not hide the object.", "Avoid clutter over the face."]
  }
];

export function findVerticalStyleProfile(slug: string) {
  return VERTICAL_STYLE_PROFILES.find((profile) => profile.slug === slug);
}

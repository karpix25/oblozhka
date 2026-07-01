import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeReport(outputDir, results, meta) {
  const cards = results.map((result) => templateCard(outputDir, result)).join("\n");
  await writeFile(join(outputDir, "index.html"), `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Local Template Test</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #111; color: #eee; }
    main { max-width: 1200px; margin: 0 auto; padding: 32px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    .meta { color: #aaa; line-height: 1.5; margin-bottom: 28px; }
    .card { border-top: 1px solid #333; padding: 28px 0; }
    h2 { font-size: 24px; margin: 0 0 10px; }
    h2 span { color: #888; font-size: 16px; font-weight: 400; }
    .hook { color: #ffd84d; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    figure { margin: 0; }
    img { width: 100%; display: block; border-radius: 8px; background: #222; }
    .error div { min-height: 240px; display: grid; place-items: center; padding: 18px; border: 1px solid #552; border-radius: 8px; color: #ffb4a8; background: #241818; }
    figcaption { margin-top: 8px; color: #aaa; }
    pre { white-space: pre-wrap; background: #1c1c1c; padding: 16px; border-radius: 8px; color: #ddd; }
  </style>
</head>
<body>
  <main>
    <h1>Local Template Test</h1>
    <div class="meta">
      Reel: ${escapeHtml(meta.reelUrl)}<br>
      Face: ${escapeHtml(meta.facePath)}<br>
      Transcript chars: ${escapeHtml(meta.transcriptLength)}
    </div>
    ${cards}
  </main>
</body>
</html>`);
}

function templateCard(outputDir, result) {
  return `
    <section class="card">
      <h2>${escapeHtml(result.index)}. ${escapeHtml(result.title)} <span>${escapeHtml(result.slug)}</span></h2>
      <p class="hook">${escapeHtml(result.hook)}</p>
      <div class="grid">
        <figure><img src="${relative(outputDir, result.templatePath)}"><figcaption>Reference</figcaption></figure>
        ${generatedFigure(outputDir, result)}
      </div>
      <pre>${escapeHtml(JSON.stringify(result.review, null, 2))}</pre>
    </section>
  `;
}

function generatedFigure(outputDir, result) {
  if (result.outputPath) {
    return `<figure><img src="${relative(outputDir, result.outputPath)}"><figcaption>Generated</figcaption></figure>`;
  }
  return `<figure class="error"><div>${escapeHtml(result.error ?? "Generation failed")}</div><figcaption>Generated</figcaption></figure>`;
}

function relative(fromDir, file) {
  return file.startsWith(fromDir) ? file.slice(fromDir.length + 1) : file;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

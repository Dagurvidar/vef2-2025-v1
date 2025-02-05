import fs from "node:fs/promises";
import path from "node:path";

const INDEX_PATH = "./data/index.json";
const DIST_DIR = "./dist";

/**
 * Les skrá og skilar gögnum eða null.
 * @param {string} filePath Skráin sem á að lesa
 * @returns {Promise<unknown | null>} Les skrá úr `filePath` og skilar innihaldi. Skilar `null` ef villa kom upp.
 */
async function readJson(filePath) {
  console.log("starting to read", filePath);
  let data;
  try {
    data = await fs.readFile(path.resolve(filePath), "utf-8");
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }

  try {
    const parsed = JSON.parse(data);
    return parsed;
  } catch (error) {
    console.error("error parsing data as json", error);
    return null;
  }
}

async function generateIndex() {
  const indexData = await readJson(INDEX_PATH);
  console.log("Loaded index.json:", indexData);

  if (!indexData || !Array.isArray(indexData)) {
    console.error("Error: index.json is missing or invalid.");
    return;
  }

  // Validate and filter valid categories
  const validCategories = await Promise.all(
    indexData.map(async (category) => {
      console.log(category.file);
      if (!category?.file || !category?.title) {
        console.log(
          `Skipping category ${JSON.stringify(
            category
          )} - Missing file or title.`
        );
        return null;
      }

      const validation = await validateQuizFile(`./data/${category.file}`);
      if (!validation.valid) {
        console.error(validation.error);
        return null;
      }

      return category;
    })
  );

  // Remove null values (invalid categories)
  const filteredCategories = validCategories.filter(Boolean);

  // Generate the HTML content
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="is">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quiz Categories</title>
      <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
      <h1>Quiz Categories</h1>
      <ul>
          ${filteredCategories
            .map(
              (category) =>
                `<li><a href="${category.file.replace(".json", ".html")}">${
                  category.title
                }</a></li>`
            )
            .join("")}
      </ul>
  </body>
  </html>`;

  await writeHtml("index.html", htmlContent);
}

/**
 * Validate the quiz data file.
 * @param {string} filePath - Path to the json file.
 * @returns {Promise<{valid: boolean, data: object | null, error?: string}>}
 */
async function validateQuizFile(filePath) {
  const data = await readJson(filePath);

  if (!data) {
    console.log(`❌ File ${filePath} does not exist.`);
    return {
      valid: false,
      data: null,
      error: `❌ Error: File ${filePath} does not exist.`,
    };
  }

  if (
    !data.title ||
    !Array.isArray(data.questions) ||
    data.questions.length === 0
  ) {
    console.log(
      `❌ File ${filePath} is missing a title or has no valid questions.`
    );
    return {
      valid: false,
      data: null,
      error: `❌ Error: ${filePath} is missing 'title' or has an invalid 'questions' array.`,
    };
  }

  // Filter out invalid answers but keep the file
  let hasInvalidAnswers = false;
  data.questions.forEach((q) => {
    if (!q.question || !Array.isArray(q.answers)) {
      console.error(
        `❌ Skipping question "${
          q.question || "UNKNOWN"
        }" in ${filePath} - Invalid answers format.`
      );
      return;
    }

    // Remove invalid answers
    q.answers = q.answers.filter((a) => {
      if (!("answer" in a) || typeof a.correct !== "boolean") {
        console.error(
          `❌ Removing invalid answer in question: "${q.question}" in ${filePath}.`
        );
        hasInvalidAnswers = true;
        return false; // Skip this answer
      }
      return true; // Keep valid answers
    });
  });

  if (hasInvalidAnswers) {
    console.log(
      `⚠️ File ${filePath} had some invalid answers that were removed.`
    );
  }

  return { valid: true, data };
}

async function generateCategories() {
  const indexData = await readJson(INDEX_PATH);
  if (!indexData) return;

  for (const category of indexData) {
    const categoryData = await readJson(`./data/${category.file}`);

    // Check if categoryData is valid
    if (!categoryData || !categoryData.questions) {
      console.error(
        `Skipping category "${category.title}" - Invalid or missing questions.`
      );
      continue; // Skip this category
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${categoryData.title}</title>
        <link rel="stylesheet" href="./styles.css">
        <script defer src="script.js"></script>
    </head>
    <body>
        <h1>${categoryData.title}</h1>
        <div id="quiz-container">
            ${categoryData.questions
              .filter((q) => Array.isArray(q.answers)) // Ensure valid questions
              .map(
                (q, qIndex) => `
                <div class="question">
                    <p>${q.question}</p>
                    <ul>
                        ${q.answers
                          .map(
                            (a, aIndex) => `
                            <li>
                                <input type="radio" name="q${qIndex}" id="q${qIndex}-${aIndex}" data-correct="${a.correct}">
                                <label for="q${qIndex}-${aIndex}">${a.answer}</label>
                            </li>`
                          )
                          .join("")}
                    </ul>
                </div>`
              )
              .join("")}
            <button onclick="checkAnswers()">Check Answers</button>
        </div>
    </body>
    </html>`;

    await writeHtml(category.file.replace(".json", ".html"), htmlContent);
  }
}

/**
 * Skrifar HTML skrá með gögnunum sem koma inn.
 * @param {string} fileName Nafn á HTML skránni sem á að skrifa (dæmi: "index.html")
 * @param {string} htmlContent HTML innihald sem á að skrifa í skrána.
 * @returns {Promise<void>} Engin return gildi, skrifar HTML skrá í `dist/`
 */
async function writeHtml(fileName, htmlContent) {
  try {
    await fs.mkdir(DIST_DIR, { recursive: true });
    const filePath = path.join(DIST_DIR, fileName);
    await fs.writeFile(filePath, htmlContent, "utf-8");

    console.log(`${fileName} created successfully!`);
  } catch (error) {
    console.error(`Error writing ${fileName}:`, error);
  }
}

async function copyStyles() {
  try {
    await fs.copyFile("./src/styles.css", "./dist/styles.css");
    console.log("✅ styles.css copied to dist/");
  } catch (error) {
    console.error("❌ Failed to copy styles.css:", error.message);
  }
}

async function main() {
  console.log("Generating HTML files...");
  await generateIndex();
  await generateCategories();
  await copyStyles();
  console.log("Build complete!");
}

main();

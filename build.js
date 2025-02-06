import fs from "node:fs/promises";
import path from "node:path";

const INDEX_PATH = "./data/index.json";
const DIST_DIR = "./dist";

/**
 * Les skrá og skilar gögnum eða null.
 * @param {string} filePath Skráin sem á að lesa
 * @returns {Promise<unknown | null>} Les skrá úr `filePath` og skilar innihaldi. Skilar `null` ef villa kom upp.
 */
export async function readJson(filePath) {
  console.log("starting to read", filePath);
  let data;
  try {
    data = await fs.readFile(path.resolve(filePath), "utf-8");
    console.log("Data read from file:", data); // Debug log
  } catch (error) {
    console.error("\t", `Error reading file ${filePath}:`, error.message);
    return null;
  }

  try {
    const parsed = JSON.parse(data);
    console.log("Parsed JSON:", parsed); // Debug log
    return parsed;
  } catch (error) {
    console.error("\t", "error parsing data as json", error);
    return null;
  }
}

async function generateIndexAndCategories() {
  const indexData = await readJson(INDEX_PATH);
  console.log("Loaded index.json:", indexData);

  if (!indexData || !Array.isArray(indexData)) {
    console.error("\t", "Error: index.json is missing or invalid.");
    return;
  }

  const validCategories = await Promise.all(
    indexData.map(async (category) => {
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
        console.error("\t", validation.error);
        return null;
      }

      return { ...category, data: validation.data };
    })
  );

  const filteredCategories = validCategories.filter(Boolean);

  const indexHtmlContent = /* html */ `
  <!DOCTYPE html>
  <html lang="is">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quiz Categories</title>
      <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <div class="wrapper">
      <div class="wrapper-content">
        <h1>Quiz Categories</h1>
        <ul>
            ${filteredCategories
              .map(
                (category) =>
                  `<li><a href="${category.file.replace(
                    ".json",
                    ".html"
                  )}">${escapeHTML(category.title)}</a></li>`
              )
              .join("")}
        </ul>
      </div>
    </div>
  </body>
  </html>`;

  await writeHtml("index.html", indexHtmlContent);
  console.log("index.html created!");

  for (const category of filteredCategories) {
    const { data: categoryData } = category;
    const categoryHtmlContent = /* html */ ` 
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>${escapeHTML(categoryData.title)}</title>
          <link rel="stylesheet" href="styles.css" />
          <script defer src="main.js"></script>
        </head>
        <body>
          <div class="wrapper">
            <div class="wrapper-content">
              <h1>${escapeHTML(categoryData.title)}</h1>
              <div id="quiz-container" class="question-container">
                ${categoryData.questions
                  .map((q, qIndex) => {
                    if (!Array.isArray(q.answers) || q.answers.length === 0) {
                      console.error(
                        "\t",
                        `Skipping question "${q.question}" in ${category.file} - No valid answers.`
                      );
                      return "";
                    }

                    return `
                    <div class="question">
                        <p>${escapeHTML(q.question)}</p>
                        <ul>
                            ${q.answers
                              .map(
                                (a, aIndex) => `
                                <li>
                                    <input type="radio" name="q${qIndex}" id="q${qIndex}-${aIndex}" data-correct="${
                                  a.correct
                                }">
                                    <label for="q${qIndex}-${aIndex}">${escapeHTML(
                                  a.answer
                                )}</label>
                                </li>`
                              )
                              .join("")}
                        </ul>
                    </div>`;
                  })
                  .join("")}
                <button class="checkAnsButton">Check Answers</button>
              </div>
            </div>
          </div>
        </body>
      </html>`;

    await writeHtml(
      category.file.replace(".json", ".html"),
      categoryHtmlContent
    );
    console.log(`${category.file.replace(".json", ".html")} created!`);
  }
}

/**
 * fjarlægir skrár sem eru ekki til eða eru af vitlausu format
 * @param {string} filePath - slóðin að json skránni.
 * @returns {Promise<{valid: boolean, data: object | null, error?: string}>}
 */
export async function validateQuizFile(filePath) {
  const data = await readJson(filePath);

  if (!data) {
    console.log(`File ${filePath} does not exist.`);
    return {
      valid: false,
      data: null,
      error: `Error: File ${filePath} does not exist.`,
    };
  }

  if (
    !data.title ||
    !Array.isArray(data.questions) ||
    data.questions.length === 0
  ) {
    console.log(
      `File ${filePath} is missing a title or has no valid questions.`
    );
    return {
      valid: false,
      data: null,
      error: `Error: ${filePath} is missing 'title' or has an invalid 'questions' array.`,
    };
  }

  // Filter out invalid answers but keep the file
  let hasInvalidAnswers = false;
  data.questions.forEach((q) => {
    if (!q.question || !Array.isArray(q.answers)) {
      console.error(
        "\t",
        `Skipping question "${
          q.question || "UNKNOWN"
        }" in ${filePath} - Invalid answers format.`
      );
      return;
    }

    // Remove invalid answers
    q.answers = q.answers.filter((a) => {
      if (
        !("answer" in a) ||
        !("correct" in a) ||
        typeof a.correct !== "boolean"
      ) {
        console.error(
          "\t",
          `Removing invalid answer in question: "${q.question}" in ${filePath}.`
        );
        hasInvalidAnswers = true;
        return false;
      }
      return true;
    });
  });

  if (hasInvalidAnswers) {
    console.log(`File ${filePath} had some invalid answers that were removed.`);
  }

  return { valid: true, data };
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
    console.error("\t", `Error writing ${fileName}:`, error);
  }
}

/**
 * Breytir html merkjum í venjulegan texta.
 * @param {string} str - strengurinn sem inniheldur html merki.
 * @returns {string} - túlkaði strengurinn
 */
function escapeHTML(str) {
  try {
    const newStr = str
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    return newStr;
  } catch (error) {
    console.log("\t could not escape HTML", str, error);
    return "";
  }
}

async function copyFiles() {
  try {
    await fs.copyFile("./src/styles.css", "./dist/styles.css");
    console.log("main.js copied to dist/");
    await fs.copyFile("./src/main.js", "./dist/main.js");
    console.log("styles.css copied to dist/");
  } catch (error) {
    console.error("\t", "Failed to copy styles.css:", error.message);
  }
}

async function main() {
  console.log("Generating HTML files...");
  await generateIndexAndCategories();
  await copyFiles();
  console.log("Build complete!");
}

main();

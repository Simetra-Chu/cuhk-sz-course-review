import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SchoolCode } from "../lib/constants";
import type { PdfRawCourse } from "../types/course-data";

const require = createRequire(import.meta.url);
const pdfjs = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js") as {
  getDocument(data: Uint8Array): Promise<{
    numPages: number;
    getPage(pageNumber: number): Promise<{
      getTextContent(): Promise<{
        items: Array<{
          str: string;
          transform: [number, number, number, number, number, number];
        }>;
      }>;
    }>;
  }>;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const OUTPUT_PATH = path.join(DATA_DIR, "pdf-courses.raw.json");
const COURSE_CODE_PATTERN = /^[A-Z]{2,5}\d{4}[A-Z]?$/;
const SCHOOLS: ReadonlySet<SchoolCode> = new Set<SchoolCode>([
  "HSS",
  "MED",
  "MUS",
  "SAI",
  "SDS",
  "SME",
  "SSE",
]);

const DEFAULT_SOURCES = [
  {
    filePath:
      "C:\\Users\\17610\\Documents\\xwechat_files\\wxid_drv1ogwt7z4h22_89e3\\msg\\file\\2026-07\\4fbc710385638d4e4d26fd7ccfc2c0fe.pdf",
    term: "AY2025-26 Term 2",
  },
  {
    filePath:
      "C:\\Users\\17610\\Documents\\xwechat_files\\wxid_drv1ogwt7z4h22_89e3\\msg\\file\\2026-07\\Pre-registration_Course Offering Information_AY2026-27 Term 1(1).pdf",
    term: "AY2026-27 Term 1",
  },
];

type TextItem = {
  text: string;
  x: number;
  y: number;
};

function cleanText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function getSources() {
  const args = process.argv.slice(2);
  if (args.length === 0) return DEFAULT_SOURCES;
  if (args.length % 2 !== 0) {
    throw new Error(
      "参数必须成对提供：npm run extract:courses -- <PDF路径> <学期> [<PDF路径> <学期>]"
    );
  }

  return Array.from({ length: args.length / 2 }, (_, index) => ({
    filePath: path.resolve(args[index * 2]),
    term: args[index * 2 + 1],
  }));
}

function parsePage(
  items: TextItem[],
  source: { filePath: string; term: string },
  pageNumber: number
) {
  const codeItems = items
    .filter(
      (item) =>
        item.x >= 70 &&
        item.x < 145 &&
        COURSE_CODE_PATTERN.test(item.text.replace(/\s+/g, "").toUpperCase())
    )
    .sort((a, b) => b.y - a.y);

  function belongsToRecord(item: TextItem, recordIndex: number) {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    codeItems.forEach((candidate, index) => {
      const distance = Math.abs(candidate.y - item.y);
      // 接近行间中点时归入页面中更靠下的课程，适配跨三行的课程名。
      if (distance <= closestDistance + 2) {
        closestIndex = index;
        closestDistance = distance;
      }
    });

    return closestIndex === recordIndex && closestDistance <= 50;
  }

  return codeItems.map((codeItem, index): PdfRawCourse => {
    const recordItems = items.filter((item) => belongsToRecord(item, index));

    const title = cleanText(
      recordItems
        .filter(
          (item) =>
            item.x >= 135 &&
            item.x < 345 &&
            cleanText(item.text) !== "Course Title"
        )
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((item) => item.text)
        .join(" ")
    );
    const schoolText = recordItems
      .filter((item) => item.x < 70)
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((item) => item.text.replace(/\s+/g, "").toUpperCase())
      .join("");
    const school = Array.from(SCHOOLS).find((code) =>
      schoolText.includes(code)
    );
    const unitsText = recordItems
      .filter((item) => item.x >= 345 && item.x < 390)
      .sort(
        (a, b) =>
          Math.abs(a.y - codeItem.y) - Math.abs(b.y - codeItem.y) || a.x - b.x
      )
      .map((item) => item.text.trim())
      .find((value) => /^\d+(?:\.\d+)?$/.test(value));

    if (!school) {
      throw new Error(
        `${source.term} 第 ${pageNumber} 页 ${codeItem.text} 无法识别学院。`
      );
    }
    if (title.length < 2) {
      throw new Error(
        `${source.term} 第 ${pageNumber} 页 ${codeItem.text} 无法识别课程名。`
      );
    }

    return {
      code: codeItem.text.replace(/\s+/g, "").toUpperCase(),
      title,
      school,
      units: unitsText ? Number(unitsText) : null,
      term: source.term,
      sourceFile: path.basename(source.filePath),
      page: pageNumber,
    };
  });
}

async function extractSource(source: { filePath: string; term: string }) {
  const document = await pdfjs.getDocument(
    new Uint8Array(await readFile(source.filePath))
  );
  const courses: PdfRawCourse[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .map(
        (item): TextItem => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
        })
      )
      .filter((item) => item.text.trim());

    courses.push(...parsePage(items, source, pageNumber));
  }

  console.log(`${source.term}：提取 ${courses.length} 条开课记录`);
  return courses;
}

async function main() {
  const sources = getSources();
  const results = await Promise.all(sources.map(extractSource));
  const courses = results.flat();

  if (courses.length < 100) {
    throw new Error(`仅提取到 ${courses.length} 条课程，数量异常，未写入文件。`);
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(courses, null, 2), "utf8");
  console.log(`共提取 ${courses.length} 条记录：${OUTPUT_PATH}`);
  console.log("下一步运行：npm run normalize:courses");
}

main().catch((error) => {
  console.error("PDF 课程提取失败：", error);
  process.exitCode = 1;
});

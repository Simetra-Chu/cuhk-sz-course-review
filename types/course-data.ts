import type { SchoolCode } from "@/lib/constants";

export type PdfRawCourse = {
  code: string;
  title: string;
  school: SchoolCode;
  units: number | null;
  term: string;
  sourceFile: string;
  page: number;
};

export type NormalizedCourse = {
  code: string;
  name_cn: string;
  name_en: string | null;
  school: SchoolCode;
  subject_code: string;
  subject_name: string;
  source: "sis" | "registry";
  source_url: string | null;
  offered_terms: string[];
  last_synced_at: string;
  mapping_reason: "subject-prefix" | "hss-fallback" | "pdf-department";
};

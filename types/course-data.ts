import type { SchoolCode } from "@/lib/constants";

export type PdfRawCourse = {
  code: string;
  title: string;
  school: SchoolCode;
  units: number | null;
  prerequisite: string | null;
  corequisite: string | null;
  exclusion: string | null;
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
  prerequisite: string | null;
  corequisite: string | null;
  exclusion: string | null;
  last_synced_at: string;
  mapping_reason: "subject-prefix" | "hss-fallback" | "pdf-department";
};

export interface AnalyzeOptions {
  repo: string;
  path?: string;
  limit?: number;
  since?: string | Date;
  message?: string;
  extensions?: string[];
  ignoreExtensions?: string[];
}

export interface CommitDetail { hash: string; date: string; message: string }
export interface HotFile { path: string; commits: number; details: CommitDetail[] }

export class HotfilesError extends Error { code: string }
export function analyzeRepository(options: AnalyzeOptions): Promise<HotFile[]>;
export default analyzeRepository;

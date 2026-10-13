export type EvidenceType = 'PHOTO' | 'DOCUMENT' | 'MESSAGE' | 'CALL' | 'VIDEO' | 'BADGE' | 'SUSPECT_PROFILE' | 'TIMELINE';
export type InvestigationStatus = 'IN_PROGRESS' | 'SOLVED' | 'FAILED' | 'TIME_OUT';
export type LinkResult = 'MATCH' | 'CONTRADICTION' | 'NONE';
export type OptionCategory = 'MOTIVE' | 'METHOD' | 'WEAPON';

export interface CaseSummary {
  id: number;
  title: string;
  synopsis: string;
  stamp: string | null;
  difficulty: number;
  timeLimit: number;
  tutorial: boolean;
  evidenceCount: number;
  suspectCount: number;
}

export interface EvidenceDto {
  id: number;
  title: string;
  teaser: string | null;
  content: string | null;
  fileUrl: string | null;
  type: EvidenceType;
}

export interface SuspectDto {
  id: number;
  name: string;
  role: string | null;
  description: string | null;
  alibi: string | null;
  imageUrl: string | null;
}

export interface AnswerOptionDto {
  id: number;
  category: OptionCategory;
  text: string;
}

export interface CaseDetail {
  summary: CaseSummary;
  evidences: EvidenceDto[];
  suspects: SuspectDto[];
  answerOptions: AnswerOptionDto[];
}

export interface Investigation {
  id: number;
  playerId: number;
  caseId: number;
  startedAt: string;
  finishedAt: string | null;
  status: InvestigationStatus;
  timeLimitMinutes: number;
  remainingSeconds: number;
}

export interface LinkDto {
  id: number;
  fromEvidenceId: number;
  toEvidenceId: number;
  result: LinkResult;
  message: string;
}

export interface SolutionDto {
  guiltySuspectId: number | null;
  guiltySuspectName: string | null;
  motive: string;
  method: string;
  weapon: string;
  explanation: string | null;
}

export interface ResultDto {
  investigationId: number;
  status: InvestigationStatus;
  correctCount: number | null;
  correct: boolean | null;
  suspectCorrect: boolean | null;
  motiveCorrect: boolean | null;
  methodCorrect: boolean | null;
  weaponCorrect: boolean | null;
  solution: SolutionDto;
  finishedAt: string | null;
}

export interface AccusationBody {
  suspectId: number;
  motive: string;
  method: string;
  weapon: string;
}

export interface CaseCreateBody {
  title: string;
  synopsis: string;
  stamp: string | null;
  difficulty: number;
  timeLimit: number;
  tutorial: boolean;
  motive: string;
  method: string;
  weapon: string;
  explanation: string | null;
  evidences: { title: string; teaser: string | null; content: string | null; fileUrl: string | null; type: EvidenceType }[];
  suspects: { name: string; role: string | null; description: string | null; alibi: string | null; imageUrl: string | null; guilty: boolean }[];
  relations: { fromIndex: number; toIndex: number; type: LinkResult; message: string | null }[];
  answerOptions: { category: OptionCategory; text: string }[];
}

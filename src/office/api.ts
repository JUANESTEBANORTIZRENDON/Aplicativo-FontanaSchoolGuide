import { api, ApiError } from '../http';

// Cliente del módulo "Ofimática para tus cobranzas". El navegador nunca calcula una nota que cuente:
// solo muestra lo que el servidor decide.

export { ApiError };

export type SectionKey = 'bienvenida' | 'mecanografia' | 'excel' | 'ortografia' | 'resultado';
export const SECTION_KEYS: SectionKey[] = ['bienvenida', 'mecanografia', 'excel', 'ortografia', 'resultado'];

export type SectionState = {
  key: SectionKey;
  title: string;
  activityId: string | null;
  graded: boolean;
  status: 'COMPLETED' | 'PENDING' | 'NO_ATTEMPTS';
  // Solo ortografía: el dictado se presentó con errores (alerta para refuerzo, no bloquea el módulo).
  alert?: boolean;
  attemptsRemaining: number | null;
  maxAttempts: number | null;
  waitUntil: string | null;
  lessonsViewed: string[];
  lessonsTotal: number;
};

export type DictationInfo = { id: string; title: string; difficulty: number; attemptId: string | null; hasAudio: boolean; devTts: boolean; audioDurationSeconds: number | null };

export type ModuleState = {
  module: { slug: string; name: string; status: string; progressPercent: string; hasSeal: boolean; route: string };
  currentSection: SectionKey;
  sections: SectionState[];
  config: {
    version: number;
    typing: { durationSeconds: number; minCorrectCpm: number; minAccuracy: number; startWindowSeconds: number; maxAttempts: number };
    excel: { minScore: number; maxAttempts: number };
    dictation: { minScore: number; maxAttempts: number; maxPlays: number };
  };
  typing: { practiceRequired: boolean; openAttempt: { attemptId: string; expiresAt: string; started: boolean } | null };
  dictation: DictationInfo | null;
  dictationAvailable: boolean;
  excelAvailable: boolean;
  devTts: boolean;
  seal: { issuedAt: string } | null;
  nextModule: { slug: string; name: string; enabled: boolean; route: string; blockedReason: string | null } | null;
};

export type LessonImage = { key: string; alt: string; width: number; height: number; caption: string; url: string | null };
export type Lesson = { key: string; title: string; summary: string; rule: string; incorrect: string; correct: string; image: LessonImage | null };

const BASE = '/training/office';

async function get<T>(path: string): Promise<T> {
  return (await api<{ data: T }>(`${BASE}${path}`)).data;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  return (await api<{ data: T }>(`${BASE}${path}`, { method: 'POST', body: body === undefined ? '{}' : JSON.stringify(body) })).data;
}

export const officeApi = {
  module: () => get<ModuleState>('/module'),
  content: <T>(section: 'bienvenida' | 'excel' | 'ortografia') => get<T>(`/content/${section}`),
  view: (sectionKey: string) => post<{ sectionKey: string }>(`/sections/${sectionKey}/view`),
  result: () => get<ResultView>('/result'),

  typingPrepare: () => post<TypingPrepared>('/typing/attempts'),
  typingResume: () => post<TypingPrepared>('/typing/attempts/resume'),
  typingStart: (id: string) => post<{ startedOfficialAt: string; durationSeconds: number; startWindowSeconds: number }>(`/typing/attempts/${id}/start`),
  typingComplete: (id: string, body: { nonce: string; typedText: string; clientDurationSeconds: number }) => post<TypingResult>(`/typing/attempts/${id}/complete`, body),
  typingPracticeTexts: () => get<{ texts: string[] }>('/typing/practice'),
  typingPracticeDone: () => post<{ practicedAt: string }>('/typing/practice/complete'),

  excelActivity: () => get<ExcelActivityInfo>('/excel/activity'),
  excelStart: (id: string) => post<ExcelPractice>(`/excel/activity/${id}/attempts`),
  excelSubmit: (id: string, body: { attemptId: string; answers: { questionId: string; optionId: QuizOptionId }[] }) => post<ExcelResult>(`/excel/activity/${id}/submit`, body),

  dictationNext: () => get<{ exercise: DictationInfo | null }>('/dictation/next'),
  dictationStart: (id: string) => post<DictationStarted>(`/dictation/${id}/attempts`),
  dictationPlay: (id: string, attemptId: string) => post<DictationPlay>(`/dictation/${id}/play`, { attemptId }),
  dictationSubmit: (id: string, body: { attemptId: string; typedText: string }) => post<DictationResult>(`/dictation/${id}/submit`, body),
};

export type TypingPrepared = { attemptId: string; number: number; text: string; textTitle: string; nonce: string; durationSeconds: number; startWindowSeconds: number; expiresAt: string };
export type TypingResult = {
  attemptNumber: number; passed: boolean; attemptsRemaining: number | null; practiceRequired: boolean;
  metrics: { correctCpm: number; ppm: number; accuracy: number; errors: number; correctCharacters: number; totalCharacters: number; durationSeconds: number };
};

// Evaluación de Excel: preguntas de opción múltiple con un caso ilustrado (la respuesta correcta queda en el servidor).
export type QuizOptionId = 'a' | 'b' | 'c' | 'd';
export type QuizQuestion = { id: string; lesson: string; image: string; prompt: string; options: { id: QuizOptionId; text: string }[] };
export type ExcelPractice = { attemptId: string; number: number; resumed: boolean; title: string; questions: QuizQuestion[] };
export type ExcelActivityInfo = {
  id: string; title: string; attemptId: string | null; lessons: Lesson[]; minScore: number; maxAttempts: number; questions?: QuizQuestion[];
};
export type ExcelResult = {
  attemptNumber: number; score: number; passed: boolean; minScore: number; attemptsRemaining: number | null;
  steps: { questionId: string; lesson: string; correct: boolean; awardedScore: number; weight: number; chosen: string | null; correctOption: string; feedback: string }[];
};

export type DictationStarted = { attemptId: string; number: number; resumed: boolean; exerciseId: string; playsAllowed: number; playsUsed: number; playsRemaining: number };
export type DictationPlay =
  | { mode: 'audio'; url: string; expiresAt: string; playsRemaining: number }
  | { mode: 'tts'; text: string; playsRemaining: number };
export type Correction = { position: number; type: string; expected: string; written: string; ruleKey: string | null; severity: 'CRITICAL' | 'MINOR'; weight: number; explanation: string };
export type Recommendation = { resumen: string; fortalezas: string[]; recomendaciones: string[]; proximoPaso: string };
export type DictationResult = {
  attemptNumber: number; score: number; passed: boolean; minScore: number; criticalCount: number; wordMatchPercent: number;
  expectedText: string; typedText: string; corrections: { priority: Correction[]; rest: Correction[] };
  recommendation: Recommendation; recommendationSource: 'OLLAMA' | 'TEMPLATE'; attemptsRemaining: number | null;
};

export type ResultView = {
  sealIssued: boolean; sealIssuedAt: string | null; moduleStatus: string; progressPercent: string;
  sections: { key: string; title: string; status: string; alert?: boolean }[];
  moduleScore: { score: number; parts: { key: string; score: number; weight: number }[] } | null;
  strengths: string[]; reinforce: string[];
  nextStep: { text: string; module?: ModuleState['nextModule']; section?: SectionKey };
};

export type PlanId = 'free' | 'premium';

export type Feature =
  | 'ai_writing_feedback'
  | 'ai_speaking_feedback'
  | 'ai_reader_explain'
  | 'ocr_scan'
  | 'voice_call'
  | 'mock_test'
  | 'battle';

/** Daily limits per feature. `null` = unlimited. Enforced on the server. */
export const PLAN_LIMITS: Record<PlanId, Record<Feature, number | null>> = {
  free: {
    ai_writing_feedback: 2,
    ai_speaking_feedback: 3,
    ai_reader_explain: 15,
    ocr_scan: 5,
    voice_call: 5,
    mock_test: 1,
    battle: 15,
  },
  premium: {
    ai_writing_feedback: 20,
    ai_speaking_feedback: 30,
    ai_reader_explain: 200,
    ocr_scan: 60,
    voice_call: null,
    mock_test: null,
    battle: null,
  },
};

export const FEATURE_LABELS: Record<Feature, string> = {
  ai_writing_feedback: 'AI writing evaluations per day',
  ai_speaking_feedback: 'AI speaking evaluations per day',
  ai_reader_explain: 'AI word explanations per day',
  ocr_scan: 'Book page scans per day',
  voice_call: 'Voice practice calls per day',
  mock_test: 'Mock tests started per day',
  battle: 'Battles per day',
};

export const PLAN_INFO: Record<PlanId, { name: string; priceLabel: string; perks: string[] }> = {
  free: {
    name: 'Free',
    priceLabel: '$0',
    perks: [
      'All grammar lessons and vocabulary tools',
      'IELTS reading, listening, writing and speaking practice',
      'Placement assessment and progress dashboard',
      '5 anonymous voice calls per day',
      '1 mock test per day',
      '2 AI writing evaluations per day (when AI is configured)',
    ],
  },
  premium: {
    name: 'Premium',
    priceLabel: '$9.99 / month',
    perks: [
      'Unlimited voice practice calls and battles',
      'Unlimited mock tests and premium practice sets',
      'Detailed AI writing feedback with a rewritten model answer',
      '20 AI writing and 30 AI speaking evaluations per day',
      'Advanced analytics: skill breakdown and band trends',
      '60 book page scans per day',
    ],
  },
};

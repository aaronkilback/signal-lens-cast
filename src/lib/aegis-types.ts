export type TargetAudience =
  | 'executives'
  | 'hnw_families'
  | 'public_figures'
  | 'enterprise_leaders'
  | 'family_offices'
  | 'board_members';

export type LifeDomain =
  | 'executive_travel'
  | 'family_legacy'
  | 'digital_privacy'
  | 'public_presence'
  | 'business_continuity'
  | 'residential_sanctuary';

export type ToneIntensity = 'clinical' | 'strategic' | 'commanding';

export type OutputMode = 
  | 'full_episode' 
  | 'executive_summary' 
  | 'social_clip' 
  | 'long_narrative';

export type VoiceOption = 'onyx' | 'echo' | 'alloy' | 'fable' | 'nova' | 'shimmer';

export interface GenerationConfig {
  topic: string;
  targetAudience: TargetAudience;
  lifeDomains: LifeDomain[];
  contentLength: 5 | 10 | 15;
  toneIntensity: ToneIntensity;
  outputMode: OutputMode;
  voice?: VoiceOption;
}

export const AUDIENCE_OPTIONS: { value: TargetAudience; label: string }[] = [
  { value: 'executives', label: 'C-Suite Executives' },
  { value: 'hnw_families', label: 'High-Net-Worth Families' },
  { value: 'public_figures', label: 'Public Figures & Personalities' },
  { value: 'enterprise_leaders', label: 'Enterprise Leaders' },
  { value: 'family_offices', label: 'Family Offices' },
  { value: 'board_members', label: 'Board Members' },
];

export const LIFE_DOMAIN_OPTIONS: { value: LifeDomain; label: string; description: string }[] = [
  { value: 'executive_travel', label: 'Executive Travel', description: 'Moving through the world with invisible protection' },
  { value: 'family_legacy', label: 'Family Legacy', description: 'Generational protection and continuity' },
  { value: 'digital_privacy', label: 'Digital Privacy', description: 'Sovereign control over your digital footprint' },
  { value: 'public_presence', label: 'Public Presence', description: 'Managing visibility and reputation with certainty' },
  { value: 'business_continuity', label: 'Business Continuity', description: 'Operations that never stop, no matter what' },
  { value: 'residential_sanctuary', label: 'Residential Sanctuary', description: 'Your home as an uncompromised fortress' },
];

export const OUTPUT_MODE_OPTIONS: { value: OutputMode; label: string; description: string }[] = [
  { value: 'full_episode', label: 'Full Episode', description: 'Complete 7-section future-paced episode' },
  { value: 'executive_summary', label: 'Executive Summary', description: 'Condensed insight for decision-makers' },
  { value: 'social_clip', label: 'Social Clip', description: 'Punchy excerpt for LinkedIn/social sharing' },
  { value: 'long_narrative', label: 'Long-Form Narrative', description: 'Deep storytelling for premium content' },
];

export const VOICE_OPTIONS: { value: VoiceOption; label: string; description: string }[] = [
  { value: 'onyx', label: 'Onyx', description: 'Deep, authoritative (commanding tone)' },
  { value: 'echo', label: 'Echo', description: 'Calm, measured (clinical tone)' },
  { value: 'alloy', label: 'Alloy', description: 'Neutral, balanced' },
  { value: 'fable', label: 'Fable', description: 'Warm, narrative' },
  { value: 'nova', label: 'Nova', description: 'Clear, professional' },
  { value: 'shimmer', label: 'Shimmer', description: 'Bright, engaging' },
];

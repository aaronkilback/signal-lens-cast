export type TargetAudience =
  | 'energy_executives'
  | 'hnw_families'
  | 'soc_leaders'
  | 'corporate_risk_officers'
  | 'government_decision_makers'
  | 'security_directors'
  | 'board_members';

export type RiskDomain =
  | 'physical'
  | 'cyber'
  | 'reputational'
  | 'geopolitical'
  | 'operational';

export type ToneIntensity = 'clinical' | 'strategic' | 'commanding';

export type OutputMode = 
  | 'podcast_script' 
  | 'executive_briefing' 
  | 'field_intelligence' 
  | 'narrative_story';

export type VoiceOption = 'onyx' | 'echo' | 'alloy' | 'fable' | 'nova' | 'shimmer';

export interface GenerationConfig {
  topic: string;
  targetAudience: TargetAudience;
  riskDomains: RiskDomain[];
  contentLength: 5 | 10 | 15;
  toneIntensity: ToneIntensity;
  outputMode: OutputMode;
  voice?: VoiceOption;
}

export const AUDIENCE_OPTIONS: { value: TargetAudience; label: string }[] = [
  { value: 'energy_executives', label: 'Energy Executives' },
  { value: 'hnw_families', label: 'High-Net-Worth Families' },
  { value: 'soc_leaders', label: 'SOC Leaders' },
  { value: 'corporate_risk_officers', label: 'Corporate Risk Officers' },
  { value: 'government_decision_makers', label: 'Government Decision Makers' },
  { value: 'security_directors', label: 'Security Directors' },
  { value: 'board_members', label: 'Board Members' },
];

export const RISK_DOMAIN_OPTIONS: { value: RiskDomain; label: string; description: string }[] = [
  { value: 'physical', label: 'Physical Security', description: 'Facility, personnel, and asset protection' },
  { value: 'cyber', label: 'Cyber Threats', description: 'Digital infrastructure and data security' },
  { value: 'reputational', label: 'Reputational Risk', description: 'Brand, public perception, and crisis' },
  { value: 'geopolitical', label: 'Geopolitical Factors', description: 'International relations and political risk' },
  { value: 'operational', label: 'Operational Vulnerabilities', description: 'Business continuity and process risks' },
];

export const OUTPUT_MODE_OPTIONS: { value: OutputMode; label: string; description: string }[] = [
  { value: 'podcast_script', label: 'Podcast Script', description: 'Full 7-section episode format' },
  { value: 'executive_briefing', label: 'Executive Briefing', description: 'Condensed, decision-focused' },
  { value: 'field_intelligence', label: 'Field Intelligence', description: 'Tactical, operational focus' },
  { value: 'narrative_story', label: 'Narrative Story', description: 'Long-form storytelling approach' },
];

export const VOICE_OPTIONS: { value: VoiceOption; label: string; description: string }[] = [
  { value: 'onyx', label: 'Onyx', description: 'Deep, authoritative (commanding tone)' },
  { value: 'echo', label: 'Echo', description: 'Calm, measured (clinical tone)' },
  { value: 'alloy', label: 'Alloy', description: 'Neutral, balanced' },
  { value: 'fable', label: 'Fable', description: 'Warm, narrative' },
  { value: 'nova', label: 'Nova', description: 'Clear, professional' },
  { value: 'shimmer', label: 'Shimmer', description: 'Bright, engaging' },
];

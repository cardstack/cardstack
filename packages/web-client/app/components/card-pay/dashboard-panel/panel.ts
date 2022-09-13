export interface Section {
  title: string;
  description: string;
  bullets: string[];
  icon: string;
  workflow: string;
  cta: string;
  isCtaDisabled: boolean;
}

export default interface Panel {
  title: string;
  description: string;
  heroImageUrl: string;
  summaryHeroImageUrl: string;
  sections: Section[];
}

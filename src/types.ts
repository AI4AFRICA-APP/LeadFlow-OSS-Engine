/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Lead {
  id: string;
  businessName: string;
  industry: string;
  location: string;
  website?: string;
  email?: string;
  phoneNumber?: string;
  automationGaps: string[];
  suggestedService: 'Voice Agent' | 'WhatsApp Automation' | 'Omnichannel' | 'Custom RAG' | 'Free Audit';
  personalizedDraft: string;
  status: 'new' | 'analyzing' | 'ready' | 'contacted';
  score: number;
  intelligenceReport: {
    companyOverview: string;
    techStackIdentified: string[];
    potentialROI: string;
    recentNews?: string;
    founderContext?: string;
  };
}

export interface SearchParams {
  location: string;
  niche: string;
}

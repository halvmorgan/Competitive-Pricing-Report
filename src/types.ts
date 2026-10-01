export interface PublishedOffer {
  id: string;
  title: string;
  price: string;
  currency: string;
  billingPeriod: string;
  introRestrictions?: string;
  extraFees?: string;
  sourceUrl: string;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface CompetitorBusiness {
  id: string;
  name: string;
  addressOrArea: string;
  approximateDistance: string;
  sourceUrl: string;
  description: string;
  specialties: string[];
  hasPublishedPricing: boolean;
  noPricingReason?: string;
  offers: PublishedOffer[];
  groundingSources: GroundingSource[];
}

export interface CompetitorSearchResult {
  queryId: string;
  industry: string;
  location: string;
  approximateRadiusMiles: number;
  searchedAt: string;
  summary: string;
  competitors: CompetitorBusiness[];
}

export interface AuthSession {
  isAuthenticated: boolean;
  email?: string;
  accessPass?: string;
  role: 'owner' | 'guest' | 'team';
  authenticatedAt: string;
}

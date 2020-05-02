export const API_URLS = {
  covid:
    'https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query',
};
export const RKI_PAGE_SIZE = 2000;

export const RKI_FIELDS = [
  'ObjectId',
  'IdBundesland',
  'Bundesland',
  'IdLandkreis',
  'Landkreis',
  'Altersgruppe',
  'Geschlecht',
  'AnzahlFall',
  'NeuerFall',
  'AnzahlTodesfall',
  'NeuerTodesfall',
  'Meldedatum',
  'Datenstand',
] as const;

export const CASE_STATES = [
  { id: 0, de: 'confirmed' },
  { id: 1, de: 'death' },
] as const;

export const AGES = [
  { id: 0, de: 'A00-A04' },
  { id: 1, de: 'A05-A14' },
  { id: 2, de: 'A15-A34' },
  { id: 3, de: 'A35-A59' },
  { id: 4, de: 'A60-A79' },
  { id: 5, de: 'A80+' },
  { id: 6, de: 'unbekannt' },
] as const;

export const SEX = [
  { id: 0, de: 'W' },
  { id: 1, de: 'M' },
  { id: 2, de: 'unbekannt' },
] as const;

export type OptimizedMetaEntry = {
  id: number;
  de: string;
};

export type LicenseInformation = {
  asOf: string;
  provider: string;
  license: string;
};

export const LICENSES: {
  [key: string]: ImmutableArray<LicenseInformation>;
} = {
  area: [
    {
      asOf: '31.12.2018',
      provider:
        'Statistische Ämter des Bundes und der Länder, Deutschland, 2020',
      license: 'CC BY 2.0 DE.',
    },
  ],
  population: [
    {
      asOf: '31.12.2018',
      provider:
        'Statistische Ämter des Bundes und der Länder, Deutschland, 2020',
      license: 'CC BY 2.0 DE',
    },
    {
      asOf: '31.12.2019',
      provider: 'Amt für Statistik Berlin-Brandenburg',
      license: 'CC BY 3.0 DE',
    },
  ],
} as const;

export type Sex = typeof SEX[number];
export type Ages = typeof AGES[number];
export type CaseStates = typeof CASE_STATES[number];

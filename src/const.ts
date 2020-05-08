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

export const FIELDS = ['county', 'day', 'sex', 'age', 'count'] as const;

export const FIELD_KEYS = {
  county: 0,
  day: 1,
  sex: 2,
  age: 3,
  count: 4,
} as const;

export const CASE_STATES = [
  { id: 0, name: 'confirmed' },
  { id: 1, name: 'deaths' },
] as const;

export const AGES = [
  { id: 0, name: 'A00-A04' },
  { id: 1, name: 'A05-A14' },
  { id: 2, name: 'A15-A34' },
  { id: 3, name: 'A35-A59' },
  { id: 4, name: 'A60-A79' },
  { id: 5, name: 'A80+' },
  { id: 6, name: 'unbekannt' },
] as const;

export const SEX = [
  { id: 0, name: 'W' },
  { id: 1, name: 'M' },
  { id: 2, name: 'unbekannt' },
] as const;

export type OptimizedMetaEntry = {
  id: number;
  name: string;
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
export type CaseStateName = CaseStates['name'];
export type Fields = typeof FIELDS[number];

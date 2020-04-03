import { CDG } from 'types';

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

export const AGE_GROUPS = [
  'A00-A04',
  'A05-A14',
  'A15-A34',
  'A35-A59',
  'A60-A79',
  'A80+',
  'unbekannt',
] as const;

export const SEX = ['W', 'M', 'unbekannt'] as const;

export const START_DATE = 1579824000000;

export const META: Omit<CDG.Meta, 'states' | 'counties'> = {
  startDate: START_DATE,
  age: AGE_GROUPS,
  sex: SEX,
};

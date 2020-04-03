import axios from 'axios';
import { API_URLS, RKI_PAGE_SIZE } from './const';
import { CDG } from '../types';

const QUERY_FIELDS = [
  'IdBundesland',
  'Bundesland',
  'IdLandkreis',
  'Landkreis',
  'Altersgruppe',
  'Geschlecht',
  'AnzahlFall',
  'AnzahlTodesfall',
  'Meldedatum',
] as const;

export type QueriedFields = Pick<CDG.RKI.Fields, ValuesOf<typeof QUERY_FIELDS>>;

export async function getCount(where: string) {
  const params: CDG.RKI.FullParams = {
    where,
    f: 'json',
    returnCountOnly: true,
  };
  const {
    data: { count },
  } = await axios.get(API_URLS.covid, { params });
  return count;
}

async function getData(params: ImmutableObject<CDG.RKI.FullParams>) {
  const { data } = await axios.get(API_URLS.covid, { params });
  const { features } = data as CDG.RKI.Response;
  return features.map(({ attributes }) => attributes);
}

export async function fetchDataIfDifferentCount(
  oldCount: number,
): Promise<QueriedFields[] | undefined> {
  const where = 'NeuerFall IN(0, 1)';

  const count = await getCount(where);
  if (count === 0 || count === oldCount) {
    return;
  }
  const params: CDG.RKI.FullParams = {
    where,
    outFields: QUERY_FIELDS.join(','),
    f: 'json',
    cacheHint: true,
    resultRecordCount: RKI_PAGE_SIZE,
    returnGeometry: false,
    spatialRel: 'esriSpatialRelIntersects',
  };
  const pages = Math.ceil(count / RKI_PAGE_SIZE);
  const promises = [];
  for (let i = 0; i < pages; i++) {
    promises.push(getData({ ...params, resultOffset: i * RKI_PAGE_SIZE }));
  }
  const results: any[] = (await Promise.all(promises)).flat();
  results.forEach((entry: any) => {
    delete entry.ObjectId;
  });
  return results;
}

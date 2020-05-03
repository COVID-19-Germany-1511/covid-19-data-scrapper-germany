import axios from 'axios';
import { API_URLS, RKI_PAGE_SIZE, AGES, SEX } from './const';

type FieldDescription = {
  name: keyof Fields;
  type: 'esriFieldTypeOID' | 'esriFieldTypeInteger' | 'esriFieldTypeString';
  alias: string;
  sqlType: 'sqlTypeInteger' | 'sqlTypeNVarchar' | 'sqlTypeOther';
  length?: number;
  domain: null;
  defaultValue?: any;
};

type QueryParams = Pick<
  FullParams,
  'where' | 'returnDistinctValues' | 'orderByFields'
> & {
  outFields: Array<keyof Fields>;
};

type FullParams = {
  where: string;
  outFields?: string;
  f: 'json' | 'html';
  orderByFields?: string;
  returnIdsOnly?: boolean;
  returnUniqueIdsOnly?: boolean;
  returnCountOnly?: boolean;
  returnDistinctValues?: boolean;
  returnGeometry?: boolean;
  objectIds?: any;
  time?: any;
  resultType?: 'none';
  cacheHint?: boolean;
  groupByFieldsForStatistics?: any;
  outStatistics?: any;
  having?: any;
  resultOffset?: any;
  resultRecordCount?: any;
  sqlFormat?: 'none';
  spatialRel?: string;
};

type Response = {
  objectIdFieldName: 'ObjectId' | string;
  uniqueIdField: {
    name: 'ObjectId' | string;
    isSystemMaintained: boolean;
  };
  globalIdFieldName: '';
  fields: FieldDescription[];
  features: {
    attributes: Partial<Fields>;
  }[];
};

type Fields = {
  ObjectId: number;
  IdBundesland: number;
  Bundesland: string;
  IdLandkreis: string;
  Landkreis: string;
  Altersgruppe: [typeof AGES[number]][number]['name'];
  Geschlecht: [typeof SEX[number]][number]['name'];
  AnzahlFall: number;
  NeuerFall: number;
  AnzahlTodesfall: number;
  NeuerTodesfall: number;
  Meldedatum: number;
  Datenstand: string;
};

type FieldsArray = Array<keyof Fields>;

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
  'Datenstand',
] as const;

export type QueriedFields = Pick<Fields, ValuesOf<typeof QUERY_FIELDS>>;

export async function getCount(where: string) {
  const params: FullParams = {
    where,
    f: 'json',
    returnCountOnly: true,
  };
  const {
    data: { count },
  } = await axios.get(API_URLS.covid, { params });
  return count;
}

async function getData(params: ImmutableObject<FullParams>) {
  const {
    data: { features },
  } = (await axios.get(API_URLS.covid, { params })) as { data: Response };
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
  const params: FullParams = {
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

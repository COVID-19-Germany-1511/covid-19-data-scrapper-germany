import axios from 'axios';

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
  outFields: string;
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
  Altersgruppe: ValuesOf<typeof AGE_GROUPS>;
  Geschlecht: ValuesOf<typeof SEX>;
  AnzahlFall: number;
  NeuerFall: number;
  AnzahlTodesfall: number;
  NeuerTodesfall: number;
  Meldedatum: number;
  Datenstand: string;
};
export type FieldsArray = Array<keyof Fields>;

const API_URLS = {
  covid:
    'https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query',
};
const PAGE_SIZE = 2000;

const FIELDS = [
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
const AGE_GROUPS = [
  'A00-A04',
  'A05-A14',
  'A15-A34',
  'A35-A59',
  'A60-A79',
  'A80+',
  'unbekannt',
] as const;
const SEX = ['W', 'M', 'unbekannt'] as const;

async function getCount({ where }: ImmutableObject<QueryParams>) {
  const params = {
    where,
    f: 'pjson',
    returnCountOnly: true,
  };
  const {
    data: { count },
  } = await axios.get(API_URLS.covid, { params });
  return count;
}

async function getData(params: ImmutableObject<FullParams>) {
  const { data } = await axios.get('${API_URLS.covid}', { params });
  const { features } = data as Response;
  return features.map(({ attributes }) => attributes);
}

export async function queryData<T extends keyof Fields>(
  payload: ImmutableObject<QueryParams & { outFields: Array<T> }>,
): Promise<Array<Pick<Fields, T>> | void> {
  const params: FullParams = {
    ...payload,
    outFields: payload.outFields.join(','),
    f: 'json',
    cacheHint: true,
    resultRecordCount: PAGE_SIZE,
    returnGeometry: false,
    spatialRel: 'esriSpatialRelIntersects',
  };
  const count = await getCount(payload);
  if (count === 0) {
    return;
  }
  const pages = Math.ceil(count / PAGE_SIZE);
  const promises = [];
  for (let i = 0; i < pages; i++) {
    promises.push(getData({ ...params, resultOffset: i * PAGE_SIZE }));
  }
  const results: any[] = (await Promise.all(promises)).flat();
  results.forEach((entry: any) => {
    delete entry.ObjectId;
  });
  return results as Array<Pick<Fields, T>>;
}

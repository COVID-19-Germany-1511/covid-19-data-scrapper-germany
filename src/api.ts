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
  /** ID of database-entry */
  ObjectId: number;
  /** ID of state */
  IdBundesland: number;
  /** name of state */
  Bundesland: string;
  /** Id of county */
  IdLandkreis: string;
  /** name of county */
  Landkreis: string;
  /** age */
  Altersgruppe: [typeof AGES[number]][number]['name'];
  /** sex */
  Geschlecht: [typeof SEX[number]][number]['name'];
  /** confirmed cases for county, age & sex */
  AnzahlFall: number;
  /** 1 seems to mean new record in database */
  NeuerFall: 0 | 1 | -9;
  /** deaths for county, age & sex */
  AnzahlTodesfall: number;
  /** 1 seems to mean new record in database */
  NeuerTodesfall: 0 | 1 | -9;
  /** date when case was reported to RKI */
  Meldedatum: number;
  /** date of last database update */
  Datenstand: string;
  // what is that for? it's mostly some days older than the Meldedatum.
  // was also the same day on some occasions. Maybe the Date when it was confirmed?
  Refdatum: number;
  /** 1 seems to mean new record in database */
  NeuGenesen: 0 | 1 | -9;
  /** recovered cases for county, age & sex (by guess) */
  AnzahlGenesen: number;
  IstErkrankungsbeginn: 0 | 1;
  /** not used */
  Altersgruppe2: 'Nicht übermittelt';
};

const QUERY_FIELDS = [
  'IdBundesland',
  'IdLandkreis',
  'Altersgruppe',
  'Geschlecht',
  'AnzahlFall',
  'AnzahlTodesfall',
  'AnzahlGenesen',
  'Meldedatum',
  'Refdatum',
  'Datenstand',
  'IstErkrankungsbeginn',
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

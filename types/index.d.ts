import { AGE_GROUPS, SEX, CASE_STATES } from '../src/const';

declare namespace CDG {
  type StateInfo = {
    id: number;
    name: string;
  };

  type CountyInfo = {
    stateId: number;
    id: number;
    name: string;
  };

  type CaseState = ValuesOf<typeof CASE_STATES>;

  type Sex = ValuesOf<typeof SEX>;

  type AgeGroup = ValuesOf<typeof AGE_GROUPS>;

  type CaseRecord = {
    /** State Index */
    state: number;
    /** County Index */
    county: number;
    /** Date Index */
    date: number;
    /** CaseState Index */
    caseState: number;
    /** Sex Index */
    sex: number;
    /** Age Index */
    age: number;
    /** Count */
    count: number;
  };

  type Meta = {
    startDate: number;
    states: OptimizedObjectArray<StateInfo[]>;
    counties: OptimizedObjectArray<CountyInfo[]>;
    sex: typeof SEX;
    ages: typeof AGE_GROUPS;
    caseStates: typeof CASE_STATES;
  };

  type OptimizedObjectArray<
    T extends ImmutableArray<{ [key: string]: any }>
  > = {
    fields: Array<keyof T[0]>;
    values: T[keyof T[0]][][];
  };

  namespace RKI {
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
      Altersgruppe: CDG.AgeGroup;
      Geschlecht: CDG.Sex;
      AnzahlFall: number;
      NeuerFall: number;
      AnzahlTodesfall: number;
      NeuerTodesfall: number;
      Meldedatum: number;
      Datenstand: string;
    };

    type FieldsArray = Array<keyof Fields>;
  }
}

import axios from 'axios';

import { OptimizedData, OptimizedRecord } from './DataScrapper';
import { OptimizedMeta } from './meta-data';

import { Sex, Ages, CaseStates, CaseStateName, FIELD_KEYS } from './const';

import { unzipObjectArray } from './lib';

type getDataRowFunction = (
  caseState: CaseStateName,
  sex?: Sex,
  age?: Ages,
) => Map<Date, [number, number]>;

export type BaseArea = {
  id: number;
  svgId: number;
  de: string;
  area: number;
  population: number;
  records: Record<CaseStateName, DataEntry[]>;
  total: Record<CaseStateName, number>;
  getDataRow: getDataRowFunction;
};

export type State = BaseArea & {
  counties: County[];
};

export type County = BaseArea & {
  state: State;
};

type RecordList = {
  fields: {
    [key in keyof OptimizedRecord]: number;
  };
  records: DataEntry[];
};

export type DataEntry = Array<number | Date>;

export type ProvidedData = {
  areas: {
    germany: BaseArea;
    states: State[];
    counties: County[];
  };
  meta: {
    days: Date[];
    sex: ImmutableArray<Sex>;
    ages: ImmutableArray<Ages>;
    caseStates: ImmutableArray<CaseStates>;
    lastUpdated: string;
  };
};

export type Status = 'start' | 'loading' | 'transforming' | 'ready';

const URL =
  'https://covid-19-germany-1511.github.io/covid-19-data-scrapper-germany/';

const countyKey = FIELD_KEYS.county;
const sexKey = FIELD_KEYS.sex;
const ageKey = FIELD_KEYS.age;
const dayKey = FIELD_KEYS.day;
const countKey = FIELD_KEYS.count;

async function loadJSON<T extends {}>(filename: string): Promise<T> {
  const { data } = await axios.get(`${URL}${filename}.json`);
  return data;
}

function emptyArea(): Omit<BaseArea, 'id' | 'svgId' | 'de'> {
  return {
    population: 0,
    area: 0,
    records: {
      confirmed: [],
      deaths: [],
    },
    total: {
      confirmed: 0,
      deaths: 0,
    },
    getDataRow: () => new Map(),
  };
}

function transformStates({ states }: OptimizedMeta): State[] {
  return unzipObjectArray(states).map(state => ({
    ...emptyArea(),
    ...state,
    counties: [],
  }));
}

function transformCounties(
  { counties }: OptimizedMeta,
  states: ProvidedData['areas']['states'],
  germany: BaseArea,
): County[] {
  return unzipObjectArray(counties).map(county => {
    const { stateId } = county;
    delete county.stateId;
    const state = states.find(({ id }) => id === stateId) as State;
    const mapped = {
      ...emptyArea(),
      ...county,
      state,
    };
    state.counties.push((mapped as unknown) as County);
    state.population += mapped.population;
    state.area += mapped.area;
    germany.population += mapped.population;
    germany.area += mapped.area;
    return mapped;
  });
}

function buildDays(startDate: number): ProvidedData['meta']['days'] {
  const now = new Date();
  const cur = new Date(startDate);
  const days = [];
  while (cur < now) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  Object.freeze(days);
  return days;
}

function freeze(arr: ImmutableArray<any>) {
  arr.forEach(obj => Object.freeze(obj));
  Object.freeze(arr);
  return arr;
}

function transformMeta(
  rawMeta: OptimizedMeta,
  { startDate, lastUpdated }: OptimizedData,
): ProvidedData {
  const germany = { id: 0, svgId: 0, de: 'Deutschland', ...emptyArea() };
  const states = transformStates(rawMeta);
  const counties = transformCounties(rawMeta, states, germany);
  return {
    areas: {
      germany,
      states,
      counties,
    },
    meta: {
      lastUpdated,
      days: buildDays(startDate),
      sex: freeze(rawMeta.sex),
      ages: freeze(rawMeta.ages),
      caseStates: freeze(rawMeta.caseStates),
    },
  };
}

function createMapDataFunction({ meta: { days } }: ProvidedData) {
  return function (record: number[]): RecordList['records'][number] {
    const mapped = [...record] as RecordList['records'][number];
    mapped[dayKey] = days[record[dayKey]];
    Object.freeze(mapped);
    return mapped;
  };
}

function createLinkDataFunction({
  areas: { germany, counties },
}: ProvidedData) {
  const germanyRecords = germany.records;
  const germanyTotal = germany.total;

  function findCounty(countyId: number) {
    return counties.find(({ id }) => id === countyId);
  }

  return function (record: DataEntry, caseState: CaseStateName): void {
    const curCounty = findCounty(record[countyKey] as number) as County;
    const curCount = record[countKey] as number;
    curCounty.records[caseState].push(record);
    curCounty.state.records[caseState].push(record);
    germanyRecords[caseState].push(record);
    curCounty.total[caseState] += curCount;
    curCounty.state.total[caseState] += curCount;
    germanyTotal[caseState] += curCount;
  };
}

function transformAndLinkData(data: ProvidedData, { records }: OptimizedData) {
  const mapDataFunction = createMapDataFunction(data);
  const linkFunction = createLinkDataFunction(data);

  Object.entries(records).forEach(([caseState, records]) => {
    records.values.forEach(record => {
      const mapped = mapDataFunction(record);
      linkFunction(mapped, caseState as CaseStateName);
    });
  });
}

function createGetDataRowFunction({ days }: ProvidedData['meta']) {
  function filterRecords(
    records: DataEntry[],
    sex?: number,
    age?: number,
  ): DataEntry[] {
    if (sex && age) {
      return records.filter(
        record => record[sexKey] === sex && record[ageKey] === age,
      );
    } else if (sex) {
      return records.filter(record => record[sexKey] === sex);
    } else if (age) {
      return records.filter(record => record[ageKey] === age);
    }
    return records;
  }

  const cachedDataRows = new Map<string, Map<Date, [number, number]>>();

  return function (area: BaseArea): getDataRowFunction {
    return function (caseState, sex?, age?): Map<Date, [number, number]> {
      const identifier = `${area.id}-${caseState}-${sex?.id}-${age?.id}`;
      const cached = cachedDataRows.get(identifier);
      if (cached) {
        return cached;
      }
      const map = filterRecords(
        area.records[caseState],
        sex?.id,
        age?.id,
      ).reduce((numberMap, record) => {
        const day = record[dayKey] as Date;
        const count = record[countKey] as number;
        if (numberMap.has(day)) {
          (numberMap.get(day) as number[])[0] += count;
        } else {
          numberMap.set(day, [count, 0]);
        }
        return numberMap;
      }, new Map<Date, [number, number]>());
      let total = 0;
      days.forEach(day => {
        const counts = map.get(day) || [0, 0];
        total = counts[1] = counts[0] + total;
        map.set(day, counts);
      });
      Object.freeze(map);
      cachedDataRows.set(identifier, map);
      return map;
    };
  };
}

function setDataRowGetter({ areas, meta }: ProvidedData): void {
  const getDataRowFunction = createGetDataRowFunction(meta);
  const { germany, states, counties } = areas;
  [germany, ...states, ...counties].forEach(area => {
    area.getDataRow = getDataRowFunction(area);
    Object.freeze(area);
  });
}

type StatusHandler = (status: Status) => void;
export async function loadData(
  statusHandler: StatusHandler,
): Promise<ProvidedData> {
  statusHandler('loading');
  const [rawMeta, rawData] = await Promise.all([
    loadJSON<OptimizedMeta>('meta'),
    loadJSON<OptimizedData>('data'),
  ]);
  statusHandler('transforming');
  const meta = transformMeta(rawMeta, rawData);
  transformAndLinkData(meta, rawData);
  setDataRowGetter(meta);
  statusHandler('ready');
  Object.freeze(meta);
  return meta;
}

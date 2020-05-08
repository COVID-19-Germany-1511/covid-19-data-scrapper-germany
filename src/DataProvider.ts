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
  de: string;
  area: number;
  population: number;
  records: Record<CaseStateName, DataEntry[]>;
  total: Record<CaseStateName, number>;
  getDataRow: getDataRowFunction;
};

type State = BaseArea & {
  counties: County[];
};

type County = BaseArea & {
  state: State;
};

type RecordList = {
  fields: {
    [key in keyof OptimizedRecord]: number;
  };
  records: DataEntry[];
};

type TransformedData = Record<CaseStateName, RecordList>;

export type DataEntry = Array<County | Sex | Ages | CaseStates | Date | number>;

export type ProvidedData = {
  germany: BaseArea;
  states: State[];
  counties: County[];
  days: Date[];
  sex: ImmutableArray<Sex>;
  ages: ImmutableArray<Ages>;
  caseStates: ImmutableArray<CaseStates>;
  lastUpdated: string;
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

function emptyArea(): Omit<BaseArea, 'id' | 'de'> {
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
  states: ProvidedData['states'],
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

function buildDays(startDate: number): ProvidedData['days'] {
  const now = new Date();
  const cur = new Date(startDate);
  const days = [];
  while (cur < now) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function transformMeta(
  rawMeta: OptimizedMeta,
  { startDate, lastUpdated }: OptimizedData,
): ProvidedData {
  const germany = { id: 0, de: 'Deutschland', ...emptyArea() };
  const states = transformStates(rawMeta);
  const counties = transformCounties(rawMeta, states, germany);
  return {
    lastUpdated,
    germany,
    states,
    counties,
    days: buildDays(startDate),
    sex: rawMeta.sex,
    ages: rawMeta.ages,
    caseStates: rawMeta.caseStates,
  };
}

function createFindFunction<T extends { id: number }>(
  objArr: ImmutableArray<T>,
) {
  return function (idToFind: number) {
    return objArr.find(({ id }) => id === idToFind) as T;
  };
}

function createMapDataFunction(meta: ProvidedData) {
  const findCounties = createFindFunction(meta.counties);
  const findSex = createFindFunction(meta.sex);
  const findAge = createFindFunction(meta.ages);

  return function (record: number[]): RecordList['records'][number] {
    const mapped = [...record] as RecordList['records'][number];
    mapped[dayKey] = meta.days[record[dayKey]];
    mapped[countyKey] = findCounties(record[countyKey]);
    mapped[sexKey] = findSex(record[sexKey]);
    mapped[ageKey] = findAge(record[ageKey]);
    return mapped;
  };
}

function createLinkDataFunction({ germany }: ProvidedData) {
  return function (record: DataEntry, caseState: CaseStateName): void {
    const curCounty = record[countyKey] as County;
    const curCount = record[countKey] as number;
    curCounty.records[caseState].push(record);
    curCounty.state.records[caseState].push(record);
    germany.records[caseState].push(record);
    curCounty.total[caseState] += curCount;
    curCounty.state.total[caseState] += curCount;
    germany.total[caseState] += curCount;
  };
}

function transformAndLinkData(meta: ProvidedData, { records }: OptimizedData) {
  const mapFunction = createMapDataFunction(meta);
  const linkFunction = createLinkDataFunction(meta);
  const caseStates: CaseStateName[] = ['confirmed', 'deaths'];
  caseStates.forEach(caseState => {
    records[caseState].values.map(record => {
      const mapped = mapFunction(record);
      linkFunction(mapped, caseState);
      return mapped;
    });
  });
}

function createGetDataRowFunction({ days }: ProvidedData) {
  function filterRecords(
    records: DataEntry[],
    sex?: Sex,
    age?: Ages,
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

  return function (area: BaseArea): getDataRowFunction {
    return function (caseState, sex?, age?): Map<Date, [number, number]> {
      const map = filterRecords(area.records[caseState], sex, age).reduce(
        (numberMap, record) => {
          const day = record[dayKey] as Date;
          const count = record[countKey] as number;
          if (numberMap.has(day)) {
            (numberMap.get(day) as number[])[0] += count;
          } else {
            numberMap.set(day, [count, 0]);
          }
          return numberMap;
        },
        new Map<Date, [number, number]>(),
      );
      let total = 0;
      days.forEach(day => {
        const counts = map.get(day) || [0, 0];
        total = counts[1] = counts[0] + total;
        map.set(day, counts);
      });
      return map;
    };
  };
}

function setDataRowGetter(meta: ProvidedData): void {
  const getDataRowFunction = createGetDataRowFunction(meta);
  const { germany, states, counties } = meta;
  [germany, ...states, ...counties].forEach(area => {
    area.getDataRow = getDataRowFunction(area);
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
  return { ...meta };
}

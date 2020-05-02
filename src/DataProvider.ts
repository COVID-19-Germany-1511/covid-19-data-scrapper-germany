import axios from 'axios';

import { OptimizedData } from './DataScrapper';
import { OptimizedMeta } from './meta-data';

import { Sex, Ages, CaseStates } from './const';

import { unzipObjectArray, unzipObjectArrayHeader, findById } from './lib';

type BaseEntry<T> = T & {
  id: number;
  de: string;
};

type State = BaseEntry<{
  counties: County[];
  area: number;
  population: number;
}>;

type County = BaseEntry<{
  state: State;
  area: number;
  population: number;
}>;

export type ProvidedData = {
  meta: {
    states: State[];
    counties: County[];
    days: Date[];
    sex: ImmutableArray<Sex>;
    ages: ImmutableArray<Ages>;
    caseStates: ImmutableArray<CaseStates>;
    lastUpdated: string;
  };
  data: {
    fields: {
      [key in OptimizedData['records']['fields'][number]]: number;
    } & {
      state: number;
    };
    records: Array<State | County | Sex | Ages | CaseStates | Date | number>[];
  };
};

export type Status = 'start' | 'loading' | 'transforming' | 'ready';

const URL =
  'https://covid-19-germany-1511.github.io/covid-19-data-scrapper-germany/';

async function loadJSON<T extends {}>(filename: string): Promise<T> {
  const { data } = await axios.get(`${URL}${filename}.json`);
  return data;
}

function transformStates({
  states,
}: OptimizedMeta): ProvidedData['meta']['states'] {
  return unzipObjectArray(states).map((state) => ({
    ...state,
    counties: [],
    population: 0,
    area: 0,
  }));
}

function transformCounties(
  { counties }: OptimizedMeta,
  states: ProvidedData['meta']['states'],
): ProvidedData['meta']['counties'] {
  return unzipObjectArray(counties).map((county: any) => {
    const { stateId } = county;
    delete county.stateId;
    const state = states.find(({ id }) => id === stateId) as State;
    county = { ...county, state };
    state.counties.push(county);
    state.population += county.population;
    state.area += county.area;
    return county;
  });
}

function buildDays(startDate: number): ProvidedData['meta']['days'] {
  const now = new Date();
  const cur = new Date(startDate);
  const days = [];
  while (cur < now) {
    days.push(cur);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function transformMeta(
  rawMeta: OptimizedMeta,
  { startDate, lastUpdated }: OptimizedData,
): ProvidedData['meta'] {
  const states = transformStates(rawMeta);
  const counties = transformCounties(rawMeta, states);
  return {
    lastUpdated,
    days: buildDays(startDate),
    states,
    counties,
    sex: rawMeta.sex,
    ages: rawMeta.ages,
    caseStates: rawMeta.caseStates,
  };
}

function transformData(
  { records }: OptimizedData,
  meta: ProvidedData['meta'],
): ProvidedData['data'] {
  const fields = unzipObjectArrayHeader(
    records,
  ) as ProvidedData['data']['fields'];
  fields.state = Object.keys(fields).length;
  const values = records.values.map((record) => {
    const mapped = [];
    const county = findById(meta.counties, record[fields.county]);
    mapped[fields.county] = county;
    mapped[fields.state] = county.state;
    mapped[fields.caseState] = findById(
      meta.caseStates,
      record[fields.caseState],
    );
    mapped[fields.count] = record[fields.count];
    mapped[fields.day] = meta.days[record[fields.day]];
    mapped[fields.sex] = findById(meta.sex, record[fields.sex]);
    mapped[fields.age] = findById(meta.ages, record[fields.age]);
    return mapped;
  });
  return { fields, records: values };
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
  const data = transformData(rawData, meta);
  statusHandler('ready');
  return { meta, data };
}

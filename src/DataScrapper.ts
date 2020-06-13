import { QueriedFields, fetchDataIfDifferentCount } from './api';
import { SEX, AGES, FIELDS, Fields, CaseStateName } from './const';
import {
  writeToCSV,
  loadCSV,
  writeToJSON,
  loadJSON,
  zipObjectArray,
  unzipObjectArray,
  idForName,
  ZippedObjectArray,
} from './lib';
import type { Area, County, OptimizedMeta } from './meta-data';

export type OptimizedRecord = Record<Fields, number>;

export type OptimizedData = {
  startDate: number;
  lastUpdated: Date;
  records: Record<CaseStateName, ZippedObjectArray<OptimizedRecord>>;
};

export type DataMinimal = {
  startDate: number;
  lastUpdated: Date;
  areas: Array<
    {
      id: number;
    } & Record<CaseStateName, number[]>
  >;
};

export type BaseAreaStat = {
  id: number;
} & Record<CaseStateName, number>;

export type DataToday = {
  date: Date;
  areas: BaseAreaStat[];
};

const MILLIES_PER_DAY = 24 * 60 * 60 * 1000;

function createAreaStat({ id }: Area): BaseAreaStat {
  return {
    id,
    confirmed: 0,
    deaths: 0,
    recovered: 0,
  };
}

const META = loadJSON('meta') as OptimizedMeta;

function addStat(areaStat: BaseAreaStat, countyStat: BaseAreaStat): void {
  areaStat.confirmed += countyStat.confirmed;
  areaStat.deaths += countyStat.deaths;
  areaStat.recovered += countyStat.recovered;
}

// e.g. 15.05.2020, 00:00 Uhr
function parseUpdateDate(dateString: string): Date {
  const pattern = /^(\d{2}).(\d{2}).(\d{4}),\s(\d{1,2}):(\d{2})\sUhr$/gm;
  const [, day, month, year, rawHour, min] = pattern.exec(
    dateString,
  ) as RegExpExecArray;
  return new Date(
    `${year}-${month}-${day}T${('0' + rawHour).slice(-2)}:${min}:00`,
  );
}

function createListAdder(
  lists: Record<CaseStateName, OptimizedRecord[]>,
  countyRows: Map<number, Map<number, Record<CaseStateName, number>>>,
) {
  function createAdder(
    casestate: CaseStateName,
    countName: 'AnzahlFall' | 'AnzahlTodesfall' | 'AnzahlGenesen',
  ) {
    lists[casestate].splice(0, lists[casestate].length);
    return (
      entry: QueriedFields,
      optimized: Omit<OptimizedRecord, 'count'>,
      dayEntry: Record<CaseStateName, number>,
    ) => {
      const count = entry[countName];
      if (count > 0) {
        lists[casestate].push({ ...optimized, count });
        dayEntry[casestate] += count;
      }
    };
  }

  const confirmedAdder = createAdder('confirmed', 'AnzahlFall');
  const deathsAdder = createAdder('deaths', 'AnzahlTodesfall');
  const recoveredAdder = createAdder('recovered', 'AnzahlGenesen');

  return (entry: QueriedFields, optimized: Omit<OptimizedRecord, 'count'>) => {
    const countyRow = countyRows.get(optimized.county) as Map<
      number,
      Record<CaseStateName, number>
    >;
    const dayEntry = countyRow.get(optimized.day) || {
      confirmed: 0,
      deaths: 0,
      recovered: 0,
    };
    confirmedAdder(entry, optimized, dayEntry);
    deathsAdder(entry, optimized, dayEntry);
    recoveredAdder(entry, optimized, dayEntry);
    countyRow.set(optimized.day, dayEntry);
  };
}

function transformCountyRows(
  countyRows: Map<number, Map<number, Record<CaseStateName, number>>>,
  daysCount: number,
): Map<number, Record<CaseStateName, number[]>> {
  const result = new Map();
  for (const [county, dayRecords] of countyRows) {
    const changes: Record<CaseStateName, number[]> = {
      confirmed: [],
      deaths: [],
      recovered: [],
    };
    for (let i = 0; i < daysCount; i++) {
      const dayRecord = dayRecords.get(i) || {
        confirmed: 0,
        deaths: 0,
        recovered: 0,
      };
      changes.confirmed.push(dayRecord.confirmed);
      changes.deaths.push(dayRecord.deaths);
      changes.recovered.push(dayRecord.recovered);
    }
    result.set(county, changes);
  }
  return result;
}

function sumDataRows(
  dataRows: Record<CaseStateName, number[]>,
): Record<CaseStateName, number> {
  const result: any = {};
  (['confirmed', 'deaths', 'recovered'] as CaseStateName[]).forEach(
    caseState => {
      result[caseState] = dataRows[caseState].reduce(
        (sum, cur) => sum + cur,
        0,
      );
    },
  );
  return result;
}

function addDataRows(
  { confirmed, deaths, recovered }: Record<CaseStateName, number[]>,
  targetA: Record<CaseStateName, number[]>,
  targetB: Record<CaseStateName, number[]>,
): void {
  const confirmedA = targetA.confirmed;
  const deathsA = targetA.deaths;
  const recoveredA = targetA.recovered;

  const confirmedB = targetB.confirmed;
  const deathsB = targetB.deaths;
  const recoveredB = targetB.recovered;

  for (let i = 0; i < confirmed.length; i++) {
    confirmedA[i] += confirmed[i];
    deathsA[i] += deaths[i];
    recoveredA[i] += recovered[i];

    confirmedB[i] += confirmed[i];
    deathsB[i] += deaths[i];
    recoveredB[i] += recovered[i];
  }
}

export class DataScrapper {
  data: QueriedFields[] = [];
  optimizedRecords: Record<CaseStateName, OptimizedRecord[]> = {
    confirmed: [],
    deaths: [],
    recovered: [],
  };
  days: {
    first: number | null;
    last: number | null;
    updated: Date | null;
  } = {
    first: null,
    last: null,
    updated: null,
  };
  dataRows: Array<{ id: number } & Record<CaseStateName, number[]>> = [];
  dataToday: BaseAreaStat[] = [];

  async run() {
    await this.fetchData();
    if (this.data.length) {
      this.setDays();
      this.processData();
      this.save();
    }
  }

  async fetchData() {
    const oldCount = loadCSV('data')?.length || 0;
    const data = await fetchDataIfDifferentCount(oldCount);
    if (!data || !data.length) {
      return;
    }
    data.sort((a, b) => a.Refdatum - b.Refdatum);
    this.data = data;
  }

  save() {
    const confirmedCasesEverywhere = this.dataToday.every(
      ({ confirmed }) => confirmed > 0,
    );
    if (confirmedCasesEverywhere) {
      // this.saveRawData();
      this.saveOptimizedData();
      this.saveMinimalDataRows();
      this.saveDataOfToday();
    }
  }

  saveRawData() {
    const rawData = this.data.map(entry => {
      const mapped = { ...entry };
      delete mapped.Datenstand;
      return mapped;
    });
    writeToCSV('data', rawData);
  }

  saveOptimizedData() {
    const { confirmed, deaths, recovered } = this.optimizedRecords;
    const optimizedData: OptimizedData = {
      startDate: this.days.first!,
      lastUpdated: this.days.updated!,
      records: {
        confirmed: zipObjectArray(confirmed, FIELDS),
        deaths: zipObjectArray(deaths, FIELDS),
        recovered: zipObjectArray(recovered, FIELDS),
      },
    };
    writeToJSON('data', optimizedData);
  }

  saveDataOfToday() {
    const today: DataToday = {
      date: this.days.updated!,
      areas: this.dataToday,
    };
    writeToJSON('today', today);
  }

  saveMinimalDataRows() {
    const data: DataMinimal = {
      startDate: this.days.first!,
      lastUpdated: this.days.updated!,
      areas: this.dataRows,
    };
    writeToJSON('data-minimal', data);
  }

  setDays() {
    if (!this.data.length) {
      return;
    }

    const days = this.data
      .map(({ Refdatum }) => Refdatum)
      .filter((day, index, self) => {
        return index === self.indexOf(day);
      });

    this.days.first = Math.min(...days);
    this.days.last = Math.max(...days);

    this.days.updated = parseUpdateDate(this.data[0].Datenstand);
  }

  processData(): void {
    const firstDay = this.days.first as number;
    const countyRows: Map<
      number,
      Map<number, Record<CaseStateName, number>>
    > = new Map();
    unzipObjectArray(META.counties).forEach(({ id }) => {
      countyRows.set(id, new Map());
    });
    const addToList = createListAdder(this.optimizedRecords, countyRows);

    this.data.forEach(entry => {
      const optimized = {
        county: parseInt(entry.IdLandkreis),
        day: (entry.Refdatum - firstDay) / MILLIES_PER_DAY,
        sex: idForName(SEX, entry.Geschlecht),
        age: idForName(AGES, entry.Altersgruppe),
      };
      addToList(entry, optimized);
    });
    const daysCount = (this.days.last! - firstDay) / MILLIES_PER_DAY;
    const countyDataRows = transformCountyRows(countyRows, daysCount);
    this.buildDataRows(countyDataRows, daysCount);
  }

  buildDataRows(
    countyDataRows: Map<
      number,
      Record<'confirmed' | 'deaths' | 'recovered', number[]>
    >,
    daysCount: number,
  ) {
    function toRecords({ id }: Area) {
      const arr = [];
      for (let i = 0; i < daysCount; i++) {
        arr.push(0);
      }
      return {
        id,
        confirmed: [...arr],
        deaths: [...arr],
        recovered: [...arr],
      };
    }

    const germany = toRecords(META.germany);
    this.dataRows.push(germany);
    const states = unzipObjectArray(META.states).map(toRecords);
    this.dataRows.push(...states);
    const metaCounties = unzipObjectArray(META.counties);
    for (const [countyId, records] of countyDataRows) {
      const { stateId } = metaCounties.find(({ id }) => id === countyId)!;
      const state = states.find(({ id }) => id === stateId)!;
      addDataRows(records, state, germany);
      this.dataRows.push({ id: countyId, ...records });
    }
    this.dataToday = this.dataRows.map(entry => ({
      id: entry.id,
      ...sumDataRows(entry),
    }));
  }
}

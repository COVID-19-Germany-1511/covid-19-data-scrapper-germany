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

const MILLIES_PER_DAY = 24 * 60 * 60 * 1000;

export type OptimizedRecord = Record<Fields, number>;

export type OptimizedData = {
  startDate: number;
  lastUpdated: Date;
  records: Record<CaseStateName, ZippedObjectArray<OptimizedRecord>>;
};

export type BaseAreaStat = {
  id: number;
} & Record<CaseStateName, number>;

export type DataToday = {
  date: Date;
  areas: BaseAreaStat[];
};

function createAreaStat({ id }: Area): BaseAreaStat {
  return {
    id,
    confirmed: 0,
    deaths: 0,
    recovered: 0,
  };
}

const META = loadJSON('meta') as OptimizedMeta;

function buildListAdder(list: OptimizedRecord[]) {
  list.splice(0, list.length);

  return (optimized: Omit<OptimizedRecord, 'count'>, count: number) => {
    if (count > 0) {
      list.push({ ...optimized, count });
    }
    return count;
  };
}

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

export class DataScrapper {
  data: QueriedFields[] = [];
  optimizedRecords: Record<CaseStateName, OptimizedRecord[]> = {
    confirmed: [],
    deaths: [],
    recovered: [],
  };
  countyStats: BaseAreaStat[] = unzipObjectArray(META.counties).map(
    createAreaStat,
  );
  days: {
    first: number | null;
    last: number | null;
    updated: Date | null;
  } = {
    first: null,
    last: null,
    updated: null,
  };

  async run() {
    await this.fetchData();
    if (this.data.length) {
      this.setDays();
      this.optimizeRecords();
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
    const confirmedCasesEverywhere = this.countyStats.every(
      ({ confirmed }) => confirmed > 0,
    );
    if (confirmedCasesEverywhere) {
      this.saveRawData();
      this.saveOptimizedData();
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
      startDate: this.days.first as number,
      lastUpdated: this.days.updated as Date,
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
      date: this.days.updated as Date,
      areas: this.dataToday,
    };
    writeToJSON('today', today);
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

  optimizeRecords(): void {
    const firstDay = this.days.first as number;

    const confirmedAdder = buildListAdder(this.optimizedRecords.confirmed);
    const deathsAdder = buildListAdder(this.optimizedRecords.deaths);
    const recoveredAdder = buildListAdder(this.optimizedRecords.recovered);

    this.data.forEach(entry => {
      const county = parseInt(entry.IdLandkreis);
      const optimized = {
        county,
        day: (entry.Refdatum - firstDay) / MILLIES_PER_DAY,
        sex: idForName(SEX, entry.Geschlecht),
        age: idForName(AGES, entry.Altersgruppe),
      };
      const countyStat = this.countyStats.find(
        ({ id }) => id === county,
      ) as BaseAreaStat;
      countyStat.confirmed += confirmedAdder(optimized, entry.AnzahlFall);
      countyStat.deaths += deathsAdder(optimized, entry.AnzahlTodesfall);
      countyStat.recovered += recoveredAdder(optimized, entry.AnzahlGenesen);
    });
  }

  get dataToday(): BaseAreaStat[] {
    const metaGermany = META.germany;
    const metaStates = unzipObjectArray(META.states);
    const metaCounties = unzipObjectArray(META.counties);
    const germany = createAreaStat(metaGermany);
    const states = metaStates.map(createAreaStat);

    this.countyStats.forEach(countyStat => {
      const countyMeta = metaCounties.find(
        ({ id }) => id === countyStat.id,
      ) as County;
      const { stateId } = countyMeta;
      const state = states.find(({ id }) => id === stateId) as BaseAreaStat;
      addStat(state, countyStat);
      addStat(germany, countyStat);
    });

    return [germany, ...states, ...this.countyStats];
  }
}

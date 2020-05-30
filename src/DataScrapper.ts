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

type Stat = {
  total: number;
  perPop: number;
};
export type BaseAreaStat = {
  id: number;
} & Record<CaseStateName, Stat>;

export type DataToday = {
  date: Date;
  areas: BaseAreaStat[];
};

function createAreaStat({ id }: Area): BaseAreaStat {
  return {
    id,
    confirmed: {
      total: 0,
      perPop: 0,
    },
    deaths: {
      total: 0,
      perPop: 0,
    },
  };
}

const META = loadJSON('meta') as OptimizedMeta;

export class DataScrapper {
  data: QueriedFields[] = [];
  optimizedRecords: Record<CaseStateName, OptimizedRecord[]> = {
    confirmed: [],
    deaths: [],
  };
  countyStats: BaseAreaStat[] = unzipObjectArray(META.counties).map(
    createAreaStat,
  );

  async run() {
    await this.fetchData();
    if (this.data.length) {
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
    data.sort((a, b) => a.Meldedatum - b.Meldedatum);
    this.data = data;
  }

  save() {
    const confirmedCasesEverywhere = this.countyStats.every(({ confirmed }) => {
      return confirmed.total > 0;
    });
    if (confirmedCasesEverywhere) {
      this.saveRawData();
      this.saveOptimizedData();
      this.saveDataOfToday();
    }
  }

  saveRawData() {
    const rawData = this.data.map(entry => {
      const mapped = { ...entry };
      delete mapped.Bundesland;
      delete mapped.Landkreis;
      delete mapped.Datenstand;
      return mapped;
    });
    writeToCSV('data', rawData);
  }

  saveOptimizedData() {
    const { confirmed, deaths } = this.optimizedRecords;
    const optimizedData: OptimizedData = {
      startDate: this.startDate,
      lastUpdated: this.lastUpdated as Date,
      records: {
        confirmed: zipObjectArray(confirmed, FIELDS),
        deaths: zipObjectArray(deaths, FIELDS),
      },
    };
    writeToJSON('data', optimizedData);
  }

  saveDataOfToday() {
    writeToJSON('today', this.dataToday);
  }

  get lastUpdated(): Date | null {
    if (!this.data.length) {
      return null;
    }
    // e.g. 15.05.2020, 00:00 Uhr
    const pattern = /^(\d{2}).(\d{2}).(\d{4}),\s(\d{1,2}):(\d{2})\sUhr$/gm;
    const [, day, month, year, rawHour, min] = pattern.exec(
      this.data[0].Datenstand,
    ) as RegExpExecArray;
    return new Date(
      `${year}-${month}-${day}T${('0' + rawHour).slice(-2)}:${min}:00`,
    );
  }

  get startDate(): number {
    const days = this.data
      .map(({ Meldedatum }) => Meldedatum)
      .filter((day, index, self) => {
        return index === self.indexOf(day);
      });
    return Math.min(...days);
  }

  optimizeRecords(): void {
    const { startDate } = this;
    const confirmed: OptimizedRecord[] = [];
    const deaths: OptimizedRecord[] = [];
    this.data.forEach(entry => {
      const county = parseInt(entry.IdLandkreis);
      const optimized = {
        county,
        day: (entry.Meldedatum - startDate) / MILLIES_PER_DAY,
        sex: idForName(SEX, entry.Geschlecht),
        age: idForName(AGES, entry.Altersgruppe),
      };
      const countyStat = this.countyStats.find(
        ({ id }) => id === county,
      ) as BaseAreaStat;
      if (entry.AnzahlFall > 0) {
        confirmed.push({ ...optimized, count: entry.AnzahlFall });
        countyStat.confirmed.total += entry.AnzahlFall;
      }
      if (entry.AnzahlTodesfall > 0) {
        deaths.push({ ...optimized, count: entry.AnzahlTodesfall });
        countyStat.deaths.total += entry.AnzahlTodesfall;
      }
    });
    this.optimizedRecords = { confirmed, deaths };
  }

  get dataToday(): BaseAreaStat[] {
    const metaGermany = META.germany;
    const metaStates = unzipObjectArray(META.states);
    const metaCounties = unzipObjectArray(META.counties);
    const germany = createAreaStat(metaGermany);
    const states = metaStates.map(createAreaStat);
    this.countyStats.forEach(({ id, confirmed, deaths }) => {
      const { stateId, population } = metaCounties.find(
        county => county.id === id,
      ) as County;
      confirmed.perPop = (confirmed.total / population) * 100000;
      deaths.perPop = (deaths.total / population) * 100000;
      const state = states.find(({ id }) => id === stateId) as BaseAreaStat;
      state.confirmed.total += confirmed.total;
      state.deaths.total += deaths.total;
      germany.confirmed.total += confirmed.total;
      germany.deaths.total += deaths.total;
    });
    states.forEach(({ id, confirmed, deaths }) => {
      const { population } = metaStates.find(state => state.id === id) as Area;
      confirmed.perPop = (confirmed.total / population) * 100000;
      deaths.perPop = (deaths.total / population) * 100000;
    });
    const germanyPop = META.germany.population;
    germany.confirmed.perPop = (germany.confirmed.total / germanyPop) * 100000;
    germany.deaths.perPop = (germany.deaths.total / germanyPop) * 100000;
    return [germany, ...states, ...this.countyStats];
  }
}

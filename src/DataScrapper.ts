import { QueriedFields, fetchDataIfDifferentCount } from './api';
import { SEX, AGES, FIELDS, Fields, CaseStateName } from './const';
import {
  writeToCSV,
  loadCSV,
  writeToJSON,
  zipObjectArray,
  idForName,
  ZippedObjectArray,
} from './lib';

const MILLIES_PER_DAY = 24 * 60 * 60 * 1000;

export type OptimizedRecord = Record<Fields, number>;

export type OptimizedData = {
  startDate: number;
  lastUpdated: string;
  records: Record<CaseStateName, ZippedObjectArray<OptimizedRecord>>;
};

export class DataScrapper {
  data: QueriedFields[] = [];

  async run() {
    await this.fetchData();
    this.save();
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

  async save() {
    if (this.data.length) {
      writeToCSV('data', this.rawData);
      const optimizedData: OptimizedData = {
        startDate: this.startDate,
        lastUpdated: this.data[0].Datenstand,
        records: this.optimizedRecords,
      };
      writeToJSON('data', optimizedData);
    }
  }

  get days(): number[] {
    return this.data
      .map(({ Meldedatum }) => Meldedatum)
      .filter((day, index, self) => {
        return index === self.indexOf(day);
      });
  }

  get startDate(): number {
    return Math.min(...this.days);
  }

  get rawData() {
    return this.data.map(entry => {
      const mapped = { ...entry };
      delete mapped.Bundesland;
      delete mapped.Landkreis;
      delete mapped.Datenstand;
      return mapped;
    });
  }

  get optimizedRecords(): OptimizedData['records'] {
    const { startDate } = this;
    const confirmed: OptimizedRecord[] = [];
    const deaths: OptimizedRecord[] = [];
    this.data.forEach(entry => {
      const optimized = {
        county: parseInt(entry.IdLandkreis),
        day: (entry.Meldedatum - startDate) / MILLIES_PER_DAY,
        sex: idForName(SEX, entry.Geschlecht),
        age: idForName(AGES, entry.Altersgruppe),
      };
      if (entry.AnzahlFall > 0) {
        confirmed.push({ ...optimized, count: entry.AnzahlFall });
      }
      if (entry.AnzahlTodesfall > 0) {
        deaths.push({ ...optimized, count: entry.AnzahlTodesfall });
      }
    });
    return {
      confirmed: zipObjectArray(confirmed, FIELDS),
      deaths: zipObjectArray(deaths, FIELDS),
    };
  }
}

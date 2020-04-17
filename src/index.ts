import fs from 'fs';
import path from 'path';
import papa from 'papaparse';

import { QueriedFields, fetchDataIfDifferentCount } from './api';
import { META, SEX, AGE_GROUPS } from './const';
import { mergeObjectArrays, optimizeObjArray, filterUnique } from './lib';
import { CDG } from '../types';

const DATA_DIR = path.resolve(__dirname, '../data');

const MILLIES_PER_DAY = 24 * 60 * 60 * 1000;

function writeToCSV(name: string, data: any[]) {
  const csv = papa.unparse(data, { header: true });
  fs.writeFileSync(`${DATA_DIR}/${name}.csv`, csv, { encoding: 'utf8' });
}

function loadCSV(name: string): any[] | undefined {
  const fileName = `${DATA_DIR}/${name}.csv`;
  if (!fs.existsSync(fileName)) {
    return;
  }
  const file = fs.readFileSync(fileName, {
    encoding: 'utf8',
  });
  const { data } = papa.parse(file, { header: true, dynamicTyping: true });
  return data;
}

function writeToJSON(name: string, data: any) {
  const json = JSON.stringify(data);
  fs.writeFileSync(`${DATA_DIR}/${name}.json`, json, { encoding: 'utf8' });
}

class DataScrapper {
  data: QueriedFields[] = [];
  savedStates: CDG.StateInfo[];
  savedCounties: CDG.CountyInfo[];

  constructor() {
    this.savedStates = loadCSV('raw/states') || [];
    this.savedCounties = loadCSV('raw/counties') || [];
  }

  async fetchData() {
    const oldCount = loadCSV('raw/data')?.length || 0;
    this.data = (await fetchDataIfDifferentCount(oldCount)) || [];
    this.data.sort((a, b) => a.Meldedatum - b.Meldedatum);
  }

  saveData() {
    if (this.data.length) {
      writeToCSV('raw/states', this.states);
      writeToCSV('raw/counties', this.counties);
      writeToCSV('raw/data', this.rawData);
      writeToJSON('data', this.optimizedData);
      writeToJSON('meta', this.meta);
    }
  }

  get states() {
    const newStates = this.data
      .filter(filterUnique('IdBundesland'))
      // eslint-disable-next-line prettier/prettier
      .map((state) => ({
        id: state.IdBundesland,
        name: state.Bundesland,
      }));
    return mergeObjectArrays(this.savedStates, newStates, 'id').sort(
      (a, b) => a.id - b.id,
    );
  }

  get counties() {
    const newCounties = this.data
      .filter(filterUnique('IdLandkreis'))
      // eslint-disable-next-line prettier/prettier
      .map((county) => ({
        id: parseInt(county.IdLandkreis),
        name: county.Landkreis,
        stateId: county.IdBundesland,
      }));
    return mergeObjectArrays(this.savedCounties, newCounties, 'id').sort(
      (a, b) => a.id - b.id,
    );
  }

  get days() {
    return this.data
      .map(({ Meldedatum }) => Meldedatum)
      .filter((day, index, self) => {
        return index === self.indexOf(day);
      });
  }

  get startDate() {
    return Math.min(...this.days);
  }

  get meta(): CDG.Meta {
    return {
      ...META,
      startDate: this.startDate,
      states: optimizeObjArray(this.states),
      counties: optimizeObjArray(this.counties),
    };
  }

  get rawData() {
    // eslint-disable-next-line
    return this.data.map((entry) => {
      const mapped = { ...entry };
      delete mapped.Bundesland;
      delete mapped.Landkreis;
      return mapped;
    });
  }

  get optimizedData() {
    const { startDate } = this;
    const result: CDG.CaseRecord[] = [];
    // eslint-disable-next-line
    this.data.forEach((entry) => {
      const optimized = {
        state: entry.IdBundesland,
        county: parseInt(entry.IdLandkreis),
        date: (entry.Meldedatum - startDate) / MILLIES_PER_DAY,
        sex: SEX.indexOf(entry.Geschlecht),
        age: AGE_GROUPS.indexOf(entry.Altersgruppe),
      };
      if (entry.AnzahlFall > 0) {
        result.push({
          ...optimized,
          caseState: 0,
          count: entry.AnzahlFall,
        });
      }
      if (entry.AnzahlTodesfall > 0) {
        result.push({
          ...optimized,
          caseState: 1,
          count: entry.AnzahlTodesfall,
        });
      }
    });
    return optimizeObjArray(result);
  }
}

async function main() {
  fs.mkdirSync(`${DATA_DIR}/raw`, { recursive: true });
  const scrapper = new DataScrapper();
  await scrapper.fetchData();
  scrapper.saveData();
}
main();

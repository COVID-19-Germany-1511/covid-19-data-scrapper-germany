import fs from 'fs';
import path from 'path';
import papa, { ParseConfig } from 'papaparse';

import { queryData } from './api';
import { META } from './const';
import { CDG } from 'types';

const PAPA_CONFIG: ParseConfig = {
  header: true,
};

const DATA_DIR = path.resolve(__dirname, '../data');

function toQueryDate(date: string | number) {
  if (typeof date === 'string') {
    date = parseInt(date);
  }
  date = new Date(date).toISOString();
  const splitted = date.split('T');
  return `${splitted[0]} ${splitted[1].split('.')[0]}`;
}

function writeToCSV(name: string, data: any[], overwrite?: boolean) {
  const file = `${DATA_DIR}/${name}.csv`;
  const newFile = overwrite || !fs.existsSync(file);
  const csv = papa.unparse(data, { header: newFile });
  if (newFile) {
    fs.writeFileSync(file, csv, { encoding: 'utf8' });
  } else {
    fs.appendFileSync(file, `\n${csv}`, { encoding: 'utf8' });
  }
}

type MetaQueryResponse = Pick<
  CDG.RKI.Fields,
  'IdBundesland' | 'Bundesland' | 'IdLandkreis' | 'Landkreis'
>[];

function saveRawMetaStates(data: MetaQueryResponse): CDG.StateInfo[] {
  const states = data
    .filter(({ IdBundesland }, index, self) => {
      return (
        // eslint-disable-next-line
        index === self.findIndex((other) => other.IdBundesland === IdBundesland)
      );
    })
    // eslint-disable-next-line
    .map((state) => ({
      id: state.IdBundesland,
      name: state.Bundesland,
    }));
  writeToCSV('raw/states', states, true);
  return states;
}

function saveRawMetaCounties(data: MetaQueryResponse): CDG.CountyInfo[] {
  // eslint-disable-next-line
  const counties = data.map((county) => ({
    id: parseInt(county.IdLandkreis),
    name: county.Landkreis,
    stateId: county.IdBundesland,
  }));
  writeToCSV('raw/counties', counties, true);
  return counties;
}

export function optimizeObjArray<T extends Array<{ [key: string]: any }>>(
  objArr: T,
): CDG.OptimizedObjectArray<T> {
  const fields = Object.keys(objArr[0]);
  // eslint-disable-next-line
  const values = objArr.map((obj) => fields.map((field) => obj[field]));
  return { fields, values };
}

function saveMeta(states: CDG.StateInfo[], counties: CDG.CountyInfo[]) {
  const meta: CDG.Meta = {
    ...META,
    states: optimizeObjArray(states),
    counties: optimizeObjArray(counties),
  };
  fs.writeFileSync(`${DATA_DIR}/meta.json`, JSON.stringify(meta), {
    encoding: 'utf8',
  });
}

async function queryMeta() {
  if (
    fs.existsSync(`${DATA_DIR}/raw/states.csv`) &&
    fs.existsSync(`${DATA_DIR}/raw/counties.csv`)
  ) {
    return;
  }
  const data = await queryData({
    where: 'IdBundesland IS NOT NULL',
    outFields: ['IdBundesland', 'Bundesland', 'IdLandkreis', 'Landkreis'],
    returnDistinctValues: true,
  });

  if (data) {
    const states = saveRawMetaStates(data);
    const counties = saveRawMetaCounties(data);
    saveMeta(states, counties);
  }
}

function getLastSavedDate(fields: CDG.RKI.FieldsArray): string | void {
  if (!fs.existsSync(`${DATA_DIR}/raw/data.csv`)) {
    return;
  }
  const file = fs.readFileSync(`${DATA_DIR}/raw/data.csv`, {
    encoding: 'utf8',
  });
  const { data } = papa.parse(file, PAPA_CONFIG);
  // TODO: really check fields
  if (data.length && Object.keys(data[0]).length === fields.length) {
    const lastEntry = data[data.length - 1];
    return toQueryDate(lastEntry.Meldedatum);
  }
}

async function updateData(fields: CDG.RKI.FieldsArray) {
  const lastSavedDate = getLastSavedDate(fields);

  const where = lastSavedDate
    ? `Meldedatum>timestamp '${lastSavedDate}' AND NeuerFall IN(0, 1)`
    : 'NeuerFall IN(0, 1)';

  const data = await queryData({
    where,
    outFields: fields,
    orderByFields: 'Meldedatum asc',
  });
  if (!data) {
    return;
  }
  console.log(`got ${data.length} new entries`);
  writeToCSV('raw/data', data, !lastSavedDate);
}

async function main() {
  Promise.all([
    queryMeta(),
    updateData([
      'IdBundesland',
      'IdLandkreis',
      'Altersgruppe',
      'Geschlecht',
      'AnzahlFall',
      'AnzahlTodesfall',
      'Meldedatum',
    ] as CDG.RKI.FieldsArray),
  ]);
}
main();

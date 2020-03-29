import fs from 'fs';
import path from 'path';
import papa, { ParseConfig } from 'papaparse';

import { queryData, FieldsArray } from './api';

const PAPA_CONFIG: ParseConfig = {
  header: true,
};

const DATA_DIR = path.resolve(__dirname, '../data');

function toQueryDate(date: string | number) {
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
    fs.appendFileSync(file, csv, { encoding: 'utf8' });
  }
}

async function queryMeta() {
  if (fs.existsSync(`${DATA_DIR}/states.csv`)) {
    return;
  }
  const data = await queryData({
    where: 'IdBundesland IS NOT NULL',
    outFields: ['IdBundesland', 'Bundesland', 'IdLandkreis', 'Landkreis'],
    returnDistinctValues: true,
  });

  const states = data
    .filter(({ IdBundesland }, index, self) => {
      return (
        index === self.findIndex(other => other.IdBundesland === IdBundesland)
      );
    })
    .map(date => {
      const state = { ...date };
      delete state.Landkreis;
      delete state.IdLandkreis;
      return state;
    });
  writeToCSV('states', states, true);

  const counties = data.map(date => {
    delete date.Bundesland;
    return date;
  });
  writeToCSV('counties', counties, true);
}

function getLastSavedDate(fields: FieldsArray): string | void {
  if (!fs.existsSync(`${DATA_DIR}/rawData.csv`)) {
    return;
  }
  const file = fs.readFileSync(`${DATA_DIR}/rawData.csv`, { encoding: 'utf8' });
  const { data } = papa.parse(file, PAPA_CONFIG);
  // TODO: really check fields
  if (!data.length && data.length === fields.length) {
    const lastEntry = data[data.length - 1];
    return toQueryDate(lastEntry.Meldedatum);
  }
}

async function updateData(fields: FieldsArray) {
  const lastSavedDate = getLastSavedDate(fields);

  /* eslint-disable */
  const where = lastSavedDate
    ? `NeuerFall IN(0, 1) AND Meldedatum > timestamp '${toQueryDate(
        lastSavedDate,
      )}'`
    : 'NeuerFall IN(0, 1)';
  /* eslint-enable */

  const data = await queryData({
    where,
    outFields: fields,
    orderByFields: 'Meldedatum asc',
  });
  writeToCSV('rawData', data, !lastSavedDate);
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
    ] as FieldsArray),
  ]);
}
main();

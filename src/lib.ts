import fs from 'fs';
import path from 'path';
import papa from 'papaparse';

export type ZippedObjectArray<T extends Immutable<{ [key: string]: any }>> = {
  fields: Array<keyof T>;
  values: T[keyof T][][];
};

const DATA_DIR = path.resolve(__dirname, '../data');

export function fileExists(name: string): boolean {
  return fs.existsSync(`${DATA_DIR}/${name}`);
}

export function writeToCSV(name: string, data: any[]) {
  const csv = papa.unparse(data, { header: true });
  fs.writeFileSync(`${DATA_DIR}/${name}.csv`, csv, { encoding: 'utf8' });
}

export function loadCSV(name: string): any[] | undefined {
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

export function writeToJSON(name: string, data: any) {
  const json = JSON.stringify(data);
  fs.writeFileSync(`${DATA_DIR}/${name}.json`, json, { encoding: 'utf8' });
}

export function zipObjectArray<
  T extends { [key: string]: any },
  K extends keyof T
>(objArr: T[], fields?: ImmutableArray<K>): ZippedObjectArray<T> {
  const mapFields = (fields || Object.keys(objArr[0])) as K[];
  const values = objArr.map(obj => mapFields.map(field => obj[field]));
  return { fields: mapFields, values };
}

export function unzipObjectArray<T extends { [key: string]: any }>({
  fields,
  values,
}: ZippedObjectArray<T>): T[] {
  return values.map(entry => {
    const obj: any = {};
    fields.forEach((key, index) => {
      obj[key] = entry[index];
    });
    return obj as T;
  });
}

export function unzipObjectArrayHeader<T extends { [key: string]: any }>({
  fields,
}: ZippedObjectArray<T>): {
  [key in keyof T]: number;
} {
  const result: any = {};
  fields.forEach((key, index) => {
    result[key] = index;
  });
  return result;
}

export function pick<T extends {}, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result: any = {};
  keys.forEach(key => {
    result[key] = obj[key];
  });
  return result;
}

export function idForName<T extends Immutable<{ id: number; name: string }>>(
  objArr: ImmutableArray<T>,
  nameToFind: T['name'],
): number {
  return (objArr.find(({ name }) => name === nameToFind) as T).id;
}

export function findById<T extends { id: number }>(
  objArr: ImmutableArray<T>,
  idToFind: number,
): T {
  return objArr.find(({ id }) => id === idToFind) as T;
}

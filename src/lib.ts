import { CDG } from 'types';

export function mergeObjectArrays<T extends {}>(
  a: T[],
  b: T[],
  key: keyof T,
): T[] {
  const bCopy = b.slice();
  // eslint-disable-next-line prettier/prettier
  const result = a.map((itemA) => {
    const keyValue = itemA[key];
    // eslint-disable-next-line prettier/prettier
    const itemBIdx = bCopy.findIndex((itemB) => keyValue === itemB[key]);
    if (itemBIdx >= 0) {
      const itemB = bCopy.splice(itemBIdx, 1)[0];
      return { ...itemA, ...itemB };
    } else {
      return { ...itemA };
    }
  });
  result.push(...bCopy);
  return result;
}

export function optimizeObjArray<T extends Array<{ [key: string]: any }>>(
  objArr: T,
): CDG.OptimizedObjectArray<T> {
  const fields = Object.keys(objArr[0]);
  // eslint-disable-next-line prettier/prettier
  const values = objArr.map((obj) => fields.map((field) => obj[field]));
  return { fields, values };
}

export function pick<T extends {}, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result: any = {};
  // eslint-disable-next-line prettier/prettier
  keys.forEach((key) => {
    result[key] = obj[key];
  });
  return result;
}

export function filterUnique<T extends {}>(key: keyof T) {
  return (item: T, index: number, self: T[]) => {
    const value = item[key];
    return index === self.findIndex((other) => other[key] === value);
  };
}

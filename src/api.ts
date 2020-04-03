import axios from 'axios';
import { API_URLS, RKI_PAGE_SIZE } from './const';
import { CDG } from 'types';

async function getCount({ where }: ImmutableObject<CDG.RKI.QueryParams>) {
  const params: CDG.RKI.FullParams = {
    where,
    f: 'json',
    returnCountOnly: true,
  };
  const {
    data: { count },
  } = await axios.get(API_URLS.covid, { params });
  return count;
}

async function getData(params: ImmutableObject<CDG.RKI.FullParams>) {
  const { data } = await axios.get(API_URLS.covid, { params });
  const { features } = data as CDG.RKI.Response;
  return features.map(({ attributes }) => attributes);
}

export async function queryData<T extends keyof CDG.RKI.Fields>(
  payload: ImmutableObject<CDG.RKI.QueryParams & { outFields: Array<T> }>,
): Promise<Array<Pick<CDG.RKI.Fields, T>> | void> {
  const params: CDG.RKI.FullParams = {
    ...payload,
    outFields: payload.outFields.join(','),
    f: 'json',
    cacheHint: true,
    resultRecordCount: RKI_PAGE_SIZE,
    returnGeometry: false,
    spatialRel: 'esriSpatialRelIntersects',
  };
  const count = await getCount(payload);
  if (count === 0) {
    return;
  }
  const pages = Math.ceil(count / RKI_PAGE_SIZE);
  const promises = [];
  for (let i = 0; i < pages; i++) {
    promises.push(getData({ ...params, resultOffset: i * RKI_PAGE_SIZE }));
  }
  const results: any[] = (await Promise.all(promises)).flat();
  results.forEach((entry: any) => {
    delete entry.ObjectId;
  });
  return results as Array<Pick<CDG.RKI.Fields, T>>;
}

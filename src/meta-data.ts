import { loadCSV, writeToJSON, zipObjectArray, ZippedObjectArray } from './lib';
import {
  SEX,
  AGES,
  CASE_STATES,
  LICENSES,
  Sex,
  Ages,
  CaseStates,
} from './const';

type RawState = {
  id: number;
  svgId: number;
  de: string;
};

export type Area = {
  id: number;
  svgId: number;
  de: string;
  area: number;
  population: number;
};

export type County = Area & {
  stateId: number;
};

export type OptimizedMeta = {
  germany: Area;
  states: ZippedObjectArray<Area>;
  counties: ZippedObjectArray<County>;
  sex: ImmutableArray<Sex>;
  ages: ImmutableArray<Ages>;
  caseStates: ImmutableArray<CaseStates>;
  licenses: typeof LICENSES;
};

type Areas = {
  germany: Area;
  states: ZippedObjectArray<Area>;
  counties: ZippedObjectArray<County>;
};

function loadStates(): Area[] {
  const states = loadCSV('states') as RawState[];
  return states.map(state => ({ ...state, population: 0, area: 0 }));
}

function buildAreas(): Areas {
  const counties = loadCSV('counties') as County[];
  const states = loadStates();
  const germany: Area = {
    id: 0,
    svgId: 0,
    de: 'Deutschland',
    area: 0,
    population: 0,
  };

  counties.forEach(county => {
    germany.population += county.population;
    germany.area += county.area;
    const state = states.find(({ id }) => id === county.stateId) as Area;
    state.population += county.population;
    state.area += county.area;
  });

  return {
    germany,
    states: zipObjectArray(states),
    counties: zipObjectArray(counties),
  };
}

export function generateMeta() {
  const meta: OptimizedMeta = {
    ...buildAreas(),
    sex: SEX,
    ages: AGES,
    caseStates: CASE_STATES,
    licenses: LICENSES,
  };
  writeToJSON('meta', meta);
}

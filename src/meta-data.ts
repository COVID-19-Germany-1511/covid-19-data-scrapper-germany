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

type State = {
  id: number;
  de: string;
};

type County = {
  id: number;
  de: string;
  stateId: number;
  area: number;
  population: number;
};

export type OptimizedMeta = {
  states: ZippedObjectArray<State>;
  counties: ZippedObjectArray<County>;
  sex: ImmutableArray<Sex>;
  ages: ImmutableArray<Ages>;
  caseStates: ImmutableArray<CaseStates>;
  licenses: typeof LICENSES;
};

export function generateMeta() {
  const states = loadCSV('states') as State[];
  const counties = loadCSV('counties') as County[];
  const meta: OptimizedMeta = {
    states: zipObjectArray(states),
    counties: zipObjectArray(counties),
    sex: SEX,
    ages: AGES,
    caseStates: CASE_STATES,
    licenses: LICENSES,
  };
  writeToJSON('meta', meta);
}

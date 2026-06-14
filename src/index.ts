import { API } from 'homebridge';

import { ENotEionPlatform } from './platform';
import { PLATFORM_NAME } from './settings';

/** Entry point — register the dynamic platform with Homebridge. */
export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, ENotEionPlatform);
};

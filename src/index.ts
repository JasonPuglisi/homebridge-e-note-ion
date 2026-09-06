import type { API } from 'homebridge';

import { ENotEionPlatform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';

/** Entry point — register the dynamic platform with Homebridge. */
export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, ENotEionPlatform);
};

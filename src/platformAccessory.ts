import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import { actionFor } from './modes';
import type { ENotEionPlatform } from './platform';
import type { ModeCharacteristic } from './pushServer';

/**
 * A single "Vestaboard" accessory exposing two switches — Quiet and Public —
 * grouped under one Home device. Each switch maps to a scheduler action; the
 * cached state is refreshed by the platform's poll and push paths.
 */
export class VestaboardAccessory {
  private readonly quietService: Service;
  private readonly publicService: Service;
  private readonly states: Record<ModeCharacteristic, boolean> = { quiet: false, public: false };

  constructor(
    private readonly platform: ENotEionPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    const { Service, Characteristic } = this.platform;

    this.accessory
      .getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'e-note-ion')
      .setCharacteristic(Characteristic.Model, 'Vestaboard')
      .setCharacteristic(Characteristic.SerialNumber, 'e-note-ion-vestaboard');

    this.quietService = this.getSwitch('quiet', 'Quiet');
    this.publicService = this.getSwitch('public', 'Public');

    this.quietService
      .getCharacteristic(Characteristic.On)
      .onGet(() => this.states.quiet)
      .onSet((value) => this.setMode('quiet', value));

    this.publicService
      .getCharacteristic(Characteristic.On)
      .onGet(() => this.states.public)
      .onSet((value) => this.setMode('public', value));
  }

  private getSwitch(subtype: ModeCharacteristic, name: string): Service {
    const { Service, Characteristic } = this.platform;
    const service =
      this.accessory.getServiceById(Service.Switch, subtype) ||
      this.accessory.addService(Service.Switch, name, subtype);
    service.setCharacteristic(Characteristic.ConfiguredName, name);
    return service;
  }

  private async setMode(mode: ModeCharacteristic, value: CharacteristicValue): Promise<void> {
    const on = value as boolean;
    const action = actionFor(mode, on);
    try {
      await this.platform.client.setAction(action);
      this.states[mode] = on;
    } catch (e) {
      this.platform.log.error(`Failed to set ${mode}=${on}: ${(e as Error).message}`);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /** Reflect an externally-driven state change (poll or push). */
  updateMode(mode: ModeCharacteristic, value: boolean): void {
    if (this.states[mode] === value) {
      return;
    }
    this.states[mode] = value;
    const service = mode === 'quiet' ? this.quietService : this.publicService;
    service.updateCharacteristic(this.platform.Characteristic.On, value);
  }
}

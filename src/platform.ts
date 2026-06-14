import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { ENotEionClient } from './client';
import { VestaboardAccessory } from './platformAccessory';
import { PushServer } from './pushServer';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

/**
 * Dynamic platform that publishes a single "Vestaboard" accessory and keeps its
 * Quiet/Public switches in sync via polling GET /state and (optionally) an
 * inbound push receiver fed by e-note-ion's [homebridge] notifier.
 */
export class ENotEionPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly client: ENotEionClient;

  private readonly cachedAccessories: PlatformAccessory[] = [];
  private vestaboard?: VestaboardAccessory;
  private pollTimer?: NodeJS.Timeout;
  private pushServer?: PushServer;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    const baseUrl = String(config.baseUrl || '').replace(/\/+$/, '');
    this.client = new ENotEionClient(
      baseUrl,
      String(config.schedulerSecret || ''),
      String(config.stateSecret || ''),
      log,
    );

    if (!baseUrl) {
      this.log.error('No "baseUrl" configured — set the e-note-ion webhook URL in the Homebridge config.');
    }

    this.api.on('didFinishLaunching', () => {
      this.setupAccessory();
      this.startPolling();
      this.startPushServer();
    });

    this.api.on('shutdown', () => {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
      }
      this.pushServer?.stop();
    });
  }

  /** Restore accessories cached by Homebridge across restarts. */
  configureAccessory(accessory: PlatformAccessory): void {
    this.cachedAccessories.push(accessory);
  }

  private setupAccessory(): void {
    const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:vestaboard`);
    let accessory = this.cachedAccessories.find((a) => a.UUID === uuid);
    if (!accessory) {
      accessory = new this.api.platformAccessory('Vestaboard', uuid);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.log.info('Registered the Vestaboard accessory');
    }
    this.vestaboard = new VestaboardAccessory(this, accessory);
  }

  private async refresh(): Promise<void> {
    try {
      const modes = await this.client.getModes();
      if (modes && this.vestaboard) {
        this.vestaboard.updateMode('quiet', modes.quiet);
        this.vestaboard.updateMode('public', modes.public);
      }
    } catch (e) {
      this.log.debug(`Poll of /state failed: ${(e as Error).message}`);
    }
  }

  private startPolling(): void {
    const seconds = Math.max(15, Number(this.config.pollInterval) || 300);
    void this.refresh();
    this.pollTimer = setInterval(() => void this.refresh(), seconds * 1000);
  }

  private startPushServer(): void {
    const port = Number(this.config.pushPort) || 0;
    if (!port) {
      return;
    }
    const secret = String(this.config.pushSecret || this.config.stateSecret || '');
    this.pushServer = new PushServer(port, secret, this.log, (characteristic, value) => {
      this.vestaboard?.updateMode(characteristic, value);
    });
    this.pushServer.start();
  }
}

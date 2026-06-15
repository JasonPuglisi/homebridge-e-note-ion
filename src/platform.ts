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
import { generateSecret, hashSecret, isHash, persistHashToConfig, verifySecret } from './secret';
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
  private pushSecretHash = '';

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

    // Stay inert until configured: with no baseUrl the platform registers
    // nothing and does no work, so installing it without configuration cannot
    // affect Homebridge.
    if (!baseUrl) {
      this.log.error('No "baseUrl" configured — add the e-note-ion webhook URL to the plugin config; the platform will not start until then.');
      return;
    }

    this.api.on('didFinishLaunching', () => {
      this.setupAccessory();
      this.resolvePushSecret();
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

  /**
   * Resolve the push secret used to authenticate inbound push updates.
   *
   * Runs regardless of whether push is enabled. If `pushSecret` is blank, a new
   * secret is generated, its plaintext logged once (copy it into e-note-ion's
   * [homebridge].secret), and its hash persisted back to config.json. Clear the
   * field to rotate. An explicit value is used as-is: an existing hash is reused,
   * any other value is treated as a user-supplied plaintext.
   */
  private resolvePushSecret(): void {
    const configured = String(this.config.pushSecret || '').trim();
    if (configured) {
      this.pushSecretHash = isHash(configured) ? configured : hashSecret(configured);
      return;
    }
    const plaintext = generateSecret();
    this.pushSecretHash = hashSecret(plaintext);
    persistHashToConfig(this.api, PLATFORM_NAME, this.pushSecretHash, this.log);
    this.log.info(`Generated push secret — copy this into e-note-ion [homebridge].secret: ${plaintext}`);
  }

  private startPushServer(): void {
    const port = Number(this.config.pushPort) || 0;
    if (!port) {
      return;
    }
    this.pushServer = new PushServer(
      port,
      (provided) => verifySecret(provided, this.pushSecretHash),
      this.log,
      (characteristic, value) => this.vestaboard?.updateMode(characteristic, value),
    );
    this.pushServer.start();
  }
}

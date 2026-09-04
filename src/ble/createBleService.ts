import { BleManagerImpl } from './BleManagerImpl';
import type { BleService } from './types';

/** 工厂：创建真实 BLE 服务实例。测试中可注入 mock 实现。 */
export function createBleService(): BleService {
  return new BleManagerImpl();
}

let instance: BleService | null = null;

/**
 * 惰性单例。放在函数里而非模块顶层，避免在纯逻辑测试 import 本模块时
 * 意外实例化依赖原生环境的 BleManager。
 */
export function getBleService(): BleService {
  if (!instance) {
    const service = createBleService();
    const destroy = service.destroy.bind(service);
    // ble-plx 的 BleManager 在 destroy() 后不可复用（复用会引发未定义行为）。
    // 单例被销毁后置空，下次获取时重建一个全新实例（如热重载/卸载后重新挂载）。
    service.destroy = () => {
      destroy();
      if (instance === service) instance = null;
    };
    instance = service;
  }
  return instance;
}

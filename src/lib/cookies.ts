// Cookie utilities for persistent Nostr key storage
export class CookieManager {
  static getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue || null;
    }
    return null;
  }

  static setCookie(name: string, value: string, days: number = 365): void {
    if (typeof document === 'undefined') return;

    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  }

  static deleteCookie(name: string): void {
    if (typeof document === 'undefined') return;

    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
  }

  // Telehash Pirate specific methods
  static getTelehashPirateKey(): Uint8Array | null {
    const keyString = this.getCookie('telehash-pirate-key');
    if (!keyString) return null;

    try {
      const keyArray = JSON.parse(keyString);
      return new Uint8Array(keyArray);
    } catch (error) {
      console.error('Failed to parse stored Telehash Pirate key:', error);
      this.deleteCookie('telehash-pirate-key');
      return null;
    }
  }

  static setTelehashPirateKey(secretKey: Uint8Array): void {
    const keyArray = Array.from(secretKey);
    const keyString = JSON.stringify(keyArray);
    this.setCookie('telehash-pirate-key', keyString);
  }

  static hasTelehashPirateKey(): boolean {
    return this.getCookie('telehash-pirate-key') !== null;
  }

  static clearTelehashPirateKey(): void {
    this.deleteCookie('telehash-pirate-key');
  }
}
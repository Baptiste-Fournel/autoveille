import { describe, expect, it } from 'vitest';
import { publicAddress } from '../../../src/application/notifications/publicAddress.js';
import { fakeSecretStore } from '../../fakes/fakeSecretStore.js';

describe('adresse de l’application dans les liens des notifications', () => {
  it('avant toute connexion et sans BASE_URL, les liens des notifications mènent au port local de l’application', () => {
    // Given
    const secrets = fakeSecretStore();

    // When
    const address = publicAddress(secrets, { configuredBaseUrl: '', port: 3000 });

    // Then
    expect(address).toBe('http://localhost:3000');
  });

  it('BASE_URL configurée après la mise en route l’emporte sur l’adresse retenue à la première connexion', () => {
    // Given
    const secrets = fakeSecretStore({ base_url: 'http://192.168.1.10:3000' });

    // When
    const address = publicAddress(secrets, { configuredBaseUrl: 'https://autoveille.example.fr', port: 3000 });

    // Then
    expect(address).toBe('https://autoveille.example.fr');
  });
});

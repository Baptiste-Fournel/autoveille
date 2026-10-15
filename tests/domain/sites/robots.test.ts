import { describe, expect, it } from 'vitest';
import { robotsAllows } from '../../../src/domain/sites/robots.js';
import { loadFixture } from '../../support/fixtures.js';

describe('robots.txt', () => {
  const robots = loadFixture('pages/robots-groupe-general-et-robot-exclu.txt');

  it('un robots.txt sans groupe pour AutoVeille : le groupe « * » décide, « Allow » plus précis compris', () => {
    // Arrange
    const paths = ['/voiture-occasion/porsche', '/compte/alertes', '/recherche?x=1', '/recherche/public'];

    // Act
    const [listings, account, search, publicSearch] = paths.map((path) => robotsAllows(robots, path));

    // Assert
    expect(listings).toBe(true);
    expect(account).toBe(false);
    expect(search).toBe(false);
    expect(publicSearch).toBe(true);
  });

  it('« Disallow: / » interdit tout, « Disallow: » vide n’interdit rien', () => {
    // Arrange
    const everythingForbidden = 'User-agent: *\nDisallow: /';
    const nothingForbidden = 'User-agent: *\nDisallow:';

    // Act
    const underForbiddenRoot = robotsAllows(everythingForbidden, '/a');
    const underEmptyRule = robotsAllows(nothingForbidden, '/a');

    // Assert
    expect(underForbiddenRoot).toBe(false);
    expect(underEmptyRule).toBe(true);
  });

  it('une règle terminée par « $ » ne vaut que pour ce chemin exact', () => {
    // Arrange
    const robotsTxt = 'User-agent: *\nDisallow: /*.php$';

    // Act
    const page = robotsAllows(robotsTxt, '/annonces.php');
    const pageWithQuery = robotsAllows(robotsTxt, '/annonces.php?page=2');

    // Assert
    expect(page).toBe(false);
    expect(pageWithQuery).toBe(true);
  });

  it('un groupe propre à AutoVeille l’emporte sur le groupe « * », même plus permissif', () => {
    // Arrange
    const robotsTxt = 'User-agent: *\nDisallow: /\n\nUser-agent: AutoVeille\nDisallow: /compte/';

    // Act
    const results = robotsAllows(robotsTxt, '/voitures/porsche');
    const account = robotsAllows(robotsTxt, '/compte/alertes');

    // Assert
    expect(results).toBe(true);
    expect(account).toBe(false);
  });
});

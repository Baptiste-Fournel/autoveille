import type { AstNode } from './ast.js';
import { importsOf, type ModuleImport } from './imports.js';
import { type Location, locate } from './location.js';
import { type Target, targetOf } from './target.js';
import { type RuleId, type SourceFile, type Violation, violationAt } from './violation.js';

type Breach = {
  readonly rule: RuleId;
  readonly description: string;
};

const locationOf = (target: Target): Location | undefined => (target.kind === 'file' ? locate(target.path) : undefined);

const describeImport = (moduleImport: ModuleImport, target: Target): string => {
  switch (target.kind) {
    case 'file':
      return `« ${moduleImport.specifier} » (${target.path})`;
    case 'package':
      return `le paquet npm « ${target.name} »`;
    case 'nodeBuiltin':
      return moduleImport.names.length > 0
        ? `le module Node « ${target.name} » (${moduleImport.names.join(', ')})`
        : `le module Node « ${target.name} »`;
    case 'unresolvable':
      return `un module au chemin non vérifiable ${moduleImport.sourceText}`;
  }
};

const isFingerprintHash = (moduleImport: ModuleImport, target: Target): boolean =>
  target.kind === 'nodeBuiltin' &&
  target.name === 'node:crypto' &&
  moduleImport.kind === 'static' &&
  moduleImport.names.length > 0 &&
  moduleImport.names.every((name) => name === 'createHash');

const domainBreach = (moduleImport: ModuleImport, target: Target): Breach | undefined =>
  locationOf(target)?.area === 'domain' || isFingerprintHash(moduleImport, target)
    ? undefined
    : {
        rule: 'domainDependency',
        description: `le domaine importe ${describeImport(moduleImport, target)} : src/domain/ n'importe que src/domain/ (et createHash de node:crypto pour l'empreinte)`,
      };

const applicationBreach = (moduleImport: ModuleImport, target: Target): Breach | undefined => {
  const area = locationOf(target)?.area;
  return area === 'domain' || area === 'application'
    ? undefined
    : {
        rule: 'applicationDependency',
        description: `l'application importe ${describeImport(moduleImport, target)} : src/application/ n'importe que src/application/ et src/domain/`,
      };
};

const infrastructureBreach = (zone: string, moduleImport: ModuleImport, target: Target): Breach | undefined => {
  if (target.kind === 'package' || target.kind === 'nodeBuiltin') {
    return undefined;
  }
  const location = locationOf(target);
  if (location?.area === 'infrastructure') {
    return location.zone === zone
      ? undefined
      : {
          rule: 'infrastructureDependency',
          description: `l'adaptateur « ${zone} » importe l'adaptateur « ${location.zone} » ${describeImport(moduleImport, target)} : un adaptateur ne connaît pas les autres adaptateurs`,
        };
  }
  return location?.area === 'domain' || location?.area === 'application' || location?.area === 'shared'
    ? undefined
    : {
        rule: 'infrastructureDependency',
        description: `l'infrastructure importe ${describeImport(moduleImport, target)} : elle n'importe que src/domain/, src/application/, src/shared/, sa propre zone, des paquets npm et des modules Node`,
      };
};

const sharedBreach = (moduleImport: ModuleImport, target: Target): Breach | undefined =>
  moduleImport.typeOnly && locationOf(target)?.area === 'shared'
    ? undefined
    : {
        rule: 'sharedTypesOnly',
        description: `src/shared/ importe ${describeImport(moduleImport, target)} : seul « import type » depuis src/shared/ est permis`,
      };

const clientBreach = (moduleImport: ModuleImport, target: Target): Breach | undefined => {
  const area = locationOf(target)?.area;
  if (target.kind === 'package' || area === 'client' || (area === 'shared' && moduleImport.typeOnly)) {
    return undefined;
  }
  return {
    rule: 'clientDependency',
    description:
      area === 'shared'
        ? `le client importe ${describeImport(moduleImport, target)} sans « import type » : src/shared/ ne fournit que des types au client`
        : `le client importe ${describeImport(moduleImport, target)} : client/ n'importe que client/, les types de src/shared/ (import type) et des paquets npm`,
  };
};

const compositionBreach = (moduleImport: ModuleImport, target: Target): Breach | undefined =>
  locationOf(target)?.area === 'infrastructure'
    ? {
        rule: 'compositionRoot',
        description: `importe l'adaptateur ${describeImport(moduleImport, target)} : seuls src/main.ts et src/cli/ importent src/infrastructure/`,
      }
    : undefined;

const breachOf = (location: Location, moduleImport: ModuleImport, target: Target): Breach | undefined => {
  switch (location.area) {
    case 'domain':
      return domainBreach(moduleImport, target);
    case 'application':
      return applicationBreach(moduleImport, target);
    case 'infrastructure':
      return infrastructureBreach(location.zone, moduleImport, target);
    case 'shared':
      return sharedBreach(moduleImport, target);
    case 'client':
      return clientBreach(moduleImport, target);
    case 'otherSource':
      return compositionBreach(moduleImport, target);
    default:
      return undefined;
  }
};

export const dependencyViolations = (file: SourceFile, program: AstNode, location: Location): readonly Violation[] =>
  importsOf(program, file.text).flatMap((moduleImport) => {
    const breach = breachOf(location, moduleImport, targetOf(file.path, moduleImport.specifier));
    return breach === undefined ? [] : [violationAt(breach.rule, file, moduleImport.offset, breach.description)];
  });

import type { FastifyError, FastifyReply, FastifyRequest, FastifySchemaValidationError } from 'fastify';
import { type AuthenticationProblem, AuthenticationRefused } from '../../application/auth/authenticationRefused.js';
import { NothingToImport } from '../../application/ingest/importListings.js';
import { NoDateToRecord } from '../../application/ingest/recordPublishedDates.js';
import { VehicleNotFound } from '../../application/vehicles/vehicleNotFound.js';
import { settingsProblemText } from '../../domain/presentation/settings.js';
import { InvalidSettings } from '../../domain/settings/invalidSettings.js';
import { UnknownStatus } from '../../domain/vehicle/status.js';
import type { ErrorResponse, SetupRefusedResponse } from '../../shared/api.js';
import { refusedPreviewDto } from './dto/settings.js';
import { UnreadableCursor } from './dto/vehicleCursor.js';

export const NOT_SIGNED_IN_TEXT = 'non connecté';

export const UNKNOWN_API_ROUTE_TEXT = 'inconnu';

export const INVALID_REQUEST_TEXT = 'Requête invalide.';

export const INVALID_SUBSCRIPTION_TEXT = 'Abonnement invalide.';

export const NOTHING_TO_IMPORT_TEXT = 'Aucune annonce à importer.';

export const NO_DATE_TO_RECORD_TEXT = 'Aucune date à enregistrer.';

const VEHICLE_NOT_FOUND_TEXT = 'Annonce inconnue.';

const UNREADABLE_CURSOR_TEXT = 'Curseur de pagination illisible : rechargez la liste.';

export class ImportTokenRefused extends Error {
  constructor() {
    super('import token refused');
    this.name = 'ImportTokenRefused';
  }
}

interface HttpError {
  readonly status: number;
  readonly body: ErrorResponse | SetupRefusedResponse;
}

const refusal = (status: number, error: string): HttpError => ({ status, body: { error } });

const AUTHENTICATION_REFUSALS: Readonly<Record<AuthenticationProblem, HttpError>> = {
  passwordAlreadyChosen: refusal(409, 'Le mot de passe est déjà défini.'),
  tooManyAttempts: refusal(429, 'Trop d’essais, réessayez dans dix minutes.'),
  wrongSetupCode: refusal(403, 'Code de première connexion incorrect.'),
  passwordTooShort: refusal(400, 'Choisissez un mot de passe d’au moins 8 caractères.'),
  passwordNotChosenYet: { status: 409, body: { error: 'Première connexion : choisissez d’abord un mot de passe.', needsSetup: true } },
  wrongPassword: refusal(401, 'Mot de passe incorrect.'),
};

const isValidationError = (error: unknown): error is FastifyError =>
  error instanceof Error && 'validation' in error && error.validation !== undefined;

export const httpErrorOf = (error: unknown): HttpError | undefined => {
  if (isValidationError(error)) {
    return refusal(error.statusCode ?? 400, error.message);
  }
  if (error instanceof AuthenticationRefused) {
    return AUTHENTICATION_REFUSALS[error.problem];
  }
  if (error instanceof VehicleNotFound) {
    return refusal(404, VEHICLE_NOT_FOUND_TEXT);
  }
  if (error instanceof UnreadableCursor) {
    return refusal(400, UNREADABLE_CURSOR_TEXT);
  }
  if (error instanceof UnknownStatus) {
    return refusal(400, 'Statut inconnu.');
  }
  if (error instanceof InvalidSettings) {
    return refusal(400, settingsProblemText(error.problem));
  }
  if (error instanceof NothingToImport) {
    return refusal(400, NOTHING_TO_IMPORT_TEXT);
  }
  if (error instanceof NoDateToRecord) {
    return refusal(400, NO_DATE_TO_RECORD_TEXT);
  }
  if (error instanceof ImportTokenRefused) {
    return refusal(401, 'jeton invalide');
  }
  return undefined;
};

export const rejectedAs =
  (text: string): (() => Error) =>
  () =>
    new Error(text);

export const unknownVehicleUnlessNumbered = (_errors: readonly FastifySchemaValidationError[], dataVar: string): Error =>
  dataVar === 'params' ? Object.assign(new Error(VEHICLE_NOT_FOUND_TEXT), { statusCode: 404 }) : new Error(INVALID_REQUEST_TEXT);

export const replyWithHttpError = (error: FastifyError, _request: FastifyRequest, reply: FastifyReply): FastifyReply => {
  const httpError = httpErrorOf(error);
  return httpError === undefined ? reply.send(error) : reply.code(httpError.status).send(httpError.body);
};

export const replyWithRefusedPreview = (error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply =>
  error instanceof InvalidSettings ? reply.code(200).send(refusedPreviewDto(error.problem)) : replyWithHttpError(error, request, reply);

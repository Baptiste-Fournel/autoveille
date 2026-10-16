export type Family = 'allemandes' | 'italiennes' | 'americaines' | 'francaises' | 'autres';

export type Status = 'nouveau' | 'contacte' | 'repondu' | 'ignore';

export type ListedStatus = Status | 'tous' | 'ecartees';

export type SellerType = 'particulier' | 'pro' | 'inconnu';

export type RejectedKind = 'tous' | 'suivies' | 'marque' | 'special' | 'pro' | 'km' | 'loin';

export type VehicleEventType =
  | 'nouveau'
  | 'prix_baisse'
  | 'prix_hausse'
  | 'republiee'
  | 'autre_site'
  | 'notification_echec'
  | 'statut_nouveau'
  | 'statut_contacte'
  | 'statut_repondu'
  | 'statut_ignore'
  | 'ne_plus_contacter'
  | 'garde_manuellement';

export type AlertSellerType = 'particulier' | 'pro' | 'tous';

export type EmailKind = 'new' | 'price_drop' | 'reminder' | 'recap' | 'other';

export interface ErrorResponse {
  readonly error: string;
}

export interface SetupRefusedResponse extends ErrorResponse {
  readonly needsSetup: true;
}

export interface OkResponse {
  readonly ok: true;
}

export interface HealthResponse {
  readonly ok: true;
}

export interface MeResponse {
  readonly authenticated: boolean;
  readonly needsSetup: boolean;
  readonly setupCodeRequired: boolean;
}

export interface SetupRequest {
  readonly setupCode?: string;
  readonly password?: string;
}

export interface LoginRequest {
  readonly password?: string;
}

export interface SourceRunDto {
  readonly source: string;
  readonly last_run_at: string;
  readonly ok: 0 | 1;
  readonly detail: string;
}

export interface StatusCountsDto {
  readonly nouveau: number;
  readonly contacte: number;
  readonly repondu: number;
  readonly ignore: number;
}

export interface DealerDto {
  readonly firstName: string;
  readonly lastName: string;
  readonly company: string;
  readonly city: string;
  readonly phone: string;
}

export interface OverviewResponse {
  readonly counts: StatusCountsDto & { readonly today: number };
  readonly week: { readonly received: number; readonly contacted: number; readonly replied: number };
  readonly dealer: DealerDto;
  readonly zone: { readonly city: string; readonly radiusKm: number };
  readonly imapConfigured: boolean;
  readonly alertsDone: readonly string[];
  readonly alertIssues: readonly string[];
  readonly sources: readonly SourceRunDto[];
  readonly pushKey?: string;
}

export interface PricePointDto {
  readonly price: number;
  readonly seen_at: string;
}

export interface VehicleEventDto {
  readonly id: number;
  readonly vehicle_id: number;
  readonly type: VehicleEventType;
  readonly detail: string | null;
  readonly at: string;
}

export interface ListingDto {
  readonly id: number;
  readonly site: string;
  readonly siteLabel: string;
  readonly url: string;
  readonly title: string;
  readonly price: number | null;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly priceHistory: readonly PricePointDto[];
}

export interface VehicleDto {
  readonly id: number;
  readonly name: string;
  readonly title: string;
  readonly make: string | null;
  readonly model: string | null;
  readonly family: Family;
  readonly familyLabel: string;
  readonly year: number | null;
  readonly km: number | null;
  readonly price: number | null;
  readonly city: string | null;
  readonly postalCode: string | null;
  readonly distanceKm: number | null;
  readonly status: Status;
  readonly doNotContact: boolean;
  readonly matched: boolean;
  readonly reasons: readonly string[];
  readonly specialReason: string | null;
  readonly priceDropped: boolean;
  readonly reposted: boolean;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly publishedAt: string | null;
  readonly url: string;
  readonly site: string;
  readonly siteLabel: string;
  readonly imageUrl: string | null;
  readonly description: string | null;
  readonly sellerType: SellerType;
  readonly message: string;
  readonly messageEdited: boolean;
  readonly note: string;
  readonly contactedAt: string | null;
  readonly repliedAt: string | null;
  readonly listings: readonly ListingDto[];
  readonly events: readonly VehicleEventDto[];
}

export interface VehiclesQuery {
  readonly status?: ListedStatus;
  readonly kind?: RejectedKind;
  readonly days?: number;
  readonly cursor?: string;
  readonly limit?: number;
}

export type RejectedKindCountsDto = Readonly<Record<RejectedKind, number>>;

export interface VehiclesResponse {
  readonly vehicles: readonly VehicleDto[];
  readonly nextCursor: string | null;
  readonly kinds?: RejectedKindCountsDto;
}

export interface VehicleUpdateRequest {
  readonly status?: string;
  readonly doNotContact?: boolean;
  readonly message?: string | null;
  readonly keep?: boolean;
  readonly note?: string | null;
}

export interface FamilyRulesDto {
  readonly enabled: boolean;
  readonly brands: readonly string[];
  readonly known: readonly string[];
  readonly minPrice: number;
  readonly maxYear: number;
  readonly keywords: readonly string[];
}

export interface MessageTemplateDto {
  readonly variants: readonly string[];
}

export interface ZoneDto {
  readonly city: string;
  readonly postalCode: string;
  readonly lat: number | null;
  readonly lon: number | null;
  readonly radiusKm: number;
}

export interface NotificationSettingsDto {
  readonly push: boolean;
  readonly telegramToken: string;
  readonly telegramChatId: string;
}

export interface MailboxSettingsDto {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly pass: string;
  readonly mailbox: string;
}

export interface HttpSiteDto {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly enabled: boolean;
}

export interface AlertDto {
  readonly site: string;
  readonly criteria: string;
  readonly confirmedAt: string;
  readonly manageUrl?: string;
  readonly radiusKm?: number;
  readonly maxKm?: number;
  readonly postalCode?: string;
  readonly sellerType?: AlertSellerType;
}

export interface SettingsDto {
  readonly dealer: DealerDto;
  readonly zone: ZoneDto;
  readonly maxKm: number;
  readonly privateOnly: boolean;
  readonly specialOnly: boolean;
  readonly families: Readonly<Record<Family, FamilyRulesDto>>;
  readonly templates: Readonly<Record<Family, MessageTemplateDto>>;
  readonly notifications: NotificationSettingsDto;
  readonly imap: MailboxSettingsDto;
  readonly httpSites: readonly HttpSiteDto[];
  readonly alertsDone: Readonly<Record<string, boolean>>;
  readonly alerts: Readonly<Record<string, AlertDto>>;
}

export type SettingsRequest = Partial<SettingsDto>;

export interface FamilyChoiceDto {
  readonly key: Family;
  readonly label: string;
}

export interface SettingsResponse {
  readonly settings: SettingsDto;
  readonly variables: Readonly<Record<string, string>>;
  readonly families: readonly FamilyChoiceDto[];
}

export interface SettingsPreviewDto {
  readonly pass: number;
  readonly total: number;
}

export interface SettingsUpdateResponse {
  readonly settings: SettingsDto;
  readonly preview: SettingsPreviewDto;
  readonly warning: string | null;
}

export type SettingsPreviewResponse = SettingsPreviewDto | (SettingsPreviewDto & ErrorResponse);

export interface TemplatePreviewRequest {
  readonly family?: Family;
  readonly text?: string;
  readonly vehicleId?: number;
}

export interface TemplatePreviewResponse {
  readonly text: string;
  readonly warnings: readonly string[];
}

export interface MailboxDto {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly hasPassword: boolean;
  readonly mailbox: string;
  readonly configured: boolean;
  readonly lastRun: SourceRunDto | null;
}

export interface TruncatedDigestDto {
  readonly at: string | null;
  readonly announced: number;
  readonly received: number;
  readonly url: string | null;
  readonly subject: string;
}

export interface TargetedSearchDto {
  readonly label: string;
  readonly url: string;
  readonly brands: readonly string[];
  readonly minPrice?: number;
  readonly maxYear?: number;
}

export interface SiteDto {
  readonly key: string;
  readonly label: string;
  readonly searchUrl: string;
  readonly prefilled: boolean;
  readonly manageUrl?: string;
  readonly alertRadiusKm: number;
  readonly alertMaxKm: number;
  readonly help: string;
  readonly done: boolean;
  readonly alert: AlertDto | null;
  readonly issues: readonly string[];
  readonly advice?: string | null;
  readonly digest: TruncatedDigestDto | null;
  readonly targeted: readonly TargetedSearchDto[];
}

export interface HttpSiteStateDto extends HttpSiteDto {
  readonly lastRun: SourceRunDto | null;
}

export interface EmailListingDto {
  readonly title: string;
  readonly price?: number;
  readonly km?: number;
  readonly year?: number;
  readonly city?: string;
  readonly postalCode?: string;
  readonly sellerType?: SellerType;
  readonly url: string;
}

export interface EmailReadingDto {
  readonly listings: readonly EmailListingDto[];
  readonly pending: number;
  readonly ignored: number;
  readonly announced?: number;
  readonly kind?: EmailKind;
  readonly moreUrl?: string;
}

export interface ProcessedEmailDto {
  readonly message_id: string;
  readonly subject: string;
  readonly sender: string;
  readonly received_at: string | null;
  readonly site: string | null;
  readonly parsed_count: number;
  readonly parsed: EmailReadingDto | null;
  readonly error: string | null;
  readonly processed_at: string;
}

export interface SourcesResponse {
  readonly imap: MailboxDto;
  readonly sites: readonly SiteDto[];
  readonly httpSites: readonly HttpSiteStateDto[];
  readonly emails: readonly ProcessedEmailDto[];
}

export interface MailboxTestRequest {
  readonly host?: string;
  readonly port?: number;
  readonly user?: string;
  readonly pass?: string;
  readonly mailbox?: string;
}

export interface CheckResultDto {
  readonly ok: boolean;
  readonly detail: string;
}

export interface HttpSiteTestRequest {
  readonly url?: string;
}

export interface SampleListingDto {
  readonly title: string;
  readonly price?: number;
  readonly km?: number;
  readonly year?: number;
  readonly city?: string;
  readonly url: string;
}

export interface HttpSiteTestResponse extends CheckResultDto {
  readonly sample?: readonly SampleListingDto[];
}

export interface SourceRunSummaryDto {
  readonly source: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CheckNowResponse {
  readonly mail: SourceRunSummaryDto;
  readonly http: readonly SourceRunSummaryDto[];
}

export interface RereadResponse {
  readonly mail: SourceRunSummaryDto;
}

export interface RepairResponse {
  readonly vehicles: number;
  readonly renamed: number;
  readonly split: number;
  readonly reevaluated: number;
}

export interface ImportTokenResponse {
  readonly token: string;
}

export interface ImportedListingDto {
  readonly site?: unknown;
  readonly siteLabel?: unknown;
  readonly externalId?: unknown;
  readonly url?: unknown;
  readonly title?: unknown;
  readonly price?: unknown;
  readonly km?: unknown;
  readonly year?: unknown;
  readonly city?: unknown;
  readonly postalCode?: unknown;
  readonly sellerType?: unknown;
  readonly description?: unknown;
  readonly imageUrl?: unknown;
  readonly publishedAt?: unknown;
  readonly sourceRef?: unknown;
}

export interface ImportRequest {
  readonly listings?: readonly ImportedListingDto[];
  readonly notify?: boolean;
  readonly token?: unknown;
}

export interface ImportResponse {
  readonly received: number;
  readonly new: number;
  readonly matched: number;
  readonly seen: number;
  readonly skipped: number;
}

export interface ImportedPublicationDateDto {
  readonly site?: unknown;
  readonly externalId?: unknown;
  readonly publishedAt?: unknown;
}

export interface PublishedDatesRequest {
  readonly items?: readonly ImportedPublicationDateDto[];
  readonly token?: unknown;
}

export interface PublishedDatesResponse {
  readonly received: number;
  readonly updated: number;
  readonly unknown: number;
  readonly skipped: number;
}

export interface PushKeyResponse {
  readonly key?: string;
}

export interface PushSubscriptionDto {
  readonly endpoint: string;
  readonly expirationTime?: number | null;
  readonly keys?: { readonly p256dh: string; readonly auth: string };
}

export interface SubscribeRequest {
  readonly subscription: PushSubscriptionDto;
}

export interface SubscribeResponse extends OkResponse {
  readonly count: number;
}

export interface UnsubscribeRequest {
  readonly endpoint: string;
}

export interface TelegramTestRequest {
  readonly token?: string;
  readonly chatId?: string;
}

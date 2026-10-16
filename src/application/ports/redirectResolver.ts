export interface RedirectResolver {
  resolve(href: string): Promise<string | undefined>;
}

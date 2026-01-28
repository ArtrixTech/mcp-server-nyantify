export interface BarkOptions {
  title?: string;
  subtitle?: string;
  body: string;
  sound?: string;
  group?: string;
  level?: 'active' | 'timeSensitive' | 'passive';
  url?: string;
  icon?: string;
  call?: string;
  badge?: number;
  copy?: string;
}

export class BarkClient {
  private baseUrl: string;
  private key: string;

  constructor(key: string, baseUrl: string = 'https://api.day.app') {
    this.key = key;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async send(options: BarkOptions): Promise<void> {
    const { title, subtitle, body, ...params } = options;
    
    // Build URL path
    const pathParts = [this.key];
    if (title) pathParts.push(encodeURIComponent(title));
    if (subtitle) pathParts.push(encodeURIComponent(subtitle));
    pathParts.push(encodeURIComponent(body));
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params.sound) queryParams.set('sound', params.sound);
    if (params.group) queryParams.set('group', params.group);
    if (params.level) queryParams.set('level', params.level);
    if (params.url) queryParams.set('url', params.url);
    if (params.icon) queryParams.set('icon', params.icon);
    if (params.call) queryParams.set('call', params.call);
    if (params.badge !== undefined) queryParams.set('badge', params.badge.toString());
    if (params.copy) queryParams.set('copy', params.copy);
    
    const url = `${this.baseUrl}/${pathParts.join('/')}?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Bark API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send Bark notification:', error);
      throw error;
    }
  }
}

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface IDEDetectorConfig {
  ideIdentifiers: string[];  // Bundle IDs like 'com.microsoft.VSCode', 'com.todesktop.20230321yt3tgw5'
}

const DEFAULT_IDE_BUNDLE_IDS = [
  'com.microsoft.VSCode',
  'com.microsoft.VSCodeInsiders',
  'com.todesktop.20230321yt3tgw5',  // Cursor
  'com.jetbrains.intellij',
  'com.jetbrains.intellij.ce',
  'com.jetbrains.WebStorm',
  'com.jetbrains.PhpStorm',
  'com.jetbrains.RubyMine',
  'com.jetbrains.PyCharm',
  'com.jetbrains.GoLand',
  'com.jetbrains.CLion',
  'com.apple.dt.Xcode',
  'com.sublimetext.4',
  'com.github.atom',
  'com.brave.Browser.nightly',  // Zed (if available)
];

export class IDEDetector {
  private config: IDEDetectorConfig;

  constructor(config?: Partial<IDEDetectorConfig>) {
    this.config = {
      ideIdentifiers: config?.ideIdentifiers ?? DEFAULT_IDE_BUNDLE_IDS,
    };
  }

  async isIDEFocused(): Promise<boolean> {
    try {
      const frontAppBundleId = await this.getFrontmostApplicationBundleID();
      return this.config.ideIdentifiers.includes(frontAppBundleId);
    } catch (error) {
      console.error('Failed to detect IDE focus:', error);
      return false;
    }
  }

  private async getFrontmostApplicationBundleID(): Promise<string> {
    const script = `
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set bundleID to bundle identifier of frontApp
        return bundleID
      end tell
    `;
    
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    return stdout.trim();
  }

  async getFrontmostApplicationName(): Promise<string> {
    try {
      const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set appName to name of frontApp
          return appName
        end tell
      `;
      
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      return stdout.trim();
    } catch (error) {
      console.error('Failed to get frontmost application name:', error);
      return 'Unknown';
    }
  }
}

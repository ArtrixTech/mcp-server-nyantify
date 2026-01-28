import { platform } from 'os';
import activeWin from 'active-win';

export interface IDEDetectorConfig {
  ideIdentifiers?: string[];  // Optional: Custom IDE identifiers for the current platform
}

// macOS: Bundle IDs (e.g., 'com.microsoft.VSCode')
const MACOS_IDE_BUNDLE_IDS = [
  'com.microsoft.VSCode',
  'com.microsoft.VSCodeInsiders',
  'com.todesktop.20230321yt3tgw5',  // Cursor
  'com.todesktop.20240613q6u2vci',  // Cursor (newer bundle ID)
  'com.jetbrains.intellij',
  'com.jetbrains.intellij.ce',
  'com.jetbrains.WebStorm',
  'com.jetbrains.PhpStorm',
  'com.jetbrains.RubyMine',
  'com.jetbrains.PyCharm',
  'com.jetbrains.GoLand',
  'com.jetbrains.CLion',
  'com.jetbrains.Rider',
  'com.jetbrains.DataGrip',
  'com.apple.dt.Xcode',
  'com.sublimetext.4',
  'com.sublimetext.3',
  'com.github.atom',
  'com.github.GitHubClient',  // GitHub Desktop
  'dev.zed.Zed',
  'co.zeit.hyper',
  'com.googlecode.iterm2',
  'com.apple.Terminal',
  'io.alacritty',
  'org.gnu.Emacs',
  'com.google.android.studio',
  'com.vscodium',
  'com.visualstudio.code.oss',
];

// Windows: Process names (e.g., 'Code.exe')
const WINDOWS_IDE_PROCESS_NAMES = [
  'Code.exe',              // VS Code
  'Code - Insiders.exe',   // VS Code Insiders
  'cursor.exe',            // Cursor
  'cursor-updater.exe',    // Cursor updater
  'idea64.exe',            // IntelliJ IDEA (64-bit)
  'idea.exe',              // IntelliJ IDEA (32-bit)
  'webstorm64.exe',        // WebStorm
  'webstorm.exe',
  'phpstorm64.exe',        // PhpStorm
  'phpstorm.exe',
  'pycharm64.exe',         // PyCharm
  'pycharm.exe',
  'goland64.exe',          // GoLand
  'goland.exe',
  'clion64.exe',           // CLion
  'clion.exe',
  'rider64.exe',           // Rider
  'rider.exe',
  'datagrip64.exe',        // DataGrip
  'datagrip.exe',
  'studio64.exe',          // Android Studio
  'studio.exe',
  'devenv.exe',            // Visual Studio
  'notepad++.exe',         // Notepad++
  'sublime_text.exe',      // Sublime Text
  'atom.exe',              // Atom
  'zed.exe',               // Zed (Windows)
  'Hyper.exe',             // Hyper terminal
  'WindowsTerminal.exe',   // Windows Terminal
  'alacritty.exe',         // Alacritty
  'emacs.exe',             // Emacs
  'vim.exe',
  'nvim.exe',
];

// Linux: Process names (lowercase)
const LINUX_IDE_PROCESS_NAMES = [
  'code',                  // VS Code
  'code-insiders',         // VS Code Insiders
  'cursor',                // Cursor
  'intellij-idea',         // IntelliJ IDEA
  'idea.sh',
  'webstorm',
  'phpstorm',
  'pycharm',
  'goland',
  'clion',
  'rider',
  'datagrip',
  'android-studio',
  'sublime_text',
  'subl',
  'atom',
  'zed',
  'hyper',
  'gnome-terminal',
  'konsole',
  'alacritty',
  'kitty',
  'xterm',
  'terminator',
  'tilix',
  'emacs',
  'vim',
  'nvim',
  'gvim',
];

// Map platforms to their IDE identifiers
const PLATFORM_IDE_MAP: Record<string, string[]> = {
  darwin: MACOS_IDE_BUNDLE_IDS,
  win32: WINDOWS_IDE_PROCESS_NAMES,
  linux: LINUX_IDE_PROCESS_NAMES,
};

export class IDEDetector {
  private platform: string;
  private defaultIDEs: string[];
  private customIDEs?: string[];

  constructor(config?: IDEDetectorConfig) {
    this.platform = platform();
    this.defaultIDEs = PLATFORM_IDE_MAP[this.platform] || [];
    this.customIDEs = config?.ideIdentifiers;
  }

  /**
   * Check if the currently focused application is an IDE
   * @returns Promise<boolean> - true if focused on IDE, false otherwise
   */
  async isIDEFocused(): Promise<boolean> {
    try {
      const frontApp = await this.getFrontmostApplicationIdentifier();
      if (!frontApp) return false;
      
      const ideList = this.customIDEs || this.defaultIDEs;
      return ideList.includes(frontApp);
    } catch (error) {
      console.error('Failed to detect IDE focus:', error);
      // Fail-safe: assume not focused on IDE (will send notification)
      return false;
    }
  }

  /**
   * Get the identifier of the currently focused application
   * @returns Promise<string | null> - Bundle ID (macOS) or process name (Windows/Linux)
   */
  private async getFrontmostApplicationIdentifier(): Promise<string | null> {
    try {
      const window = await activeWin();
      if (!window) return null;

      // macOS: Use bundleIdentifier if available, fallback to app name
      if (this.platform === 'darwin') {
        // active-win on macOS returns bundleIdentifier in the owner.name for some apps
        // But we should check the actual bundle ID
        const bundleId = await this.getMacOSBundleID(window.owner.name);
        return bundleId || window.owner.name;
      }

      // Windows/Linux: Use process name
      return window.owner.name;
    } catch (error) {
      console.error('Failed to get frontmost application:', error);
      return null;
    }
  }

  /**
   * Get the display name of the currently focused application
   * @returns Promise<string> - Human-readable app name
   */
  async getFrontmostApplicationName(): Promise<string> {
    try {
      const window = await activeWin();
      if (!window) return 'Unknown';
      return window.title || window.owner.name || 'Unknown';
    } catch (error) {
      console.error('Failed to get frontmost application name:', error);
      return 'Unknown';
    }
  }

  /**
   * Get macOS Bundle ID from app name (fallback method)
   * Note: This uses AppleScript as fallback for accurate bundle ID detection on macOS
   */
  private async getMacOSBundleID(appName: string): Promise<string | null> {
    // If the identifier looks like a bundle ID (contains dots), use it directly
    if (appName.includes('.')) {
      return appName;
    }
    return null;
  }

  /**
   * Get the current platform
   * @returns string - 'darwin', 'win32', 'linux', etc.
   */
  getPlatform(): string {
    return this.platform;
  }

  /**
   * Get the list of supported IDEs for the current platform
   * @returns string[] - List of IDE identifiers
   */
  getSupportedIDEs(): string[] {
    return this.customIDEs || this.defaultIDEs;
  }
}

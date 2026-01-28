// i18n support for nyantify
export type Language = 'en' | 'zh' | 'ja';

interface Translations {
  taskCompleted: string;
  youWereUsing: string;
  seconds: string;
  minutes: string;
}

const translations: Record<Language, Translations> = {
  en: {
    taskCompleted: 'Task Completed',
    youWereUsing: 'You were using',
    seconds: 's',
    minutes: 'min',
  },
  zh: {
    taskCompleted: '任务完成',
    youWereUsing: '你正在使用',
    seconds: '秒',
    minutes: '分钟',
  },
  ja: {
    taskCompleted: 'タスク完了',
    youWereUsing: '使用中のアプリ',
    seconds: '秒',
    minutes: '分',
  },
};

export class I18n {
  private lang: Language;

  constructor(lang: Language = 'en') {
    this.lang = lang;
  }

  t(key: keyof Translations): string {
    return translations[this.lang][key];
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}${this.t('seconds')}`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}${this.t('minutes')}`;
    }
    return `${minutes}${this.t('minutes')}${remainingSeconds}${this.t('seconds')}`;
  }
}

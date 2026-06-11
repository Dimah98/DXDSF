// Імпортуємо вбудований модуль Node.js для роботи з файловою системою
import fs from 'fs';
// Імпортуємо вбудований модуль Node.js для обробки шляхів до файлів
import path from 'path';
// Імпортуємо активні сесії проектів з менеджера браузерів для перевірки статусу запуску
import { sessions } from '../browserManager';

export interface ScheduledRun {
  projectName: string;
  runAt: number;
  createdAt: number;
  source: string;
  randomOffset?: number; // Збережений випадковий зсув для interval
}

export interface ScheduleInfo {
  projectName: string;
  mode: string;
  nextRun: number | null;
  lastRun: number;
  settings: any;
  plannedRuns: ScheduledRun[];
}

export class SchedulerService {
  // Масив для збереження запланованих запусків
  private scheduledRuns: ScheduledRun[] = [];
  // Шлях до файлу збереження розкладу на диску
  private schedulePath: string;
  // Мапа для збереження часу останньої спроби запуску проекту (для уникнення занадто частих повторів при помилках)
  private lastAttemptTime: Map<string, number> = new Map();

  constructor(projectsDir: string) {
    // Встановлюємо шлях до файлу розкладу в папці проектів
    this.schedulePath = path.join(projectsDir, 'schedule.json');
    // Завантажуємо існуючий розклад з диска при ініціалізації
    this.load();
  }

  private load(): void {
    if (fs.existsSync(this.schedulePath)) {
      try {
        const data = fs.readFileSync(this.schedulePath, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed.scheduledRuns && Array.isArray(parsed.scheduledRuns)) {
          this.scheduledRuns = parsed.scheduledRuns;
        }
      } catch (err) {
        console.error('Помилка читання schedule.json:', err);
      }
    }
  }

  // Розраховує наступний час запуску на основі тижневого розкладу (днів тижня та часу)
  public getNextScheduleTime(scheduleTime: string, scheduleDays: number[]): number | null {
    // Якщо дні тижня не задані або масив порожній
    if (!scheduleDays || scheduleDays.length === 0) return null; // Повертаємо null
    // Парсимо години та хвилини розкладу з рядка типу "HH:MM"
    const [hours, minutes] = scheduleTime.split(':').map(Number); // Отримуємо числове значення
    // Створюємо об'єкт поточної дати та часу
    const now = new Date(); // Поточний час
    // Створюємо об'єкт дати для розрахунку цільового запуску
    const targetDate = new Date(now); // Копіюємо поточний час
    // Встановлюємо цільові години та хвилини для розрахунку
    targetDate.setHours(hours, minutes, 0, 0); // Обнуляємо секунди та мілісекунди
    // Проходимо по днях вперед (максимум на 8 днів для надійності)
    for (let i = 0; i < 8; i++) { // Лічильник днів
      // Перевіряємо чи цільовий час уже в майбутньому і чи цей день тижня є у списку запланованих
      if (targetDate.getTime() > now.getTime() && scheduleDays.includes(targetDate.getDay())) { // Умова відповідності
        // Повертаємо знайдений час наступного запуску у мілісекундах
        return targetDate.getTime(); // Успішно знайдено
      } // Кінець умови
      // Переходимо до наступного дня для перевірки
      targetDate.setDate(targetDate.getDate() + 1); // Збільшуємо дату на 1 день
    } // Кінець циклу
    // Якщо запуск не знайдено, повертаємо null
    return null; // Повернення за замовчуванням
  }

  // Розраховує останній запланований час запуску, який мав відбутися до поточного моменту
  public getLatestScheduleTime(scheduleTime: string, scheduleDays: number[]): number | null {
    // Якщо дні тижня не вказані, планування неможливе
    if (!scheduleDays || scheduleDays.length === 0) return null; // Повертаємо null
    // Парсимо години та хвилини з налаштувань часу
    const [hours, minutes] = scheduleTime.split(':').map(Number); // Перетворюємо у масив чисел
    // Фіксуємо поточний час
    const now = new Date(); // Поточна дата
    // Створюємо копію для обчислення дати запуску у минулому
    const targetDate = new Date(now); // Копія дати
    // Налаштовуємо цільові години та хвилини
    targetDate.setHours(hours, minutes, 0, 0); // Обнуляємо секунди
    // Перевіряємо дні тижня у зворотному напрямку (максимум на 8 днів назад)
    for (let i = 0; i < 8; i++) { // Цикл зворотної перевірки
      // Перевіряємо чи цей час уже настав (або настає зараз) та чи день тижня підходить
      if (targetDate.getTime() <= now.getTime() && scheduleDays.includes(targetDate.getDay())) { // Умова відповідності
        // Повертаємо часову мітку останнього планового запуску
        return targetDate.getTime(); // Знайдено мітку
      } // Кінець умови
      // Переходимо на один день назад
      targetDate.setDate(targetDate.getDate() - 1); // Зменшуємо дату на 1 день
    } // Кінець циклу
    // Якщо нічого не знайдено, повертаємо null
    return null; // Значення за замовчуванням
  }

  // Метод для перевірки та примусового перепланування запуску від ноди у разі помилки або виходу
  public checkAndRescheduleIfNeeded(projectName: string, projectsDir: string): void {
    // Шукаємо майбутні заплановані запуски цього проекту із джерелом 'node' (від ноди setNextRunNode)
    const futureNodeRun = this.scheduledRuns.find(r => r.projectName === projectName && r.source === 'node' && r.runAt > Date.now()); // Пошук у масиві
    // Якщо майбутній запуск вже запланований
    if (futureNodeRun) { // Перевірка знаходження
      // Завершуємо виконання методу, оскільки перепланування не потрібне
      return; // Вихід
    } // Кінець перевірки
    // Формуємо повний шлях до файлу конфігурації проекту
    const projectPath = path.join(projectsDir, `${projectName}.json`); // Об'єднання шляхів
    // Якщо файл проекту не знайдено на диску
    if (!fs.existsSync(projectPath)) { // Перевірка існування
      // Виходимо, оскільки неможливо прочитати проект
      return; // Вихід
    } // Кінець перевірки
    // Спроба прочитати та розпарсити файл проекту
    try { // Блок перехоплення помилок
      // Зчитуємо вміст файлу конфігурації проекту
      const projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8')); // Читання та парсинг
      // Якщо в проекті немає списку нод або він не є масивом
      if (!projectData.nodes || !Array.isArray(projectData.nodes)) { // Перевірка валідності нод
        // Завершуємо виконання
        return; // Вихід
      } // Кінець перевірки
      // Шукаємо ноду з типом 'setNextRunNode' у сценарії проекту
      const nextRunNode = projectData.nodes.find((n: any) => n.type === 'setNextRunNode'); // Пошук ноди
      // Якщо ноду не знайдено або в ній немає налаштувань
      if (!nextRunNode || !nextRunNode.data) { // Перевірка ноди
        // Виходимо, оскільки проект не передбачає планування від ноди
        return; // Вихід
      } // Кінець перевірки
      // Отримуємо режим планування: затримка або фіксований час (за замовчуванням 'delay')
      const mode = nextRunNode.data.scheduleMode || 'delay'; // Отримання режиму
      // Оголошуємо змінну для збереження майбутнього часу запуску
      let runAt: number; // Часова мітка
      // Якщо режим планування - відносна затримка
      if (mode === 'delay') { // Перевірка режиму затримки
        // Отримуємо значення затримки (число)
        const value = Number(nextRunNode.data.delayValue) || 1; // Числове значення
        // Отримуємо одиницю вимірювання затримки (години або хвилини)
        const unit = nextRunNode.data.delayUnit || 'hours'; // Одиниця затримки
        // Розраховуємо тривалість затримки в мілісекундах
        const delayMs = unit === 'hours' ? value * 3600000 : value * 60000; // Розрахунок мілісекунд
        // Встановлюємо час запуску як поточний час плюс затримка
        runAt = Date.now() + delayMs; // Розрахунок часу запуску
      // Якщо режим планування - запуск у конкретний час
      } else { // Інакше
        // Отримуємо цільовий час запуску (наприклад, "08:00")
        const targetTime = nextRunNode.data.targetTime || '08:00'; // Рядок часу
        // Розбираємо години та хвилини з налаштувань часу
        const [hours, minutes] = targetTime.split(':').map(Number); // Перетворення у числа
        // Фіксуємо поточний момент
        const now = new Date(); // Поточна дата
        // Копіюємо поточний момент для налаштування дати запуску
        const target = new Date(now); // Копія дати
        // Встановлюємо години, хвилини, секунди та мілісекунди для запуску
        target.setHours(hours, minutes, 0, 0); // Обнулення секунд
        // Якщо цільовий час на сьогодні вже минув
        if (target.getTime() <= now.getTime()) { // Порівняння часу
          // Переносимо запуск на наступний день (додаємо 1 день)
          target.setDate(target.getDate() + 1); // Додавання дня
        } // Кінець умови
        // Записуємо часову мітку цільового запуску
        runAt = target.getTime(); // Отримання мілісекунд
      } // Кінець умови режиму
      // Додаємо новий запланований запуск у планувальник з типом 'node' (програмний запуск)
      this.addScheduledRun(projectName, runAt, 'node'); // Додавання запуску
    } catch (err) { // Блок помилки
      // Виводимо повідомлення про помилку перепланування в консоль сервера
      console.error(`Scheduler error in checkAndRescheduleIfNeeded for ${projectName}:`, err); // Лог помилки
    } // Кінець блоку спроби
  }

  private save(): void {
    try {
      this.cleanupExpired();
      fs.writeFileSync(this.schedulePath, JSON.stringify({ scheduledRuns: this.scheduledRuns }, null, 2), 'utf-8');
    } catch (err) {
      console.error('Помилка збереження schedule.json:', err);
    }
  }

  public addScheduledRun(projectName: string, runAt: number, source: string, randomOffset?: number): void {
    // Видаляємо попередні програмні запуски для цього проекту з цього ж джерела
    this.scheduledRuns = this.scheduledRuns.filter(r => !(r.projectName === projectName && r.source === source));
    
    this.scheduledRuns.push({
      projectName,
      runAt,
      createdAt: Date.now(),
      source,
      randomOffset
    });
    this.save();
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const initialLength = this.scheduledRuns.length;
    // Видаляємо старі запуски, які прострочені більше ніж на 2 години
    this.scheduledRuns = this.scheduledRuns.filter(r => r.runAt >= now - 7200000);
    // Не зберігаємо тут, бо викликається зсередини save()
  }

  public removeScheduledRun(projectName: string, source: string = 'node'): void {
    const initialLength = this.scheduledRuns.length;
    this.scheduledRuns = this.scheduledRuns.filter(r => !(r.projectName === projectName && r.source === source));
    if (this.scheduledRuns.length !== initialLength) {
      this.save();
    }
  }

  public checkAndGetProjectsToRun(projectsDir: string): string[] {
    // Створюємо масив для повернення проектів, які готові до запуску
    const toRun: string[] = []; // Початковий пустий масив
    // Отримуємо поточний час у мілісекундах
    const now = Date.now(); // Поточна мітка
    // Створюємо змінну для списку файлів
    let files: string[] = []; // Список файлів
    
    // Спроба отримати перелік файлів у папці проектів
    try { // Блок перехоплення помилок
      // Зчитуємо вміст папки проектів синхронно
      files = fs.readdirSync(projectsDir); // Зчитування папки
    } catch (err) { // Блок помилки
      // Логуємо помилку читання папки проектів
      console.error('Scheduler: failed to read projects dir', err); // Виведення помилки
      // Повертаємо пустий масив
      return []; // Вихід
    } // Кінець блоку спроби

    // Цикл для перебору всіх знайдених файлів у папці проектів
    for (const file of files) { // Перебір файлів
      // Пропускаємо файли, які не є файлами конфігурації проектів (ігноруємо статистику, логи, конфігурацію розкладу чи сповіщень)
      if ( // Умова пропуску
        // Перевіряємо чи файл НЕ закінчується на .json
        !file.endsWith('.json') || // Перевірка розширення
        // Перевіряємо чи є файл статистикою проекту
        file.endsWith('_stats.json') || // Перевірка статистики
        // Перевіряємо чи є файл логами проекту
        file.endsWith('_logs.json') || // Перевірка логів
        // Перевіряємо чи є файл інвентарем проекту
        file.endsWith('_inventory.json') || // Перевірка інвентаря
        // Перевіряємо чи є файл глобальною базою розкладу
        file === 'schedule.json' || // Перевірка розкладу
        // Перевіряємо чи є файл глобальною базою сповіщень
        file === 'notifications.json' // Перевірка сповіщень
      ) { // Якщо умова виконується
        // Переходимо до наступного файлу в списку
        continue; // Перехід до наступної ітерації
      } // Кінець умови пропуску
      
      // Отримуємо ім'я проекту, видаляючи розширення файлу
      const projectName = file.replace('.json', ''); // Очищення імені
      // Формуємо повний шлях до файлу конфігурації проекту
      const projectPath = path.join(projectsDir, file); // Об'єднання шляхів
      
      // Створюємо змінну для збереження даних проекту
      let projectData: any; // Дані проекту
      // Спроба зчитати конфігурацію
      try { // Блок спроби
        // Зчитуємо та парсимо вміст файлу проекту
        projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8')); // Зчитування файлу
      } catch (err) { // Блок помилки
        // Переходимо до наступного файлу в разі помилки читання
        continue; // Пропуск проекту
      } // Кінець спроби
      
      // Ініціалізуємо прапорець запуску значенням false
      let shouldRun = false; // Прапорець запуску

      // Отримуємо налаштування запуску проекту
      const launchSettings = projectData.launchSettings; // Налаштування запуску

      // 1. Інтервальний запуск — тільки якщо launchSettings існує та mode === 'interval'
      if (launchSettings && launchSettings.mode === 'interval' && launchSettings.intervalValue > 0) { // Перевірка інтервального режиму
        // Отримуємо час останнього успішного запуску проекту
        const lastRun = this.getLastRunTime(projectName, projectsDir, projectData); // Останній запуск
        // Розраховуємо необхідну різницю в мілісекундах залежно від одиниці виміру інтервалу
        const requiredDiffMs = launchSettings.intervalUnit === 'hours' // Перевірка одиниці
          ? launchSettings.intervalValue * 3600000 // Години в мс
          : launchSettings.intervalValue * 60000; // Хвилини в мс
        
        // Розраховуємо плановий час наступного запуску
        let targetRunAt = lastRun + requiredDiffMs; // Розрахунок часу

        // Рандомізація інтервалу
        if (launchSettings.randomOffsetMinutes > 0) { // Перевірка наявності рандомізації
          // Шукаємо чи є збережений випадковий зсув для поточного інтервалу
          let savedRun = this.scheduledRuns.find(r => r.projectName === projectName && r.source === 'interval_random'); // Пошук
          
          // Якщо зсуву ще немає або він застарів (старший за 1 годину)
          if (!savedRun || savedRun.runAt < now - 3600000) { // Перевірка зсуву
            // Генеруємо випадковий зсув у заданих межах хвилин
            const offsetMs = (Math.random() * 2 - 1) * (launchSettings.randomOffsetMinutes * 60000); // Розрахунок зсуву
            // Визначаємо новий час запуску з урахуванням зсуву
            const newRunAt = targetRunAt + offsetMs; // Новий час
            // Додаємо випадковий запуск в список запланованих
            this.addScheduledRun(projectName, newRunAt, 'interval_random', offsetMs); // Збереження зсуву
            // Оновлюємо цільовий час запуску
            targetRunAt = newRunAt; // Оновлення часу
          } else { // Інакше
            // Використовуємо вже раніше розрахований час із збереженого зсуву
            targetRunAt = savedRun.runAt; // Застосування зсуву
          } // Кінець умови зсуву
        } // Кінець умови рандомізації

        // Перевіряємо, чи настав час запуску з урахуванням розрахованого інтервалу
        if (now >= targetRunAt) { // Перевірка настання часу
          // Отримуємо поточну активну сесію проекту
          const session = sessions.get(projectName); // Отримання сесії
          // Запускаємо лише якщо сесія відсутня або бот зараз НЕ працює
          if (!session || !session.isBotRunning) { // Перевірка стану роботи
            // Отримуємо час останньої спроби запуску з нашої локальної карти спроб
            const lastAttempt = this.lastAttemptTime.get(projectName) || 0; // Остання спроба
            // Перевіряємо чи минуло 5 хвилин з моменту останньої спроби
            if (now - lastAttempt >= 5 * 60 * 1000) { // Умова 5 хвилин
              // Дозволяємо запуск проекту
              shouldRun = true; // Зміна прапорця
              // Видаляємо тимчасовий випадковий зсув з бази розкладів
              this.removeScheduledRun(projectName, 'interval_random'); // Видалення зсуву
            } // Кінець умови 5 хвилин
          } // Кінець перевірки роботи
        } // Кінець перевірки настання часу
      } // Кінець перевірки інтервального режиму

      // 1.1 Тижневий запуск за розкладом — якщо mode === 'schedule' та є налаштування
      if (launchSettings && launchSettings.mode === 'schedule') { // Перевірка тижневого режиму
        // Отримуємо останній час успішного запуску проекту
        const lastRun = this.getLastRunTime(projectName, projectsDir, projectData); // Останній запуск
        // Отримуємо останній плановий час запуску, який мав відбутися
        const latestTime = this.getLatestScheduleTime(launchSettings.scheduleTime, launchSettings.scheduleDays); // Останній плановий
        // Якщо плановий час існує і проект ще не запускався для цього слоту
        if (latestTime !== null && lastRun < latestTime) { // Порівняння часу
          // Отримуємо поточну сесію проекту
          const session = sessions.get(projectName); // Отримання сесії
          // Якщо сесія відсутня або бот зараз не виконується
          if (!session || !session.isBotRunning) { // Перевірка стану
            // Отримуємо час останньої спроби запуску
            const lastAttempt = this.lastAttemptTime.get(projectName) || 0; // Остання спроба
            // Перевіряємо ліміт у 5 хвилин для уникнення циклічних збоїв
            if (now - lastAttempt >= 5 * 60 * 1000) { // Перевірка інтервалу
              // Дозволяємо запуск проекту
              shouldRun = true; // Встановлюємо прапорець
            } // Кінець умови інтервалу
          } // Кінець перевірки стану
        } // Кінець порівняння часу
      } // Кінець перевірки тижневого режиму

      // 2. Програмний запуск (від ноди setNextRunNode) — перевіряється для ВСІХ проектів
      // незалежно від launchSettings, бо нода може бути в будь-якому проекті
      const nodeRun = this.scheduledRuns.find(r => r.projectName === projectName && r.source === 'node'); // Пошук програмного запуску
      // Якщо програмний запуск знайдено і його запланований час уже настав або минув
      if (nodeRun && now >= nodeRun.runAt) { // Перевірка часу програмного запуску
        // Отримуємо поточну активну WebSocket сесію проекту з глобальної карти
        const session = sessions.get(projectName); // Отримання сесії
        // Запускаємо проект та видаляємо запис тільки якщо бот зараз НЕ виконується
        if (!session || !session.isBotRunning) { // Перевірка стану роботи
          // Отримуємо час останньої спроби запуску
          const lastAttempt = this.lastAttemptTime.get(projectName) || 0; // Остання спроба
          // Перевіряємо ліміт у 5 хвилин з моменту останньої спроби запуску
          if (now - lastAttempt >= 5 * 60 * 1000) { // Умова 5 хвилин
            // Дозволяємо запуск проекту
            shouldRun = true; // Зміна прапорця
            // Очищаємо програмний запуск з бази запланованих, оскільки він зараз виконається
            this.removeScheduledRun(projectName, 'node'); // Видалення розкладу ноди
          } // Кінець умови 5 хвилин
        } // Кінець перевірки роботи
      } // Кінець перевірки програмного запуску

      // Якщо запуск проекту схвалено за будь-яким з розкладів
      if (shouldRun) { // Перевірка прапорця
        // Записуємо час поточної спроби запуску проекту в мапу
        this.lastAttemptTime.set(projectName, now); // Збереження часу спроби
        // Додаємо назву проекту до списку проектів, які необхідно запустити
        toRun.push(projectName); // Додавання проекту
      } // Кінець перевірки прапорця
    } // Кінець циклу перебору файлів

    // Повертаємо список проектів до запуску
    return toRun; // Повернення результату
  }

  private getLastRunTime(projectName: string, projectsDir: string, projectData: any): number {
    const statPath = path.join(projectsDir, `${projectName}_stats.json`);
    let lastRun = projectData.updatedAt || 0;
    
    try {
      if (fs.existsSync(statPath)) {
        const statsContent = fs.readFileSync(statPath, 'utf-8');
        const stats = JSON.parse(statsContent);
        if (stats && stats.length > 0) {
          lastRun = stats[stats.length - 1].timestamp;
        }
      }
    } catch (err) {
      console.warn(`Scheduler: failed to read stats file for ${projectName}`);
    }
    return lastRun;
  }

  public getFullSchedule(projectsDir: string): ScheduleInfo[] {
    const schedule: ScheduleInfo[] = [];
    let files: string[] = [];
    
    try {
      files = fs.readdirSync(projectsDir);
    } catch (err) {
      return schedule;
    }

    for (const file of files) {
      // Пропускаємо файли, які не є проектами (ігноруємо статистику, логи, загальний розклад та сповіщення)
      if (
        // Перевіряємо чи файл НЕ має розширення .json
        !file.endsWith('.json') || 
        // Перевіряємо чи це файл статистичних даних проекту
        file.endsWith('_stats.json') || 
        // Перевіряємо чи це файл збереження логів проекту
        file.endsWith('_logs.json') || 
        // Перевіряємо чи це файл інвентаря проекту
        file.endsWith('_inventory.json') ||
        // Перевіряємо чи це файл розкладу
        file === 'schedule.json' || 
        // Перевіряємо чи це файл сповіщень
        file === 'notifications.json'
      ) {
        // Пропускаємо ітерацію для цього файлу
        continue;
      }
      
      const projectName = file.replace('.json', '');
      const projectPath = path.join(projectsDir, file);
      
      let projectData: any;
      try {
        projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
      } catch (err) {
        continue;
      }
      
      const launchSettings = projectData.launchSettings || { mode: 'none' };
      const lastRun = this.getLastRunTime(projectName, projectsDir, projectData);
      
      let nextRun: number | null = null;
      
      if (launchSettings.mode === 'interval' && launchSettings.intervalValue > 0) {
        const requiredDiffMs = launchSettings.intervalUnit === 'hours' 
          ? launchSettings.intervalValue * 3600000 
          : launchSettings.intervalValue * 60000;
        
        nextRun = lastRun + requiredDiffMs;
        
        if (launchSettings.randomOffsetMinutes > 0) {
          const savedRun = this.scheduledRuns.find(r => r.projectName === projectName && r.source === 'interval_random');
          if (savedRun) {
            nextRun = savedRun.runAt;
          }
        }
      // Якщо режим тижневого розкладу і задані час та дні тижня
      } else if (launchSettings.mode === 'schedule' && launchSettings.scheduleTime && launchSettings.scheduleDays) { // Перевірка
        // Розраховуємо наступний час запланованого запуску
        nextRun = this.getNextScheduleTime(launchSettings.scheduleTime, launchSettings.scheduleDays); // Отримання мітки
      }

      // Додаємо програмні запуски
      const plannedRuns = this.scheduledRuns.filter(r => r.projectName === projectName && r.source === 'node');

      schedule.push({
        projectName,
        mode: launchSettings.mode,
        nextRun,
        lastRun,
        settings: launchSettings,
        plannedRuns
      });
    }

    return schedule;
  }
}

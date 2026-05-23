import PrettyMilliseconds from "pretty-ms";
import ReadingProgress from "./main";
import { ReadingTimeFormat } from "./settings";

export function readingTimeText(text: string, plugin: ReadingProgress) {
  // подсчёт символов (по умолчанию JS .length — количество UTF-16 code units)
  const charCount = text.replace(/[\s\p{P}]+/gu, "").length;


  // скорость чтения в словах в минуту (из настроек)
  const wordsPerMinute = plugin.settings.readingSpeed || 200;

  // требование: делить не на wpm, а на wpm * 5
  const charsPerMinute = wordsPerMinute * 5;

  // минуты (в дробном виде)
  const minutesFloat = charsPerMinute > 0 ? charCount / charsPerMinute : 0;

  // миллисекунды для pretty-ms
  const timeMs = Math.round(minutesFloat * 60 * 1000);
  
  if (timeMs < 60_000) {
  return plugin.settings.appendText
    ? `0 min ${plugin.settings.appendText}`
    : `0 min`;
}

  // целые минуты для компактного формата (аналогично result.minutes)
  const minutes = Math.ceil(minutesFloat);

  let options: PrettyMilliseconds.Options = { secondsDecimalDigits: 0 };

  switch (plugin.settings.format) {
    case ReadingTimeFormat.Simple:
      break;
    case ReadingTimeFormat.Default: // 🔁 swapped: now behaves like old Compact
      if (timeMs > 3600000) {
        options = { ...options, unitCount: 2 };
      } else {
        options = { ...options, compact: true };
      }
      break;
    case ReadingTimeFormat.Verbose:
      options = { ...options, verbose: true };
      break;
    case ReadingTimeFormat.Digital:
      options = { ...options, colonNotation: true };
      break;
    case ReadingTimeFormat.Compact: // 🔁 swapped: now behaves like old Default
    default:
      return plugin.settings.appendText
        ? `${minutes} min left`
        : `${minutes} min`;
  }

  const output = PrettyMilliseconds(timeMs, options);
  return plugin.settings.appendText
    ? `${output} ${plugin.settings.appendText}`
    : output;
}

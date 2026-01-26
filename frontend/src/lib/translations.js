import dayjs from "dayjs";
import "dayjs/locale/ru";
import relativeTime from "dayjs/plugin/relativeTime";
import calendar from "dayjs/plugin/calendar";
import { Streami18n } from "stream-chat-react";

dayjs.extend(relativeTime);
dayjs.extend(calendar);
dayjs.locale("ru");

const russianTranslations = {
  "Last seen just now": "Только что",
  "Last seen": "Был(а)",
  "at": "в",
  "{{ timestamp }}": "{{ timestamp }}",
};

export const i18nInstance = new Streami18n({
  language: "ru",
  translationsForLanguage: russianTranslations,
  dayjsLocaleConfigForLanguage: {
    calendar: {
      lastDay: "[вчера в] LT",
      sameDay: "[сегодня в] LT",
      nextDay: "[завтра в] LT",
      lastWeek: "dddd [в] LT",
      nextWeek: "dddd [в] LT",
      sameElse: "L [в] LT",
    },
    relativeTime: {
      future: "через %s",
      past: "%s назад",
      s: "несколько секунд",
      m: "минуту",
      mm: "%d минут",
      h: "час",
      hh: "%d часов",
      d: "день",
      dd: "%d дней",
      M: "месяц",
      MM: "%d месяцев",
      y: "год",
      yy: "%d лет",
    },
  },
  DateTimeParser: (input) => dayjs(input).locale("ru"),
});
